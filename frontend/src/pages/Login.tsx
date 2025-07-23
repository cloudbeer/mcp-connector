import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Button, Typography, Space, message, Checkbox } from 'antd';
import { KeyOutlined, LoginOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { ApiKeyService } from '@/services/apiKey.service';
import { apiService } from '@/services/api.service';
import { APP_TITLE, STORAGE_KEYS } from '@/constants';

const { Title, Text } = Typography;

const Login: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const { login, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  // If already authenticated, redirect to dashboard
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, isLoading, navigate]);

  const onFinish = async (values: { apiKey: string; rememberKey: boolean }) => {
    setLoading(true);
    
    try {
      // Set the API key based on remember preference
      if (values.rememberKey) {
        // Store in localStorage for permanent storage
        localStorage.setItem(STORAGE_KEYS.API_KEY, values.apiKey);
      } else {
        // Store in sessionStorage for session-only storage
        sessionStorage.setItem(STORAGE_KEYS.API_KEY, values.apiKey);
        // Make sure it's not in localStorage
        localStorage.removeItem(STORAGE_KEYS.API_KEY);
      }
      
      // Set the API key for current use
      apiService.setApiKey(values.apiKey);
      
      // Try to fetch current key info to validate
      const response = await ApiKeyService.getMyKeyInfo();
      console.log('Login validation successful:', response);
      
      // If successful, login and navigate
      login(values.apiKey);
      
      const storageType = values.rememberKey ? 'permanently' : 'for this session';
      message.success(`Login successful! Your API key has been saved ${storageType}.`);
      
      navigate('/dashboard');
    } catch (error) {
      console.error('Login validation failed:', error);
      // Remove invalid key
      apiService.removeApiKey();
      message.error('Invalid API key. Please check and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '20px'
    }}>
      <Card
        style={{
          width: '100%',
          maxWidth: 400,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
        }}
      >
        <Space direction="vertical" size="large" style={{ width: '100%', textAlign: 'center' }}>
          <div>
            <KeyOutlined style={{ fontSize: '48px', color: '#1890ff', marginBottom: '16px' }} />
            <Title level={2} style={{ margin: 0 }}>
              {APP_TITLE}
            </Title>
            <Text type="secondary">
              Enter your API key to access the management console
            </Text>
          </div>

          <Form
            name="login"
            onFinish={onFinish}
            layout="vertical"
            size="large"
            style={{ width: '100%' }}
          >
            <Form.Item
              name="apiKey"
              label="API Key"
              rules={[
                { required: true, message: 'Please enter your API key!' },
                { min: 10, message: 'API key must be at least 10 characters long!' },
              ]}
              tooltip={{
                title: 'Your API key will be securely stored in this browser for future logins',
                icon: <InfoCircleOutlined />,
              }}
            >
              <Input.Password
                prefix={<KeyOutlined />}
                placeholder="Enter your API key"
                autoComplete="off"
              />
            </Form.Item>

            <Form.Item 
              name="rememberKey" 
              valuePropName="checked"
              initialValue={true}
            >
              <Checkbox>Remember API key in this browser</Checkbox>
            </Form.Item>

            <Form.Item style={{ marginBottom: 0 }}>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                icon={<LoginOutlined />}
                block
              >
                Login
              </Button>
            </Form.Item>
          </Form>


        </Space>
      </Card>
    </div>
  );
};

export default Login;
