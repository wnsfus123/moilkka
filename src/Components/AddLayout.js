import React, { useState, useEffect, useRef } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { getUserInfoFromLocalStorage } from './authUtils';
import './AddLayout.css';

const AppLayout = () => {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const location = useLocation();
  const userInfo = getUserInfoFromLocalStorage();
  const nickname =
    userInfo?.kakao_account?.profile?.nickname ||
    userInfo?.properties?.nickname ||
    '';
  const dropdownRef = useRef(null);

  const handleLogout = () => {
    localStorage.removeItem('kakaoAccessToken');
    localStorage.removeItem('userInfo');
    sessionStorage.removeItem('isLoggedIn');
    window.location.href = '/';
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navItems = [
    { path: '/event', label: '홈' },
    { path: '/create', label: '새 모임' },
    { path: '/help', label: '도움말' },
  ];

  return (
    <div className="app-layout">
      <header className="app-header">
        <a href="/event" className="header-logo-link">
          <img src="/logo.png" alt="모일까" className="header-logo-img" />
        </a>

        <nav className="header-nav">
          {navItems.map(item => (
            <Link
              key={item.path}
              to={item.path}
              className={`header-nav-item${location.pathname === item.path ? ' active' : ''}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {userInfo && (
          <div className="header-user" ref={dropdownRef}>
            <button
              className="user-avatar-btn"
              onClick={() => setUserMenuOpen(v => !v)}
            >
              <div className="user-avatar">
                {nickname ? nickname.charAt(0) : '?'}
              </div>
              <span className="user-name-text">{nickname || '사용자'}</span>
              <span className="avatar-chevron">{userMenuOpen ? '▲' : '▼'}</span>
            </button>
            {userMenuOpen && (
              <div className="user-dropdown">
                <div className="dropdown-username">{nickname || '사용자'}</div>
                <button onClick={handleLogout} className="dropdown-logout">
                  로그아웃
                </button>
              </div>
            )}
          </div>
        )}
      </header>

      <main className="app-content">
        <Outlet />
      </main>

      <footer className="app-footer">
        모일까 ©{new Date().getFullYear()} Created by 모일까
      </footer>

      <nav className="mobile-bottom-nav">
        {navItems.map(item => (
          <Link
            key={item.path}
            to={item.path}
            className={`bottom-nav-item${location.pathname === item.path ? ' active' : ''}`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
};

export default AppLayout;
