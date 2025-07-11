import React, { useState } from 'react';
import {
  Table,
  Button,
  Space,
  Typography,
  Modal,
  Form,
  Input,
  InputNumber,
  Card,
  Tooltip,
  Popconfirm,
  Tag,
  Statistic,
  Row,
  Col,
  message,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ClusterOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ServerGroupService, McpToolService } from '@/services/mcpTool.service';
import type { ServerGroup, CreateServerGroupRequest, UpdateServerGroupRequest } from '@/types/api.types';
import { DEFAULT_MAX_TOOLS } from '@/constants';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { TextArea } = Input;

const ServerGroups: React.FC = () => {
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ServerGroup | null>(null);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const queryClient = useQueryClient();

  // Fetch server groups
  const { data: groupsData, isLoading } = useQuery({
    queryKey: ['serverGroups'],
    queryFn: ServerGroupService.listGroups,
  });

  // Fetch all tools to count tools per group
  const { data: toolsData } = useQuery({
    queryKey: ['mcpTools'],
    queryFn: () => McpToolService.listTools(),
  });

  // Create group mutation
  const createMutation = useMutation({
    mutationFn: ServerGroupService.createGroup,
    onSuccess: () => {
      message.success('Server group created successfully!');
      setIsCreateModalVisible(false);
      createForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ['serverGroups'] });
    },
    onError: (error: any) => {
      message.error(error.response?.data?.detail || 'Failed to create server group');
    },
  });

  // Update group mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateServerGroupRequest }) =>
      ServerGroupService.updateGroup(id, data),
    onSuccess: () => {
      message.success('Server group updated successfully!');
      setIsEditModalVisible(false);
      setEditingGroup(null);
      editForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ['serverGroups'] });
    },
    onError: (error: any) => {
      message.error(error.response?.data?.detail || 'Failed to update server group');
    },
  });

  // Delete group mutation
  const deleteMutation = useMutation({
    mutationFn: ServerGroupService.deleteGroup,
    onSuccess: () => {
      message.success('Server group deleted successfully!');
      queryClient.invalidateQueries({ queryKey: ['serverGroups'] });
    },
    onError: (error: any) => {
      message.error(error.response?.data?.detail || 'Failed to delete server group');
    },
  });

  const handleCreate = (values: CreateServerGroupRequest) => {
    createMutation.mutate(values);
  };

  const handleEdit = (group: ServerGroup) => {
    setEditingGroup(group);
    editForm.setFieldsValue({
      name: group.name,
      description: group.description,
      max_tools: group.max_tools,
    });
    setIsEditModalVisible(true);
  };

  const handleUpdate = (values: UpdateServerGroupRequest) => {
    if (!editingGroup) return;
    
    updateMutation.mutate({
      id: editingGroup.id,
      data: values,
    });
  };

  const handleDelete = (id: number) => {
    // Check if group has tools
    const toolsInGroup = toolsData?.data?.filter(tool => tool.group_id === id) || [];
    if (toolsInGroup.length > 0) {
      message.error(`Cannot delete group with ${toolsInGroup.length} tools. Please move or delete the tools first.`);
      return;
    }
    
    deleteMutation.mutate(id);
  };

  const getToolsCountForGroup = (groupId: number) => {
    return toolsData?.data?.filter(tool => tool.group_id === groupId).length || 0;
  };

  const getActiveToolsCountForGroup = (groupId: number) => {
    return toolsData?.data?.filter(tool => tool.group_id === groupId && tool.enabled && !tool.disabled).length || 0;
  };

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => (
        <Space>
          <ClusterOutlined />
          <span>{text}</span>
        </Space>
      ),
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (text: string) => (
        <Text ellipsis style={{ maxWidth: 300 }}>
          {text || 'No description'}
        </Text>
      ),
    },
    {
      title: 'Tools',
      key: 'tools',
      render: (record: ServerGroup) => {
        const totalTools = getToolsCountForGroup(record.id);
        const activeTools = getActiveToolsCountForGroup(record.id);
        return (
          <Space>
            <Tag color="blue">
              <ToolOutlined /> {totalTools} / {record.max_tools}
            </Tag>
            <Tag color="green">
              {activeTools} Active
            </Tag>
          </Space>
        );
      },
    },
    {
      title: 'Usage',
      key: 'usage',
      render: (record: ServerGroup) => {
        const totalTools = getToolsCountForGroup(record.id);
        const usagePercent = Math.round((totalTools / record.max_tools) * 100);
        return (
          <div style={{ width: 120 }}>
            <div style={{ 
              background: '#f0f0f0', 
              borderRadius: 4, 
              overflow: 'hidden',
              height: 8,
              marginBottom: 4
            }}>
              <div 
                style={{ 
                  background: usagePercent > 80 ? '#ff4d4f' : usagePercent > 60 ? '#faad14' : '#52c41a',
                  height: '100%',
                  width: `${Math.min(usagePercent, 100)}%`,
                  transition: 'width 0.3s'
                }} 
              />
            </div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {usagePercent}% used
            </Text>
          </div>
        );
      },
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
      render: (record: ServerGroup) => (
        <Space>
          <Tooltip title="Edit">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            />
          </Tooltip>
          <Popconfirm
            title="Are you sure you want to delete this group?"
            description="This action cannot be undone."
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
            <Title level={2}>Server Groups</Title>
            <Text type="secondary">
              Organize MCP tools into logical groups with capacity management.
            </Text>
          </div>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setIsCreateModalVisible(true)}
          >
            Create Group
          </Button>
        </div>

        {/* Statistics Cards */}
        <Row gutter={16}>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic
                title="Total Groups"
                value={groupsData?.data?.length || 0}
                prefix={<ClusterOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic
                title="Total Tools"
                value={toolsData?.data?.length || 0}
                prefix={<ToolOutlined />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card>
              <Statistic
                title="Active Tools"
                value={toolsData?.data?.filter(tool => tool.enabled && !tool.disabled).length || 0}
                prefix={<ToolOutlined />}
                valueStyle={{ color: '#722ed1' }}
              />
            </Card>
          </Col>
        </Row>

        {/* Groups Table */}
        <Card>
          <Table
            columns={columns}
            dataSource={groupsData?.data || []}
            rowKey="id"
            loading={isLoading}
            pagination={{
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total) => `Total ${total} groups`,
            }}
          />
        </Card>

        {/* Create Modal */}
        <Modal
          title="Create Server Group"
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
            initialValues={{
              max_tools: DEFAULT_MAX_TOOLS,
            }}
          >
            <Form.Item
              name="name"
              label="Group Name"
              rules={[
                { required: true, message: 'Please enter group name' },
                { min: 1, max: 100, message: 'Name must be between 1 and 100 characters' },
              ]}
            >
              <Input placeholder="Enter group name (e.g., aws-tools, dev-tools)" />
            </Form.Item>

            <Form.Item name="description" label="Description">
              <TextArea 
                rows={3} 
                placeholder="Enter group description (optional)"
                maxLength={500}
                showCount
              />
            </Form.Item>

            <Form.Item
              name="max_tools"
              label="Maximum Tools"
              rules={[
                { required: true, message: 'Please enter maximum tools' },
                { type: 'number', min: 1, max: 100, message: 'Must be between 1 and 100' },
              ]}
            >
              <InputNumber
                min={1}
                max={100}
                style={{ width: '100%' }}
                placeholder="Maximum number of tools in this group"
              />
            </Form.Item>

            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit" loading={createMutation.isPending}>
                  Create Group
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
          title="Edit Server Group"
          open={isEditModalVisible}
          onCancel={() => {
            setIsEditModalVisible(false);
            setEditingGroup(null);
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
              label="Group Name"
              rules={[
                { required: true, message: 'Please enter group name' },
                { min: 1, max: 100, message: 'Name must be between 1 and 100 characters' },
              ]}
            >
              <Input placeholder="Enter group name" />
            </Form.Item>

            <Form.Item name="description" label="Description">
              <TextArea 
                rows={3} 
                placeholder="Enter group description (optional)"
                maxLength={500}
                showCount
              />
            </Form.Item>

            <Form.Item
              name="max_tools"
              label="Maximum Tools"
              rules={[
                { required: true, message: 'Please enter maximum tools' },
                { type: 'number', min: 1, max: 100, message: 'Must be between 1 and 100' },
              ]}
            >
              <InputNumber
                min={1}
                max={100}
                style={{ width: '100%' }}
                placeholder="Maximum number of tools in this group"
              />
            </Form.Item>

            {editingGroup && (
              <div style={{ marginBottom: 16, padding: 12, background: '#f5f5f5', borderRadius: 6 }}>
                <Text type="secondary">
                  Current tools in group: {getToolsCountForGroup(editingGroup.id)}
                </Text>
              </div>
            )}

            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit" loading={updateMutation.isPending}>
                  Update Group
                </Button>
                <Button onClick={() => {
                  setIsEditModalVisible(false);
                  setEditingGroup(null);
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

export default ServerGroups;
