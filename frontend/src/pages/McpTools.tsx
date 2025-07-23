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
  PlayCircleOutlined,
  PauseCircleOutlined,
  ApiOutlined,
  ImportOutlined,
  CodeOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { McpToolService } from '@/services/mcpTool.service';
import type { McpTool, CreateMcpToolRequest, UpdateMcpToolRequest, ServerGroup } from '@/types/api.types';
import { CONNECTION_TYPES, DEFAULT_TIMEOUT, DEFAULT_RETRY_COUNT, DEFAULT_RETRY_DELAY } from '@/constants';
import BatchImportModal from '@/components/BatchImportModal';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const McpTools: React.FC = () => {
  const navigate = useNavigate();
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [isBatchImportVisible, setIsBatchImportVisible] = useState(false);
  const [isJsonConfigVisible, setIsJsonConfigVisible] = useState(false);
  const [editingTool, setEditingTool] = useState<McpTool | null>(null);
  const [viewingTool, setViewingTool] = useState<McpTool | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<number | undefined>();
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const queryClient = useQueryClient();

  // Fetch MCP tools
  const { data: toolsData, isLoading } = useQuery({
    queryKey: ['mcpTools', selectedGroupId],
    queryFn: () => McpToolService.listTools(selectedGroupId, false), // Include disabled tools
  });

  // Create tool mutation
  const createMutation = useMutation({
    mutationFn: McpToolService.createTool,
    onSuccess: () => {
      message.success('MCP tool created successfully!');
      setIsCreateModalVisible(false);
      createForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ['mcpTools'] });
    },
    onError: (error: any) => {
      message.error(error.response?.data?.detail || 'Failed to create MCP tool');
    },
  });

  // Update tool mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      McpToolService.updateTool(id, data),
    onSuccess: () => {
      message.success('MCP tool updated successfully!');
      setIsEditModalVisible(false);
      setEditingTool(null);
      editForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ['mcpTools'] });
    },
    onError: (error: any) => {
      message.error(error.response?.data?.detail || 'Failed to update MCP tool');
    },
  });

  // Delete tool mutation
  const deleteMutation = useMutation({
    mutationFn: McpToolService.deleteTool,
    onSuccess: () => {
      message.success('MCP tool deleted successfully!');
      queryClient.invalidateQueries({ queryKey: ['mcpTools'] });
    },
    onError: (error: any) => {
      message.error(error.response?.data?.detail || 'Failed to delete MCP tool');
    },
  });

  // Update tool status mutation
  const updateStatusMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) =>
      McpToolService.updateToolStatus(id, enabled),
    onSuccess: () => {
      message.success('Tool status updated successfully!');
      queryClient.invalidateQueries({ queryKey: ['mcpTools'] });
    },
    onError: (error: any) => {
      message.error(error.response?.data?.detail || 'Failed to update tool status');
    },
  });

  // Batch import mutation
  const batchImportMutation = useMutation({
    mutationFn: McpToolService.batchImportTools,
    onSuccess: (result) => {
      const { summary } = result.data;
      message.success(
        `Batch import completed! ${summary.successfully_imported} tools imported, ${summary.renamed_count} renamed`
      );
      queryClient.invalidateQueries({ queryKey: ['mcpTools'] });
    },
    onError: (error: any) => {
      message.error(error.response?.data?.detail || 'Failed to import tools');
    },
  });

  const handleCreate = (values: CreateMcpToolRequest) => {
    createMutation.mutate(values);
  };

  const handleStatusToggle = (tool: McpTool) => {
    updateStatusMutation.mutate({
      id: tool.id,
      enabled: !tool.enabled,
    });
  };

  const handleEdit = (tool: McpTool) => {
    setEditingTool(tool);
    editForm.setFieldsValue({
      name: tool.name,
      description: tool.description,
      connection_type: tool.connection_type,
      // group_id: tool.group_id,
      command: tool.command,
      args: tool.args?.join(' '), // Convert array to string for display
      env: Object.entries(tool.env || {}).map(([key, value]) => ({ key, value })),
      url: tool.url,
      headers: Object.entries(tool.headers || {}).map(([key, value]) => ({ key, value })),
      timeout: tool.timeout,
      retry_count: tool.retry_count,
      retry_delay: tool.retry_delay,
      disabled: tool.disabled,
      auto_approve: tool.auto_approve?.join(', '), // Convert array to string
      enabled: tool.enabled,
    });
    setIsEditModalVisible(true);
  };

  const handleUpdate = (values: any) => {
    if (!editingTool) return;

    const formData: any = {
      name: values.name,
      description: values.description,
      connection_type: values.connection_type,
      // group_id: values.group_id,
      timeout: values.timeout,
      retry_count: values.retry_count,
      retry_delay: values.retry_delay,
      disabled: values.disabled,
      enabled: values.enabled,
    };

    // Handle stdio configuration
    if (values.connection_type === 'stdio') {
      formData.command = values.command;
      if (values.args) {
        formData.args = values.args.split(' ').filter((arg: string) => arg.trim());
      }
      if (values.env) {
        formData.env = values.env.reduce((acc: any, item: any) => {
          if (item.key && item.value) {
            acc[item.key] = item.value;
          }
          return acc;
        }, {});
      }
    }

    // Handle http/sse configuration
    if (values.connection_type === 'http' || values.connection_type === 'sse') {
      formData.url = values.url;
      if (values.headers) {
        formData.headers = values.headers.reduce((acc: any, item: any) => {
          if (item.key && item.value) {
            acc[item.key] = item.value;
          }
          return acc;
        }, {});
      }
    }

    // Handle auto_approve
    if (values.auto_approve) {
      formData.auto_approve = values.auto_approve
        .split(',')
        .map((item: string) => item.trim())
        .filter((item: string) => item);
    }

    updateMutation.mutate({
      id: editingTool.id,
      data: formData,
    });
  };

  const handleDelete = (id: number) => {
    deleteMutation.mutate(id);
  };

  const handleBatchImport = async (data: { mcpServers: any; group_id: number }) => {
    return batchImportMutation.mutateAsync(data);
  };

  const handleBatchImportSuccess = () => {
    setIsBatchImportVisible(false);
  };

  const handleShowJsonConfig = (tool: McpTool) => {
    setViewingTool(tool);
    setIsJsonConfigVisible(true);
  };

  const handleCopyJsonConfig = (tool: McpTool) => {
    const jsonConfig = {
      mcpServers: {
        [tool.name]: {
          ...(tool.connection_type === 'http' || tool.connection_type === 'sse'
            ? { url: tool.url }
            : { command: tool.command }),
          ...(tool.args && tool.args.length > 0 && { args: tool.args }),
          ...(tool.env && Object.keys(tool.env).length > 0 && { env: tool.env }),
          ...(tool.auto_approve && tool.auto_approve.length > 0 && { autoApprove: tool.auto_approve }),
          ...(tool.disabled && { disabled: tool.disabled }),
        }
      }
    };

    const jsonString = JSON.stringify(jsonConfig, null, 2);
    navigator.clipboard.writeText(jsonString);
    message.success('JSON configuration copied to clipboard!');
  };

  const getConnectionTypeColor = (type: string) => {
    switch (type) {
      case 'stdio': return 'blue';
      case 'http': return 'green';
      case 'sse': return 'orange';
      default: return 'default';
    }
  };

  const getStatusColor = (enabled: boolean, disabled: boolean) => {
    if (disabled) return 'red';
    return enabled ? 'green' : 'orange';
  };

  const getStatusText = (enabled: boolean, disabled: boolean) => {
    if (disabled) return 'Disabled';
    return enabled ? 'Active' : 'Inactive';
  };

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: McpTool) => (
        <Space>
          <ApiOutlined />
          <a onClick={() => navigate(`/mcp-tools/${record.id}`)}>{text}</a>
          {record.disabled && <Tag color="red">Disabled</Tag>}
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
      dataIndex: 'connection_type',
      key: 'connection_type',
      render: (type: string) => (
        <Tag color={getConnectionTypeColor(type)}>
          {type.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      render: (record: McpTool) => (
        <Tag color={getStatusColor(record.enabled, record.disabled)}>
          {getStatusText(record.enabled, record.disabled)}
        </Tag>
      ),
    },
    {
      title: 'Config',
      key: 'config',
      render: (record: McpTool) => (
        <Space size="small">
          {record.connection_type === 'stdio' && record.command && (
            <Tooltip title={`Command: ${record.command}`}>
              <Tag size="small">CMD</Tag>
            </Tooltip>
          )}
          {(record.connection_type === 'http' || record.connection_type === 'sse') && record.url && (
            <Tooltip title={`URL: ${record.url}`}>
              <Tag size="small">URL</Tag>
            </Tooltip>
          )}
          {record.env && Object.keys(record.env).length > 0 && (
            <Tooltip title={`Environment variables: ${Object.keys(record.env).length}`}>
              <Tag size="small">ENV</Tag>
            </Tooltip>
          )}
        </Space>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (record: McpTool) => (
        <Space>
          <Tooltip title={record.enabled ? 'Disable' : 'Enable'}>
            <Button
              type="text"
              icon={record.enabled ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
              onClick={() => handleStatusToggle(record)}
              style={{ color: record.enabled ? '#ff4d4f' : '#52c41a' }}
            />
          </Tooltip>
          <Tooltip title="Edit">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            />
          </Tooltip>
          <Tooltip title="JSON Config">
            <Button
              type="text"
              icon={<CodeOutlined />}
              onClick={() => handleShowJsonConfig(record)}
            />
          </Tooltip>
          <Popconfirm
            title="Are you sure you want to delete this tool?"
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
            <Title level={2}>MCP Tools</Title>
            <Text type="secondary">
              Manage MCP (Model Context Protocol) tools and their configurations.
            </Text>
          </div>
          <Space>

            <Button
              icon={<ImportOutlined />}
              onClick={() => setIsBatchImportVisible(true)}
            >
              From JSON
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setIsCreateModalVisible(true)}
            >
              Add Tool
            </Button>
          </Space>
        </div>

        {/* Tools Table */}
        <Card>
          <Table
            columns={columns}
            dataSource={toolsData?.data || []}
            rowKey="id"
            loading={isLoading}
            pagination={{
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total) => `Total ${total} tools`,
            }}
          />
        </Card>

        {/* Create Modal */}
        <Modal
          title="Add MCP Tool"
          open={isCreateModalVisible}
          onCancel={() => {
            setIsCreateModalVisible(false);
            createForm.resetFields();
          }}
          footer={null}
          width={800}
        >
          <CreateToolForm
            form={createForm}
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
          title="Edit MCP Tool"
          open={isEditModalVisible}
          onCancel={() => {
            setIsEditModalVisible(false);
            setEditingTool(null);
            editForm.resetFields();
          }}
          footer={null}
          width={800}
        >
          <EditToolForm
            form={editForm}
            onFinish={handleUpdate}
            onCancel={() => {
              setIsEditModalVisible(false);
              setEditingTool(null);
              editForm.resetFields();
            }}
            loading={updateMutation.isPending}
            initialTool={editingTool}
          />
        </Modal>

        {/* Batch Import Modal */}
        <BatchImportModal
          visible={isBatchImportVisible}
          onCancel={() => setIsBatchImportVisible(false)}
          onSuccess={handleBatchImportSuccess}
          onImport={handleBatchImport}
          loading={batchImportMutation.isPending}
        />

        {/* JSON Config Modal */}
        <Modal
          title={`JSON Configuration - ${viewingTool?.name}`}
          open={isJsonConfigVisible}
          onCancel={() => {
            setIsJsonConfigVisible(false);
            setViewingTool(null);
          }}
          footer={[
            <Button key="copy" onClick={() => viewingTool && handleCopyJsonConfig(viewingTool)}>
              Copy to Clipboard
            </Button>,
            <Button key="close" type="primary" onClick={() => {
              setIsJsonConfigVisible(false);
              setViewingTool(null);
            }}>
              Close
            </Button>,
          ]}
          width={600}
        >
          {viewingTool && (
            <div>
              <Typography.Paragraph type="secondary">
                This is the JSON configuration for the "{viewingTool.name}" tool. You can copy it and use it for batch import.
              </Typography.Paragraph>
              <pre style={{
                background: '#f5f5f5',
                padding: 16,
                borderRadius: 6,
                overflow: 'auto',
                fontSize: '12px',
                fontFamily: 'monospace',
                maxHeight: 400,
                border: '1px solid #d9d9d9'
              }}>
                {JSON.stringify({
                  mcpServers: {
                    [viewingTool.name]: {
                      ...(viewingTool.connection_type === 'http' || viewingTool.connection_type === 'sse'
                        ? { url: viewingTool.url }
                        : { command: viewingTool.command }),
                      ...(viewingTool.args && viewingTool.args.length > 0 && { args: viewingTool.args }),
                      ...(viewingTool.env && Object.keys(viewingTool.env).length > 0 && { env: viewingTool.env }),
                      ...(viewingTool.auto_approve && viewingTool.auto_approve.length > 0 && { autoApprove: viewingTool.auto_approve }),
                      ...(viewingTool.disabled && { disabled: viewingTool.disabled }),
                    }
                  }
                }, null, 2)}
              </pre>
            </div>
          )}
        </Modal>
      </Space>
    </div>
  );
};

// Create Tool Form Component
interface CreateToolFormProps {
  form: any;
  // groups: ServerGroup[];
  onFinish: (values: CreateMcpToolRequest) => void;
  onCancel: () => void;
  loading: boolean;
}

const CreateToolForm: React.FC<CreateToolFormProps> = ({
  form,
  onFinish,
  onCancel,
  loading,
}) => {
  const [connectionType, setConnectionType] = useState<string>('stdio');

  const handleFinish = (values: any) => {
    const formData: CreateMcpToolRequest = {
      name: values.name,
      description: values.description,
      connection_type: values.connection_type,
      timeout: values.timeout || DEFAULT_TIMEOUT,
      retry_count: values.retry_count || DEFAULT_RETRY_COUNT,
      retry_delay: values.retry_delay || DEFAULT_RETRY_DELAY,
      disabled: values.disabled || false,
      enabled: values.enabled !== false,
    };

    // Handle stdio configuration
    if (values.connection_type === 'stdio') {
      formData.command = values.command;
      if (values.args) {
        formData.args = values.args.split(' ').filter((arg: string) => arg.trim());
      }
      if (values.env) {
        formData.env = values.env.reduce((acc: any, item: any) => {
          if (item.key && item.value) {
            acc[item.key] = item.value;
          }
          return acc;
        }, {});
      }
    }

    // Handle http/sse configuration
    if (values.connection_type === 'http' || values.connection_type === 'sse') {
      formData.url = values.url;
      if (values.headers) {
        formData.headers = values.headers.reduce((acc: any, item: any) => {
          if (item.key && item.value) {
            acc[item.key] = item.value;
          }
          return acc;
        }, {});
      }
    }

    // Handle auto_approve
    if (values.auto_approve) {
      formData.auto_approve = values.auto_approve
        .split(',')
        .map((item: string) => item.trim())
        .filter((item: string) => item);
    }

    onFinish(formData);
  };

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleFinish}
      initialValues={{
        connection_type: 'stdio',
        timeout: DEFAULT_TIMEOUT,
        retry_count: DEFAULT_RETRY_COUNT,
        retry_delay: DEFAULT_RETRY_DELAY,
        enabled: true,
      }}
    >
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item
            name="name"
            label="Tool Name"
            rules={[{ required: true, message: 'Please enter tool name' }]}
          >
            <Input placeholder="Enter tool name" />
          </Form.Item>
        </Col>
        <Col span={12}>
        </Col>
      </Row>

      <Form.Item name="description" label="Description">
        <TextArea rows={2} placeholder="Enter tool description" />
      </Form.Item>

      <Form.Item
        name="connection_type"
        label="Connection Type"
        rules={[{ required: true, message: 'Please select connection type' }]}
      >
        <Select onChange={setConnectionType}>
          {CONNECTION_TYPES.map(type => (
            <Option key={type.value} value={type.value}>
              {type.label}
            </Option>
          ))}
        </Select>
      </Form.Item>

      {/* Stdio Configuration */}
      {connectionType === 'stdio' && (
        <>
          <Form.Item
            name="command"
            label="Command"
            rules={[{ required: true, message: 'Please enter command' }]}
          >
            <Input placeholder="e.g., uvx, npx, python" />
          </Form.Item>

          <Form.Item name="args" label="Arguments">
            <Input placeholder="e.g., mcp-server-fetch --port 3000" />
          </Form.Item>

          <Form.Item label="Environment Variables">
            <Form.List name="env">
              {(fields, { add, remove }) => (
                <>
                  {fields.map(({ key, name, ...restField }) => (
                    <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                      <Form.Item
                        {...restField}
                        name={[name, 'key']}
                        rules={[{ required: true, message: 'Missing key' }]}
                      >
                        <Input placeholder="Key" />
                      </Form.Item>
                      <Form.Item
                        {...restField}
                        name={[name, 'value']}
                        rules={[{ required: true, message: 'Missing value' }]}
                      >
                        <Input placeholder="Value" />
                      </Form.Item>
                      <Button type="link" onClick={() => remove(name)}>
                        Remove
                      </Button>
                    </Space>
                  ))}
                  <Form.Item>
                    <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                      Add Environment Variable
                    </Button>
                  </Form.Item>
                </>
              )}
            </Form.List>
          </Form.Item>
        </>
      )}

      {/* HTTP/SSE Configuration */}
      {(connectionType === 'http' || connectionType === 'sse') && (
        <>
          <Form.Item
            name="url"
            label="URL"
            rules={[
              { required: true, message: 'Please enter URL' },
              { type: 'url', message: 'Please enter a valid URL' },
            ]}
          >
            <Input placeholder="https://example.com/mcp" />
          </Form.Item>

          <Form.Item label="Headers">
            <Form.List name="headers">
              {(fields, { add, remove }) => (
                <>
                  {fields.map(({ key, name, ...restField }) => (
                    <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                      <Form.Item
                        {...restField}
                        name={[name, 'key']}
                        rules={[{ required: true, message: 'Missing header name' }]}
                      >
                        <Input placeholder="Header Name" />
                      </Form.Item>
                      <Form.Item
                        {...restField}
                        name={[name, 'value']}
                        rules={[{ required: true, message: 'Missing header value' }]}
                      >
                        <Input placeholder="Header Value" />
                      </Form.Item>
                      <Button type="link" onClick={() => remove(name)}>
                        Remove
                      </Button>
                    </Space>
                  ))}
                  <Form.Item>
                    <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                      Add Header
                    </Button>
                  </Form.Item>
                </>
              )}
            </Form.List>
          </Form.Item>
        </>
      )}

      <Divider />

      {/* Advanced Configuration */}
      <Row gutter={16}>
        <Col span={8}>
          <Form.Item name="timeout" label="Timeout (seconds)">
            <InputNumber min={1} max={300} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item name="retry_count" label="Retry Count">
            <InputNumber min={0} max={10} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item name="retry_delay" label="Retry Delay (seconds)">
            <InputNumber min={1} max={60} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
      </Row>

      <Form.Item name="auto_approve" label="Auto Approve Actions">
        <Input placeholder="action1, action2, action3" />
      </Form.Item>

      <Row gutter={16}>
        <Col span={12}>
          <Form.Item name="enabled" label="Enabled" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="disabled" label="Disabled" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Col>
      </Row>

      <Form.Item>
        <Space>
          <Button type="primary" htmlType="submit" loading={loading}>
            Create Tool
          </Button>
          <Button onClick={onCancel}>
            Cancel
          </Button>
        </Space>
      </Form.Item>
    </Form>
  );
};

// Edit Tool Form Component
interface EditToolFormProps {
  form: any;
  onFinish: (values: any) => void;
  onCancel: () => void;
  loading: boolean;
  initialTool: McpTool | null;
}

const EditToolForm: React.FC<EditToolFormProps> = ({
  form,
  onFinish,
  onCancel,
  loading,
  initialTool,
}) => {
  const [connectionType, setConnectionType] = useState<string>(initialTool?.connection_type || 'stdio');

  const handleFinish = (values: any) => {
    onFinish(values);
  };

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleFinish}
      initialValues={{
        connection_type: initialTool?.connection_type || 'stdio',
        timeout: initialTool?.timeout || DEFAULT_TIMEOUT,
        retry_count: initialTool?.retry_count || DEFAULT_RETRY_COUNT,
        retry_delay: initialTool?.retry_delay || DEFAULT_RETRY_DELAY,
        enabled: initialTool?.enabled !== false,
      }}
    >
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item
            name="name"
            label="Tool Name"
            rules={[{ required: true, message: 'Please enter tool name' }]}
          >
            <Input placeholder="Enter tool name" />
          </Form.Item>
        </Col>
        <Col span={12}>
        </Col>
      </Row>

      <Form.Item name="description" label="Description">
        <TextArea rows={2} placeholder="Enter tool description" />
      </Form.Item>

      <Form.Item
        name="connection_type"
        label="Connection Type"
        rules={[{ required: true, message: 'Please select connection type' }]}
      >
        <Select onChange={setConnectionType}>
          {CONNECTION_TYPES.map(type => (
            <Option key={type.value} value={type.value}>
              {type.label}
            </Option>
          ))}
        </Select>
      </Form.Item>

      {/* Stdio Configuration */}
      {connectionType === 'stdio' && (
        <>
          <Form.Item
            name="command"
            label="Command"
            rules={[{ required: true, message: 'Please enter command' }]}
          >
            <Input placeholder="e.g., uvx, npx, python" />
          </Form.Item>

          <Form.Item name="args" label="Arguments">
            <Input placeholder="e.g., mcp-server-fetch --port 3000" />
          </Form.Item>

          <Form.Item label="Environment Variables">
            <Form.List name="env">
              {(fields, { add, remove }) => (
                <>
                  {fields.map(({ key, name, ...restField }) => (
                    <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                      <Form.Item
                        {...restField}
                        name={[name, 'key']}
                        rules={[{ required: true, message: 'Missing key' }]}
                      >
                        <Input placeholder="Key" />
                      </Form.Item>
                      <Form.Item
                        {...restField}
                        name={[name, 'value']}
                        rules={[{ required: true, message: 'Missing value' }]}
                      >
                        <Input placeholder="Value" />
                      </Form.Item>
                      <Button type="link" onClick={() => remove(name)}>
                        Remove
                      </Button>
                    </Space>
                  ))}
                  <Form.Item>
                    <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                      Add Environment Variable
                    </Button>
                  </Form.Item>
                </>
              )}
            </Form.List>
          </Form.Item>
        </>
      )}

      {/* HTTP/SSE Configuration */}
      {(connectionType === 'http' || connectionType === 'sse') && (
        <>
          <Form.Item
            name="url"
            label="URL"
            rules={[
              { required: true, message: 'Please enter URL' },
              { type: 'url', message: 'Please enter a valid URL' },
            ]}
          >
            <Input placeholder="https://example.com/mcp" />
          </Form.Item>

          <Form.Item label="Headers">
            <Form.List name="headers">
              {(fields, { add, remove }) => (
                <>
                  {fields.map(({ key, name, ...restField }) => (
                    <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                      <Form.Item
                        {...restField}
                        name={[name, 'key']}
                        rules={[{ required: true, message: 'Missing header name' }]}
                      >
                        <Input placeholder="Header Name" />
                      </Form.Item>
                      <Form.Item
                        {...restField}
                        name={[name, 'value']}
                        rules={[{ required: true, message: 'Missing header value' }]}
                      >
                        <Input placeholder="Header Value" />
                      </Form.Item>
                      <Button type="link" onClick={() => remove(name)}>
                        Remove
                      </Button>
                    </Space>
                  ))}
                  <Form.Item>
                    <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                      Add Header
                    </Button>
                  </Form.Item>
                </>
              )}
            </Form.List>
          </Form.Item>
        </>
      )}

      <Divider />

      {/* Advanced Configuration */}
      <Row gutter={16}>
        <Col span={8}>
          <Form.Item name="timeout" label="Timeout (seconds)">
            <InputNumber min={1} max={300} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item name="retry_count" label="Retry Count">
            <InputNumber min={0} max={10} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item name="retry_delay" label="Retry Delay (seconds)">
            <InputNumber min={1} max={60} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
      </Row>

      <Form.Item name="auto_approve" label="Auto Approve Actions">
        <Input placeholder="action1, action2, action3" />
      </Form.Item>

      <Row gutter={16}>
        <Col span={12}>
          <Form.Item name="enabled" label="Enabled" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="disabled" label="Disabled" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Col>
      </Row>

      <Form.Item>
        <Space>
          <Button type="primary" htmlType="submit" loading={loading}>
            Update Tool
          </Button>
          <Button onClick={onCancel}>
            Cancel
          </Button>
        </Space>
      </Form.Item>
    </Form>
  );
};

export default McpTools;
