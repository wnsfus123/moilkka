import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from "react-router-dom";

const GetToken = () => {
  const [accessToken, setAccessToken] = useState('');
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
          setAccessToken(token);
          console.log("Access Token:", token);

          localStorage.setItem('kakaoAccessToken', token);

          const userInfoResponse = await axios.get("https://kapi.kakao.com/v2/user/me", {
            headers: {
              "Authorization": `Bearer ${token}`,
            },
          });

          const userInfo = userInfoResponse.data;
          localStorage.setItem('userInfo', JSON.stringify(userInfo));

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
      <p>Access Token: {accessToken}</p>
      <div>로그인 중입니다.</div>
    </div>
  );
};

export default GetToken;
