import { PaginationMeta } from './common';

export interface SourceItem {
  source_type: 'LOG' | 'BRIEFING' | 'CREATION';
  source_id: number;
}

export interface GenerateCreativeRequest {
  sources: SourceItem[]; 
  system_instruction: string;
  temperature: number; 
  max_length: number; 
}

export interface GenerateMetaPromptRequest {
  user_intent: string;
}

export interface SaveCreativeRequest {
  sources: SourceItem[];
  base_entity_id: number;
  tone_name: string;
  creative_title: string;
  creative_content: string;
}

export interface EventCreationItem {
  creation_id: number;
  sources: SourceItem[];
  base_entity_id: number;
  tone_name: string;
  creative_title: string;
  creative_content: string;
  ne_ts: string;
}

export interface EventCreationListResponse {
  status: string;
  data: EventCreationItem[];
  meta: PaginationMeta;
}