import { apiService } from './api.service';
import type {
  ApiResponse,
  ApiKey,
  ApiKeyWithSecret,
  CreateApiKeyRequest,
  UpdateApiKeyRequest,
  ApiKeyStats,
  UsageLog,
  Assistant,
} from '@/types/api.types';

export class ApiKeyService {
  // List all API keys
  static async listApiKeys(includeDisabled = false): Promise<ApiResponse<ApiKey[]>> {
    return apiService.get(`/api/v1/api-keys?include_disabled=${includeDisabled}`);
  }

  // Get specific API key
  static async getApiKey(id: number): Promise<ApiResponse<ApiKey>> {
    return apiService.get(`/api/v1/api-keys/${id}`);
  }

  // Create new API key
  static async createApiKey(data: CreateApiKeyRequest): Promise<ApiResponse<ApiKeyWithSecret>> {
    return apiService.post('/api/v1/api-keys', data);
  }

  // Update API key
  static async updateApiKey(id: number, data: UpdateApiKeyRequest): Promise<ApiResponse<ApiKey>> {
    return apiService.put(`/api/v1/api-keys/${id}`, data);
  }

  // Delete API key
  static async deleteApiKey(id: number): Promise<ApiResponse> {
    return apiService.delete(`/api/v1/api-keys/${id}`);
  }

  // Get API key assistants
  static async getApiKeyAssistants(id: number): Promise<ApiResponse<Assistant[]>> {
    return apiService.get(`/api/v1/api-keys/${id}/assistants`);
  }

  // Bind assistant to API key
  static async bindAssistant(keyId: number, assistantId: number): Promise<ApiResponse> {
    return apiService.post(`/api/v1/api-keys/${keyId}/assistants/${assistantId}`);
  }

  // Unbind assistant from API key
  static async unbindAssistant(keyId: number, assistantId: number): Promise<ApiResponse> {
    return apiService.delete(`/api/v1/api-keys/${keyId}/assistants/${assistantId}`);
  }

  // Get API key statistics
  static async getApiKeyStats(id: number, days = 30): Promise<ApiResponse<ApiKeyStats>> {
    return apiService.get(`/api/v1/api-keys/${id}/stats?days=${days}`);
  }

  // Get API key usage logs
  static async getApiKeyLogs(
    id: number,
    limit = 100,
    offset = 0
  ): Promise<ApiResponse<UsageLog[]>> {
    return apiService.get(`/api/v1/api-keys/${id}/logs?limit=${limit}&offset=${offset}`);
  }

  // Get current API key info
  static async getMyKeyInfo(): Promise<ApiResponse<ApiKey>> {
    return apiService.get('/api/v1/my-key');
  }

  // Get my accessible assistants
  static async getMyAssistants(): Promise<ApiResponse<Assistant[]>> {
    return apiService.get('/api/v1/my-assistants');
  }
}
