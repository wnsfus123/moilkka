import React from "react";
import './Socialkakao.css';

const Socialkakao = () => {
  const REST_API_KEY = process.env.REACT_APP_KAKAO_REST_API_KEY;
  const REDIRECT_URI = process.env.REACT_APP_KAKAO_REDIRECT_URI;
  const kakaoURL = `https://kauth.kakao.com/oauth/authorize?client_id=${REST_API_KEY}&redirect_uri=${REDIRECT_URI}&response_type=code&scope=profile_nickname,talk_message`;

  return (
    <div className="sk-page">
      <div className="sk-card">
        <img src="/logo.png" alt="모일까" className="sk-logo" />
        <h1 className="sk-title">모일까</h1>
        <p className="sk-desc">
          일정을 등록하고<br />모두가 가능한 최적의 시간을 찾아보세요
        </p>
        <div className="sk-divider" />
        <span className="sk-login-label">카카오 계정으로 시작하기</span>
        <a href={kakaoURL} className="sk-kakao-btn">
          <img src="/kakao_login_medium_narrow.png" alt="카카오 로그인" />
        </a>
        <p className="sk-notice">로그인 시 닉네임 정보만 사용합니다</p>
      </div>
    </div>
  );
};

export default Socialkakao;
