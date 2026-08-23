import { PaginationMeta } from './common';

export interface PromptItem {
  prompt_id: number;
  target_type: string;
  target_value: string;
  pipeline_step: string;
  schema_name: string;
  system_prompt: string;
  temperature: number; 
  max_length: number; // 💡
  is_active: boolean;
  up_ts: string;
  ne_ts: string;
}

export interface PromptListResponse {
  status: string;
  data: PromptItem[];
  meta: PaginationMeta;
}

export interface SavePromptRequest {
  target_type: string;
  target_value: string;
  pipeline_step: string;
  schema_name: string;
  system_prompt: string;
  temperature: number; 
  max_length: number; // 💡
  is_active: boolean;
}