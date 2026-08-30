export interface PaginationMeta {
  total_count: number;
  current_page: number;
  total_pages: number;
  limit: number;
}

export interface ActionItem {
  task: string;
  status_id: number; 
  due_date: string;  
}

export interface SaveSummaryResponse {
  status: string;
  message: string;
}

export interface MediaUploadResponse {
  status: string;
  message: string;
  source_id: number;
  file_url: string;
}

export interface SystemConfigResponse {
  status: string;
  use_bigquery: boolean;
}