import React, { useState } from 'react';
import './OnboardingModal.css';

const SLIDES = [
  {
    icon: '🗓',
    title: '모임 일정을 쉽게 조율해요',
    desc: '날짜와 시간을 설정하면 참여자들이 가능한 시간을 직접 선택해요',
  },
  {
    icon: '💬',
    title: '카카오톡으로 초대해요',
    desc: '링크 하나로 참여자를 초대하고 알림도 자동으로 보내드려요',
  },
  {
    icon: '📌',
    title: '만날까로 1:1 예약도!',
    desc: '내 가능한 시간을 오픈하면 상대방이 직접 예약해요',
  },
];

const OnboardingModal = ({ onClose }) => {
  const [step, setStep] = useState(0);
  const slide = SLIDES[step];
  const isLast = step === SLIDES.length - 1;

  const finish = () => {
    localStorage.setItem('onboarded', 'true');
    onClose();
  };

  return (
    <div className="ob-overlay">
      <div className="ob-modal">
        <button className="ob-skip" onClick={finish}>건너뛰기</button>
        <div className="ob-step-label">{step + 1}/{SLIDES.length}</div>
        <div className="ob-icon">{slide.icon}</div>
        <h2 className="ob-title">{slide.title}</h2>
        <p className="ob-desc">{slide.desc}</p>
        <div className="ob-dots">
          {SLIDES.map((_, i) => (
            <span key={i} className={`ob-dot${i === step ? ' active' : ''}`} />
          ))}
        </div>
        <div className="ob-footer">
          {step > 0 ? (
            <button className="ob-btn ob-btn-prev" onClick={() => setStep(s => s - 1)}>
              ← 이전
            </button>
          ) : <span />}
          {isLast ? (
            <button className="ob-btn ob-btn-start" onClick={finish}>
              시작하기 🎉
            </button>
          ) : (
            <button className="ob-btn ob-btn-next" onClick={() => setStep(s => s + 1)}>
              다음 →
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default OnboardingModal;
