import React from 'react';
import { Card, Col, Row } from 'antd';

const HelpSection = () => {
  // 도움말 항목들
  const helpItems = [
    {
      title: "1. 일정 생성",
      description: "새로운 일정을 생성하여 친구들과 계획을 공유하세요.",
      image: "https://via.placeholder.com/150" // 이미지 URL을 여기에 추가
    },
    {
      title: "2. 일정 수정",
      description: "기존 일정을 수정하여 변경사항을 반영하세요.",
      image: "https://via.placeholder.com/150" // 이미지 URL을 여기에 추가
    },
    {
      title: "3. 일정 초대",
      description: "친구들을 초대하여 함께 일정을 관리하세요.",
      image: "https://via.placeholder.com/150" // 이미지 URL을 여기에 추가
    },
    {
      title: "4. 공유하기",
      description: "일정을 친구들과 쉽게 공유하여 모두가 알 수 있도록 하세요.",
      image: "https://via.placeholder.com/150" // 이미지 URL을 여기에 추가
    }
  ];

  return (
    <div style={{ padding: '20px' }}>
      <h2>도움말 섹션</h2>
      <Row gutter={16}>
        {helpItems.map((item, index) => (
          <Col span={6} key={index}>
            <Card
              hoverable
              style={{ textAlign: 'center', marginBottom: '20px' }}
            >
              <img 
                src={item.image} 
                alt={item.title} 
                style={{ width: '100%', height: 'auto', marginBottom: '10px' }} 
              />
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
};

export default HelpSection;
