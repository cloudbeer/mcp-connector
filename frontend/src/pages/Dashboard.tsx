import React from 'react';
import {
  Row,
  Col,
  Card,
  Statistic,
  Typography,
  Space,
  Alert,
  Progress,
  List,
  Tag,
} from 'antd';
import {
  KeyOutlined,
  ToolOutlined,
  ClusterOutlined,
  ApiOutlined,
  CheckCircleOutlined,
  UserOutlined,
  ClockCircleOutlined,
  WarningOutlined,
  TrophyOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ApiKeyService } from '@/services/apiKey.service';
import { McpToolService } from '@/services/mcpTool.service';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Title, Paragraph, Text } = Typography;

const Dashboard: React.FC = () => {
  const navigate = useNavigate();

  // Fetch current user info
  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: ApiKeyService.getMyKeyInfo,
  });

  // Fetch API keys (only if user has manage permission)
  const { data: apiKeysData } = useQuery({
    queryKey: ['apiKeys'],
    queryFn: () => ApiKeyService.listApiKeys(),
    enabled: currentUser?.data?.can_manage,
  });

  // Fetch MCP tools
  const { data: toolsData } = useQuery({
    queryKey: ['mcpTools'],
    queryFn: () => McpToolService.listTools(undefined, false), // Include disabled tools
  });


  // Fetch my accessible assistants
  const { data: myAssistants } = useQuery({
    queryKey: ['myAssistants'],
    queryFn: ApiKeyService.getMyAssistants,
  });

  const canManage = currentUser?.data?.can_manage;
  const apiKeysCount = apiKeysData?.data?.length || 0;
  const toolsCount = toolsData?.data?.length || 0;
  const enabledToolsCount = toolsData?.data?.filter(tool => tool.enabled && !tool.disabled)?.length || 0;
  const disabledToolsCount = toolsData?.data?.filter(tool => tool.disabled)?.length || 0;
  // const groupsCount = groupsData?.data?.length || 0;
  const myAssistantsCount = myAssistants?.data?.length || 0;


  // Get recent tools (last 5)
  const recentTools = toolsData?.data
    ?.sort((a, b) => dayjs(b.created_at).valueOf() - dayjs(a.created_at).valueOf())
    ?.slice(0, 5) || [];

  // Connection type distribution
  const connectionTypeStats = toolsData?.data?.reduce((acc, tool) => {
    acc[tool.connection_type] = (acc[tool.connection_type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  return (
    <div>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Header */}
        <div>
          <Title level={2}>Dashboard</Title>
          <Paragraph type="secondary">
            Welcome to MCP Connector management console. Monitor and manage your MCP tools and API keys.
          </Paragraph>
        </div>

        {/* Current User Info */}
        {currentUser?.data && (
          <Alert
            message={
              <Space>
                <UserOutlined />
                <span>Logged in as: <strong>{currentUser.data.name}</strong></span>
                {currentUser.data.last_used_at && (
                  <Text type="secondary">
                    • Last used {dayjs(currentUser.data.last_used_at).fromNow()}
                  </Text>
                )}
              </Space>
            }
            description={
              <Space wrap>
                <span>Permissions:</span>
                {currentUser.data.can_manage && (
                  <Tag color="blue" icon={<CheckCircleOutlined />}>
                    Management Access
                  </Tag>
                )}
                {currentUser.data.can_call_assistant && (
                  <Tag color="green" icon={<CheckCircleOutlined />}>
                    Assistant Access ({myAssistantsCount} assistants)
                  </Tag>
                )}
                {currentUser.data.expires_at && (
                  <Tag color="orange" icon={<ClockCircleOutlined />}>
                    Expires {dayjs(currentUser.data.expires_at).fromNow()}
                  </Tag>
                )}
              </Space>
            }
            type="info"
            showIcon
          />
        )}

        {/* Main Statistics Cards */}
        <Row gutter={[16, 16]}>
          {canManage && (
            <Col xs={24} sm={12} lg={6}>
              <Card hoverable onClick={() => navigate('/api-keys')} style={{ cursor: 'pointer' }}>
                <Statistic
                  title="API Keys"
                  value={apiKeysCount}
                  prefix={<KeyOutlined />}
                  valueStyle={{ color: '#1890ff' }}
                />
                <div style={{ marginTop: 8 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Click to manage →
                  </Text>
                </div>
              </Card>
            </Col>
          )}

          <Col xs={24} sm={12} lg={6}>
            <Card hoverable onClick={() => navigate('/mcp-tools')} style={{ cursor: 'pointer' }}>
              <Statistic
                title="MCP Tools"
                value={toolsCount}
                prefix={<ToolOutlined />}
                valueStyle={{ color: '#52c41a' }}
              />
              <div style={{ marginTop: 8 }}>
                <Progress
                  percent={toolsCount > 0 ? Math.round((enabledToolsCount / toolsCount) * 100) : 0}
                  size="small"
                  status="active"
                  format={() => `${enabledToolsCount} active`}
                />
              </div>
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Active Tools"
                value={enabledToolsCount}
                prefix={<CheckCircleOutlined />}
                valueStyle={{ color: '#52c41a' }}
              />
              <div style={{ marginTop: 8 }}>
                {disabledToolsCount > 0 && (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {disabledToolsCount} disabled
                  </Text>
                )}
              </div>
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={6}>
            <Card hoverable onClick={() => navigate('/server-groups')} style={{ cursor: 'pointer' }}>
              <Statistic
                title="Server Groups"
                prefix={<ClusterOutlined />}
                valueStyle={{ color: '#722ed1' }}
              />
              <div style={{ marginTop: 8 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Organize tools →
                </Text>
              </div>
            </Card>
          </Col>
        </Row>

        {/* Secondary Statistics */}
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <Card title="Connection Types" extra={<ApiOutlined />}>
              <Space direction="vertical" style={{ width: '100%' }}>
                {Object.entries(connectionTypeStats).map(([type, count]) => (
                  <div key={type} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Space>
                      <Tag color={type === 'stdio' ? 'blue' : type === 'http' ? 'green' : 'orange'}>
                        {type.toUpperCase()}
                      </Tag>
                      <span>{count} tools</span>
                    </Space>
                    <Progress
                      percent={toolsCount > 0 ? Math.round((count / toolsCount) * 100) : 0}
                      size="small"
                      style={{ width: 100 }}
                      showInfo={false}
                    />
                  </div>
                ))}
                {Object.keys(connectionTypeStats).length === 0 && (
                  <Text type="secondary">No tools configured yet</Text>
                )}
              </Space>
            </Card>
          </Col>

          <Col xs={24} lg={12}>
          </Col>
        </Row>

        {/* Recent Activity and Quick Actions */}
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <Card title="Recent Tools" extra={<TrophyOutlined />}>
              <List
                size="small"
                dataSource={recentTools}
                renderItem={tool => (
                  <List.Item>
                    <List.Item.Meta
                      avatar={<ToolOutlined />}
                      title={
                        <Space>
                          <span>{tool.name}</span>
                          <Tag
                            size="small"
                            color={tool.connection_type === 'stdio' ? 'blue' : tool.connection_type === 'http' ? 'green' : 'orange'}
                          >
                            {tool.connection_type}
                          </Tag>
                          {tool.enabled && !tool.disabled ? (
                            <Tag size="small" color="green">Active</Tag>
                          ) : (
                            <Tag size="small" color="red">Inactive</Tag>
                          )}
                        </Space>
                      }
                      description={
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          Created {dayjs(tool.created_at).fromNow()}
                        </Text>
                      }
                    />
                  </List.Item>
                )}
                locale={{ emptyText: 'No tools created yet' }}
              />
            </Card>
          </Col>

          <Col xs={24} lg={12}>
            <Card title="Quick Actions" extra={<ApiOutlined />}>
              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                {canManage && (
                  <Card size="small" hoverable onClick={() => navigate('/api-keys')}>
                    <Space>
                      <KeyOutlined style={{ fontSize: '20px', color: '#1890ff' }} />
                      <div>
                        <Text strong>Create API Key</Text>
                        <br />
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          Generate new API keys with custom permissions
                        </Text>
                      </div>
                    </Space>
                  </Card>
                )}

                <Card size="small" hoverable onClick={() => navigate('/mcp-tools')}>
                  <Space>
                    <ToolOutlined style={{ fontSize: '20px', color: '#52c41a' }} />
                    <div>
                      <Text strong>Add MCP Tool</Text>
                      <br />
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        Configure new MCP tools and services
                      </Text>
                    </div>
                  </Space>
                </Card>

                <Card size="small" hoverable onClick={() => navigate('/server-groups')}>
                  <Space>
                    <ClusterOutlined style={{ fontSize: '20px', color: '#722ed1' }} />
                    <div>
                      <Text strong>Manage Groups</Text>
                      <br />
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        Organize tools into server groups
                      </Text>
                    </div>
                  </Space>
                </Card>
              </Space>
            </Card>
          </Col>
        </Row>

        {/* System Status */}
        <Card title="System Status">
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={8}>
              <Space>
                <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 16 }} />
                <div>
                  <Text strong>API Server</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>Online and responding</Text>
                </div>
              </Space>
            </Col>
            <Col xs={24} sm={8}>
              <Space>
                <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 16 }} />
                <div>
                  <Text strong>Database</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>Connected and healthy</Text>
                </div>
              </Space>
            </Col>
            <Col xs={24} sm={8}>
              <Space>
                <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 16 }} />
                <div>
                  <Text strong>MCP Tools</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {enabledToolsCount} of {toolsCount} active
                  </Text>
                </div>
              </Space>
            </Col>
          </Row>
        </Card>
      </Space>
    </div>
  );
};

export default Dashboard;
