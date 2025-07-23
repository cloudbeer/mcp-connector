import { useState, useEffect, useCallback } from 'react';
import { apiService } from '@/services/api.service';
import { ApiKeyService } from '@/services/apiKey.service';
import type { ApiKey } from '@/types/apiKey.types';

export const useAuth = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [userData, setUserData] = useState<{ name: string; keyPrefix: string } | null>(null);

  const checkAuthStatus = useCallback(async () => {
    // 防止重复检查
    if (isChecking) return;

    setIsChecking(true);
    const apiKey = apiService.getApiKey();

    if (!apiKey) {
      setIsAuthenticated(false);
      setUserData(null);
      setIsLoading(false);
      setIsChecking(false);
      return;
    }

    try {
      // Try to fetch current key info to validate the key
      const response = await ApiKeyService.getMyKeyInfo();
      // console.log('Auth check successful:', response);

      if (response.success && response.data) {
        const keyData = response.data as ApiKey;
        setUserData({
          name: keyData.name,
          keyPrefix: keyData.key_prefix
        });
      }

      setIsAuthenticated(true);
    } catch (error) {
      console.error('Auth check failed:', error);
      // Invalid key, remove it
      apiService.removeApiKey();
      setUserData(null);
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
    // After login, fetch user data
    checkAuthStatus();
  }, [checkAuthStatus]);

  const logout = useCallback(() => {
    apiService.removeApiKey();
    setUserData(null);
    setIsAuthenticated(false);
  }, []);

  return {
    isAuthenticated,
    isLoading,
    userData,
    login,
    logout,
    checkAuthStatus,
  };
};
