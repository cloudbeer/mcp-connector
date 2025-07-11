import React, { useState } from 'react';
import {
  Table,
  Button,
  Space,
  Tag,
  Typography,
  Modal,
  Form,
  Input,
  Switch,
  DatePicker,
  Select,
  message,
  Popconfirm,
  Card,
  Tooltip,
  Alert,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  CopyOutlined,
  KeyOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { ApiKeyService } from '@/services/apiKey.service';
import type { ApiKey, CreateApiKeyRequest, UpdateApiKeyRequest } from '@/types/api.types';
import { PERMISSION_LABELS } from '@/constants';

const { Title, Text } = Typography;
const { Option } = Select;

const ApiKeys: React.FC = () => {
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editingKey, setEditingKey] = useState<ApiKey | null>(null);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const queryClient = useQueryClient();

  // Fetch API keys
  const { data: apiKeysData, isLoading } = useQuery({
    queryKey: ['apiKeys'],
    queryFn: () => ApiKeyService.listApiKeys(true), // Include disabled keys
  });

  // Create API key mutation
  const createMutation = useMutation({
    mutationFn: ApiKeyService.createApiKey,
    onSuccess: (data) => {
      message.success('API key created successfully!');
      setIsCreateModalVisible(false);
      createForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
      
      // Show the new API key in a modal
      Modal.info({
        title: 'New API Key Created',
        width: 600,
        content: (
          <div>
            <Alert
              message="Important: Save this API key now!"
              description="You won't be able to see the full key again after closing this dialog."
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
            />
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <Text strong>Name:</Text> {data.data?.name}
              </div>
              <div>
                <Text strong>API Key:</Text>
                <Input.Group compact style={{ marginTop: 8 }}>
                  <Input
                    value={data.data?.api_key}
                    readOnly
                    style={{ width: 'calc(100% - 40px)' }}
                  />
                  <Button
                    icon={<CopyOutlined />}
                    onClick={() => {
                      navigator.clipboard.writeText(data.data?.api_key || '');
                      message.success('API key copied to clipboard!');
                    }}
                  />
                </Input.Group>
              </div>
            </Space>
          </div>
        ),
      });
    },
    onError: (error: any) => {
      message.error(error.response?.data?.detail || 'Failed to create API key');
    },
  });

  // Update API key mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateApiKeyRequest }) =>
      ApiKeyService.updateApiKey(id, data),
    onSuccess: () => {
      message.success('API key updated successfully!');
      setIsEditModalVisible(false);
      setEditingKey(null);
      editForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
    },
    onError: (error: any) => {
      message.error(error.response?.data?.detail || 'Failed to update API key');
    },
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

  const handleCreate = (values: CreateApiKeyRequest) => {
    createMutation.mutate(values);
  };

  const handleEdit = (key: ApiKey) => {
    setEditingKey(key);
    editForm.setFieldsValue({
      name: key.name,
      can_manage: key.can_manage,
      can_call_assistant: key.can_call_assistant,
      is_disabled: key.is_disabled,
      expires_at: key.expires_at ? dayjs(key.expires_at) : null,
    });
    setIsEditModalVisible(true);
  };

  const handleUpdate = (values: UpdateApiKeyRequest) => {
    if (!editingKey) return;
    
    updateMutation.mutate({
      id: editingKey.id,
      data: {
        ...values,
        expires_at: values.expires_at ? dayjs(values.expires_at).toISOString() : null,
      },
    });
  };

  const handleDelete = (id: number) => {
    deleteMutation.mutate(id);
  };

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: ApiKey) => (
        <Space>
          <KeyOutlined />
          <span>{text}</span>
          {record.is_disabled && <Tag color="red">Disabled</Tag>}
        </Space>
      ),
    },
    {
      title: 'Key Prefix',
      dataIndex: 'key_prefix',
      key: 'key_prefix',
      render: (text: string) => <Text code>{text}</Text>,
    },
    {
      title: 'Permissions',
      key: 'permissions',
      render: (record: ApiKey) => (
        <Space wrap>
          {record.can_manage && <Tag color="blue">Management</Tag>}
          {record.can_call_assistant && <Tag color="green">Assistant</Tag>}
        </Space>
      ),
    },
    {
      title: 'Last Used',
      dataIndex: 'last_used_at',
      key: 'last_used_at',
      render: (date: string) => (
        date ? dayjs(date).format('YYYY-MM-DD HH:mm') : 'Never'
      ),
    },
    {
      title: 'Created',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (record: ApiKey) => (
        <Space>
          <Tooltip title="Edit">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
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
              Manage API keys and their permissions for accessing the MCP Connector.
            </Text>
          </div>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setIsCreateModalVisible(true)}
          >
            Create API Key
          </Button>
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
              showTotal: (total) => `Total ${total} items`,
            }}
          />
        </Card>

        {/* Create Modal */}
        <Modal
          title="Create API Key"
          open={isCreateModalVisible}
          onCancel={() => {
            setIsCreateModalVisible(false);
            createForm.resetFields();
          }}
          footer={null}
          width={600}
        >
          <Form
            form={createForm}
            layout="vertical"
            onFinish={handleCreate}
          >
            <Form.Item
              name="name"
              label="Name"
              rules={[{ required: true, message: 'Please enter a name for the API key' }]}
            >
              <Input placeholder="Enter API key name" />
            </Form.Item>

            <Form.Item name="can_manage" label="Management Permission" valuePropName="checked">
              <Switch />
            </Form.Item>

            <Form.Item name="can_call_assistant" label="Assistant Permission" valuePropName="checked" initialValue={true}>
              <Switch />
            </Form.Item>

            <Form.Item name="expires_at" label="Expiration Date">
              <DatePicker showTime style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit" loading={createMutation.isPending}>
                  Create
                </Button>
                <Button onClick={() => {
                  setIsCreateModalVisible(false);
                  createForm.resetFields();
                }}>
                  Cancel
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>

        {/* Edit Modal */}
        <Modal
          title="Edit API Key"
          open={isEditModalVisible}
          onCancel={() => {
            setIsEditModalVisible(false);
            setEditingKey(null);
            editForm.resetFields();
          }}
          footer={null}
          width={600}
        >
          <Form
            form={editForm}
            layout="vertical"
            onFinish={handleUpdate}
          >
            <Form.Item
              name="name"
              label="Name"
              rules={[{ required: true, message: 'Please enter a name for the API key' }]}
            >
              <Input placeholder="Enter API key name" />
            </Form.Item>

            <Form.Item name="can_manage" label="Management Permission" valuePropName="checked">
              <Switch />
            </Form.Item>

            <Form.Item name="can_call_assistant" label="Assistant Permission" valuePropName="checked">
              <Switch />
            </Form.Item>

            <Form.Item name="is_disabled" label="Disabled" valuePropName="checked">
              <Switch />
            </Form.Item>

            <Form.Item name="expires_at" label="Expiration Date">
              <DatePicker showTime style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit" loading={updateMutation.isPending}>
                  Update
                </Button>
                <Button onClick={() => {
                  setIsEditModalVisible(false);
                  setEditingKey(null);
                  editForm.resetFields();
                }}>
                  Cancel
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>
      </Space>
    </div>
  );
};

export default ApiKeys;
