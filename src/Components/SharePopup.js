import React from 'react';
import { message } from 'antd';
import './SharePopup.css';

const SharePopup = ({ isOpen, onClose, title, subtitle, shareUrl, navigateLabel, onNavigate, userInfo }) => {
  if (!isOpen) return null;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      message.success('복사됐어요!');
    } catch {
      message.error('복사에 실패했어요');
    }
  };

  const handleKakaoShare = () => {
    if (!window.Kakao) return;
    const senderName =
      userInfo?.kakao_account?.profile?.nickname ||
      userInfo?.properties?.nickname ||
      '누군가';
    window.Kakao.Link.sendDefault({
      objectType: 'feed',
      content: {
        title: '모일까',
        description: `${senderName}님이 초대했어요! ${title}`,
        imageUrl:
          'https://postfiles.pstatic.net/MjAyNDA2MjFfMTA4/MDAxNzE4OTU1MTA1MDg5.27seNkhpUz3k3bJv8rcsBYWXuvdMi-NYIGmm4MQfsCkg.4W9fU1m-u4DhuToJXqW5OTI-wySg-w_LByzoezu0szUg.PNG/logo2.png?type=w966',
        link: { mobileWebUrl: shareUrl, webUrl: shareUrl },
      },
      buttons: [
        { title: '링크 열기', link: { mobileWebUrl: shareUrl, webUrl: shareUrl } },
      ],
    });
  };

  return (
    <div className="sp-overlay" onClick={onClose}>
      <div className="sp-modal" onClick={e => e.stopPropagation()}>
        <div className="sp-emoji">🎉</div>
        <h2 className="sp-title">{title}</h2>
        {subtitle && <p className="sp-subtitle">{subtitle}</p>}
        <div className="sp-link-box">
          <span className="sp-link-text">{shareUrl}</span>
        </div>
        <div className="sp-actions">
          <button className="sp-btn sp-btn-kakao" onClick={handleKakaoShare}>
            💬 카카오로 공유
          </button>
          <button className="sp-btn sp-btn-copy" onClick={handleCopyLink}>
            🔗 링크 복사
          </button>
          <button className="sp-btn sp-btn-go" onClick={onNavigate}>
            {navigateLabel || '→ 바로가기'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SharePopup;
