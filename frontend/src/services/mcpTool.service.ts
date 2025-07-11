import { apiService } from './api.service';
import type {
  ApiResponse,
  McpTool,
  CreateMcpToolRequest,
  UpdateMcpToolRequest,
  ServerGroup,
  CreateServerGroupRequest,
  UpdateServerGroupRequest,
} from '@/types/api.types';

export class McpToolService {
  // List MCP tools
  static async listTools(groupId?: number, enabledOnly = true): Promise<ApiResponse<McpTool[]>> {
    const params = new URLSearchParams();
    if (groupId) params.append('group_id', groupId.toString());
    params.append('enabled_only', enabledOnly.toString());
    
    return apiService.get(`/api/v1/tools?${params.toString()}`);
  }

  // Get specific MCP tool
  static async getTool(id: number): Promise<ApiResponse<McpTool>> {
    return apiService.get(`/api/v1/tools/${id}`);
  }

  // Create new MCP tool
  static async createTool(data: CreateMcpToolRequest): Promise<ApiResponse<McpTool>> {
    return apiService.post('/api/v1/tools', data);
  }

  // Update MCP tool
  static async updateTool(id: number, data: UpdateMcpToolRequest): Promise<ApiResponse<McpTool>> {
    return apiService.put(`/api/v1/tools/${id}`, data);
  }

  // Delete MCP tool
  static async deleteTool(id: number): Promise<ApiResponse> {
    return apiService.delete(`/api/v1/tools/${id}`);
  }

  // Update tool status
  static async updateToolStatus(id: number, enabled: boolean): Promise<ApiResponse> {
    return apiService.put(`/api/v1/tools/${id}/status`, { enabled });
  }

  // Batch import tools
  static async batchImportTools(data: { mcpServers: any; group_id: number }): Promise<ApiResponse> {
    return apiService.post('/api/v1/tools/batch-import', data);
  }

  // Export tools configuration
  static async exportToolsConfig(groupId?: number): Promise<ApiResponse> {
    const params = new URLSearchParams();
    if (groupId) params.append('group_id', groupId.toString());
    
    return apiService.get(`/api/v1/tools/export-config?${params.toString()}`);
  }
}

export class ServerGroupService {
  // List server groups
  static async listGroups(): Promise<ApiResponse<ServerGroup[]>> {
    return apiService.get('/api/v1/groups');
  }

  // Get specific server group
  static async getGroup(id: number): Promise<ApiResponse<ServerGroup>> {
    return apiService.get(`/api/v1/groups/${id}`);
  }

  // Create new server group
  static async createGroup(data: CreateServerGroupRequest): Promise<ApiResponse<ServerGroup>> {
    return apiService.post('/api/v1/groups', data);
  }

  // Update server group
  static async updateGroup(id: number, data: UpdateServerGroupRequest): Promise<ApiResponse<ServerGroup>> {
    return apiService.put(`/api/v1/groups/${id}`, data);
  }

  // Delete server group
  static async deleteGroup(id: number): Promise<ApiResponse> {
    return apiService.delete(`/api/v1/groups/${id}`);
  }

  // Get tools in group
  static async getGroupTools(id: number): Promise<ApiResponse<McpTool[]>> {
    return apiService.get(`/api/v1/groups/${id}/tools`);
  }
}
