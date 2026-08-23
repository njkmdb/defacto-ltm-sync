import { ActionItem, PaginationMeta } from './common';

export interface StructureEventsRequest {
  base_entity_id: number;
  target_raw_ids: number[];
  schema_name: string;
  retry_failed?: boolean;
}

export interface StructureEventResult {
  raw_id: number;
  sync_status_id: number;
  event_id?: number | null;
  error_reason?: string | null;
}

export interface StructureEventsResponse {
  status: string;
  message: string;
  results: StructureEventResult[];
}

export interface RawDataStatus {
  raw_id: number;
  sync_status_id: number;
  event_date: string;
  raw_content: string;
  error_log?: string | null;
}

export interface PipelineStatusResponse {
  total_count: number;
  success_count: number;
  failed_count: number;
  pending_count: number;
  data_list: RawDataStatus[];
  meta: PaginationMeta;
}

export interface SynthesizeContextRequest {
  base_entity_id: number;
  reference_date: string; 
  schema_name: string;
  use_deep_search?: boolean;
}

export interface SynthesizedData {
  llm_summary: string;
  action_items: ActionItem[];
}

export interface RagMetrics {
  cache_hit: boolean;
  memory_type_used: string;
}

export interface SynthesizeContextData {
  log_id: number;
  synthesized_data: SynthesizedData;
  rag_metrics: RagMetrics;
}

export interface SynthesizeContextResponse {
  status: string;
  data: SynthesizeContextData;
}

export interface SaveSummaryRequest {
  base_entity_id: number;
  reference_date: string;
  edited_summary: string;
  action_items: ActionItem[];
  schema_name?: string; 
}