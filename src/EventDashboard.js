// EventDashboard.js
import React from 'react';
import ExistingEvents from './Components/ExistingEvents'; // 기존 일정 보기 컴포넌트 불러오기
import { getUserInfoFromLocalStorage } from './Components/authUtils';
import { Button } from 'antd';

const EventDashboard = () => {
  const userInfo = getUserInfoFromLocalStorage(); // 로컬 스토리지에서 사용자 정보 가져오기



  return (
    <div>
      <ExistingEvents userInfo={userInfo} /> {/* 기존 일정 보기 */}
    </div>
  );
};

export default EventDashboard;
