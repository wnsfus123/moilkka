import React from "react";

const Socialkakao = ({ onLoginSuccess }) => {
  const REST_API_KEY = process.env.REACT_APP_KAKAO_REST_API_KEY;              
  const REDIRECT_URI = process.env.REACT_APP_KAKAO_REDIRECT_URI;                    
 
  const kakaoURL = `https://kauth.kakao.com/oauth/authorize?client_id=${REST_API_KEY}&redirect_uri=${REDIRECT_URI}&response_type=code&scope=profile_nickname,talk_message`;


  return (
    <div>
      <a href={kakaoURL}>
         <img src="/kakao_login_medium_narrow.png" alt="Kakao Login" />
      </a>
    </div>
  );
};

export default Socialkakao;
