import React, { useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from "react-router-dom";

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
          localStorage.setItem('userInfo', JSON.stringify(userInfo));

          // 토큰의 유효 기간 (초 단위로)과 발급 시각을 가져옵니다.
          const expiresIn = res.data.expires_in; // Kakao API 응답에서 유효 기간 가져오기
          const issuedAt = Math.floor(Date.now() / 1000); // 현재 시간을 초 단위로

          await axios.post('/api/tokens/save', {
            kakaoId: userInfo.id,
            accessToken: token,
            refreshToken: refreshToken,
            issuedAt: issuedAt, // 발급 시각 추가
            expiresIn: expiresIn // 유효 기간 추가
          });

          navigate('/event');
        } catch (err) {
          console.warn(err);
        }
      }
    };

    handleGetToken();
  }, [CLIENT_ID, REDIRECT_URI, navigate]);

  return (
    <div>
      <p>로그인 중입니다.</p>
    </div>
  );
};

export default GetToken;
