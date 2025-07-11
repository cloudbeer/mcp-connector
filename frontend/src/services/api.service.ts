import { message } from 'antd';
import { API_BASE_URL, STORAGE_KEYS } from '@/constants';

class ApiService {
  private baseURL: string;

  constructor() {
    this.baseURL = API_BASE_URL;
  }

  private async request<T = any>(
    url: string,
    options: RequestInit = {}
  ): Promise<T> {
    const apiKey = this.getApiKey();
    
    const config: RequestInit = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey && { Authorization: `Bearer ${apiKey}` }),
        ...options.headers,
      },
    };

    try {
      const response = await fetch(`${this.baseURL}${url}`, config);
      
      if (!response.ok) {
        await this.handleErrorResponse(response);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      if (error instanceof Error) {
        message.error(error.message);
      } else {
        message.error('An unexpected error occurred.');
      }
      throw error;
    }
  }

  private async handleErrorResponse(response: Response) {
    const status = response.status;
    
    if (status === 401) {
      message.error('Authentication failed. Please check your API key.');
      this.removeApiKey();
      window.location.href = '/login';
    } else if (status === 403) {
      message.error('Access denied. Insufficient permissions.');
    } else if (status >= 500) {
      message.error('Server error. Please try again later.');
    } else {
      try {
        const errorData = await response.json();
        if (errorData.detail) {
          message.error(errorData.detail);
        } else {
          message.error(`Request failed with status ${status}`);
        }
      } catch {
        message.error(`Request failed with status ${status}`);
      }
    }
    
    throw new Error(`HTTP ${status}`);
  }

  // Generic request methods
  async get<T = any>(url: string): Promise<T> {
    return this.request<T>(url, { method: 'GET' });
  }

  async post<T = any>(url: string, data?: any): Promise<T> {
    return this.request<T>(url, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T = any>(url: string, data?: any): Promise<T> {
    return this.request<T>(url, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T = any>(url: string): Promise<T> {
    return this.request<T>(url, { method: 'DELETE' });
  }

  // Set API key
  setApiKey(apiKey: string) {
    localStorage.setItem(STORAGE_KEYS.API_KEY, apiKey);
  }

  // Remove API key
  removeApiKey() {
    localStorage.removeItem(STORAGE_KEYS.API_KEY);
  }

  // Get current API key
  getApiKey(): string | null {
    return localStorage.getItem(STORAGE_KEYS.API_KEY);
  }
}

export const apiService = new ApiService();
