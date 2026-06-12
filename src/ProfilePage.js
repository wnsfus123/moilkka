import React from 'react';
import { useNavigate } from 'react-router-dom';
import { getUserInfoFromLocalStorage } from './Components/authUtils';
import './styles/ProfilePage.css';

export default function ProfilePage() {
  const navigate  = useNavigate();
  const userInfo  = getUserInfoFromLocalStorage();
  const nickname  =
    userInfo?.kakao_account?.profile?.nickname ||
    userInfo?.properties?.nickname ||
    '사용자';
  const email = userInfo?.kakao_account?.email || '';

  const handleLogout = () => {
    localStorage.removeItem('kakaoAccessToken');
    localStorage.removeItem('userInfo');
    sessionStorage.removeItem('isLoggedIn');
    window.location.href = '/';
  };

  if (!userInfo) {
    return (
      <div className="pf-page">
        <p style={{ textAlign: 'center', color: '#aaa', marginTop: 48 }}>
          로그인이 필요해요.
        </p>
      </div>
    );
  }

  return (
    <div className="pf-page">
      <div className="pf-avatar-area">
        <div className="pf-avatar">{nickname.charAt(0)}</div>
        <h2 className="pf-nickname">{nickname}</h2>
        {email && <p className="pf-email">{email}</p>}
      </div>

      <div className="pf-menu-list">
        <button className="pf-menu-item" onClick={() => navigate('/timetable')}>
          <span className="pf-menu-icon">📋</span>
          <span className="pf-menu-label">내 시간표</span>
          <span className="pf-menu-arrow">›</span>
        </button>
        <button className="pf-menu-item" onClick={() => navigate('/help')}>
          <span className="pf-menu-icon">❓</span>
          <span className="pf-menu-label">도움말</span>
          <span className="pf-menu-arrow">›</span>
        </button>
        <button className="pf-menu-item pf-menu-logout" onClick={handleLogout}>
          <span className="pf-menu-icon">🚪</span>
          <span className="pf-menu-label">로그아웃</span>
        </button>
      </div>
    </div>
  );
}
