import React, { useEffect, useState } from 'react';
import axios from 'axios';
import useUserStore from './store/userStore';
import { checkKakaoLoginStatus, getUserInfoFromLocalStorage, getBaseUrl } from './Components/authUtils';
import './Login.css';

const Loginpage = () => {
  const { clearUserInfo } = useUserStore();
  const [loading, setLoading] = useState(true);

  const REST_API_KEY = process.env.REACT_APP_KAKAO_REST_API_KEY;
  const REDIRECT_URI = process.env.REACT_APP_KAKAO_REDIRECT_URI;
  const kakaoURL = `https://kauth.kakao.com/oauth/authorize?client_id=${REST_API_KEY}&redirect_uri=${REDIRECT_URI}&response_type=code&scope=profile_nickname,talk_message`;

  useEffect(() => {
    const checkLoginStatus = async () => {
      const savedAccessToken = localStorage.getItem('kakaoAccessToken');
      if (savedAccessToken) {
        const status = await checkKakaoLoginStatus(savedAccessToken);
        if (status) {
          const latestUserInfo = getUserInfoFromLocalStorage();
          if (latestUserInfo) {
            const nickname =
              latestUserInfo?.kakao_account?.profile?.nickname ||
              latestUserInfo?.properties?.nickname ||
              latestUserInfo?.kakao_account?.name ||
              null;
            try {
              await axios.post('/api/users/save', {
                kakaoId: latestUserInfo.id.toString(),
                nickname,
              });
            } catch (err) {
              console.error('[Loginpage] 유저 닉네임 업데이트 실패:', err.message);
            }
          }
          setLoading(false);
          window.location.href = `${getBaseUrl()}/event`;
        } else {
          clearUserInfo();
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };
    checkLoginStatus();
  }, [clearUserInfo]);

  if (loading) {
    return (
      <div className="login-loading">
        <div className="login-spinner" />
        <span>로딩 중...</span>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <img src="/logo.png" alt="모일까" className="login-logo" />
          <p className="login-tagline">모임 일정, 더 쉽게 맞춰요</p>
        </div>

        <div className="login-features">
          <div className="feature-item">
            <span className="feature-icon">📅</span>
            <div>
              <div className="feature-title">날짜 선택</div>
              <div className="feature-desc">원하는 날짜 범위를 간편하게 설정</div>
            </div>
          </div>
          <div className="feature-item">
            <span className="feature-icon">👥</span>
            <div>
              <div className="feature-title">일정 공유</div>
              <div className="feature-desc">카카오톡으로 친구에게 쉽게 공유</div>
            </div>
          </div>
          <div className="feature-item">
            <span className="feature-icon">✨</span>
            <div>
              <div className="feature-title">최적 시간 추천</div>
              <div className="feature-desc">모두가 가능한 시간을 자동으로 분석</div>
            </div>
          </div>
        </div>

        <div className="login-kakao">
          <a href={kakaoURL}>
            <img
              src="https://developers.kakao.com/tool/resource/static/img/button/login/full/ko/kakao_login_medium_narrow.png"
              alt="카카오 로그인"
              className="kakao-login-img"
            />
          </a>
        </div>
      </div>
    </div>
  );
};

export default Loginpage;
