import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Typography,
  Button,
  Space,
  Modal,
  Input,
} from 'antd';
import { useMessage } from '@/hooks/useMessage';
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
  const { success, error: showError, contextHolder } = useMessage();
  const [modal, contextHolder2] = Modal.useModal();

  // Create API key mutation
  const createMutation = useMutation({
    mutationFn: ApiKeyService.createApiKey,
    onSuccess: (response) => {
      success('API key created successfully!');

      // Show the API key secret
      if (response?.data?.api_key) {
        // Use modal.success with the useModal hook
        modal.success({
          title: 'API Key Created',
          content: (
            <div>
              <p style={{ color: 'red', fontWeight: 'bold' }}>IMPORTANT: Please copy this key now as it won't be shown again!</p>
              <Input.TextArea
                value={response.data.api_key}
                readOnly
                rows={3}
                style={{ marginBottom: 16, fontWeight: 'bold', fontSize: '16px' }}
              />
              <Button
                type="primary"
                onClick={() => {
                  if (response.data?.api_key) {
                    navigator.clipboard.writeText(response.data.api_key);
                    success('API key copied to clipboard!');
                  }
                }}
              >
                Copy to Clipboard
              </Button>
            </div>
          ),
          width: 600,
          maskClosable: false,
          okText: 'I have saved the API key',
          onOk: () => {
            navigate('/api-keys');
          },
        });
      } else {
        console.error('API key created but no key returned in response:', response);

        // Use modal.warning with the useModal hook
        modal.warning({
          title: 'API Key Created',
          content: 'The API key was created successfully, but the key value was not returned. Please contact an administrator.',
          onOk: () => {
            navigate('/api-keys');
          },
        });
      }
    },
    onError: (error: any) => {
      console.error('Error creating API key:', error);
      showError(error.response?.data?.detail || 'Failed to create API key');
    },
  });

  const handleCreate = (values: ApiKeyCreate | ApiKeyUpdate) => {
    createMutation.mutate(values as ApiKeyCreate);
  };

  return (
    <div>
      {/* Render message and modal context holders */}
      {contextHolder}
      {contextHolder2}

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
