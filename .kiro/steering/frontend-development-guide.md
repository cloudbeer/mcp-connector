---
inclusion: fileMatch
fileMatchPattern: 'frontend/**'
---

# 前端开发指南

## 技术栈概览

### 核心技术
- **React 19**: 最新版本的 React，支持并发特性
- **TypeScript**: 类型安全的 JavaScript 超集
- **Ant Design**: 企业级 UI 设计语言和组件库
- **Vite**: 快速的构建工具和开发服务器
- **React Query**: 强大的数据获取和状态管理库
- **React Router**: 客户端路由解决方案
- **Bun**: 快速的 JavaScript 运行时和包管理器

### 开发工具
- **ESLint**: 代码质量检查
- **Prettier**: 代码格式化
- **TypeScript**: 静态类型检查

## 项目结构详解

```
frontend/src/
├── components/          # 可复用组件
│   ├── common/         # 通用组件（按钮、表单等）
│   ├── forms/          # 表单相关组件
│   ├── layout/         # 布局组件
│   └── apiKeys/        # API Key 相关组件
├── pages/              # 页面组件
│   ├── Dashboard.tsx   # 仪表板页面
│   ├── ApiKeys.tsx     # API Key 管理页面
│   ├── Assistants.tsx  # 助手管理页面
│   └── McpTools.tsx    # MCP 工具管理页面
├── services/           # API 服务层
│   ├── api.service.ts  # 基础 API 服务
│   ├── apiKey.service.ts
│   ├── assistant.service.ts
│   └── mcpTool.service.ts
├── types/              # TypeScript 类型定义
│   ├── api.types.ts    # API 相关类型
│   ├── apiKey.types.ts
│   └── assistant.types.ts
├── hooks/              # 自定义 React Hooks
│   └── useAuth.ts      # 认证相关 Hook
├── constants/          # 应用常量
│   └── index.ts
└── utils/              # 工具函数
```

## 组件开发规范

### 函数式组件模板
```tsx
import React from 'react';
import { Button, Card } from 'antd';
import type { ComponentProps } from './types';

interface Props {
  title: string;
  onAction?: () => void;
  loading?: boolean;
}

export const ExampleComponent: React.FC<Props> = ({
  title,
  onAction,
  loading = false
}) => {
  const handleClick = () => {
    onAction?.();
  };

  return (
    <Card title={title}>
      <Button 
        type="primary" 
        loading={loading}
        onClick={handleClick}
      >
        执行操作
      </Button>
    </Card>
  );
};

export default ExampleComponent;
```

### Hooks 使用规范
```tsx
import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiKeyService } from '../services/apiKey.service';

export const useApiKeys = () => {
  const {
    data: apiKeys,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['apiKeys'],
    queryFn: apiKeyService.getAll
  });

  const createMutation = useMutation({
    mutationFn: apiKeyService.create,
    onSuccess: () => {
      refetch();
    }
  });

  const createApiKey = useCallback((data: CreateApiKeyRequest) => {
    return createMutation.mutate(data);
  }, [createMutation]);

  return {
    apiKeys,
    isLoading,
    error,
    createApiKey,
    isCreating: createMutation.isPending
  };
};
```

## 状态管理

### React Query 配置
```tsx
// main.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 分钟
      cacheTime: 10 * 60 * 1000, // 10 分钟
      retry: 3,
      refetchOnWindowFocus: false
    },
    mutations: {
      retry: 1
    }
  }
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Routes>
          {/* 路由配置 */}
        </Routes>
      </Router>
    </QueryClientProvider>
  );
}
```

### 认证状态管理
```tsx
// hooks/useAuth.ts
import { createContext, useContext, useState, useEffect } from 'react';

interface AuthContextType {
  apiKey: string | null;
  isAuthenticated: boolean;
  login: (apiKey: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [apiKey, setApiKey] = useState<string | null>(
    localStorage.getItem('apiKey')
  );

  const login = (key: string) => {
    setApiKey(key);
    localStorage.setItem('apiKey', key);
  };

  const logout = () => {
    setApiKey(null);
    localStorage.removeItem('apiKey');
  };

  return (
    <AuthContext.Provider value={{
      apiKey,
      isAuthenticated: !!apiKey,
      login,
      logout
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
```

## API 服务层

### 基础 API 服务
```tsx
// services/api.service.ts
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

class ApiService {
  private baseURL: string;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const apiKey = localStorage.getItem('apiKey');
    
    const config: RequestInit = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey && { Authorization: `Bearer ${apiKey}` }),
        ...options.headers,
      },
    };

    const response = await fetch(`${this.baseURL}${endpoint}`, config);
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    return response.json();
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint);
  }

  async post<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
    });
  }
}

export const apiService = new ApiService(API_BASE_URL);
```

### 特定资源服务
```tsx
// services/apiKey.service.ts
import { apiService } from './api.service';
import type { ApiKey, CreateApiKeyRequest, UpdateApiKeyRequest } from '../types/apiKey.types';

class ApiKeyService {
  async getAll(): Promise<ApiKey[]> {
    const response = await apiService.get<{ data: ApiKey[] }>('/api/v1/api-keys');
    return response.data;
  }

  async getById(id: number): Promise<ApiKey> {
    const response = await apiService.get<{ data: ApiKey }>(`/api/v1/api-keys/${id}`);
    return response.data;
  }

  async create(data: CreateApiKeyRequest): Promise<ApiKey> {
    const response = await apiService.post<{ data: ApiKey }>('/api/v1/api-keys', data);
    return response.data;
  }

  async update(id: number, data: UpdateApiKeyRequest): Promise<ApiKey> {
    const response = await apiService.put<{ data: ApiKey }>(`/api/v1/api-keys/${id}`, data);
    return response.data;
  }

  async delete(id: number): Promise<void> {
    await apiService.delete(`/api/v1/api-keys/${id}`);
  }
}

export const apiKeyService = new ApiKeyService();
```

## 表单处理

### Ant Design 表单最佳实践
```tsx
import { Form, Input, Switch, Button, Select, message } from 'antd';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiKeyService } from '../services/apiKey.service';
import type { CreateApiKeyRequest } from '../types/apiKey.types';

interface Props {
  onSuccess?: () => void;
}

export const ApiKeyForm: React.FC<Props> = ({ onSuccess }) => {
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: apiKeyService.create,
    onSuccess: () => {
      message.success('API Key 创建成功');
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
      onSuccess?.();
    },
    onError: (error) => {
      message.error(`创建失败: ${error.message}`);
    }
  });

  const handleSubmit = (values: CreateApiKeyRequest) => {
    createMutation.mutate(values);
  };

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleSubmit}
      initialValues={{
        permissions: {
          can_manage: false,
          can_call_assistant: true,
          is_disabled: false
        }
      }}
    >
      <Form.Item
        name="name"
        label="名称"
        rules={[{ required: true, message: '请输入 API Key 名称' }]}
      >
        <Input placeholder="输入 API Key 名称" />
      </Form.Item>

      <Form.Item name={['permissions', 'can_manage']} valuePropName="checked">
        <Switch checkedChildren="管理权限" unCheckedChildren="管理权限" />
      </Form.Item>

      <Form.Item name={['permissions', 'can_call_assistant']} valuePropName="checked">
        <Switch checkedChildren="助手调用" unCheckedChildren="助手调用" />
      </Form.Item>

      <Form.Item>
        <Button 
          type="primary" 
          htmlType="submit"
          loading={createMutation.isPending}
        >
          创建 API Key
        </Button>
      </Form.Item>
    </Form>
  );
};
```

## 路由配置

### React Router 设置
```tsx
// App.tsx
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from 'antd';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { Dashboard } from './pages/Dashboard';
import { Login } from './pages/Login';
import { ApiKeys } from './pages/ApiKeys';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <Layout style={{ minHeight: '100vh' }}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } />
            <Route path="/api-keys" element={
              <ProtectedRoute>
                <ApiKeys />
              </ProtectedRoute>
            } />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Layout>
      </Router>
    </AuthProvider>
  );
}
```

## 样式和主题

### Ant Design 主题定制
```tsx
// main.tsx
import { ConfigProvider, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';

const customTheme = {
  token: {
    colorPrimary: '#1890ff',
    borderRadius: 6,
    fontSize: 14,
  },
  components: {
    Button: {
      borderRadius: 4,
    },
    Card: {
      borderRadius: 8,
    },
  },
};

function App() {
  return (
    <ConfigProvider 
      theme={customTheme}
      locale={zhCN}
    >
      {/* 应用内容 */}
    </ConfigProvider>
  );
}
```

## 错误处理

### 全局错误边界
```tsx
import React from 'react';
import { Result, Button } from 'antd';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Result
          status="500"
          title="应用出现错误"
          subTitle="抱歉，应用遇到了意外错误"
          extra={
            <Button 
              type="primary" 
              onClick={() => window.location.reload()}
            >
              刷新页面
            </Button>
          }
        />
      );
    }

    return this.props.children;
  }
}
```

## 性能优化

### 组件懒加载
```tsx
import { lazy, Suspense } from 'react';
import { Spin } from 'antd';

const ApiKeys = lazy(() => import('./pages/ApiKeys'));
const Assistants = lazy(() => import('./pages/Assistants'));

const LoadingSpinner = () => (
  <div style={{ textAlign: 'center', padding: '50px' }}>
    <Spin size="large" />
  </div>
);

function App() {
  return (
    <Routes>
      <Route path="/api-keys" element={
        <Suspense fallback={<LoadingSpinner />}>
          <ApiKeys />
        </Suspense>
      } />
      <Route path="/assistants" element={
        <Suspense fallback={<LoadingSpinner />}>
          <Assistants />
        </Suspense>
      } />
    </Routes>
  );
}
```

### React Query 优化
```tsx
// 预加载数据
const prefetchApiKeys = () => {
  queryClient.prefetchQuery({
    queryKey: ['apiKeys'],
    queryFn: apiKeyService.getAll,
    staleTime: 5 * 60 * 1000
  });
};

// 乐观更新
const updateMutation = useMutation({
  mutationFn: apiKeyService.update,
  onMutate: async (newData) => {
    await queryClient.cancelQueries({ queryKey: ['apiKeys'] });
    const previousData = queryClient.getQueryData(['apiKeys']);
    
    queryClient.setQueryData(['apiKeys'], (old: ApiKey[]) =>
      old.map(item => item.id === newData.id ? { ...item, ...newData } : item)
    );
    
    return { previousData };
  },
  onError: (err, newData, context) => {
    queryClient.setQueryData(['apiKeys'], context?.previousData);
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
  }
});
```

## 测试策略

### 组件测试示例
```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiKeyForm } from '../components/ApiKeyForm';

const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false }
  }
});

const renderWithProviders = (component: React.ReactElement) => {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      {component}
    </QueryClientProvider>
  );
};

describe('ApiKeyForm', () => {
  it('should render form fields', () => {
    renderWithProviders(<ApiKeyForm />);
    
    expect(screen.getByLabelText('名称')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '创建 API Key' })).toBeInTheDocument();
  });

  it('should submit form with valid data', async () => {
    const onSuccess = jest.fn();
    renderWithProviders(<ApiKeyForm onSuccess={onSuccess} />);
    
    fireEvent.change(screen.getByLabelText('名称'), {
      target: { value: '测试 API Key' }
    });
    
    fireEvent.click(screen.getByRole('button', { name: '创建 API Key' }));
    
    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
    });
  });
});
```