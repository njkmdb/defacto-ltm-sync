export interface DailyStat {
  date: string;
  total_count: number;
  success_count: number;
  failed_count: number;
}

export interface ExtSyncStat {
  date: string;
  records_fetched: number;
}

export interface DashboardStatsData {
  daily_pipeline_stats: DailyStat[];
  ext_sync_stats: ExtSyncStat[];
  total_memories: number;
  total_entities: number;
}

export interface DashboardStatisticsResponse {
  status: string;
  data: DashboardStatsData;
}

export interface CostStat {
  tokens: number;
  cost: number;
}

export interface KeywordStat {
  text: string;
  count: number;
}

export interface RagStat {
  cache: number;
  ltm: number;
  dwh: number;
}

export interface RiskAlert {
  entity_id: number;
  message: string;
  timestamp: string;
}

export interface SystemInsightsData {
  cost_stat: CostStat;
  hot_keywords: KeywordStat[];
  rag_stat: RagStat;
  risk_alerts: RiskAlert[];
}

export interface SystemInsightsResponse {
  status: string;
  data: SystemInsightsData;
}