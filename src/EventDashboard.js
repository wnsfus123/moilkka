import React, { useState, useEffect } from 'react';
import ExistingEvents from './Components/ExistingEvents';
import { checkKakaoLoginStatus, getUserInfoFromLocalStorage, clearUserInfoFromLocalStorage } from './Components/authUtils';

const EventDashboard = () => {
  const [userInfo, setUserInfo] = useState(getUserInfoFromLocalStorage());

  useEffect(() => {
    const token = localStorage.getItem('kakaoAccessToken');
    if (!token) return;
    checkKakaoLoginStatus(token).then(ok => {
      if (ok) {
        setUserInfo(getUserInfoFromLocalStorage());
      } else {
        clearUserInfoFromLocalStorage();
        setUserInfo(null);
      }
    });
  }, []);

  return (
    <div>
      <ExistingEvents userInfo={userInfo} />
    </div>
  );
};

export default EventDashboard;
