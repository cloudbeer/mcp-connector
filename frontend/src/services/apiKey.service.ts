import { apiService } from './api.service';
import type { ApiResponse } from '@/types/api.types';
import type { ApiKey, ApiKeyCreate, ApiKeyUpdate } from '@/types/apiKey.types';

export class ApiKeyService {
  // List API keys
  static async listApiKeys(includeDisabled = false): Promise<ApiResponse<ApiKey[]>> {
    const params = new URLSearchParams();
    params.append('include_disabled', includeDisabled.toString());
    
    return apiService.get(`/api/v1/api-keys?${params.toString()}`);
  }

  // Get specific API key
  static async getApiKey(id: number): Promise<ApiResponse<ApiKey>> {
    return apiService.get(`/api/v1/api-keys/${id}`);
  }

  // Create new API key
  static async createApiKey(data: ApiKeyCreate): Promise<ApiResponse<ApiKey>> {
    return apiService.post('/api/v1/api-keys', data);
  }

  // Update API key
  static async updateApiKey(id: number, data: ApiKeyUpdate): Promise<ApiResponse<ApiKey>> {
    return apiService.put(`/api/v1/api-keys/${id}`, data);
  }

  // Delete API key
  static async deleteApiKey(id: number): Promise<ApiResponse> {
    return apiService.delete(`/api/v1/api-keys/${id}`);
  }

  // Get my key info
  static async getMyKeyInfo(): Promise<ApiResponse<ApiKey>> {
    return apiService.get('/api/v1/my-key');
  }

  // Get my accessible assistants
  static async getMyAssistants(): Promise<ApiResponse<any[]>> {
    return apiService.get('/api/v1/my-assistants');
  }

  // Get API key assistants
  static async getKeyAssistants(keyId: number): Promise<ApiResponse<any[]>> {
    return apiService.get(`/api/v1/api-keys/${keyId}/assistants`);
  }

  // Bind assistant to API key
  static async bindAssistantToKey(keyId: number, assistantId: number): Promise<ApiResponse> {
    return apiService.post(`/api/v1/api-keys/${keyId}/assistants/${assistantId}`);
  }

  // Unbind assistant from API key
  static async unbindAssistantFromKey(keyId: number, assistantId: number): Promise<ApiResponse> {
    return apiService.delete(`/api/v1/api-keys/${keyId}/assistants/${assistantId}`);
  }

  // Get API key usage statistics
  static async getKeyStats(keyId: number, days = 30): Promise<ApiResponse<any>> {
    return apiService.get(`/api/v1/api-keys/${keyId}/stats?days=${days}`);
  }

  // Get API key usage logs
  static async getKeyLogs(keyId: number, limit = 100, offset = 0): Promise<ApiResponse<any[]>> {
    return apiService.get(`/api/v1/api-keys/${keyId}/logs?limit=${limit}&offset=${offset}`);
  }
}
