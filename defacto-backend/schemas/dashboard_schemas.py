from datetime import date
from pydantic import BaseModel
from typing import List

class DailyStat(BaseModel):
    date: date
    total_count: int
    success_count: int
    failed_count: int

class ExtSyncStat(BaseModel):
    date: date
    records_fetched: int

class DashboardStatsData(BaseModel):
    daily_pipeline_stats: List[DailyStat]
    ext_sync_stats: List[ExtSyncStat]
    total_memories: int
    total_entities: int

class DashboardStatisticsResponse(BaseModel):
    status: str
    data: DashboardStatsData

class CostStat(BaseModel):
    tokens: int
    cost: float

class KeywordStat(BaseModel):
    text: str
    count: int

class RagStat(BaseModel):
    cache: int
    ltm: int
    dwh: int

class RiskAlert(BaseModel):
    entity_id: int
    message: str
    timestamp: str

class SystemInsightsData(BaseModel):
    cost_stat: CostStat
    hot_keywords: List[KeywordStat]
    rag_stat: RagStat
    risk_alerts: List[RiskAlert]

class SystemInsightsResponse(BaseModel):
    status: str
    data: SystemInsightsData