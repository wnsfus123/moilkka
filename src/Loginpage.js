import React, { useEffect, useState } from "react";
import checkKakaoLoginStatus from "./Components/checkKakaoLoginStatus";
import useUserStore from "./store/userStore"; // Zustand 스토어 가져오기
import { Button, Layout, Typography, Space, Card } from 'antd';
import SocialLogin from "./Components/SocialLogin"; // SocialLogin 컴포넌트를 가져옵니다.

const { Header, Content } = Layout;
const { Title, Text } = Typography;

const Loginpage = () => {
    const { userInfo, setUserInfo, clearUserInfo } = useUserStore(); // Zustand 스토어에서 사용자 정보 가져오기
    const [loading, setLoading] = useState(true); // 로딩 상태

    // 로그인 성공 시 실행되는 함수
    const handleLoginSuccess = (userInfo) => {
        setUserInfo(userInfo); // Zustand 스토어에 사용자 정보 저장
        window.location.href = `http://localhost:8080/event`; // 이벤트 페이지로 리다이렉트
    };

    useEffect(() => {
        const checkLoginStatus = async () => {
            const savedAccessToken = localStorage.getItem('kakaoAccessToken');

            if (savedAccessToken) {
                const status = await checkKakaoLoginStatus(savedAccessToken);
                if (status) {
                    setLoading(false); // 로그인 상태 확인 후 로딩 종료
                    window.location.href = `http://localhost:8080/event`; // 로그인 후 이벤트 페이지로 리다이렉트
                } else {
                    clearUserInfo(); // 로그인 실패 시 사용자 정보 초기화
                    setLoading(false);
                }
            } else {
                setLoading(false); // 토큰이 없으면 로딩 종료
            }
        };

        checkLoginStatus();
    }, [clearUserInfo]);

    return (
        <Layout style={{ height: '100vh' }}>
            <Content style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', padding: '0px' }}>
                <Card style={{ width: 1000, textAlign: 'center', boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)' }}>
                    {loading ? ( // 로딩 중일 때의 처리
                        <Text>로딩 중...</Text>
                    ) : userInfo ? (
                        // 로그인된 경우, 이벤트 페이지로 리다이렉트
                        null
                    ) : (
                        <SocialLogin onLoginSuccess={handleLoginSuccess} />
                    )}
                </Card>
            </Content>
        </Layout>
    );
};

export default Loginpage;
