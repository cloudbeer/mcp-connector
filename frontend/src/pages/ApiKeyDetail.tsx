import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Typography,
  Descriptions,
  Button,
  Space,
  Tag,
  Divider,
  Spin,
  Alert,
  Table,
  Modal,
  Form,
  Select,
  Row,
  Col,
  Tooltip,
  Popconfirm,
  message,
  Badge,
  Tabs,
  Transfer,
} from 'antd';
import {
  ArrowLeftOutlined,
  KeyOutlined,
  EditOutlined,
  DeleteOutlined,
  PlusOutlined,
  SyncOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  InfoCircleOutlined,
  RobotOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiKeyService } from '@/services/apiKey.service';
import { AssistantService } from '@/services/assistant.service';
import type { ApiKey, ApiKeyAssistant } from '@/types/apiKey.types';
import type { Assistant } from '@/types/assistant.types';

const { Title, Text, Paragraph } = Typography;
const { TabPane } = Tabs;
const { Option } = Select;

interface TransferItem {
  key: string;
  title: string;
  description: string;
  disabled: boolean;
}

const ApiKeyDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const apiKeyId = parseInt(id || '0', 10);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isAddAssistantModalVisible, setIsAddAssistantModalVisible] = useState(false);
  const [isBatchEditModalVisible, setIsBatchEditModalVisible] = useState(false);
  const [addAssistantForm] = Form.useForm();
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [targetKeys, setTargetKeys] = useState<string[]>([]);

  // Fetch API key details
  const {
    data: apiKeyData,
    isLoading: isApiKeyLoading,
    error: apiKeyError,
    refetch: refetchApiKey,
  } = useQuery({
    queryKey: ['apiKey', apiKeyId],
    queryFn: () => ApiKeyService.getApiKey(apiKeyId),
    enabled: !!apiKeyId,
  });

  // Fetch API key assistants
  const {
    data: assistantsData,
    isLoading: isAssistantsLoading,
    error: assistantsError,
    refetch: refetchAssistants,
  } = useQuery({
    queryKey: ['apiKeyAssistants', apiKeyId],
    queryFn: () => ApiKeyService.getKeyAssistants(apiKeyId),
    enabled: !!apiKeyId,
  });

  // Fetch all assistants for selection
  const { data: allAssistantsData, isLoading: isAllAssistantsLoading } = useQuery({
    queryKey: ['assistants'],
    queryFn: () => AssistantService.listAssistants(true),
    enabled: !!apiKeyId,
  });

  // Bind assistant mutation
  const bindAssistantMutation = useMutation({
    mutationFn: ({ keyId, assistantId }: { keyId: number; assistantId: number }) =>
      ApiKeyService.bindAssistantToKey(keyId, assistantId),
    onSuccess: () => {
      message.success('Assistant bound to API key successfully!');
      setIsAddAssistantModalVisible(false);
      addAssistantForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ['apiKeyAssistants', apiKeyId] });
    },
    onError: (error: any) => {
      message.error(error.response?.data?.detail || 'Failed to bind assistant to API key');
    },
  });

  // Unbind assistant mutation
  const unbindAssistantMutation = useMutation({
    mutationFn: ({ keyId, assistantId }: { keyId: number; assistantId: number }) =>
      ApiKeyService.unbindAssistantFromKey(keyId, assistantId),
    onSuccess: () => {
      message.success('Assistant unbound from API key successfully!');
      queryClient.invalidateQueries({ queryKey: ['apiKeyAssistants', apiKeyId] });
    },
    onError: (error: any) => {
      message.error(error.response?.data?.detail || 'Failed to unbind assistant from API key');
    },
  });

  // Batch update assistants mutation
  const batchUpdateAssistantsMutation = useMutation({
    mutationFn: async (assistantIds: number[]) => {
      // First, get current assistants
      const currentAssistants = assistantsData?.data || [];
      const currentAssistantIds = currentAssistants.map(assistant => assistant.id);
      
      // Remove assistants that are no longer selected
      const assistantsToRemove = currentAssistantIds.filter(id => !assistantIds.includes(id));
      for (const assistantId of assistantsToRemove) {
        await ApiKeyService.unbindAssistantFromKey(apiKeyId, assistantId);
      }
      
      // Add new assistants
      const assistantsToAdd = assistantIds.filter(id => !currentAssistantIds.includes(id));
      for (const assistantId of assistantsToAdd) {
        await ApiKeyService.bindAssistantToKey(apiKeyId, assistantId);
      }
      
      return { success: true };
    },
    onSuccess: () => {
      message.success('Assistants updated successfully!');
      setIsBatchEditModalVisible(false);
      queryClient.invalidateQueries({ queryKey: ['apiKeyAssistants', apiKeyId] });
    },
    onError: (error: any) => {
      message.error(error.response?.data?.detail || 'Failed to update assistants');
    },
  });

  // Update targetKeys when assistants data changes
  React.useEffect(() => {
    if (assistantsData?.data) {
      const assistantIds = assistantsData.data.map(assistant => assistant.id.toString());
      setTargetKeys(assistantIds);
    }
  }, [assistantsData]);

  const handleAddAssistant = (values: { assistant_id: number }) => {
    bindAssistantMutation.mutate({
      keyId: apiKeyId,
      assistantId: values.assistant_id,
    });
  };

  const handleRemoveAssistant = (assistantId: number) => {
    unbindAssistantMutation.mutate({
      keyId: apiKeyId,
      assistantId,
    });
  };

  const handleBatchEditAssistants = () => {
    const assistantIds = targetKeys.map(key => parseInt(key, 10));
    batchUpdateAssistantsMutation.mutate(assistantIds);
  };

  // Transfer list change handlers
  const handleChange = (nextTargetKeys: string[]) => {
    setTargetKeys(nextTargetKeys);
  };

  const handleSelectChange = (sourceSelectedKeys: string[], targetSelectedKeys: string[]) => {
    setSelectedKeys([...sourceSelectedKeys, ...targetSelectedKeys]);
  };

  // Get available assistants (not already bound to the API key)
  const getAvailableAssistants = () => {
    const boundAssistantIds = (assistantsData?.data || []).map(assistant => assistant.id);
    return (allAssistantsData?.data || []).filter(assistant => !boundAssistantIds.includes(assistant.id));
  };

  // Loading and error states
  if (isApiKeyLoading) {
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

  const apiKey: ApiKey | undefined = apiKeyData?.data;
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

  // Prepare data for transfer component
  const transferData: TransferItem[] = (allAssistantsData?.data || []).map(assistant => ({
    key: assistant.id.toString(),
    title: assistant.name,
    description: assistant.description || 'No description',
    disabled: false,
  }));

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

      {/* API Key Header */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Space align="center">
              <KeyOutlined style={{ fontSize: 24 }} />
              <Title level={2} style={{ margin: 0 }}>{apiKey.name}</Title>
              <Tag color={apiKey.is_disabled ? 'error' : 'success'}>
                {apiKey.is_disabled ? 'Disabled' : 'Active'}
              </Tag>
            </Space>
            <Paragraph type="secondary" style={{ marginTop: 8 }}>
              Key Prefix: {apiKey.key_prefix}
            </Paragraph>
          </div>
          <Space>
            <Button
              icon={<EditOutlined />}
              onClick={() => navigate(`/api-keys/${apiKeyId}/edit`)}
            >
              Edit API Key
            </Button>
            <Button
              icon={<SyncOutlined />}
              onClick={() => {
                refetchApiKey();
                refetchAssistants();
              }}
            >
              Refresh
            </Button>
          </Space>
        </div>
      </Card>

      {/* API Key Details */}
      <Card style={{ marginTop: 16 }}>
        <Descriptions title="API Key Details" bordered column={2}>
          <Descriptions.Item label="ID">{apiKey.id}</Descriptions.Item>
          <Descriptions.Item label="Created By">
            {apiKey.created_by || 'Unknown'}
          </Descriptions.Item>
          <Descriptions.Item label="Created At">
            {new Date(apiKey.created_at).toLocaleString()}
          </Descriptions.Item>
          <Descriptions.Item label="Updated At">
            {new Date(apiKey.updated_at).toLocaleString()}
          </Descriptions.Item>
          <Descriptions.Item label="Last Used At">
            {apiKey.last_used_at ? new Date(apiKey.last_used_at).toLocaleString() : 'Never'}
          </Descriptions.Item>
          <Descriptions.Item label="Expires At">
            {apiKey.expires_at ? new Date(apiKey.expires_at).toLocaleString() : 'Never'}
          </Descriptions.Item>
          <Descriptions.Item label="Permissions" span={2}>
            <Space>
              <Tag color={apiKey.can_manage ? 'blue' : 'default'}>
                {apiKey.can_manage ? 'Management' : 'No Management'}
              </Tag>
              <Tag color={apiKey.can_call_assistant ? 'green' : 'default'}>
                {apiKey.can_call_assistant ? 'Assistant Access' : 'No Assistant Access'}
              </Tag>
            </Space>
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* Tabs for Assistants and Usage */}
      <Card style={{ marginTop: 16 }}>
        <Tabs defaultActiveKey="assistants">
          <TabPane tab="Associated Assistants" key="assistants">
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <Text>Assistants that can be accessed using this API key.</Text>
              </div>
              <Space>
                <Button 
                  icon={<RobotOutlined />}
                  onClick={() => setIsBatchEditModalVisible(true)}
                >
                  Batch Edit Assistants
                </Button>
                <Button 
                  type="primary" 
                  icon={<PlusOutlined />}
                  onClick={() => setIsAddAssistantModalVisible(true)}
                  disabled={getAvailableAssistants().length === 0}
                >
                  Add Assistant
                </Button>
              </Space>
            </div>

            {isAssistantsLoading ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <Spin tip="Loading assistants..." />
              </div>
            ) : assistantsError ? (
              <Alert
                message="Error"
                description="Failed to load assistants. Please try again later."
                type="error"
                showIcon
              />
            ) : (assistantsData?.data || []).length === 0 ? (
              <Alert
                message="No Assistants"
                description={
                  <div>
                    This API key doesn't have access to any assistants.
                    {apiKey.can_call_assistant ? (
                      <div style={{ marginTop: 8 }}>
                        <Button 
                          type="primary" 
                          size="small" 
                          icon={<PlusOutlined />}
                          onClick={() => setIsAddAssistantModalVisible(true)}
                          disabled={getAvailableAssistants().length === 0}
                        >
                          Add Assistant
                        </Button>
                      </div>
                    ) : (
                      <div style={{ marginTop: 8 }}>
                        <Text type="warning">
                          Note: This API key doesn't have assistant call permission.
                        </Text>
                      </div>
                    )}
                  </div>
                }
                type="info"
                showIcon
              />
            ) : (
              <Table
                dataSource={assistantsData?.data || []}
                rowKey="id"
                pagination={false}
                columns={[
                  {
                    title: 'Name',
                    dataIndex: 'name',
                    key: 'name',
                    render: (text: string, record: ApiKeyAssistant) => (
                      <Space>
                        <RobotOutlined />
                        <a onClick={() => navigate(`/assistants/${record.id}`)}>{text}</a>
                      </Space>
                    ),
                  },
                  {
                    title: 'Type',
                    dataIndex: 'type',
                    key: 'type',
                    render: (type: string) => (
                      <Tag color={type === 'dedicated' ? 'blue' : 'purple'}>
                        {type === 'dedicated' ? 'Dedicated' : 'Universal'}
                      </Tag>
                    ),
                  },
                  {
                    title: 'Status',
                    key: 'status',
                    render: (record: ApiKeyAssistant) => (
                      <Badge 
                        status={record.enabled ? 'success' : 'error'} 
                        text={record.enabled ? 'Enabled' : 'Disabled'} 
                      />
                    ),
                  },
                  {
                    title: 'Bound At',
                    dataIndex: 'bound_at',
                    key: 'bound_at',
                    render: (text: string) => new Date(text).toLocaleString(),
                  },
                  {
                    title: 'Actions',
                    key: 'actions',
                    render: (_, record: ApiKeyAssistant) => (
                      <Space>
                        <Tooltip title="View Assistant">
                          <Button
                            type="text"
                            icon={<InfoCircleOutlined />}
                            onClick={() => navigate(`/assistants/${record.id}`)}
                          />
                        </Tooltip>
                        <Popconfirm
                          title="Are you sure you want to remove this assistant?"
                          onConfirm={() => handleRemoveAssistant(record.id)}
                          okText="Yes"
                          cancelText="No"
                        >
                          <Tooltip title="Remove">
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
                ]}
              />
            )}
          </TabPane>
          <TabPane tab="Usage Statistics" key="usage">
            <Alert
              message="Usage Statistics"
              description="Usage statistics will be implemented in a future update."
              type="info"
              showIcon
            />
          </TabPane>
        </Tabs>
      </Card>

      {/* Add Assistant Modal */}
      <Modal
        title="Add Assistant to API Key"
        open={isAddAssistantModalVisible}
        onCancel={() => {
          setIsAddAssistantModalVisible(false);
          addAssistantForm.resetFields();
        }}
        footer={null}
      >
        <Form
          form={addAssistantForm}
          layout="vertical"
          onFinish={handleAddAssistant}
        >
          <Form.Item
            name="assistant_id"
            label="Assistant"
            rules={[{ required: true, message: 'Please select an assistant' }]}
          >
            <Select
              placeholder="Select an assistant"
              loading={isAllAssistantsLoading}
              showSearch
              optionFilterProp="children"
            >
              {getAvailableAssistants().map(assistant => (
                <Option key={assistant.id} value={assistant.id}>
                  {assistant.name} - {assistant.type === 'dedicated' ? 'Dedicated' : 'Universal'}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                loading={bindAssistantMutation.isPending}
              >
                Add Assistant
              </Button>
              <Button onClick={() => {
                setIsAddAssistantModalVisible(false);
                addAssistantForm.resetFields();
              }}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Batch Edit Assistants Modal */}
      <Modal
        title="Batch Edit Assistants"
        open={isBatchEditModalVisible}
        onCancel={() => setIsBatchEditModalVisible(false)}
        width={800}
        footer={[
          <Button key="cancel" onClick={() => setIsBatchEditModalVisible(false)}>
            Cancel
          </Button>,
          <Button 
            key="submit" 
            type="primary" 
            onClick={handleBatchEditAssistants}
            loading={batchUpdateAssistantsMutation.isPending}
          >
            Save Changes
          </Button>,
        ]}
      >
        <div style={{ marginBottom: 16 }}>
          <Alert
            message="Assistant Selection"
            description="Select the assistants you want to associate with this API key. Assistants on the right side will be accessible using this API key."
            type="info"
            showIcon
          />
        </div>
        <Transfer
          dataSource={transferData}
          titles={['Available Assistants', 'Associated Assistants']}
          targetKeys={targetKeys}
          selectedKeys={selectedKeys}
          onChange={handleChange}
          onSelectChange={handleSelectChange}
          render={item => (
            <Tooltip title={item.description}>
              <div style={{ padding: '4px 0' }}>
                {item.title}
              </div>
            </Tooltip>
          )}
          listStyle={{
            width: 350,
            height: 400,
          }}
        />
        {!apiKey.can_call_assistant && (
          <div style={{ marginTop: 16 }}>
            <Alert
              message="Warning"
              description="This API key doesn't have assistant call permission. Even if you associate assistants with it, it won't be able to call them."
              type="warning"
              showIcon
            />
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ApiKeyDetail;
