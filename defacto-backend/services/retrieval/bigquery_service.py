import os
import json
import logging
from datetime import date
from google.cloud import bigquery

logger = logging.getLogger(__name__)

class BigQueryRetrievalService:
    def __init__(self):
        self.bq_client = bigquery.Client(project=os.getenv("GCP_PROJECT_ID"))

    def search_tier_3_dwh(self, query_embedding: list, reference_date: date, base_entity_id: int = None, target_entity_id: int = 0, target_object_id: int = 0, top_k: int = 5):
        project_id = os.getenv("GCP_PROJECT_ID")
        dataset_id = "defacto_dwh"
        # 💡 [스키마 변경 대응] core_dim_memory_index -> core_event_memories
        table_id = "core_event_memories" 
        
        where_clauses = []
        query_parameters = [
            bigquery.ArrayQueryParameter("query_vector", "FLOAT64", query_embedding),
            bigquery.ScalarQueryParameter("top_k", "INT64", top_k),
        ]

        if reference_date:
            where_clauses.append("base.event_date < @reference_date")
            query_parameters.append(bigquery.ScalarQueryParameter("reference_date", "DATE", reference_date))

        if base_entity_id is not None:
            where_clauses.append("base.base_entity_id = @base_entity_id")
            query_parameters.append(bigquery.ScalarQueryParameter("base_entity_id", "INT64", base_entity_id))
        if target_entity_id != 0:
            where_clauses.append("base.target_entity_id = @target_entity_id")
            query_parameters.append(bigquery.ScalarQueryParameter("target_entity_id", "INT64", target_entity_id))
        if target_object_id != 0:
            where_clauses.append("base.target_object_id = @target_object_id")
            query_parameters.append(bigquery.ScalarQueryParameter("target_object_id", "INT64", target_object_id))

        where_clause = "WHERE " + " AND ".join(where_clauses) if where_clauses else ""
        
        query = f"""
            SELECT base.memory_id, base.content_text, base.source_event_ids, base.core_keywords, distance
            FROM VECTOR_SEARCH(
                TABLE `{project_id}.{dataset_id}.{table_id}`,
                'embedding',
                (SELECT @query_vector AS embedding),
                top_k => @top_k,
                distance_type => 'COSINE'
            )
            {where_clause}
        """
        
        job_config = bigquery.QueryJobConfig(query_parameters=query_parameters)
        
        try:
            query_job = self.bq_client.query(query, job_config=job_config)
            results = query_job.result()
            
            memories = []
            for row in results:
                s_ids = row.get("source_event_ids", [])
                if isinstance(s_ids, str):
                    try: s_ids = json.loads(s_ids)
                    except: s_ids = []
                    
                kws = row.get("core_keywords", [])
                if isinstance(kws, str):
                    try: kws = json.loads(kws)
                    except: kws = []

                memories.append({
                    "memory_id": row["memory_id"],
                    "content_text": row["content_text"],
                    "core_keywords": kws,
                    "source_event_ids": s_ids,
                    "base_distance": row["distance"],
                    "adjusted_distance": row["distance"],
                    "distance": row["distance"]
                })
            
            logger.info(f"BigQuery Vector Search 성공: {len(memories)}건 발견")
            return memories
        except Exception as e:
            logger.error(f"BigQuery Vector Search 실패: {e}")
            return []