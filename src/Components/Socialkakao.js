import React from "react";

const Socialkakao = ({ onLoginSuccess }) => {
  const REST_API_KEY = process.env.REACT_APP_KAKAO_REST_API_KEY;              
  const REDIRECT_URI = process.env.REACT_APP_KAKAO_REDIRECT_URI;                    
 
  const kakaoURL = `https://kauth.kakao.com/oauth/authorize?client_id=${REST_API_KEY}&redirect_uri=${REDIRECT_URI}&response_type=code`;

  // 환경 변수가 올바르게 설정되었는지 확인하기 위해 콘솔에 로그를 출력합니다.
  console.log("REST_API_KEY:", REST_API_KEY);
  console.log("REDIRECT_URI:", REDIRECT_URI);
  console.log("Kakao URL:", kakaoURL);

  return (
    <div>
      <a href={kakaoURL}>
         <img src="/kakao_login_medium_narrow.png" alt="Kakao Login" />
      </a>
    </div>
  );
};

export default Socialkakao;
