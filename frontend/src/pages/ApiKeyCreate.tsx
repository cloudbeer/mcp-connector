import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Typography,
  Button,
  Space,
  message,
  Modal,
  Input,
} from 'antd';
import {
  ArrowLeftOutlined,
  KeyOutlined,
} from '@ant-design/icons';
import { useMutation } from '@tanstack/react-query';
import { ApiKeyService } from '@/services/apiKey.service';
import ApiKeyForm from '@/components/apiKeys/ApiKeyForm';
import type { ApiKeyCreate, ApiKeyUpdate } from '@/types/apiKey.types';

const { Title } = Typography;

const ApiKeyCreateComponent: React.FC = () => {
  const navigate = useNavigate();

  // Create API key mutation
  const createMutation = useMutation({
    mutationFn: ApiKeyService.createApiKey,
    onSuccess: (response) => {
      message.success('API key created successfully!');

      // Show the API key secret
      if (response?.data?.api_key) {
        Modal.success({
          title: 'API Key Created',
          content: (
            <div>
              <p>Your API key has been created successfully. Please copy this key now as it won't be shown again:</p>
              <Input.TextArea
                value={response.data.api_key}
                readOnly
                rows={3}
                style={{ marginBottom: 16 }}
              />
              <Button
                type="primary"
                onClick={() => {
                  navigator.clipboard.writeText(response.data?.api_key || '');
                  message.success('API key copied to clipboard!');
                }}
              >
                Copy to Clipboard
              </Button>
            </div>
          ),
          onOk: () => {
            navigate('/api-keys');
          },
        });
      } else {
        navigate('/api-keys');
      }
    },
    onError: (error: any) => {
      message.error(error.response?.data?.detail || 'Failed to create API key');
    },
  });

  const handleCreate = (values: ApiKeyCreate | ApiKeyUpdate) => {
    createMutation.mutate(values as ApiKeyCreate);
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/api-keys')}
          style={{ marginRight: 16 }}
        >
          Back to API Keys
        </Button>
      </div>

      {/* Create Form */}
      <Card
        title={
          <Space>
            <KeyOutlined />
            <Title level={3} style={{ margin: 0 }}>Create API Key</Title>
          </Space>
        }
      >
        <ApiKeyForm
          onFinish={handleCreate}
          onCancel={() => navigate('/api-keys')}
          loading={createMutation.isPending}
        />
      </Card>
    </div>
  );
};

export default ApiKeyCreateComponent;
