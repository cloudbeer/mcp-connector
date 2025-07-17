import { apiService } from './api.service';
import type { ApiResponse } from '@/types/api.types';
import type { Assistant, AssistantWithTools, CreateAssistantRequest, UpdateAssistantRequest } from '@/types/assistant.types';

export class AssistantService {
  // List assistants (requires management permission)
  static async listAssistants(enabledOnly = false): Promise<ApiResponse<Assistant[]>> {
    const params = new URLSearchParams();
    params.append('enabled_only', enabledOnly.toString());

    return apiService.get(`/api/v1/assistants?${params.toString()}`);
  }

  // List assistants accessible to the current API key (works with assistant permission)
  static async getMyAssistants(): Promise<ApiResponse<Assistant[]>> {
    return apiService.get('/api/v1/my-assistants');
  }

  // Get specific assistant
  static async getAssistant(id: number): Promise<ApiResponse<AssistantWithTools>> {
    return apiService.get(`/api/v1/assistants/${id}`);
  }

  // Create new assistant
  static async createAssistant(data: CreateAssistantRequest): Promise<ApiResponse<AssistantWithTools>> {
    return apiService.post('/api/v1/assistants', data);
  }

  // Update assistant
  static async updateAssistant(id: number, data: UpdateAssistantRequest): Promise<ApiResponse<AssistantWithTools>> {
    return apiService.put(`/api/v1/assistants/${id}`, data);
  }

  // Delete assistant
  static async deleteAssistant(id: number): Promise<ApiResponse> {
    return apiService.delete(`/api/v1/assistants/${id}`);
  }

  // Get assistant tools
  static async getAssistantTools(id: number): Promise<ApiResponse<any[]>> {
    return apiService.get(`/api/v1/assistants/${id}/tools`);
  }

  // Add tool to assistant
  static async addToolToAssistant(assistantId: number, toolId: number, priority = 1): Promise<ApiResponse> {
    return apiService.post(`/api/v1/assistants/${assistantId}/tools/${toolId}?priority=${priority}`);
  }

  // Remove tool from assistant
  static async removeToolFromAssistant(assistantId: number, toolId: number): Promise<ApiResponse> {
    return apiService.delete(`/api/v1/assistants/${assistantId}/tools/${toolId}`);
  }

  // Update tool priority
  static async updateToolPriority(assistantId: number, toolId: number, priority: number): Promise<ApiResponse> {
    return apiService.put(`/api/v1/assistants/${assistantId}/tools/${toolId}/priority?priority=${priority}`);
  }
}
