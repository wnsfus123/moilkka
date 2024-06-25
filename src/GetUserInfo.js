import React, { useEffect } from 'react';
import axios from 'axios';
import useUserStore from './store/userStore';

const GetUserInfo = ({ kakaoAccessToken, fnUserInfoCheck }) => {
  const setUserInfo = useUserStore(state => state.setUserInfo);
  const clearUserInfo = useUserStore(state => state.clearUserInfo);

  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const res = await axios.get("https://kapi.kakao.com/v2/user/me", {
          headers: {
            "Authorization": `Bearer ${kakaoAccessToken}`,
          },
        });

        const kakaoId = res.data.id.toString();
        const nickname = res.data.kakao_account.profile.nickname;

        await axios.post('/api/save-user-info', { kakaoId, nickname });

        fnUserInfoCheck(kakaoId, nickname);

        setUserInfo(res.data);
        localStorage.setItem('userInfo', JSON.stringify(res.data));
      } catch (e) {
        console.log('e : ', e);
        clearUserInfo();
        localStorage.removeItem('kakaoAccessToken');
        localStorage.removeItem('userInfo');
      }
    };

    if (kakaoAccessToken) {
      fetchUserInfo();
    }
  }, [kakaoAccessToken, fnUserInfoCheck, setUserInfo, clearUserInfo]);

  return null;
};

export default GetUserInfo;
