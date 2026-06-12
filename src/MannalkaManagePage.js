import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { message } from 'antd';
import { getUserInfoFromLocalStorage } from './Components/authUtils';
import './styles/MannalkaPage.css';

const DAY_NAMES = ['월', '화', '수', '목', '금', '토', '일'];
const pad = n => String(n).padStart(2, '0');

const fmtProposedTime = (isoStr) => {
  const d = new Date(isoStr);
  const mon = d.getMonth() + 1;
  const day = d.getDate();
  const dow = DAY_NAMES[(d.getDay() + 6) % 7];
  const h   = pad(d.getHours());
  const m   = pad(d.getMinutes());
  const he  = pad(d.getHours() + 1);
  return `${mon}월 ${day}일(${dow}) ${h}:${m}~${he}:${m}`;
};

const formatDateTime = (iso) => {
  const d = new Date(iso);
  const date = d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
  const time = d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  return `${date} ${time}`;
};

const getWeeklySummary = (slots) => {
  if (!slots || slots.length === 0) return '예약 가능한 시간이 없어요';
  const groups = {};
  slots.forEach(s => {
    const h = parseInt(s.start_time.split(':')[0]);
    const period = h < 12 ? '오전' : h < 18 ? '오후' : '저녁';
    if (!groups[s.day_of_week]) groups[s.day_of_week] = new Set();
    groups[s.day_of_week].add(period);
  });
  const parts = Object.entries(groups)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([d, p]) => `${DAY_NAMES[Number(d)]} ${[...p].join('/')}`)
    .join(', ');
  return `${parts} 예약 가능해요`;
};

const STATUS_LABEL = { pending: '대기', confirmed: '확정', cancelled: '취소' };

export default function MannalkaManagePage() {
  const { uuid }    = useParams();
  const navigate    = useNavigate();
  const userInfo    = getUserInfoFromLocalStorage();
  const userId      = userInfo?.id;

  const [page,     setPage]     = useState(null);
  const [slots,    setSlots]    = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [acting,   setActing]   = useState(null);

  const fetchAll = useCallback(async () => {
    if (!userId || !uuid) return;
    setLoading(true);
    try {
      const [pageRes, slotsRes, reqRes] = await Promise.all([
        axios.get(`/api/mannalka?action=page&uuid=${uuid}`),
        axios.get(`/api/mannalka?action=slots&uuid=${uuid}`),
        axios.get(`/api/mannalka?action=requests&uuid=${uuid}&kakaoId=${userId}`),
      ]);
      setPage(pageRes.data);
      setSlots(slotsRes.data || []);
      setRequests(reqRes.data || []);
    } catch (err) {
      if (err.response?.status === 403) {
        message.error('접근 권한이 없어요');
        navigate('/mannalka');
      }
    } finally {
      setLoading(false);
    }
  }, [uuid, userId, navigate]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleConfirm = async (bookingId) => {
    setActing(bookingId);
    try {
      await axios.post('/api/mannalka?action=confirm', { booking_id: bookingId, kakao_id: userId });
      const req = requests.find(r => r.id === bookingId);
      if (req?.booked_at) {
        try {
          await axios.post('/api/personal-events', {
            kakaoId: userId,
            title: `${page?.title || '예약'} 예약`,
            event_date: req.booked_at,
          });
        } catch {}
      }
      message.success('예약 확정! 내 캘린더에 자동 등록됐어요.');
      fetchAll();
    } catch {
      message.error('확정에 실패했어요');
    } finally {
      setActing(null);
    }
  };

  const handleCancel = async (bookingId) => {
    if (!window.confirm('이 예약을 거절할까요?')) return;
    setActing(bookingId);
    try {
      await axios.post('/api/mannalka?action=cancel', { booking_id: bookingId, kakao_id: userId });
      message.success('예약을 거절했어요');
      fetchAll();
    } catch {
      message.error('거절에 실패했어요');
    } finally {
      setActing(null);
    }
  };

  const handlePickTime = async (bookingId, confirmedTime) => {
    if (!window.confirm(`${fmtProposedTime(confirmedTime)}으로 확정할까요?`)) return;
    setActing(bookingId);
    try {
      await axios.post('/api/mannalka?action=confirm', { booking_id: bookingId, kakao_id: userId, confirmed_time: confirmedTime });
      try {
        await axios.post('/api/personal-events', {
          kakaoId: userId,
          title: `${page?.title || '예약'} 예약`,
          event_date: confirmedTime,
        });
      } catch {}
      message.success('예약 확정! 내 캘린더에 자동 등록됐어요.');
      fetchAll();
    } catch {
      message.error('확정에 실패했어요');
    } finally {
      setActing(null);
    }
  };

  if (!userInfo) {
    return (
      <div className="mk-page">
        <div className="mk-empty"><span className="mk-empty-icon">📌</span>로그인이 필요해요.</div>
      </div>
    );
  }

  if (loading) return <div className="mk-page"><div className="mk-loading"><div className="mk-spinner" /><span>불러오는 중...</span></div></div>;

  const pending   = requests.filter(r => r.status === 'pending');
  const confirmed = requests.filter(r => r.status === 'confirmed');
  const others    = requests.filter(r => r.status === 'cancelled');
  const ordered   = [...pending, ...confirmed, ...others];

  return (
    <div className="mk-page">
      <button className="mk-back-btn" onClick={() => navigate('/mannalka')}>← 내 예약 페이지 목록</button>

      <h2 className="mk-title">{page?.title}</h2>
      {page?.description && <p className="mk-subtitle">{page.description}</p>}

      <div className="mk-summary-box">
        <p className="mk-summary-title">📅 {getWeeklySummary(slots)}</p>
        <div className="mk-summary-counts">
          <span className="mk-badge mk-badge-pending">대기 {pending.length}건</span>
          <span className="mk-badge mk-badge-confirmed">확정 {confirmed.length}건</span>
          {others.length > 0 && <span className="mk-badge mk-badge-cancelled">취소 {others.length}건</span>}
        </div>
      </div>

      {ordered.length === 0 ? (
        <div className="mk-empty">
          <span className="mk-empty-icon">📭</span>
          <p>아직 예약 신청이 없어요</p>
        </div>
      ) : (
        <div className="mk-request-list">
          {ordered.map(req => {
            const isPropose = page?.booking_mode === 'guest_propose' && req.proposed_times?.length > 0;
            return (
              <div key={req.id} className={`mk-request-card status-${req.status}`}>
                <div className="mk-request-head">
                  <span className="mk-request-name">{req.guest_name}</span>
                  <span className={`mk-badge mk-badge-${req.status}`}>{STATUS_LABEL[req.status] || req.status}</span>
                </div>

                {isPropose ? (
                  /* ── guest_propose 카드 ── */
                  <div className="mk-propose-card">
                    <p className="mk-propose-label">제안한 시간 {req.proposed_times.length}개:</p>
                    <div className="mk-propose-list">
                      {req.proposed_times.map((iso, i) => (
                        <div key={i} className="mk-propose-item">
                          <span className="mk-propose-time">○ {fmtProposedTime(iso)}</span>
                          {req.status === 'pending' && (
                            <button
                              className="mk-btn-confirm mk-btn-sm"
                              onClick={() => handlePickTime(req.id, iso)}
                              disabled={acting === req.id}
                            >
                              {acting === req.id ? '...' : '확정'}
                            </button>
                          )}
                          {req.confirmed_time && new Date(req.confirmed_time).toISOString() === new Date(iso).toISOString() && (
                            <span className="mk-propose-confirmed-badge">✅ 확정됨</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  /* ── host_open 카드 ── */
                  <div className="mk-request-date">📅 {formatDateTime(req.booked_at)}</div>
                )}

                {req.memo && <div className="mk-request-memo">💬 {req.memo}</div>}
                {req.status === 'pending' && !isPropose && (
                  <div className="mk-request-actions">
                    <button
                      className="mk-btn-confirm mk-btn-sm"
                      onClick={() => handleConfirm(req.id)}
                      disabled={acting === req.id}
                    >
                      {acting === req.id ? '처리 중...' : '✅ 확정'}
                    </button>
                    <button
                      className="mk-btn-danger mk-btn-sm"
                      onClick={() => handleCancel(req.id)}
                      disabled={acting === req.id}
                    >
                      거절
                    </button>
                  </div>
                )}
                {req.status === 'pending' && isPropose && (
                  <div className="mk-request-actions" style={{ marginTop: 8 }}>
                    <button
                      className="mk-btn-danger mk-btn-sm"
                      onClick={() => handleCancel(req.id)}
                      disabled={acting === req.id}
                    >
                      거절
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
