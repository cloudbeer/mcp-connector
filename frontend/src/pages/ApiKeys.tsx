import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table,
  Button,
  Space,
  Tag,
  Typography,
  Card,
  Tooltip,
  Popconfirm,
  Switch,
  message,
  Badge,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  KeyOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  InfoCircleOutlined,
  RobotOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiKeyService } from '@/services/apiKey.service';
import type { ApiKey } from '@/types/apiKey.types';

const { Title, Text } = Typography;

const ApiKeys: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [includeDisabled, setIncludeDisabled] = useState(false);

  // Fetch API keys
  const {
    data: apiKeysData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['apiKeys', includeDisabled],
    queryFn: () => ApiKeyService.listApiKeys(includeDisabled),
  });

  // Delete API key mutation
  const deleteMutation = useMutation({
    mutationFn: ApiKeyService.deleteApiKey,
    onSuccess: () => {
      message.success('API key deleted successfully!');
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
    },
    onError: (error: any) => {
      message.error(error.response?.data?.detail || 'Failed to delete API key');
    },
  });

  // Update API key mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      ApiKeyService.updateApiKey(id, data),
    onSuccess: () => {
      message.success('API key updated successfully!');
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
    },
    onError: (error: any) => {
      message.error(error.response?.data?.detail || 'Failed to update API key');
    },
  });

  const handleDelete = (id: number) => {
    deleteMutation.mutate(id);
  };

  const handleToggleDisabled = (record: ApiKey) => {
    updateMutation.mutate({
      id: record.id,
      data: { is_disabled: !record.is_disabled },
    });
  };

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: ApiKey) => (
        <Space>
          <KeyOutlined />
          <a onClick={() => navigate(`/api-keys/${record.id}`)}>{text}</a>
        </Space>
      ),
    },
    {
      title: 'Key Prefix',
      dataIndex: 'key_prefix',
      key: 'key_prefix',
    },
    {
      title: 'Permissions',
      key: 'permissions',
      render: (record: ApiKey) => (
        <Space>
          <Tag color={record.can_manage ? 'blue' : 'default'}>
            {record.can_manage ? 'Management' : 'No Management'}
          </Tag>
          <Tag color={record.can_call_assistant ? 'green' : 'default'}>
            {record.can_call_assistant ? 'Assistant Access' : 'No Assistant Access'}
          </Tag>
        </Space>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      render: (record: ApiKey) => (
        <Badge 
          status={record.is_disabled ? 'error' : 'success'} 
          text={record.is_disabled ? 'Disabled' : 'Active'} 
        />
      ),
    },
    {
      title: 'Assistants',
      key: 'assistants',
      render: (record: ApiKey) => (
        <Button
          size="small"
          icon={<RobotOutlined />}
          onClick={() => navigate(`/api-keys/${record.id}`)}
        >
          Manage
        </Button>
      ),
    },
    {
      title: 'Created At',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (text: string) => new Date(text).toLocaleString(),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (record: ApiKey) => (
        <Space>
          <Tooltip title="View Details">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => navigate(`/api-keys/${record.id}`)}
            />
          </Tooltip>
          <Tooltip title="Edit">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => navigate(`/api-keys/${record.id}/edit`)}
            />
          </Tooltip>
          <Tooltip title={record.is_disabled ? 'Enable' : 'Disable'}>
            <Button
              type="text"
              icon={record.is_disabled ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
              onClick={() => handleToggleDisabled(record)}
            />
          </Tooltip>
          <Popconfirm
            title="Are you sure you want to delete this API key?"
            onConfirm={() => handleDelete(record.id)}
            okText="Yes"
            cancelText="No"
          >
            <Tooltip title="Delete">
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Title level={2}>API Keys</Title>
            <Text type="secondary">
              Manage API keys for authentication and authorization.
            </Text>
          </div>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/api-keys/create')}
          >
            Create API Key
          </Button>
        </div>

        {/* Filter */}
        <div>
          <Space align="center">
            <Switch
              checked={includeDisabled}
              onChange={setIncludeDisabled}
            />
            <Text>Include disabled keys</Text>
          </Space>
        </div>

        {/* API Keys Table */}
        <Card>
          <Table
            columns={columns}
            dataSource={apiKeysData?.data || []}
            rowKey="id"
            loading={isLoading}
            pagination={{
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total) => `Total ${total} API keys`,
            }}
          />
        </Card>
      </Space>
    </div>
  );
};

export default ApiKeys;
