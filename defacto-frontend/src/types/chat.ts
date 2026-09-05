export interface ChatRequest {
  session_id: string;
  user_message: string;
  base_entity_id?: number;
}

export interface GuideBotResponse {
  answer: string;
  action_code: 'NONE' | 'NAVIGATE' | 'HIGHLIGHT';
  target_menu: 'NONE' | 'DASHBOARD' | 'BUILDER' | 'ARCHIVE' | 'DOMAIN' | 'MEMORY' | 'STUDIO' | 'SYSTEM';
}

export interface ChatApiResponse {
  status: string;
  data: GuideBotResponse;
}