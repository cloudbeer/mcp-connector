import { apiService } from './api.service';
import type { ApiResponse } from '@/types/api.types';

export interface McpClientInfo {
  tool_id: number;
  name: string;
  connection_type: string;
  status: string;
  started_at: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
}

export interface McpServerResponse {
  success: boolean;
  message: string;
  data?: any;
}

export interface McpClientListResponse {
  success: boolean;
  message: string;
  data: McpClientInfo[];
  total: number;
}

export interface McpServerToolsResponse {
  success: boolean;
  message: string;
  data: {
    tool_id: number;
    tools: Array<{
      tool_name: string;
      tool_spec: any;
    }>;
    tool_count: number;
  };
}

export class McpServerService {
  // Start MCP server
  static async startServer(toolId: number): Promise<ApiResponse<McpServerResponse>> {
    return apiService.post('/api/v1/mcp-servers/start', { tool_id: toolId });
  }

  // Stop MCP server
  static async stopServer(toolId: number): Promise<ApiResponse<McpServerResponse>> {
    return apiService.post(`/api/v1/mcp-servers/stop/${toolId}`);
  }

  // Restart MCP server
  static async restartServer(toolId: number): Promise<ApiResponse<McpServerResponse>> {
    return apiService.post('/api/v1/mcp-servers/restart', { tool_id: toolId });
  }

  // List running MCP servers
  static async listServers(): Promise<ApiResponse<McpClientListResponse>> {
    return apiService.get('/api/v1/mcp-servers');
  }

  // Get MCP server status
  static async getServerStatus(toolId: number): Promise<ApiResponse<McpServerResponse>> {
    return apiService.get(`/api/v1/mcp-servers/${toolId}/status`);
  }

  // Get tools from MCP server
  static async getServerTools(toolId: number): Promise<ApiResponse<McpServerToolsResponse>> {
    return apiService.get(`/api/v1/mcp-servers/${toolId}/tools`);
  }

  // Query agent with tools
  static async queryAgent(toolIds: number[], query: string): Promise<ApiResponse<any>> {
    return apiService.post('/api/v1/mcp-servers/query', {
      tool_ids: toolIds,
      query
    });
  }
}
