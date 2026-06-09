import React, { useEffect, useState } from 'react';
import checkKakaoLoginStatus from './Components/checkKakaoLoginStatus';
import useUserStore from './store/userStore';
import { Layout, Typography, Card } from 'antd';
import SocialLogin from './Components/SocialLogin';
import { getBaseUrl } from './Components/authUtils';

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
