import React, { useState, useMemo } from 'react';
import { Layout as AntLayout, Menu, Button, Dropdown, Avatar, Space, Typography, Spin } from 'antd';
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  DashboardOutlined,
  KeyOutlined,
  ToolOutlined,
  UserOutlined,
  LogoutOutlined,
  SettingOutlined,
  RobotOutlined,
  MessageOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { APP_TITLE } from '@/constants';

const { Header, Sider, Content } = AntLayout;
const { Title } = Typography;

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, userData } = useAuth();

  // Get user permissions
  const { canManage } = usePermissions();

  // Define all menu items
  const allMenuItems = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: 'Dashboard',
      requiresManage: true,
    },
    {
      key: '/api-keys',
      icon: <KeyOutlined />,
      label: 'API Keys',
      requiresManage: true,
    },
    {
      key: '/mcp-tools',
      icon: <ToolOutlined />,
      label: 'MCP Tools',
      requiresManage: true,
    },
    {
      key: '/assistants',
      icon: <RobotOutlined />,
      label: 'Assistants',
      requiresManage: true,
    },
    {
      key: '/chat',
      icon: <MessageOutlined />,
      label: 'Chat',
      requiresManage: false,
    },
  ];

  // Filter menu items based on permissions
  const menuItems = useMemo(() => {
    return allMenuItems.filter(item => !item.requiresManage || canManage);
  }, [canManage]);

  const handleMenuClick = (key: string) => {
    navigate(key);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const userMenuItems = [
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: 'Settings',
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Logout',
      onClick: handleLogout,
    },
  ];

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <Sider trigger={null} collapsible collapsed={collapsed} theme="dark">
        <div style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderBottom: '1px solid #303030'
        }}>
          <Title
            level={4}
            style={{
              color: 'white',
              margin: 0,
              fontSize: collapsed ? '16px' : '18px'
            }}
          >
            {collapsed ? 'MCP' : APP_TITLE}
          </Title>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => handleMenuClick(key)}
        />
      </Sider>
      <AntLayout>
        <Header style={{
          padding: '0 16px',
          background: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #f0f0f0'
        }}>
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            style={{
              fontSize: '16px',
              width: 64,
              height: 64,
            }}
          />
          <Space>
            <Dropdown
              menu={{ items: userMenuItems }}
              placement="bottomRight"
              arrow
            >
              <Button type="text" style={{ height: 'auto', padding: '4px 8px' }}>
                <Space>
                  <Avatar size="small" icon={<UserOutlined />} />
                  <span>{userData?.name || 'User'}</span>
                </Space>
              </Button>
            </Dropdown>
          </Space>
        </Header>
        <Content
          style={{
            margin: '16px',
            padding: '24px',
            background: '#fff',
            borderRadius: '8px',
            minHeight: 'calc(100vh - 112px)',
          }}
        >
          {children}
        </Content>
      </AntLayout>
    </AntLayout>
  );
};

export default Layout;
