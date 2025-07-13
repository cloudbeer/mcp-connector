export type AssistantType = 'dedicated' | 'universal';

export interface Assistant {
  id: number;
  name: string;
  description?: string;
  type: AssistantType;
  intent_model?: string;
  max_tools: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface AssistantTool {
  id: number;
  assistant_id: number;
  tool_id: number;
  priority: number;
  created_at: string;
  tool_name?: string;
  tool_description?: string;
}

export interface ToolInfo {
  id: number;
  name: string;
  description?: string;
  connection_type: string;
  priority: number;
}

export interface AssistantWithTools extends Assistant {
  tools: ToolInfo[];
}

export interface CreateAssistantRequest {
  name: string;
  description?: string;
  type: AssistantType;
  intent_model?: string;
  max_tools?: number;
  enabled?: boolean;
  tool_ids?: number[];
}

export interface UpdateAssistantRequest {
  name?: string;
  description?: string;
  type?: AssistantType;
  intent_model?: string;
  max_tools?: number;
  enabled?: boolean;
  tool_ids?: number[];
}
