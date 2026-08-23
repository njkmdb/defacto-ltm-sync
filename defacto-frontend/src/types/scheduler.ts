export interface BulkSynthesizeResponse {
  job_id: string;
  total_count: number;
}

export interface BatchJobStatusResponse {
  job_id: string;
  status: string;
  total_count: number;
  current_count: number;
  error_log?: string | null;
}

export interface ExtSyncHistoryItem {
  sync_id: number;
  sync_type: string;
  status: string;
  records_fetched: number;
  error_message?: string | null;
  start_ts: string;
  end_ts?: string | null;
  up_ts: string;
  ne_ts: string;
}