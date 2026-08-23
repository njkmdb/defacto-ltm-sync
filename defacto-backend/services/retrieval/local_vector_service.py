import logging
import math
from datetime import date
from sqlalchemy.orm import Session
from database.models import EventMemory

logger = logging.getLogger(__name__)

class LocalVectorRetrievalService:
    def __init__(self, db: Session):
        self.db = db

    def search_tier_1_cache(self, query_embedding: list, base_entity_id: int = None, target_entity_id: int = 0, target_object_id: int = 0, top_k: int = 1, distance_threshold: float = 0.15):
        query = self.db.query(
            EventMemory, 
            EventMemory.embedding.cosine_distance(query_embedding).label("distance")
        ).filter(EventMemory.memory_type == 'CACHE')

        if base_entity_id is not None:
            query = query.filter(EventMemory.base_entity_id == base_entity_id)
        if target_entity_id != 0:
            query = query.filter(EventMemory.target_entity_id == target_entity_id)
        if target_object_id != 0:
            query = query.filter(EventMemory.target_object_id == target_object_id)
            
        result = query.filter(EventMemory.embedding.cosine_distance(query_embedding) <= distance_threshold)\
                      .order_by("distance").limit(top_k).first()
        
        if result:
            logger.info(f"⚡ [Cache Hit] Tier 1 캐시 적중! (Distance: {result.distance:.4f})")
            memory_obj = result.EventMemory
            return [{
                "memory_id": memory_obj.memory_id,
                "content_text": memory_obj.content_text,
                "core_keywords": memory_obj.core_keywords or [],
                "source_event_ids": memory_obj.source_event_ids or [],
                "base_distance": float(result.distance),
                "adjusted_distance": float(result.distance),
                "distance": float(result.distance)
            }]
            
        return []

    def search_tier_2_ltm(self, query_embedding: list, reference_date: date, base_entity_id: int = None, target_entity_id: int = 0, target_object_id: int = 0, top_k: int = 3, distance_threshold: float = 0.3):
        query = self.db.query(
            EventMemory, 
            EventMemory.embedding.cosine_distance(query_embedding).label("distance")
        ).filter(EventMemory.memory_type == 'LTM')
        
        if reference_date:
            query = query.filter(EventMemory.event_date < reference_date)

        if base_entity_id is not None:
            query = query.filter(EventMemory.base_entity_id == base_entity_id)
        if target_entity_id != 0:
            query = query.filter(EventMemory.target_entity_id == target_entity_id)
        if target_object_id != 0:
            query = query.filter(EventMemory.target_object_id == target_object_id)
            
        results = query.order_by("distance").limit(top_k * 3).all()
        
        if not results:
            return [], 1.0
            
        # 💡 [결함 수정] 라우팅 기준이 될 best_distance는 시간 감쇠 패널티 적용 전의 순수 최상위 시맨틱 거리로 산정
        best_base_distance = float(results[0].distance)

        reranked_results = []
        for row in results:
            base_distance = float(row.distance)
            days_diff = (reference_date - row.EventMemory.event_date).days if reference_date else 0
            days_diff = max(0, days_diff)
            
            penalty = math.log1p(days_diff) * 0.02
            adjusted_distance = base_distance + penalty
            reranked_results.append((row, adjusted_distance))
            
        reranked_results.sort(key=lambda x: x[1])
        final_results = reranked_results[:top_k]
        
        memories = []
        
        for row, adj_dist in final_results:
            memory_obj = row.EventMemory
            memories.append({
                "memory_id": memory_obj.memory_id,
                "content_text": memory_obj.content_text,
                "core_keywords": memory_obj.core_keywords or [],
                "source_event_ids": memory_obj.source_event_ids or [],
                "base_distance": float(row.distance),
                "adjusted_distance": adj_dist,
                "distance": adj_dist
            })
            
        logger.info(f"로컬 LTM 검색 및 재정렬 완료: {len(memories)}건 발견 (최고 순수 유사도: {best_base_distance:.4f})")
        return memories, best_base_distance

    def save_to_tier_1_cache(self, content_text: str, embedding: list, event_date: date, source_event_ids: list, core_keywords: list, base_entity_id: int = 0, target_entity_id: int = 0, target_object_id: int = 0):
        new_cache = EventMemory(
            base_entity_id=base_entity_id,
            target_entity_id=target_entity_id,
            target_object_id=target_object_id,
            event_date=event_date,
            memory_type='CACHE', 
            content_text=content_text,
            core_keywords=core_keywords,
            source_event_ids=source_event_ids,
            embedding=embedding 
        )
        self.db.add(new_cache)
        self.db.commit()
        return new_cache