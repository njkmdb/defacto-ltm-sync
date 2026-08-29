import { PaginationMeta } from './common';

export interface PipelineStep {
  step_id: string;
  step_order: number;
  module_name: string;
  params: Record<string, any>;
  output_key: string;
}

export interface PipelinePresetItem {
  pipeline_id: string;
  pipeline_name: string;
  description?: string | null;
  config_json: PipelineStep[];
  is_active: boolean;
  up_ts: string;
  ne_ts: string;
}

export interface PipelinePresetListResponse {
  status: string;
  data: PipelinePresetItem[];
  meta: PaginationMeta;
}

export interface CreatePipelinePresetRequest {
  pipeline_id: string;
  pipeline_name: string;
  description?: string | null;
  config_json: PipelineStep[];
  is_active: boolean;
}

export interface UpdatePipelinePresetRequest {
  pipeline_name: string;
  description?: string | null;
  config_json: PipelineStep[];
  is_active: boolean;
}

export interface PipelineExecutionRequest {
  pipeline_id?: string | null;
  base_entity_id: number;
  initial_context: Record<string, any>;
  steps: PipelineStep[];
}

export interface PipelineExecutionResponse {
  status: string;
  final_state: Record<string, any>;
}