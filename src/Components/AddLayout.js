import React from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Layout, Menu, Avatar, Dropdown } from "antd";
import { getUserInfoFromLocalStorage } from './authUtils';
import './AddLayout.css';

const { Header } = Layout;

const BOTTOM_TABS = [
  { key: '/event',    icon: '🏠', label: '홈' },
  { key: '/calendar', icon: '📅', label: '캘린더' },
  { key: '/create',   icon: '+',  label: '모임', isFab: true },
  { key: '/mannalka', icon: '📌', label: '만날까' },
  { key: '/profile',  icon: '👤', label: '내정보' },
];

const getActiveTab = (pathname) => {
  if (pathname.startsWith('/mannalka')) return '/mannalka';
  if (pathname === '/create')   return '/create';
  if (pathname === '/calendar') return '/calendar';
  if (pathname === '/profile')  return '/profile';
  if (pathname === '/event')    return '/event';
  return '';
};

const AppLayout = () => {
  const location = useLocation();
  const navigate  = useNavigate();
  const userInfo  = getUserInfoFromLocalStorage();
  const nickname  =
    userInfo?.kakao_account?.profile?.nickname ||
    userInfo?.properties?.nickname ||
    '';

  const activeTab = getActiveTab(location.pathname);

  const handleLogout = () => {
    localStorage.removeItem('kakaoAccessToken');
    localStorage.removeItem('userInfo');
    sessionStorage.removeItem('isLoggedIn');
    window.location.href = '/';
  };

  const navItems = [
    { key: '/event',     label: <Link to="/event">홈</Link> },
    { key: '/create',    label: <Link to="/create">새 모임</Link> },
    { key: '/calendar',  label: <Link to="/calendar">📅 내 캘린더</Link> },
    { key: '/timetable', label: <Link to="/timetable">📋 내 시간표</Link> },
    { key: '/mannalka',  label: <Link to="/mannalka">📌 만날까</Link> },
    { key: '/help',      label: <Link to="/help">도움말</Link> },
  ];

  const userDropdownItems = [
    { key: 'name', label: <span style={{ fontWeight: 600 }}>{nickname || '사용자'}</span>, disabled: true },
    { type: 'divider' },
    { key: 'logout', label: '로그아웃', danger: true, onClick: handleLogout },
  ];

  return (
    <div className="app-shell">
      <Header className="app-header">
        <a href="/event" className="header-logo-link">
          <img src="/logo.png" alt="모일까" className="header-logo-img" />
        </a>

        <Menu
          theme="dark"
          mode="horizontal"
          selectedKeys={[location.pathname]}
          items={navItems}
          className="desktop-nav"
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

      <main className="app-content">
        <Outlet />
      </main>

      <footer className="app-footer">
        모일까 &copy;{new Date().getFullYear()} Created by 모일까
      </footer>

      <nav className="mobile-bottom-nav">
        {BOTTOM_TABS.map(tab => (
          <button
            key={tab.key}
            className={[
              'bottom-tab',
              tab.isFab  ? 'bottom-tab-fab' : '',
              activeTab === tab.key ? 'active' : '',
            ].filter(Boolean).join(' ')}
            onClick={() => navigate(tab.key)}
          >
            <span className="bottom-tab-icon">{tab.icon}</span>
            <span className="bottom-tab-label">{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};

export default AppLayout;
