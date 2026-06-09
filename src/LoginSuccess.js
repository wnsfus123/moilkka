// src/components/LoginSuccess.js
import React from 'react';
import useUserStore from './store/userStore'; // Zustand 스토어 가져오기

const LoginSuccess = () => {
  
  const userInfo = useUserStore(state => state.userInfo);

  return (
    <div>
      <h2>로그인 성공!</h2>
      {userInfo ? (
        <div>
          <p>안녕하세요 {userInfo.kakao_account.profile.nickname}님!</p>
        </div>
      ) : (
        <p>사용자 정보를 불러오는 중...</p>
      )}
    </div>
  );
};

export default LoginSuccess;
