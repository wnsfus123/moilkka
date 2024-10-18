// CombinedPage.js
import React from 'react';
import { Row, Col } from 'antd';
import EventDashboard from './EventDashboard'; // 1번 컴포넌트
import CreateEvent from './CreateEvent'; // 2번 컴포넌트

const CombinedPage = () => {
  return (
    <div style={{ padding: '20px' }}>
      <Row gutter={16}>
        {/* 1번 컴포넌트: EventDashboard */}
        <Col span={12}>
          <div style={{ backgroundColor: '#f0f2f5', padding: '20px', height: '100%' }}>
            <EventDashboard />
          </div>
        </Col>

        {/* 2번 컴포넌트: CreateEvent */}
        <Col span={12}>
          <div style={{ backgroundColor: '#ffffff', padding: '20px', height: '100%' }}>
            <CreateEvent />
          </div>
        </Col>
      </Row>
    </div>
  );
};

export default CombinedPage;
