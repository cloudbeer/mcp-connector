import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Typography,
  Button,
  Space,
  Spin,
  Alert,
  message,
} from 'antd';
import {
  ArrowLeftOutlined,
  KeyOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ApiKeyService } from '@/services/apiKey.service';
import ApiKeyForm from '@/components/apiKeys/ApiKeyForm';
import type { ApiKeyUpdate } from '@/types/apiKey.types';

const { Title } = Typography;

const ApiKeyEdit: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const apiKeyId = parseInt(id || '0', 10);
  const navigate = useNavigate();

  // Fetch API key details
  const {
    data: apiKeyData,
    isLoading: isApiKeyLoading,
    error: apiKeyError,
  } = useQuery({
    queryKey: ['apiKey', apiKeyId],
    queryFn: () => ApiKeyService.getApiKey(apiKeyId),
    enabled: !!apiKeyId,
  });

  // Fetch API key assistants
  const {
    data: assistantsData,
    isLoading: isAssistantsLoading,
  } = useQuery({
    queryKey: ['apiKeyAssistants', apiKeyId],
    queryFn: () => ApiKeyService.getKeyAssistants(apiKeyId),
    enabled: !!apiKeyId,
  });

  // Update API key mutation
  const updateMutation = useMutation({
    mutationFn: (data: ApiKeyUpdate) => ApiKeyService.updateApiKey(apiKeyId, data),
    onSuccess: () => {
      message.success('API key updated successfully!');
      navigate(`/api-keys/${apiKeyId}`);
    },
    onError: (error: any) => {
      message.error(error.response?.data?.detail || 'Failed to update API key');
    },
  });

  const handleUpdate = (values: ApiKeyUpdate) => {
    updateMutation.mutate(values);
  };

  // Loading and error states
  if (isApiKeyLoading || isAssistantsLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '50px' }}>
        <Spin size="large" tip="Loading API key details..." />
      </div>
    );
  }

  if (apiKeyError) {
    return (
      <Alert
        message="Error"
        description="Failed to load API key details. Please try again later."
        type="error"
        showIcon
      />
    );
  }

  const apiKey = apiKeyData?.data;
  if (!apiKey) {
    return (
      <Alert
        message="API Key Not Found"
        description="The requested API key could not be found."
        type="error"
        showIcon
      />
    );
  }

  // Prepare initial values with assistant IDs
  const initialValues = {
    ...apiKey,
    assistant_ids: (assistantsData?.data || []).map(assistant => assistant.id),
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <Button 
          icon={<ArrowLeftOutlined />} 
          onClick={() => navigate(`/api-keys/${apiKeyId}`)}
          style={{ marginRight: 16 }}
        >
          Back to API Key
        </Button>
      </div>

      {/* Edit Form */}
      <Card
        title={
          <Space>
            <KeyOutlined />
            <Title level={3} style={{ margin: 0 }}>Edit API Key</Title>
          </Space>
        }
      >
        <ApiKeyForm
          initialValues={initialValues}
          onFinish={handleUpdate}
          onCancel={() => navigate(`/api-keys/${apiKeyId}`)}
          loading={updateMutation.isPending}
          isEdit={true}
        />
      </Card>
    </div>
  );
};

export default ApiKeyEdit;
