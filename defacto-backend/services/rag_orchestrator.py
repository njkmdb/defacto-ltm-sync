import json
import logging
import math
from datetime import date
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, cast, String
from database.models import EventMemory
from services.retrieval.local_vector_service import LocalVectorRetrievalService
from services.retrieval.bigquery_service import BigQueryRetrievalService

logger = logging.getLogger(__name__)

class RagOrchestrator:
    def __init__(self, db: Session):
        self.db = db
        self.local_retriever = LocalVectorRetrievalService(db)
        self.bq_retriever = BigQueryRetrievalService()

    def _execute_routing_pipeline(self, query_embedding: list, reference_date: date, base_entity_id: int = None, target_entity_id: int = 0, target_object_id: int = 0):
        cache_results = self.local_retriever.search_tier_1_cache(
            query_embedding, base_entity_id, target_entity_id, target_object_id
        )
        if cache_results:
            return cache_results

        local_results, best_distance = self.local_retriever.search_tier_2_ltm(
            query_embedding, reference_date, base_entity_id, target_entity_id, target_object_id
        )
        
        if not local_results or best_distance > 0.3:
            bq_results = self.bq_retriever.search_tier_3_dwh(
                query_embedding, reference_date, base_entity_id, target_entity_id, target_object_id
            )
            if bq_results:
                best_match = bq_results[0]
                self.local_retriever.save_to_tier_1_cache(
                    content_text=best_match["content_text"], 
                    embedding=query_embedding,
                    event_date=reference_date,
                    source_event_ids=best_match["source_event_ids"],
                    core_keywords=best_match["core_keywords"],
                    base_entity_id=base_entity_id or 0,
                    target_entity_id=target_entity_id,
                    target_object_id=target_object_id
                )
                return bq_results
        
        return local_results

    def get_optimal_context(self, base_entity_id: int, query_embedding: list, reference_date: date, target_entity_id: int = 0, target_object_id: int = 0) -> dict:
        track1_results = []
        if target_entity_id != 0 or target_object_id != 0:
            track1_results = self._execute_routing_pipeline(
                query_embedding, reference_date, base_entity_id, target_entity_id, target_object_id
            )

        # 💡 [치명적 보안 결함 수정] Track 2 (Cross-Target Search)에서도 테넌트 방어막(base_entity_id) 강제 유지
        # 타사 기밀 메모리의 벡터 검색 노출을 원천적으로 차단합니다.
        track2_results = self._execute_routing_pipeline(
            query_embedding, 
            reference_date=reference_date, 
            base_entity_id=base_entity_id, 
            target_entity_id=0, 
            target_object_id=0
        )

        def get_mem_id(item):
            return item.get("memory_id") if isinstance(item, dict) else item.memory_id
            
        track1_ids = {get_mem_id(item) for item in track1_results}
        filtered_track2 = [item for item in track2_results if get_mem_id(item) not in track1_ids]

        return {
            "track1": track1_results,
            "track2": filtered_track2
        }

    def explore_memories(self, query_embedding: list, page: int = 1, limit: int = 20, distance_threshold: float = 1.0, base_entity_id: int = None, search_conditions: str = None, include_dwh: bool = False):
        query = self.db.query(
            EventMemory, 
            EventMemory.embedding.cosine_distance(query_embedding).label("distance")
        )
        
        if base_entity_id is not None:
            query = query.filter(EventMemory.base_entity_id == base_entity_id)
            
        if search_conditions:
            try:
                conds = json.loads(search_conditions)
                if conds and isinstance(conds, list):
                    def build_cond(target, kw):
                        kw = kw.strip()
                        if target == 'CONTENT': return EventMemory.content_text.ilike(f"%{kw}%")
                        elif target == 'KEYWORDS': return cast(EventMemory.core_keywords, String).ilike(f"%{kw}%")
                        return None

                    combined_expr = None
                    for c in conds:
                        kw = c.get('keyword', '')
                        if not kw.strip(): continue
                        expr = build_cond(c.get('target'), kw)
                        if expr is not None:
                            if combined_expr is None: 
                                combined_expr = expr
                            else:
                                op = c.get('operator', 'AND')
                                if op == 'OR': 
                                    combined_expr = or_(combined_expr, expr)
                                else: 
                                    combined_expr = and_(combined_expr, expr)
                    
                    if combined_expr is not None:
                        query = query.filter(combined_expr)
            except Exception as e:
                logger.error(f"다중 검색 파싱 오류 (Memory Explorer): {e}")

        query = query.filter(EventMemory.embedding.cosine_distance(query_embedding) <= distance_threshold)
        
        total_count = query.count()
        total_pages = math.ceil(total_count / limit) if total_count > 0 else 1
        offset = (page - 1) * limit
        
        results = query.order_by("distance").offset(offset).limit(limit).all()
        
        memories = []
        for row in results:
            memory_obj = row.EventMemory
            memories.append({
                "memory_id": memory_obj.memory_id,
                "base_entity_id": memory_obj.base_entity_id,
                "event_date": memory_obj.event_date,
                "memory_type": memory_obj.memory_type,
                "content_text": memory_obj.content_text,
                "core_keywords": memory_obj.core_keywords or [],
                "source_event_ids": memory_obj.source_event_ids or [],
                "base_distance": float(row.distance),
                "adjusted_distance": float(row.distance), 
                "distance": float(row.distance)
            })
            
        if include_dwh:
            try:
                bq_results = self.bq_retriever.search_tier_3_dwh(
                    query_embedding=query_embedding,
                    reference_date=None,
                    base_entity_id=base_entity_id,
                    top_k=limit 
                )
                
                valid_bq_results = [m for m in bq_results if m["distance"] <= distance_threshold]
                
                if valid_bq_results:
                    memories.extend(valid_bq_results)
                    memories = sorted(memories, key=lambda x: x["distance"])
                    memories = memories[:limit]
                    logger.info(f"☁️ BigQuery DWH 결과 {len(valid_bq_results)}건 병합 완료")
            except Exception as e:
                logger.error(f"DWH 병합 검색 실패: {e}")

        logger.info(f"🔍 Memory Explorer 검색 완료: 총 {len(memories)}건 반환")
        return memories, {"total_count": total_count, "current_page": page, "total_pages": total_pages, "limit": limit}