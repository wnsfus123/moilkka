import axios from 'axios';

const checkKakaoLoginStatus = async (token) => {
    try {
        const response = await axios.get("https://kapi.kakao.com/v2/user/me", {
            headers: {
                "Authorization": `Bearer ${token}`,
            },
        });
        return response.status === 200;
    } catch (error) {
        console.error("로그인 상태 확인 중 오류 발생:", error);
        return false;
    }
};

export default checkKakaoLoginStatus;
