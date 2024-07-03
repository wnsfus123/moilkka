import React, { useState } from "react";
import {
  FormOutlined,
  EditOutlined,
  QuestionCircleOutlined
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
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ padding: 0, zIndex: 1, width: '110%', position: 'fixed', top: 0 }}>
        <MoHeader/>
      </Header>

      <Layout style={{ marginTop: 72 }}>
        <Sider collapsible collapsed={collapsed} onCollapse={(value) => setCollapsed(value)} style={{ overflow: 'auto', height: 'calc(100vh - 72px)', position: 'fixed', left: 0, top: 72, zIndex: 1 }}>
          <Menu theme="dark" defaultSelectedKeys={['1']} mode="inline">
            <Menu.Item key="1" icon={<FormOutlined />}>
              <Link exact to="/main" />
              일정 생성
            </Menu.Item>
            <Menu.Item key="2" icon={<EditOutlined />}>
              <Link exact to="/test" />
              일정 수정
            </Menu.Item>
            <Menu.Item key="3" icon={<QuestionCircleOutlined />}>
              <Link exact to="/time" />
              도움말
            </Menu.Item>
          </Menu>
        </Sider>

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
