import axios from 'axios';

export const getBaseUrl = () =>
  process.env.REACT_APP_BASE_URL || window.location.origin;

export const checkKakaoLoginStatus = async (token) => {
  try {
    const response = await axios.get('https://kapi.kakao.com/v2/user/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.status === 200) {
      // 항상 최신 userInfo를 localStorage에 동기화
      localStorage.setItem('userInfo', JSON.stringify(response.data));
      return true;
    }
    return false;
  } catch (error) {
    console.error('로그인 상태 확인 중 오류 발생:', error);
    return false;
  }
};

export const getUserInfoFromLocalStorage = () => {
  const userInfo = localStorage.getItem('userInfo');
  return userInfo ? JSON.parse(userInfo) : null;
};

export const clearUserInfoFromLocalStorage = () => {
  localStorage.removeItem('kakaoAccessToken');
  localStorage.removeItem('userInfo');
};
