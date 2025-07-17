import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfigProvider, theme } from 'antd';
// import { APP_TITLE } from '@/constants';
import Layout from '@/components/layout/Layout';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import ApiKeys from '@/pages/ApiKeys';
import ApiKeyCreate from '@/pages/ApiKeyCreate';
import ApiKeyDetail from '@/pages/ApiKeyDetail';
import ApiKeyEdit from '@/pages/ApiKeyEdit';
import McpTools from '@/pages/McpTools';
import McpToolDetail from '@/pages/McpToolDetail';
import Assistants from '@/pages/Assistants';
import AssistantDetail from '@/pages/AssistantDetail';
import AssistantEdit from '@/pages/AssistantEdit';
import ChatPage from '@/pages/chat/ChatPage';
import { useAuth } from '@/hooks/useAuth';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Protected Route Component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  // Show loading while checking authentication
  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh'
      }}>
        <div>Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider
        theme={{
          algorithm: theme.defaultAlgorithm,
          token: {
            colorPrimary: '#1890ff',
          },
        }}
      >
        <Router>
          <div className="App">
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route
                path="/*"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <Routes>
                        <Route path="/" element={<Navigate to="/dashboard" replace />} />
                        <Route path="/dashboard" element={<Dashboard />} />
                        <Route path="/api-keys" element={<ApiKeys />} />
                        <Route path="/api-keys/create" element={<ApiKeyCreate />} />
                        <Route path="/api-keys/:id" element={<ApiKeyDetail />} />
                        <Route path="/api-keys/:id/edit" element={<ApiKeyEdit />} />
                        <Route path="/mcp-tools" element={<McpTools />} />
                        <Route path="/mcp-tools/:id" element={<McpToolDetail />} />
                        <Route path="/assistants" element={<Assistants />} />
                        <Route path="/assistants/:id" element={<AssistantDetail />} />
                        <Route path="/assistants/:id/edit" element={<AssistantEdit />} />
                        <Route path="/chat" element={<ChatPage />} />
                      </Routes>
                    </Layout>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </div>
        </Router>
      </ConfigProvider>
    </QueryClientProvider>
  );
};

export default App;
