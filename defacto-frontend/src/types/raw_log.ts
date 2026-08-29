export interface RawEventStatusResponse {
  raw_id: number;
  sync_status_id: number;
  error_log?: string | null;
}

export interface CreateRawEventRequest {
  base_entity_id: number;
  event_date: string; 
  raw_content: string;
  run_pipeline_now: boolean;
  schema_name: string;
}

export interface UpdateRawEventRequest {
  raw_content: string;
  run_pipeline_now: boolean;
  schema_name: string;
}

export interface RawEventResponse {
  status: string;
  message: string;
  raw_id?: number | null;
}