import React from 'react';
import { getBaseUrl } from './authUtils';

const KakaoShareButton = ({ userInfo, eventData }) => {
  const handleKakaoShare = () => {
    if (!eventData || !userInfo) return;

    const shareUrl = `${getBaseUrl()}/test/?key=${eventData.uuid}`;
    const senderName =
      userInfo?.kakao_account?.profile?.nickname ||
      userInfo?.properties?.nickname ||
      '누군가';
    const shareMessage = `${senderName} 님이 모일까 일정추가를 원해요!\n카카오톡 로그인 후에 일정을 등록해보세요!`;

    if (window.Kakao) {
      window.Kakao.Link.sendDefault({
        objectType: 'feed',
        content: {
          title: '모일까',
          description: shareMessage,
          imageUrl: 'https://postfiles.pstatic.net/MjAyNDA2MjFfMTA4/MDAxNzE4OTU1MTA1MDg5.27seNkhpUz3k3bJv8rcsBYWXuvdMi-NYIGmm4MQfsCkg.4W9fU1m-u4DhuToJXqW5OTI-wySg-w_LByzoezu0szUg.PNG/logo2.png?type=w966',
          link: { mobileWebUrl: shareUrl, webUrl: shareUrl },
        },
        buttons: [
          { title: '일정 확인하기', link: { mobileWebUrl: shareUrl, webUrl: shareUrl } },
        ],
      });
    }
  };

  return (
    <button className="ep-tool-btn kakao" onClick={handleKakaoShare}>
      💬 카카오톡 공유
    </button>
  );
};

export default KakaoShareButton;
