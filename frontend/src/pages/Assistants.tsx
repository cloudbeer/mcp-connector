import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table,
  Button,
  Space,
  Tag,
  Typography,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  InputNumber,
  Card,
  Tooltip,
  Popconfirm,
  Row,
  Col,
  Divider,
  message,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  RobotOutlined,
  ToolOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AssistantService } from '@/services/assistant.service';
import { McpToolService } from '@/services/mcpTool.service';
import type { Assistant, AssistantType, CreateAssistantRequest } from '@/types/assistant.types';
import type { McpTool } from '@/types/api.types';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const ASSISTANT_TYPES = [
  { value: 'dedicated', label: 'Dedicated', description: 'Uses a fixed set of tools' },
  { value: 'universal', label: 'Universal', description: 'Dynamically recalls tools based on intent' },
];

const Assistants: React.FC = () => {
  const navigate = useNavigate();
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editingAssistant, setEditingAssistant] = useState<Assistant | null>(null);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const queryClient = useQueryClient();

  // Fetch assistants
  const { data: assistantsData, isLoading } = useQuery({
    queryKey: ['assistants'],
    queryFn: () => AssistantService.listAssistants(false),
  });

  // Fetch tools for selection
  const { data: toolsData } = useQuery({
    queryKey: ['mcpTools'],
    queryFn: () => McpToolService.listTools(undefined, true),
  });

  // Create assistant mutation
  const createMutation = useMutation({
    mutationFn: AssistantService.createAssistant,
    onSuccess: () => {
      message.success('Assistant created successfully!');
      setIsCreateModalVisible(false);
      createForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ['assistants'] });
    },
    onError: (error: any) => {
      message.error(error.response?.data?.detail || 'Failed to create assistant');
    },
  });

  // Update assistant mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      AssistantService.updateAssistant(id, data),
    onSuccess: () => {
      message.success('Assistant updated successfully!');
      setIsEditModalVisible(false);
      setEditingAssistant(null);
      editForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ['assistants'] });
    },
    onError: (error: any) => {
      message.error(error.response?.data?.detail || 'Failed to update assistant');
    },
  });

  // Delete assistant mutation
  const deleteMutation = useMutation({
    mutationFn: AssistantService.deleteAssistant,
    onSuccess: () => {
      message.success('Assistant deleted successfully!');
      queryClient.invalidateQueries({ queryKey: ['assistants'] });
    },
    onError: (error: any) => {
      message.error(error.response?.data?.detail || 'Failed to delete assistant');
    },
  });

  const handleCreate = (values: CreateAssistantRequest) => {
    createMutation.mutate(values);
  };

  const handleEdit = (assistant: Assistant) => {
    setEditingAssistant(assistant);
    editForm.setFieldsValue({
      name: assistant.name,
      description: assistant.description,
      type: assistant.type,
      intent_model: assistant.intent_model,
      max_tools: assistant.max_tools,
      enabled: assistant.enabled,
    });
    setIsEditModalVisible(true);
  };

  const handleUpdate = (values: any) => {
    if (!editingAssistant) return;
    
    updateMutation.mutate({
      id: editingAssistant.id,
      data: values,
    });
  };

  const handleDelete = (id: number) => {
    deleteMutation.mutate(id);
  };

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

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: Assistant) => (
        <Space>
          <RobotOutlined />
          <a onClick={() => navigate(`/assistants/${record.id}`)}>{text}</a>
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
          <Text ellipsis style={{ maxWidth: 200 }}>
            {text || 'No description'}
          </Text>
        </Tooltip>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (type: AssistantType) => getAssistantTypeTag(type),
    },
    {
      title: 'Status',
      key: 'status',
      render: (record: Assistant) => (
        <Tag color={record.enabled ? 'green' : 'orange'}>
          {record.enabled ? 'Enabled' : 'Disabled'}
        </Tag>
      ),
    },
    {
      title: 'Tools',
      key: 'tools',
      render: (record: Assistant) => {
        if (record.type === 'dedicated') {
          return (
            <Button 
              size="small" 
              icon={<ToolOutlined />}
              onClick={() => navigate(`/assistants/${record.id}`)}
            >
              Manage Tools
            </Button>
          );
        } else {
          return (
            <Tooltip title="Universal assistants use dynamic tool recall">
              <Tag icon={<InfoCircleOutlined />} color="purple">Dynamic</Tag>
            </Tooltip>
          );
        }
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (record: Assistant) => (
        <Space>
          <Tooltip title="Edit">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            />
          </Tooltip>
          <Popconfirm
            title="Are you sure you want to delete this assistant?"
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
            <Title level={2}>Assistants</Title>
            <Text type="secondary">
              Manage assistants and their tool configurations.
            </Text>
          </div>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setIsCreateModalVisible(true)}
          >
            Create Assistant
          </Button>
        </div>

        {/* Assistants Table */}
        <Card>
          <Table
            columns={columns}
            dataSource={assistantsData?.data || []}
            rowKey="id"
            loading={isLoading}
            pagination={{
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total) => `Total ${total} assistants`,
            }}
          />
        </Card>

        {/* Create Modal */}
        <Modal
          title="Create Assistant"
          open={isCreateModalVisible}
          onCancel={() => {
            setIsCreateModalVisible(false);
            createForm.resetFields();
          }}
          footer={null}
          width={800}
        >
          <AssistantForm
            form={createForm}
            tools={toolsData?.data || []}
            onFinish={handleCreate}
            onCancel={() => {
              setIsCreateModalVisible(false);
              createForm.resetFields();
            }}
            loading={createMutation.isPending}
          />
        </Modal>

        {/* Edit Modal */}
        <Modal
          title="Edit Assistant"
          open={isEditModalVisible}
          onCancel={() => {
            setIsEditModalVisible(false);
            setEditingAssistant(null);
            editForm.resetFields();
          }}
          footer={null}
          width={800}
        >
          <AssistantForm
            form={editForm}
            tools={toolsData?.data || []}
            onFinish={handleUpdate}
            onCancel={() => {
              setIsEditModalVisible(false);
              setEditingAssistant(null);
              editForm.resetFields();
            }}
            loading={updateMutation.isPending}
            initialAssistant={editingAssistant}
          />
        </Modal>
      </Space>
    </div>
  );
};

// Assistant Form Component
interface AssistantFormProps {
  form: any;
  tools: McpTool[];
  onFinish: (values: any) => void;
  onCancel: () => void;
  loading: boolean;
  initialAssistant?: Assistant | null;
}

const AssistantForm: React.FC<AssistantFormProps> = ({
  form,
  tools,
  onFinish,
  onCancel,
  loading,
  initialAssistant,
}) => {
  const [assistantType, setAssistantType] = useState<AssistantType>(
    initialAssistant?.type || 'dedicated'
  );

  const handleTypeChange = (value: AssistantType) => {
    setAssistantType(value);
  };

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={onFinish}
      initialValues={{
        type: 'dedicated',
        max_tools: 5,
        enabled: true,
        ...initialAssistant,
      }}
    >
      <Row gutter={16}>
        <Col span={16}>
          <Form.Item
            name="name"
            label="Assistant Name"
            rules={[{ required: true, message: 'Please enter assistant name' }]}
          >
            <Input placeholder="Enter assistant name" />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item
            name="type"
            label="Assistant Type"
            rules={[{ required: true, message: 'Please select assistant type' }]}
          >
            <Select onChange={handleTypeChange}>
              {ASSISTANT_TYPES.map(type => (
                <Option key={type.value} value={type.value}>
                  <Space>
                    {type.label}
                    <Tooltip title={type.description}>
                      <InfoCircleOutlined />
                    </Tooltip>
                  </Space>
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Col>
      </Row>

      <Form.Item name="description" label="Description">
        <TextArea rows={2} placeholder="Enter assistant description" />
      </Form.Item>

      {assistantType === 'universal' && (
        <>
          <Divider orientation="left">Universal Assistant Configuration</Divider>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="intent_model" label="Intent Model">
                <Input placeholder="e.g., gpt-4-turbo" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="max_tools" label="Maximum Tools">
                <InputNumber min={1} max={20} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        </>
      )}

      {assistantType === 'dedicated' && (
        <>
          <Divider orientation="left">Dedicated Assistant Configuration</Divider>
          <Form.Item
            name="tool_ids"
            label="Tools"
            help="Select tools for this assistant. You can manage tool priorities after creation."
          >
            <Select
              mode="multiple"
              placeholder="Select tools"
              optionFilterProp="children"
              style={{ width: '100%' }}
            >
              {tools.map(tool => (
                <Option key={tool.id} value={tool.id}>
                  {tool.name} - {tool.description?.substring(0, 30) || 'No description'}
                </Option>
              ))}
            </Select>
          </Form.Item>
        </>
      )}

      <Divider />

      <Form.Item name="enabled" label="Enabled" valuePropName="checked">
        <Switch />
      </Form.Item>

      <Form.Item>
        <Space>
          <Button type="primary" htmlType="submit" loading={loading}>
            {initialAssistant ? 'Update' : 'Create'} Assistant
          </Button>
          <Button onClick={onCancel}>
            Cancel
          </Button>
        </Space>
      </Form.Item>
    </Form>
  );
};

export default Assistants;
