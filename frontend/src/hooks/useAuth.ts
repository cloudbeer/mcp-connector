import { useState, useEffect, useCallback } from 'react';
import { apiService } from '@/services/api.service';
import { ApiKeyService } from '@/services/apiKey.service';

export const useAuth = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isChecking, setIsChecking] = useState<boolean>(false);

  const checkAuthStatus = useCallback(async () => {
    // 防止重复检查
    if (isChecking) return;
    
    setIsChecking(true);
    const apiKey = apiService.getApiKey();
    
    if (!apiKey) {
      setIsAuthenticated(false);
      setIsLoading(false);
      setIsChecking(false);
      return;
    }

    try {
      // Try to fetch current key info to validate the key
      const response = await ApiKeyService.getMyKeyInfo();
      console.log('Auth check successful:', response);
      setIsAuthenticated(true);
    } catch (error) {
      console.error('Auth check failed:', error);
      // Invalid key, remove it
      apiService.removeApiKey();
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
      setIsChecking(false);
    }
  }, [isChecking]);

  useEffect(() => {
    checkAuthStatus();
  }, []); // 只在组件挂载时检查一次

  const login = useCallback((apiKey: string) => {
    apiService.setApiKey(apiKey);
    setIsAuthenticated(true);
    setIsLoading(false);
  }, []);

  const logout = useCallback(() => {
    apiService.removeApiKey();
    setIsAuthenticated(false);
  }, []);

  return {
    isAuthenticated,
    isLoading,
    login,
    logout,
    checkAuthStatus,
  };
};
