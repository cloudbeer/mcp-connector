// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  total?: number;
}

// API Key Types
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

export interface ApiKeyWithSecret extends ApiKey {
  api_key: string;
}

export interface CreateApiKeyRequest {
  name: string;
  can_manage?: boolean;
  can_call_assistant?: boolean;
  is_disabled?: boolean;
  expires_at?: string;
  assistant_ids?: number[];
}

export interface UpdateApiKeyRequest {
  name?: string;
  can_manage?: boolean;
  can_call_assistant?: boolean;
  is_disabled?: boolean;
  expires_at?: string;
  assistant_ids?: number[];
}

// MCP Tool Types
export type ConnectionType = 'stdio' | 'http' | 'sse';

// export interface ServerGroupInfo {
//   id: number;
//   name: string;
//   description?: string;
//   max_tools: number;
// }

export interface McpTool {
  id: number;
  name: string;
  description?: string;
  connection_type: ConnectionType;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
  timeout: number;
  retry_count: number;
  retry_delay: number;
  disabled: boolean;
  auto_approve?: string[];
  enabled: boolean;
  created_at: string;
  updated_at: string;
  // groups?: ServerGroupInfo[];
}

export interface CreateMcpToolRequest {
  name: string;
  description?: string;
  connection_type: ConnectionType;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
  timeout?: number;
  retry_count?: number;
  retry_delay?: number;
  disabled?: boolean;
  auto_approve?: string[];
  enabled?: boolean;
  // group_id?: number;
}

export interface UpdateMcpToolRequest {
  name?: string;
  description?: string;
  connection_type?: ConnectionType;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
  timeout?: number;
  retry_count?: number;
  retry_delay?: number;
  disabled?: boolean;
  auto_approve?: string[];
  enabled?: boolean;
  // group_id?: number;
}


// Server Group Types
// export interface ServerGroup {
//   id: number;
//   name: string;
//   description?: string;
//   max_tools: number;
//   created_at: string;
//   updated_at: string;
// }

// export interface CreateServerGroupRequest {
//   name: string;
//   description?: string;
//   max_tools?: number;
// }

// export interface UpdateServerGroupRequest {
//   name?: string;
//   description?: string;
//   max_tools?: number;
// }

// Assistant Types
export interface Assistant {
  id: number;
  name: string;
  description?: string;
  type: 'dedicated' | 'universal';
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

// Usage Statistics Types
export interface ApiKeyStats {
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  last_used_at?: string;
  most_used_endpoint?: string;
  most_used_assistant?: string;
}

export interface UsageLog {
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
