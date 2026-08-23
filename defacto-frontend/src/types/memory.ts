import { PaginationMeta } from './common';

export interface MemorySearchRequest {
  query_text: string;
  page?: number;
  limit?: number;
  distance_threshold?: number;
  base_entity_id?: number | null;
  search_conditions?: string | null;
  include_dwh?: boolean;
}

export interface MemorySearchResultItem {
  memory_id: number;
  base_entity_id: number;
  event_date: string;
  memory_type: string;
  content_text: string;
  core_keywords: string[];
  source_event_ids: number[];
  distance: number;
}

export interface MemorySearchResponse {
  status: string;
  data: MemorySearchResultItem[];
  meta: PaginationMeta;
}

export interface GenerateBriefingRequest {
  query_text: string;
  selected_memory_ids: number[];
  base_entity_id: number;
}

export interface EventBriefingData {
  executive_summary: string;
  key_findings: string[];
  risk_and_warnings: string[];
  recommended_actions: string[];
}

export interface SaveBriefingRequest {
  base_entity_id: number;
  query_text: string;
  executive_summary: string;
  key_findings: string[];
  risk_and_warnings: string[];
  recommended_actions: string[];
  source_memory_ids: number[];
}

export interface BriefingItem {
  briefing_id: number;
  base_entity_id: number;
  query_text: string;
  executive_summary: string;
  key_findings: string[];
  risk_and_warnings: string[];
  recommended_actions: string[];
  source_memory_ids: number[];
  up_ts: string;
  ne_ts: string;
}

export interface BriefingListResponse {
  status: string;
  data: BriefingItem[];
  meta: PaginationMeta;
}

export interface AuditMemoryItem {
  memory_id: number;
  content_text: string;
  event_date: string;
  source_event_ids: number[];
}

export interface BriefingAuditTrailResponse {
  status: string;
  data: AuditMemoryItem[];
}