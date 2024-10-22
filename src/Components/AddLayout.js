import React, { useState } from "react";
import {
  FormOutlined,
  EditOutlined,
  QuestionCircleOutlined,
  LogoutOutlined // 로그아웃 아이콘 추가
} from '@ant-design/icons';
import { Layout, Menu, theme } from 'antd';
import { Link } from "react-router-dom";
import { Outlet } from "react-router-dom";
import MoHeader from "./MoHeader";
import MoFooter from "./MoFooter";

const { Header, Content, Footer, Sider } = Layout;

const AppLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  // 로그아웃 핸들러
  const handleLogout = () => {
    localStorage.removeItem('kakaoAccessToken');
    localStorage.removeItem('userInfo');
    sessionStorage.removeItem('isLoggedIn');
    window.location.href = '/';
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* Header width를 100%로 맞추고, zIndex는 충분히 높게 설정 */}
      <Header style={{ padding: 0, zIndex: 10, width: '100%', position: 'fixed', top: 0, left: -7}}>
        <MoHeader />
      </Header>

      {/* Sider의 zIndex를 낮게 설정하고, overflow 문제를 해결 */}
      <Layout style={{ marginTop: 72 }}>
        <Sider
          collapsible
          collapsed={collapsed}
          onCollapse={(value) => setCollapsed(value)}
          style={{ 
            overflow: 'auto',
            height: 'calc(100vh - 72px)', 
            position: 'fixed', 
            left: -7, 
            top: 72, 
            zIndex: 1 // Header보다 낮은 zIndex 설정
            
          }}
        >
          <Menu theme="dark" defaultSelectedKeys={['1']} mode="inline" style={{ height: '100%' }}>
            <Menu.Item key="1" icon={<FormOutlined />}>
              <Link exact to="/main" />
              메인 페이지
            </Menu.Item>
            <Menu.Item key="2" icon={<EditOutlined />}>
              <Link exact to="/google" />
              일정 수정
            </Menu.Item>
            <Menu.Item key="3" icon={<QuestionCircleOutlined />}>
              <Link exact to="/help" />
              도움말
            </Menu.Item>
            <Menu.Item key="logout" icon={<LogoutOutlined />} onClick={handleLogout} style={{ position: 'absolute', bottom: 40, width: '100%' }}>
              로그아웃
            </Menu.Item>
          </Menu>
        </Sider>

        {/* 사이드바가 닫힐 때와 열릴 때 marginLeft 조정 */}
        <Layout className="site-layout" style={{ marginLeft: collapsed ? 80 : 200 }}>
          <Content style={{ margin: '24px 16px 0', overflow: 'initial' }}>
            <div>
              <Outlet />
            </div>
          </Content>

          <Footer>
            <MoFooter />
          </Footer>
        </Layout>
      </Layout>
    </Layout>
  );
};

export default AppLayout;
