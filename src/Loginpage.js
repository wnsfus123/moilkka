import React, { useEffect, useState } from "react";
import Socialkakao from "./Components/Socialkakao";
import checkKakaoLoginStatus from "./Components/checkKakaoLoginStatus"; // 로그인 상태 확인 함수 가져오기
import { Button, Layout, Typography, Space, Card } from 'antd';
const { Header, Content } = Layout;
const { Title, Text } = Typography;
const Loginpage = () => {

    const [userInfo, setUserInfo] = useState(null); // LocalStorage를 직접 사용하여 상태 관리


    const handleLoginSuccess = (userInfo) => {
        localStorage.setItem('userInfo', JSON.stringify(userInfo)); // LocalStorage에 사용자 정보 저장
        setUserInfo(userInfo);
        window.location.href = `http://localhost:8080/`;
    };


    useEffect(() => {
        const checkLoginStatus = async () => {
            const savedAccessToken = localStorage.getItem('kakaoAccessToken');
            if (savedAccessToken) {
                const status = await checkKakaoLoginStatus(savedAccessToken);
                if (status) {
                    // 로그인 상태 복원
                    const storedUserInfo = localStorage.getItem('userInfo');
                    if (storedUserInfo) {
                        setUserInfo(JSON.parse(storedUserInfo));
                    }
                } else {
                    // 카카오 로그아웃 시 상태 초기화
                    localStorage.removeItem('kakaoAccessToken');
                    localStorage.removeItem('userInfo');
                    setUserInfo(null);
                }
            }
        };

        checkLoginStatus();
    }, []); // 필요한 상태를 의존성 배열에 추가

    // 로그아웃 핸들러
    const handleLogout = () => {
        localStorage.removeItem('kakaoAccessToken'); // LocalStorage에서 액세스 토큰 제거
        localStorage.removeItem('userInfo'); // LocalStorage에서 사용자 정보 제거
        setUserInfo(null); // 상태 초기화
        window.location.href = '/'; // 홈 페이지로 리다이렉트
    };



        // 이벤트 생성창 바로가기 핸들러
        const handleCreateEvent = () => {
            window.location.href = 'http://localhost:8080/create';
        };
    
    return (
        <Layout style={{ height: '100vh' }}>
        <Header style={{ textAlign: 'center', background: '#001529' }}>
            <Title style={{ color: 'white', margin: 0 }}>로그인 페이지</Title>
        </Header>
        <Content style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column', padding: '50px' }}>
            <Card style={{ width: 400, textAlign: 'center', boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)' }}>
                {userInfo ? (
                    <Space direction="vertical" align="center">
                        <Text> 안녕하세요 {userInfo.kakao_account.profile.nickname}님!</Text>
                        <Button type="primary" onClick={handleCreateEvent}>이벤트 생성창 바로가기</Button>
                        <Button type="primary" onClick={handleLogout}>로그아웃</Button>
                    </Space>
                ) : (
                    <Space direction="vertical" align="center">
                        <Socialkakao onLoginSuccess={handleLoginSuccess} />
                    </Space>
                )}
            </Card>
        </Content>
    </Layout>
    );
};

export default Loginpage;
