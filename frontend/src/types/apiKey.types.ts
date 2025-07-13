export interface ApiKey {
  id: number;
  name: string;
  key_prefix: string;
  can_manage: boolean;
  can_call_assistant: boolean;
  is_disabled: boolean;
  created_by?: string;
  last_used_at?: string;
  expires_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ApiKeyCreate {
  name: string;
  can_manage?: boolean;
  can_call_assistant?: boolean;
  is_disabled?: boolean;
  expires_at?: string;
  assistant_ids?: number[];
}

export interface ApiKeyUpdate {
  name?: string;
  can_manage?: boolean;
  can_call_assistant?: boolean;
  is_disabled?: boolean;
  expires_at?: string;
  assistant_ids?: number[];
}

export interface ApiKeyWithSecret extends ApiKey {
  api_key: string;
}

export interface ApiKeyStats {
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  last_used_at?: string;
  most_used_endpoint?: string;
  most_used_assistant?: string;
}

export interface ApiKeyUsageLog {
  id: number;
  api_key_id: number;
  endpoint: string;
  assistant_id?: number;
  assistant_name?: string;
  ip_address?: string;
  user_agent?: string;
  request_size?: number;
  response_size?: number;
  status_code: number;
  error_message?: string;
  created_at: string;
}

export interface ApiKeyAssistant {
  id: number;
  name: string;
  description?: string;
  type: string;
  enabled: boolean;
  bound_at: string;
}
