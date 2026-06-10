import React, { useEffect, useState } from 'react';
import axios from 'axios';
import useUserStore from './store/userStore';
import { Layout, Typography, Card } from 'antd';
import SocialLogin from './Components/SocialLogin';
import { checkKakaoLoginStatus, getUserInfoFromLocalStorage, getBaseUrl } from './Components/authUtils';

const { Content } = Layout;
const { Text } = Typography;

const Loginpage = () => {
  const { userInfo, setUserInfo, clearUserInfo } = useUserStore();
  const [loading, setLoading] = useState(true);

  const handleLoginSuccess = (info) => {
    setUserInfo(info);
    window.location.href = `${getBaseUrl()}/event`;
  };

  useEffect(() => {
    const checkLoginStatus = async () => {
      const savedAccessToken = localStorage.getItem('kakaoAccessToken');
      if (savedAccessToken) {
        const status = await checkKakaoLoginStatus(savedAccessToken);
        if (status) {
          // checkKakaoLoginStatus가 이미 최신 userInfo를 localStorage에 저장
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

  return (
    <Layout style={{ height: '100vh' }}>
      <Content style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', padding: '0px' }}>
        <Card style={{ width: 1000, textAlign: 'center', boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)' }}>
          {loading ? (
            <Text>로딩 중...</Text>
          ) : userInfo ? null : (
            <SocialLogin onLoginSuccess={handleLoginSuccess} />
          )}
        </Card>
      </Content>
    </Layout>
  );
};

export default Loginpage;
