import React, { useState } from 'react';
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
  Badge,
  Tabs,
  Empty,
  Modal,
  message,
  Row,
  Col,
  Statistic,
} from 'antd';
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  ReloadOutlined,
  ArrowLeftOutlined,
  ToolOutlined,
  ApiOutlined,
  CodeOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation } from '@tanstack/react-query';
import { McpToolService } from '@/services/mcpTool.service';
import { McpServerService } from '@/services/mcpServer.service';
import type { McpTool } from '@/types/api.types';
import type { McpClientInfo } from '@/services/mcpServer.service';

const { Title, Text, Paragraph } = Typography;
const { TabPane } = Tabs;

const McpToolDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const toolId = parseInt(id || '0', 10);
  const navigate = useNavigate();
  // const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('info');
  const [isStarting, setIsStarting] = useState(false);
  const [isQueryModalVisible, setIsQueryModalVisible] = useState(false);
  const [queryText, setQueryText] = useState('');

  // Fetch tool details
  const {
    data: toolData,
    isLoading: isToolLoading,
    error: toolError,
  } = useQuery({
    queryKey: ['mcpTool', toolId],
    queryFn: () => McpToolService.getTool(toolId),
    enabled: !!toolId,
  });

  // Fetch server status
  const {
    data: statusData,
    isLoading: isStatusLoading,
    // error: statusError,
    refetch: refetchStatus,
  } = useQuery({
    queryKey: ['mcpServerStatus', toolId],
    queryFn: () => McpServerService.getServerStatus(toolId),
    enabled: !!toolId,
    refetchInterval: isStarting ? false : 10000, // 只有在非启动状态下才定期刷新
  });

  console.log(statusData, statusData);
  // 判断服务器是否正在运行
  const isServerRunning = statusData?.success === true;
  const {
    data: toolsData,
    isLoading: isToolsLoading,
    error: toolsError,
    refetch: refetchTools,
  } = useQuery({
    queryKey: ['mcpServerTools', toolId],
    queryFn: () => McpServerService.getServerTools(toolId),
    enabled: !!toolId && isServerRunning,
    refetchInterval: isServerRunning ? 30000 : false, // Refetch every 30 seconds if server is running
  });

  // Start server mutation
  const startMutation = useMutation({
    mutationFn: McpServerService.startServer,
    onMutate: () => {
      // 开始请求时设置 loading 状态
      setIsStarting(true);
    },
    onSuccess: (response) => {
      // 请求成功后立即停止 loading 状态
      setIsStarting(false);

      // 检查服务器是否已启动
      if (response?.data?.success) {
        message.success('MCP server started successfully!');
        // 刷新状态和工具列表
        refetchStatus();
        setTimeout(() => {
          refetchTools();
        }, 1000);
      } else {
        message.warning('Server start request completed, but server may not be running yet.');
      }
    },
    onError: (error: any) => {
      setIsStarting(false);
      message.error(error.response?.data?.detail || 'Failed to start MCP server');
    },
  });

  // Stop server mutation
  const stopMutation = useMutation({
    mutationFn: McpServerService.stopServer,
    onSuccess: () => {
      message.success('MCP server stopped successfully!');
      refetchStatus();
    },
    onError: (error: any) => {
      message.error(error.response?.data?.detail || 'Failed to stop MCP server');
    },
  });

  // Restart server mutation
  const restartMutation = useMutation({
    mutationFn: McpServerService.restartServer,
    onMutate: () => {
      // 开始请求时设置 loading 状态
      setIsStarting(true);
    },
    onSuccess: (response) => {
      // 请求成功后立即停止 loading 状态
      setIsStarting(false);

      // 检查服务器是否已重启
      if (response?.data?.success) {
        message.success('MCP server restarted successfully!');
        // 刷新状态和工具列表
        refetchStatus();
        setTimeout(() => {
          refetchTools();
        }, 1000);
      } else {
        message.warning('Server restart request completed, but server may not be running yet.');
      }
    },
    onError: (error: any) => {
      setIsStarting(false);
      message.error(error.response?.data?.detail || 'Failed to restart MCP server');
    },
  });

  // Query agent mutation
  const queryMutation = useMutation({
    mutationFn: (query: string) => McpServerService.queryAgent([toolId], query),
    onSuccess: (_) => {
      message.success('Query executed successfully!');
      setIsQueryModalVisible(false);
      setQueryText('');
    },
    onError: (error: any) => {
      message.error(error.response?.data?.detail || 'Failed to execute query');
    },
  });

  // Handle server actions
  const handleStartServer = () => {
    if (isStarting) return; // 防止重复点击
    startMutation.mutate(toolId);
  };

  const handleStopServer = () => {
    if (isStarting) return; // 启动中不允许停止

    Modal.confirm({
      title: 'Stop MCP Server',
      icon: <ExclamationCircleOutlined />,
      content: 'Are you sure you want to stop this MCP server?',
      okText: 'Yes',
      cancelText: 'No',
      onOk: () => {
        stopMutation.mutate(toolId);
      },
    });
  };

  const handleRestartServer = () => {
    if (isStarting) return; // 启动中不允许重启
    restartMutation.mutate(toolId);
  };

  const handleQueryAgent = () => {
    if (!queryText.trim()) {
      message.warning('Please enter a query');
      return;
    }
    queryMutation.mutate(queryText);
  };

  // Loading and error states
  if (isToolLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '50px' }}>
        <Spin size="large" tip="Loading tool details..." />
      </div>
    );
  }

  if (toolError) {
    return (
      <Alert
        message="Error"
        description="Failed to load tool details. Please try again later."
        type="error"
        showIcon
      />
    );
  }

  const tool: McpTool = toolData?.data || {} as McpTool;
  const serverInfo: McpClientInfo | undefined = statusData?.data?.data;
  const mcpTools = toolsData?.data?.data?.tools || [];

  // Get connection type color
  const getConnectionTypeColor = (type: string) => {
    switch (type) {
      case 'stdio': return 'blue';
      case 'http': return 'green';
      case 'sse': return 'orange';
      default: return 'default';
    }
  };

  // Get status badge
  const getStatusBadge = () => {
    if (tool.disabled) {
      return <Badge status="error" text="Disabled" />;
    }

    if (isStarting) {
      return <Badge status="processing" text="Starting..." />;
    }

    if (isStatusLoading) {
      return <Badge status="processing" text="Checking..." />;
    }

    if (isServerRunning) {
      return <Badge status="success" text="Running" />;
    }

    return <Badge status="warning" text="Stopped" />;
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/mcp-tools')}
          style={{ marginRight: 16 }}
        >
          Back to Tools
        </Button>
      </div>

      {/* Tool Header */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Space align="center">
              <ApiOutlined style={{ fontSize: 24 }} />
              <Title level={2} style={{ margin: 0 }}>{tool.name}</Title>
              <Tag color={getConnectionTypeColor(tool.connection_type)}>
                {tool.connection_type.toUpperCase()}
              </Tag>
              {getStatusBadge()}
            </Space>
            <Paragraph type="secondary" style={{ marginTop: 8 }}>
              {tool.description || 'No description provided'}
            </Paragraph>
          </div>
          <Space>
            {!isServerRunning && !tool.disabled && !isStarting && (
              <Button
                type="primary"
                icon={<PlayCircleOutlined />}
                onClick={handleStartServer}
                loading={startMutation.isPending}
              >
                Start Server
              </Button>
            )}
            {isStarting && (
              <Button
                type="primary"
                icon={<LoadingOutlined />}
                loading={true}
              >
                Starting...
              </Button>
            )}
            {isServerRunning && (
              <>
                <Button
                  icon={<ReloadOutlined />}
                  onClick={handleRestartServer}
                  loading={restartMutation.isPending}
                  disabled={isStarting}
                >
                  Restart
                </Button>
                <Button
                  danger
                  icon={<PauseCircleOutlined />}
                  onClick={handleStopServer}
                  loading={stopMutation.isPending}
                  disabled={isStarting}
                >
                  Stop Server
                </Button>
              </>
            )}
          </Space>
        </div>
      </Card>

      {/* Status Cards */}
      <Row gutter={16} style={{ marginTop: 16 }}>
        <Col span={8}>
          <Card>
            <Statistic
              title="Status"
              value={isStarting ? "Starting..." : (isServerRunning ? "Running" : "Stopped")}
              valueStyle={{ color: isStarting ? '#1890ff' : (isServerRunning ? '#52c41a' : '#faad14') }}
              prefix={isStarting ? <LoadingOutlined /> : (isServerRunning ? <CheckCircleOutlined /> : <ClockCircleOutlined />)}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="Connection Type"
              value={serverInfo?.connection_type?.toUpperCase() || tool.connection_type.toUpperCase()}
              valueStyle={{ color: '#1890ff' }}
              prefix={<ApiOutlined />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="Available Tools"
              value={mcpTools.length}
              valueStyle={{ color: '#722ed1' }}
              prefix={<ToolOutlined />}
              loading={isServerRunning && isToolsLoading}
            />
          </Card>
        </Col>
      </Row>

      {/* Tabs */}
      <Card style={{ marginTop: 16 }}>
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <TabPane tab="Tool Information" key="info">
            <Descriptions bordered column={2}>
              <Descriptions.Item label="Tool ID">{tool.id}</Descriptions.Item>
              <Descriptions.Item label="Connection Type">
                <Tag color={getConnectionTypeColor(tool.connection_type)}>
                  {tool.connection_type.toUpperCase()}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                {getStatusBadge()}
              </Descriptions.Item>
              <Descriptions.Item label="Enabled">
                {tool.enabled ? (
                  <Tag color="green">Yes</Tag>
                ) : (
                  <Tag color="red">No</Tag>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Disabled">
                {tool.disabled ? (
                  <Tag color="red">Yes</Tag>
                ) : (
                  <Tag color="green">No</Tag>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Timeout">{tool.timeout} seconds</Descriptions.Item>
              <Descriptions.Item label="Retry Settings">
                Count: {tool.retry_count}, Delay: {tool.retry_delay}s
              </Descriptions.Item>

              {tool.connection_type === 'stdio' && (
                <>
                  <Descriptions.Item label="Command" span={2}>
                    <Text code>{tool.command}</Text>
                  </Descriptions.Item>
                  {tool.args && tool.args.length > 0 && (
                    <Descriptions.Item label="Arguments" span={2}>
                      <Text code>{tool.args.join(' ')}</Text>
                    </Descriptions.Item>
                  )}
                  {tool.env && Object.keys(tool.env).length > 0 && (
                    <Descriptions.Item label="Environment Variables" span={2}>
                      <ul style={{ listStyleType: 'none', padding: 0, margin: 0 }}>
                        {Object.entries(tool.env).map(([key, value]) => (
                          <li key={key}>
                            <Text code>{key}={value}</Text>
                          </li>
                        ))}
                      </ul>
                    </Descriptions.Item>
                  )}
                </>
              )}

              {(tool.connection_type === 'http' || tool.connection_type === 'sse') && (
                <>
                  <Descriptions.Item label="URL" span={2}>
                    <Text code>{tool.url}</Text>
                  </Descriptions.Item>
                  {tool.headers && Object.keys(tool.headers).length > 0 && (
                    <Descriptions.Item label="Headers" span={2}>
                      <ul style={{ listStyleType: 'none', padding: 0, margin: 0 }}>
                        {Object.entries(tool.headers).map(([key, value]) => (
                          <li key={key}>
                            <Text code>{key}: {value}</Text>
                          </li>
                        ))}
                      </ul>
                    </Descriptions.Item>
                  )}
                </>
              )}

              {tool.auto_approve && tool.auto_approve.length > 0 && (
                <Descriptions.Item label="Auto Approve Actions" span={2}>
                  {tool.auto_approve.map(action => (
                    <Tag key={action}>{action}</Tag>
                  ))}
                </Descriptions.Item>
              )}
            </Descriptions>
          </TabPane>


          <TabPane tab="Available Tools" key="tools">
            {!isServerRunning && !isStarting ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <span>
                    Server is not running. <Button type="link" onClick={handleStartServer} disabled={isStarting}>Start server</Button> to see available tools.
                  </span>
                }
              />
            ) : isStarting ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <Spin tip="Starting server..." />
                <div style={{ marginTop: 16 }}>
                  <Alert
                    message="Server is starting"
                    description="Please wait while the MCP server is being initialized. Tools will be available once the server is running."
                    type="info"
                    showIcon
                  />
                </div>
              </div>
            ) : isServerRunning && isToolsLoading ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <Spin tip="Loading tools..." />
              </div>
            ) : isServerRunning && toolsError ? (
              <Alert
                message="Error"
                description="Failed to load tools. The server might be starting up or experiencing issues."
                type="error"
                showIcon
                action={
                  <Button size="small" onClick={() => refetchTools()}>
                    Retry
                  </Button>
                }
              />
            ) : isServerRunning && mcpTools.length === 0 ? (
              <Empty description="No tools available from this MCP server" />
            ) : isServerRunning && mcpTools.length > 0 ? (
              <Table
                dataSource={mcpTools}
                rowKey="tool_name"
                pagination={false}
                columns={[
                  {
                    title: 'Tool Name',
                    dataIndex: 'tool_name',
                    key: 'tool_name',
                    render: (text) => <Text strong>{text}</Text>,
                  },
                  {
                    title: 'Description',
                    dataIndex: 'tool_spec',
                    key: 'description',
                    render: (spec) => spec?.description || 'No description',
                  },
                  {
                    title: 'Parameters',
                    dataIndex: 'tool_spec',
                    key: 'parameters',
                    render: (spec) => {
                      const paramCount = spec?.parameters?.properties ?
                        Object.keys(spec.parameters.properties).length : 0;
                      return paramCount > 0 ? (
                        <Tag color="blue">{paramCount} parameters</Tag>
                      ) : (
                        <Tag color="default">No parameters</Tag>
                      );
                    },
                  },
                  {
                    title: 'Actions',
                    key: 'actions',
                    render: (_, record: any) => (
                      <Button
                        size="small"
                        icon={<CodeOutlined />}
                        onClick={() => {
                          Modal.info({
                            title: `Tool Specification: ${record.tool_name}`,
                            width: 800,
                            content: (
                              <div style={{ maxHeight: '60vh', overflow: 'auto' }}>
                                <pre style={{
                                  backgroundColor: '#f5f5f5',
                                  padding: 16,
                                  borderRadius: 4,
                                  overflow: 'auto'
                                }}>
                                  {JSON.stringify(record.tool_spec, null, 2)}
                                </pre>
                              </div>
                            ),
                          });
                        }}
                      >
                        View Spec
                      </Button>
                    ),
                  },
                ]}
              />
            ) : (
              <Empty description="Server status is inconsistent. Please refresh the page." />
            )}
          </TabPane>
        </Tabs>
      </Card>

      {/* Query Modal */}
      <Modal
        title="Query Agent"
        open={isQueryModalVisible}
        onCancel={() => setIsQueryModalVisible(false)}
        onOk={handleQueryAgent}
        confirmLoading={queryMutation.isPending}
      >
        <Typography.Paragraph>
          Enter a query to test the agent with this MCP server's tools.
        </Typography.Paragraph>
        <Typography.Text
          copyable
          code
          onChange={(e: any) => setQueryText(e.target.value)}
        >{queryText}</Typography.Text>
      </Modal>
    </div>
  );
};

export default McpToolDetail;
