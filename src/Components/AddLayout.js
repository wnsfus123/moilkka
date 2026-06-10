import React from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { Layout, Menu, Avatar, Dropdown } from "antd";
import { getUserInfoFromLocalStorage } from './authUtils';
import './AddLayout.css';

const { Header, Content, Footer } = Layout;

const AppLayout = () => {
  const location = useLocation();
  const userInfo = getUserInfoFromLocalStorage();
  const nickname =
    userInfo?.kakao_account?.profile?.nickname ||
    userInfo?.properties?.nickname ||
    '';

  const handleLogout = () => {
    localStorage.removeItem('kakaoAccessToken');
    localStorage.removeItem('userInfo');
    sessionStorage.removeItem('isLoggedIn');
    window.location.href = '/';
  };

  const navItems = [
    { key: '/event', label: <Link to="/event">홈</Link> },
    { key: '/create', label: <Link to="/create">새 모임</Link> },
    { key: '/help', label: <Link to="/help">도움말</Link> },
  ];

  const userDropdownItems = [
    { key: 'name', label: <span style={{ fontWeight: 600 }}>{nickname || '사용자'}</span>, disabled: true },
    { type: 'divider' },
    { key: 'logout', label: '로그아웃', danger: true, onClick: handleLogout },
  ];

  const mobileNavItems = [
    { path: '/event', label: '홈' },
    { path: '/create', label: '새 모임' },
    { path: '/help', label: '도움말' },
  ];

  return (
    <Layout style={{ minHeight: '100vh', background: '#F8F8F6' }}>
      <Header className="app-header">
        <a href="/event" className="header-logo-link">
          <img src="/logo.png" alt="모일까" className="header-logo-img" />
        </a>

        <Menu
          theme="dark"
          mode="horizontal"
          selectedKeys={[location.pathname]}
          items={navItems}
          style={{
            flex: 1,
            minWidth: 0,
            background: 'transparent',
            borderBottom: 'none',
            lineHeight: '50px',
          }}
        />

        {userInfo && (
          <Dropdown
            menu={{ items: userDropdownItems }}
            trigger={['click']}
            placement="bottomRight"
          >
            <div className="header-user-btn">
              <Avatar
                style={{
                  backgroundColor: '#FEE500',
                  color: '#3C1E1E',
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {nickname ? nickname.charAt(0) : '?'}
              </Avatar>
              <span className="user-name-text">{nickname || '사용자'}</span>
              <span className="avatar-chevron">▾</span>
            </div>
          </Dropdown>
        )}
      </Header>

      <Content className="app-content">
        <Outlet />
      </Content>

      <Footer className="app-footer">
        모일까 ©{new Date().getFullYear()} Created by 모일까
      </Footer>

      <nav className="mobile-bottom-nav">
        {mobileNavItems.map(item => (
          <Link
            key={item.path}
            to={item.path}
            className={`bottom-nav-item${location.pathname === item.path ? ' active' : ''}`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </Layout>
  );
};

export default AppLayout;
