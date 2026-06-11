import React, { useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from "react-router-dom";
import './GetToken.css';

const GetToken = () => {
  const CLIENT_ID = process.env.REACT_APP_KAKAO_REST_API_KEY;
  const REDIRECT_URI = process.env.REACT_APP_KAKAO_REDIRECT_URI;

  const navigate = useNavigate();

  const makeFormData = (params) => {
    const searchParams = new URLSearchParams();
    Object.keys(params).forEach(key => {
      searchParams.append(key, params[key]);
    });
    return searchParams;
  };

  useEffect(() => {
    const handleGetToken = async () => {
      const code = new URLSearchParams(window.location.search).get("code");

      if (code) {
        try {
          const res = await axios({
            method: 'POST',
            headers: {
              'content-type': 'application/x-www-form-urlencoded;charset=utf-8',
            },
            url: 'https://kauth.kakao.com/oauth/token',
            data: makeFormData({
              grant_type: 'authorization_code',
              client_id: CLIENT_ID,
              redirect_uri: REDIRECT_URI,
              code
            })
          });

          const token = res.data.access_token;
          const refreshToken = res.data.refresh_token;

          localStorage.setItem('kakaoAccessToken', token);
          localStorage.setItem('kakaoRefreshToken', refreshToken); // 리프레시 토큰 저장

          const userInfoResponse = await axios.get("https://kapi.kakao.com/v2/user/me", {
            headers: {
              "Authorization": `Bearer ${token}`,
            },
          });

          const userInfo = userInfoResponse.data;
          console.log('카카오 유저 전체 응답:', JSON.stringify(userInfo));
          localStorage.setItem('userInfo', JSON.stringify(userInfo));

          // 토큰의 유효 기간 (초 단위로)과 발급 시각을 가져옵니다.
          const expiresIn = res.data.expires_in;
          const issuedAt = Math.floor(Date.now() / 1000);

          // 유저 저장 (실패해도 로그인 흐름 계속)
          const nickname =
            userInfo?.kakao_account?.profile?.nickname ||
            userInfo?.properties?.nickname ||
            userInfo?.kakao_account?.name ||
            '익명';

          try {
            await axios.post('/api/users/save', {
              kakaoId: userInfo.id.toString(),
              nickname,
            });
          } catch (err) {
            console.error('[GetToken] 유저 저장 실패:', err.response?.data || err.message);
          }

          // 토큰 저장 (실패해도 로그인 흐름 계속)
          try {
            await axios.post('/api/tokens/save', {
              kakaoId: userInfo.id.toString(),
              accessToken: token,
              refreshToken,
              issuedAt,
              expiresIn,
            });
          } catch (err) {
            console.error('[GetToken] 토큰 저장 실패:', err.response?.data || err.message);
          }

          navigate('/event');
        } catch (err) {
          console.error('[GetToken] 카카오 로그인 실패:', err.response?.data || err.message);
        }
      }
    };

    handleGetToken();
  }, [CLIENT_ID, REDIRECT_URI, navigate]);

  return (
    <div className="gt-page">
      <div className="gt-card">
        <img src="/logo.png" alt="모일까" className="gt-logo" />
        <div className="gt-spinner" />
        <p className="gt-title">로그인 중...</p>
        <p className="gt-sub">카카오 계정 정보를 불러오고 있어요</p>
      </div>
    </div>
  );
};

export default GetToken;
