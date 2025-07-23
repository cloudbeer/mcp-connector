import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Typography,
  Descriptions,
  Button,
  Space,
  Tag,
  Spin,
  Alert,
  Table,
  Modal,
  Form,
  Select,
  InputNumber,
  Tooltip,
  Popconfirm,
  message,
  Transfer,
  Empty,
} from 'antd';
import {
  ArrowLeftOutlined,
  RobotOutlined,
  ToolOutlined,
  EditOutlined,
  DeleteOutlined,
  PlusOutlined,
  UpOutlined,
  DownOutlined,
  InfoCircleOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AssistantService } from '@/services/assistant.service';
import { McpToolService } from '@/services/mcpTool.service';
import type { AssistantWithTools, AssistantType, ToolInfo } from '@/types/assistant.types';
// import type { McpTool } from '@/types/api.types';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

interface TransferItem {
  key: string;
  title: string;
  description: string;
  disabled: boolean;
  priority?: number;
}

const AssistantDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const assistantId = parseInt(id || '0', 10);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isAddToolModalVisible, setIsAddToolModalVisible] = useState(false);
  const [isBatchEditModalVisible, setIsBatchEditModalVisible] = useState(false);
  const [addToolForm] = Form.useForm();
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [targetKeys, setTargetKeys] = useState<string[]>([]);

  // Fetch assistant details
  const {
    data: assistantData,
    isLoading: isAssistantLoading,
    error: assistantError,
    refetch: refetchAssistant,
  } = useQuery({
    queryKey: ['assistant', assistantId],
    queryFn: () => AssistantService.getAssistant(assistantId),
    enabled: !!assistantId,
  });

  // Fetch all tools for selection
  const { data: toolsData, isLoading: isToolsLoading } = useQuery({
    queryKey: ['mcpTools'],
    queryFn: () => McpToolService.listTools(undefined, true),
    enabled: !!assistantId,
  });

  // Add tool mutation
  const addToolMutation = useMutation({
    mutationFn: ({ assistantId, toolId, priority }: { assistantId: number; toolId: number; priority: number }) =>
      AssistantService.addToolToAssistant(assistantId, toolId, priority),
    onSuccess: () => {
      message.success('Tool added to assistant successfully!');
      setIsAddToolModalVisible(false);
      addToolForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ['assistant', assistantId] });
    },
    onError: (error: any) => {
      message.error(error.response?.data?.detail || 'Failed to add tool to assistant');
    },
  });

  // Remove tool mutation
  const removeToolMutation = useMutation({
    mutationFn: ({ assistantId, toolId }: { assistantId: number; toolId: number }) =>
      AssistantService.removeToolFromAssistant(assistantId, toolId),
    onSuccess: () => {
      message.success('Tool removed from assistant successfully!');
      queryClient.invalidateQueries({ queryKey: ['assistant', assistantId] });
    },
    onError: (error: any) => {
      message.error(error.response?.data?.detail || 'Failed to remove tool from assistant');
    },
  });

  // Update tool priority mutation
  const updatePriorityMutation = useMutation({
    mutationFn: ({ assistantId, toolId, priority }: { assistantId: number; toolId: number; priority: number }) =>
      AssistantService.updateToolPriority(assistantId, toolId, priority),
    onSuccess: () => {
      message.success('Tool priority updated successfully!');
      queryClient.invalidateQueries({ queryKey: ['assistant', assistantId] });
    },
    onError: (error: any) => {
      message.error(error.response?.data?.detail || 'Failed to update tool priority');
    },
  });

  // Batch update tools mutation
  const batchUpdateToolsMutation = useMutation({
    mutationFn: async (toolIds: number[]) => {
      // First, remove all existing tools
      const assistant = assistantData?.data;
      if (!assistant) return;

      // Get current tools
      const currentToolIds = assistant.tools.map(tool => tool.id);

      // Remove tools that are no longer selected
      const toolsToRemove = currentToolIds.filter(id => !toolIds.includes(id));
      for (const toolId of toolsToRemove) {
        await AssistantService.removeToolFromAssistant(assistantId, toolId);
      }

      // Add new tools
      const toolsToAdd = toolIds.filter(id => !currentToolIds.includes(id));
      for (let i = 0; i < toolsToAdd.length; i++) {
        await AssistantService.addToolToAssistant(assistantId, toolsToAdd[i], i + 1);
      }

      return { success: true };
    },
    onSuccess: () => {
      message.success('Tools updated successfully!');
      setIsBatchEditModalVisible(false);
      queryClient.invalidateQueries({ queryKey: ['assistant', assistantId] });
    },
    onError: (error: any) => {
      message.error(error.response?.data?.detail || 'Failed to update tools');
    },
  });

  // Update targetKeys when assistant data changes
  useEffect(() => {
    if (assistantData?.data) {
      const toolIds = assistantData.data.tools.map(tool => tool.id.toString());
      setTargetKeys(toolIds);
    }
  }, [assistantData]);

  const handleAddTool = (values: { tool_id: number; priority: number }) => {
    addToolMutation.mutate({
      assistantId,
      toolId: values.tool_id,
      priority: values.priority,
    });
  };

  const handleRemoveTool = (toolId: number) => {
    removeToolMutation.mutate({ assistantId, toolId });
  };

  const handleMovePriorityUp = (tool: ToolInfo) => {
    // Find the tool with the next lower priority
    const sortedTools = [...(assistant?.tools || [])].sort((a, b) => a.priority - b.priority);
    const currentIndex = sortedTools.findIndex(t => t.id === tool.id);

    if (currentIndex > 0) {
      const newPriority = sortedTools[currentIndex - 1].priority - 1;
      updatePriorityMutation.mutate({
        assistantId,
        toolId: tool.id,
        priority: newPriority,
      });
    }
  };

  const handleMovePriorityDown = (tool: ToolInfo) => {
    // Find the tool with the next higher priority
    const sortedTools = [...(assistant?.tools || [])].sort((a, b) => a.priority - b.priority);
    const currentIndex = sortedTools.findIndex(t => t.id === tool.id);

    if (currentIndex < sortedTools.length - 1) {
      const newPriority = sortedTools[currentIndex + 1].priority + 1;
      updatePriorityMutation.mutate({
        assistantId,
        toolId: tool.id,
        priority: newPriority,
      });
    }
  };

  const handleBatchEditTools = () => {
    const toolIds = targetKeys.map(key => parseInt(key, 10));
    batchUpdateToolsMutation.mutate(toolIds);
  };

  // Transfer list change handlers
  const handleChange = (nextTargetKeys: any,) => {
    setTargetKeys(nextTargetKeys);
  };

  const handleSelectChange = (sourceSelectedKeys: any, targetSelectedKeys: any) => {
    setSelectedKeys([...sourceSelectedKeys, ...targetSelectedKeys]);
  };

  // Loading and error states
  if (isAssistantLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '50px' }}>
        <Spin size="large" tip="Loading assistant details..." />
      </div>
    );
  }

  if (assistantError) {
    return (
      <Alert
        message="Error"
        description="Failed to load assistant details. Please try again later."
        type="error"
        showIcon
      />
    );
  }

  const assistant: AssistantWithTools | undefined = assistantData?.data;
  if (!assistant) {
    return (
      <Alert
        message="Assistant Not Found"
        description="The requested assistant could not be found."
        type="error"
        showIcon
      />
    );
  }

  // Get assistant type tag
  const getAssistantTypeTag = (type: AssistantType) => {
    switch (type) {
      case 'dedicated':
        return <Tag color="blue">Dedicated</Tag>;
      case 'universal':
        return <Tag color="purple">Universal</Tag>;
      default:
        return <Tag>Unknown</Tag>;
    }
  };

  // Get available tools (not already added to the assistant)
  const getAvailableTools = () => {
    const currentToolIds = assistant.tools.map(tool => tool.id);
    return (toolsData?.data || []).filter(tool => !currentToolIds.includes(tool.id));
  };

  // Sort tools by priority
  const sortedTools = [...assistant.tools].sort((a, b) => a.priority - b.priority);

  // Prepare data for transfer component
  const transferData: TransferItem[] = (toolsData?.data || []).map(tool => ({
    key: tool.id.toString(),
    title: tool.name,
    description: tool.description || 'No description',
    disabled: false,
  }));

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/assistants')}
          style={{ marginRight: 16 }}
        >
          Back to Assistants
        </Button>
      </div>

      {/* Assistant Header */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Space align="center">
              <RobotOutlined style={{ fontSize: 24 }} />
              <Title level={2} style={{ margin: 0 }}>{assistant.name}</Title>
              {getAssistantTypeTag(assistant.type)}
              <Tag color={assistant.enabled ? 'green' : 'orange'}>
                {assistant.enabled ? 'Enabled' : 'Disabled'}
              </Tag>
            </Space>
            <Paragraph type="secondary" style={{ marginTop: 8 }}>
              {assistant.description || 'No description provided'}
            </Paragraph>
          </div>
          <Space>
            <Button
              icon={<EditOutlined />}
              onClick={() => navigate(`/assistants/${assistantId}/edit`)}
            >
              Edit Assistant
            </Button>
            <Button
              icon={<SyncOutlined />}
              onClick={() => refetchAssistant()}
            >
              Refresh
            </Button>
          </Space>
        </div>
      </Card>

      {/* Assistant Details */}
      <Card style={{ marginTop: 16 }}>
        <Descriptions title="Assistant Details" bordered column={2}>
          <Descriptions.Item label="ID">{assistant.id}</Descriptions.Item>
          <Descriptions.Item label="Type">{getAssistantTypeTag(assistant.type)}</Descriptions.Item>
          <Descriptions.Item label="Created At">
            {new Date(assistant.created_at).toLocaleString()}
          </Descriptions.Item>
          <Descriptions.Item label="Updated At">
            {new Date(assistant.updated_at).toLocaleString()}
          </Descriptions.Item>

          {assistant.type === 'universal' && (
            <>
              <Descriptions.Item label="Intent Model">
                {assistant.intent_model || 'Not specified'}
              </Descriptions.Item>
              <Descriptions.Item label="Max Tools">
                {assistant.max_tools}
              </Descriptions.Item>
            </>
          )}
        </Descriptions>
      </Card>

      {/* Tools Section */}
      {assistant.type === 'dedicated' && (
        <Card
          title={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Associated Tools</span>
              <Space>
                <Button
                  icon={<ToolOutlined />}
                  onClick={() => setIsBatchEditModalVisible(true)}
                >
                  Batch Edit Tools
                </Button>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => setIsAddToolModalVisible(true)}
                  disabled={getAvailableTools().length === 0}
                >
                  Add Tool
                </Button>
              </Space>
            </div>
          }
          style={{ marginTop: 16 }}
        >
          {sortedTools.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <span>
                  This assistant doesn't have any tools associated with it yet.
                  <br />
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    style={{ marginTop: 16 }}
                    onClick={() => setIsAddToolModalVisible(true)}
                    disabled={getAvailableTools().length === 0}
                  >
                    Add Tool
                  </Button>
                </span>
              }
            />
          ) : (
            <Table
              dataSource={sortedTools}
              rowKey="id"
              pagination={false}
              columns={[
                {
                  title: 'Priority',
                  dataIndex: 'priority',
                  key: 'priority',
                  width: 100,
                  render: (priority: number) => (
                    <Tag color="blue">{priority}</Tag>
                  ),
                },
                {
                  title: 'Name',
                  dataIndex: 'name',
                  key: 'name',
                  render: (text: string) => (
                    <Space>
                      <ToolOutlined />
                      <Text strong>{text}</Text>
                    </Space>
                  ),
                },
                {
                  title: 'Description',
                  dataIndex: 'description',
                  key: 'description',
                  ellipsis: true,
                  render: (text: string) => (
                    <Tooltip title={text}>
                      <Text ellipsis style={{ maxWidth: 300 }}>
                        {text || 'No description'}
                      </Text>
                    </Tooltip>
                  ),
                },
                {
                  title: 'Actions',
                  key: 'actions',
                  width: 200,
                  render: (_, record: ToolInfo) => (
                    <Space>
                      <Tooltip title="Move Up">
                        <Button
                          type="text"
                          icon={<UpOutlined />}
                          onClick={() => handleMovePriorityUp(record)}
                          disabled={record.priority === Math.min(...sortedTools.map(t => t.priority))}
                        />
                      </Tooltip>
                      <Tooltip title="Move Down">
                        <Button
                          type="text"
                          icon={<DownOutlined />}
                          onClick={() => handleMovePriorityDown(record)}
                          disabled={record.priority === Math.max(...sortedTools.map(t => t.priority))}
                        />
                      </Tooltip>
                      <Popconfirm
                        title="Are you sure you want to remove this tool?"
                        onConfirm={() => handleRemoveTool(record.id)}
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
        </Card>
      )}

      {/* Universal Assistant Info */}
      {assistant.type === 'universal' && (
        <Card style={{ marginTop: 16 }}>
          <Alert
            message="Universal Assistant"
            description={
              <div>
                <p>
                  This is a universal assistant that dynamically recalls tools based on user intent.
                  It can use any available tool in the system, up to a maximum of {assistant.max_tools} tools per query.
                </p>
                <p>
                  Universal assistants use vector search and intent recognition to find the most relevant tools for each user query.
                </p>
              </div>
            }
            type="info"
            showIcon
            icon={<InfoCircleOutlined />}
          />
        </Card>
      )}

      {/* Add Tool Modal */}
      <Modal
        title="Add Tool to Assistant"
        open={isAddToolModalVisible}
        onCancel={() => {
          setIsAddToolModalVisible(false);
          addToolForm.resetFields();
        }}
        footer={null}
      >
        <Form
          form={addToolForm}
          layout="vertical"
          onFinish={handleAddTool}
          initialValues={{ priority: 1 }}
        >
          <Form.Item
            name="tool_id"
            label="Tool"
            rules={[{ required: true, message: 'Please select a tool' }]}
          >
            <Select
              placeholder="Select a tool"
              loading={isToolsLoading}
              showSearch
              optionFilterProp="children"
            >
              {getAvailableTools().map(tool => (
                <Option key={tool.id} value={tool.id}>
                  {tool.name} - {tool.description?.substring(0, 30) || 'No description'}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="priority"
            label="Priority"
            help="Lower number = higher priority"
            rules={[{ required: true, message: 'Please enter priority' }]}
          >
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                loading={addToolMutation.isPending}
              >
                Add Tool
              </Button>
              <Button onClick={() => {
                setIsAddToolModalVisible(false);
                addToolForm.resetFields();
              }}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Batch Edit Tools Modal */}
      <Modal
        title="Batch Edit Tools"
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
            onClick={handleBatchEditTools}
            loading={batchUpdateToolsMutation.isPending}
          >
            Save Changes
          </Button>,
        ]}
      >
        <div style={{ marginBottom: 16 }}>
          <Alert
            message="Tool Selection"
            description="Select the tools you want to associate with this assistant. Tools on the right side will be available to the assistant."
            type="info"
            showIcon
          />
        </div>
        <Transfer
          dataSource={transferData}
          titles={['Available Tools', 'Assistant Tools']}
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
        <div style={{ marginTop: 16 }}>
          <Alert
            message="Note"
            description="After saving, you can adjust the priority of tools in the main view."
            type="warning"
            showIcon
          />
        </div>
      </Modal>
    </div>
  );
};

export default AssistantDetail;
