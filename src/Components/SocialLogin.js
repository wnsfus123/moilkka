import React from "react";
import { Space, Typography, Card, Image, Row } from 'antd';
import Socialkakao from "./Socialkakao"; // Socialkakao 컴포넌트를 가져옵니다.

const { Title, Text } = Typography;

const SocialLogin = ({ onLoginSuccess }) => {
    return (
        <Card 
            style={{ 
                width: '100%',           // 전체 너비로 설정
                maxWidth: 1600,          // 최대 너비를 1600px로 설정
                textAlign: 'center', 
                boxShadow: '0 6px 8px rgba(0, 0, 0, 0.1)', 
                padding: '20px',          // 패딩 추가
                backgroundColor: '#001529'
            }}
        >
            <Image
                preview={false}
                src="/logo.png" // public 폴더에 있는 logo.png 파일 경로
                alt="Logo"
                style={{ marginBottom: '20px', maxWidth: '250px', height: 'auto', color: 'white'}} // 로고 크기 조정
            />
            <Text style={{ fontSize: '20px', display: 'block', marginBottom: '20px', color: 'white' }}>
                <strong style={{ color: 'white',fontSize: '22px' }}>모</strong>임시간 
                    <strong style={{ color: 'white' ,fontSize: '22px' }}> 일</strong>일히 조율하지 말고 
                        <strong style={{ color: 'white',fontSize: '22px'  }}> 까</strong>먹지 않게 리마인더로!
            </Text>
            <Title level={4} style={{ color: 'white', marginBottom: '30px' }}>모일까로 각자 일정을 등록하고 가능한 시간을 조율해보세요!</Title>
            <Socialkakao onLoginSuccess={onLoginSuccess} />
        </Card>
    );
};

export default SocialLogin;
