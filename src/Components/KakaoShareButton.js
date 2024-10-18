import React from 'react';
import { Button } from 'antd';

const KakaoShareButton = ({ userInfo, eventData }) => {
  const handleKakaoShare = () => {
    if (!eventData || !userInfo) return;

    const shareUrl = `http://localhost:8080/test/?key=${eventData.uuid}`;
    const shareMessage = `${userInfo.kakao_account.profile.nickname} 님이 모일까 일정추가를 원해요!
    카카오톡 로그인 후에 일정을 등록해보세요!`;

    if (window.Kakao) {
      window.Kakao.Link.sendDefault({
        objectType: 'feed',
        content: {
          title: '모일까',
          description: shareMessage,
          imageUrl: 'https://postfiles.pstatic.net/MjAyNDA2MjFfMTA4/MDAxNzE4OTU1MTA1MDg5.27seNkhpUz3k3bJv8rcsBYWXuvdMi-NYIGmm4MQfsCkg.4W9fU1m-u4DhuToJXqW5OTI-wySg-w_LByzoezu0szUg.PNG/logo2.png?type=w966', // 공유할 이미지 URL
          link: {
            mobileWebUrl: shareUrl,
            webUrl: shareUrl
          }
        },
        buttons: [
          {
            title: '일정 확인하기',
            link: {
              mobileWebUrl: shareUrl,
              webUrl: shareUrl
            }
          }
        ]
      });
    }
  };

  return (
    <Button type="default" onClick={handleKakaoShare} block style={{ marginBottom: "10px" }}>
      💬 카카오톡으로 공유하기
    </Button>
  );
};

export default KakaoShareButton;
