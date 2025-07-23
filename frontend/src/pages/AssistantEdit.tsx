import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Typography,
  Button,
  Space,
  Spin,
  Alert,
  Form,
  Input,
  Select,
  Switch,
  InputNumber,
  Row,
  Col,
  Divider,
  Tooltip,
  message,
} from 'antd';
import {
  ArrowLeftOutlined,
  InfoCircleOutlined,
  SaveOutlined,
  RollbackOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation } from '@tanstack/react-query';
import { AssistantService } from '@/services/assistant.service';
import { McpToolService } from '@/services/mcpTool.service';
import type { AssistantType, UpdateAssistantRequest } from '@/types/assistant.types';
// import type { McpTool } from '@/types/api.types';

const { Title, } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const ASSISTANT_TYPES = [
  { value: 'dedicated', label: 'Dedicated', description: 'Uses a fixed set of tools' },
  { value: 'universal', label: 'Universal', description: 'Dynamically recalls tools based on intent' },
];

const AssistantEdit: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const assistantId = parseInt(id || '0', 10);
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [assistantType, setAssistantType] = useState<AssistantType>('dedicated');

  // Fetch assistant details
  const {
    data: assistantData,
    isLoading: isAssistantLoading,
    error: assistantError,
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

  // Update assistant mutation
  const updateMutation = useMutation({
    mutationFn: (data: UpdateAssistantRequest) => AssistantService.updateAssistant(assistantId, data),
    onSuccess: () => {
      message.success('Assistant updated successfully!');
      navigate(`/assistants/${assistantId}`);
    },
    onError: (error: any) => {
      message.error(error.response?.data?.detail || 'Failed to update assistant');
    },
  });

  // Set form values when assistant data is loaded
  useEffect(() => {
    if (assistantData?.data) {
      const assistant = assistantData.data;
      setAssistantType(assistant.type);

      form.setFieldsValue({
        name: assistant.name,
        description: assistant.description,
        type: assistant.type,
        intent_model: assistant.intent_model,
        max_tools: assistant.max_tools,
        enabled: assistant.enabled,
        tool_ids: assistant.tools.map(tool => tool.id),
      });
    }
  }, [assistantData, form]);

  const handleTypeChange = (value: AssistantType) => {
    setAssistantType(value);
  };

  const handleSubmit = (values: any) => {
    updateMutation.mutate(values);
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

  if (!assistantData?.data) {
    return (
      <Alert
        message="Assistant Not Found"
        description="The requested assistant could not be found."
        type="error"
        showIcon
      />
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate(`/assistants/${assistantId}`)}
          style={{ marginRight: 16 }}
        >
          Back to Assistant
        </Button>
      </div>

      {/* Edit Form */}
      <Card
        title={
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <Title level={3} style={{ margin: 0 }}>Edit Assistant</Title>
          </div>
        }
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            type: 'dedicated',
            max_tools: 5,
            enabled: true,
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
              <Alert
                message="Tool Management"
                description="You can manage tools and their priorities in the assistant detail page after saving."
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
              />
              <Form.Item
                name="tool_ids"
                label="Tools"
                help="Select tools for this assistant. You can manage tool priorities in the assistant detail page."
              >
                <Select
                  mode="multiple"
                  placeholder="Select tools"
                  optionFilterProp="children"
                  style={{ width: '100%' }}
                  loading={isToolsLoading}
                >
                  {(toolsData?.data || []).map(tool => (
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
              <Button
                type="primary"
                htmlType="submit"
                icon={<SaveOutlined />}
                loading={updateMutation.isPending}
              >
                Save Changes
              </Button>
              <Button
                icon={<RollbackOutlined />}
                onClick={() => navigate(`/assistants/${assistantId}`)}
              >
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default AssistantEdit;
