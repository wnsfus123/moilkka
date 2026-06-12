import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { message } from 'antd';
import { getUserInfoFromLocalStorage, getBaseUrl } from './Components/authUtils';
import EmptyState from './Components/EmptyState';
import SharePopup from './Components/SharePopup';
import './styles/MannalkaPage.css';

const DAY_NAMES = ['월', '화', '수', '목', '금', '토', '일'];
const DURATION_OPTIONS = [30, 60, 90, 120];
const START_HOURS = Array.from({ length: 17 }, (_, i) => i + 6);
const END_HOURS   = Array.from({ length: 17 }, (_, i) => i + 7);
const AVAIL_HOURS = Array.from({ length: 24 }, (_, i) => i);
const pad = n => String(n).padStart(2, '0');

const initDaySlots = () =>
  Array.from({ length: 7 }, (_, i) => ({
    day_of_week: i, enabled: false, start_time: '09:00', end_time: '18:00',
  }));

export default function MannalkaPage() {
  const navigate  = useNavigate();
  const userInfo  = getUserInfoFromLocalStorage();
  const userId    = userInfo?.id;
  const nickname  = userInfo?.kakao_account?.profile?.nickname || userInfo?.properties?.nickname || '';

  const [pages,      setPages]      = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [creating,   setCreating]   = useState(false);
  const [shareData,  setShareData]  = useState(null);
  const [createForm, setCreateForm] = useState({
    title: '', description: '', duration: 60, showTimetable: false,
    bookingMode: 'host_open',
    availableDays: [0,1,2,3,4],
    availableStart: '09:00',
    availableEnd: '22:00',
  });
  const [daySlots,   setDaySlots]   = useState(initDaySlots);

  const fetchPages = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await axios.get(`/api/mannalka?action=list&kakaoId=${userId}`);
      setPages(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchPages(); }, [fetchPages]);

  const handleUpdateSlot = (idx, patch) =>
    setDaySlots(prev => prev.map((s, i) => i === idx ? { ...s, ...patch } : s));

  const loadFromTimetable = async () => {
    if (!userId) return;
    try {
      const res = await axios.get(`/api/timetable?kakaoId=${userId}`);
      const entries = res.data || [];
      if (!entries.length) { message.info('등록된 시간표가 없어요'); return; }
      const next = initDaySlots();
      entries.forEach(e => {
        next[e.day_of_week] = {
          ...next[e.day_of_week],
          enabled: true,
          // 시간은 기본값(09:00-18:00) 유지 — 시간표 시간은 예약 불가 표시용으로만 쓰임
        };
      });
      setDaySlots(next);
      message.success('시간표를 불러왔어요');
    } catch {
      message.error('시간표를 불러오지 못했어요');
    }
  };

  const handleCreate = async () => {
    if (!createForm.title.trim()) { message.warning('제목을 입력해주세요'); return; }
    const isGuestPropose = createForm.bookingMode === 'guest_propose';
    if (isGuestPropose) {
      if (!createForm.availableDays.length) { message.warning('가능한 요일을 하나 이상 선택해주세요'); return; }
    } else {
      const slots = daySlots.filter(s => s.enabled);
      if (!slots.length) { message.warning('가능한 요일을 하나 이상 선택해주세요'); return; }
    }
    setCreating(true);
    try {
      const slots = isGuestPropose ? [] : daySlots.filter(s => s.enabled);
      const res = await axios.post('/api/mannalka?action=create', {
        kakao_id:        userId,
        title:           createForm.title.trim(),
        description:     createForm.description.trim() || null,
        duration:        createForm.duration,
        show_timetable:  createForm.showTimetable,
        booking_mode:    createForm.bookingMode,
        available_days:  createForm.availableDays,
        available_start: createForm.availableStart,
        available_end:   createForm.availableEnd,
        slots:           slots.map(s => ({ day_of_week: s.day_of_week, start_time: s.start_time, end_time: s.end_time })),
      });
      const newUuid = res.data?.uuid;
      setShowCreate(false);
      setCreateForm({ title: '', description: '', duration: 60, showTimetable: false, bookingMode: 'host_open', availableDays: [0,1,2,3,4], availableStart: '09:00', availableEnd: '22:00' });
      setDaySlots(initDaySlots());
      fetchPages();
      if (newUuid) {
        setShareData({
          url: `${getBaseUrl()}/book/${newUuid}`,
          uuid: newUuid,
          title: createForm.title.trim(),
        });
      } else {
        message.success('예약 페이지가 만들어졌어요!');
      }
    } catch (err) {
      message.error(err.response?.data?.error || '생성에 실패했어요');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (page) => {
    if (!window.confirm(`"${page.title}" 예약 페이지를 삭제할까요?`)) return;
    try {
      await axios.delete(`/api/mannalka?uuid=${page.uuid}`, { data: { kakao_id: userId } });
      message.success('삭제됐어요');
      fetchPages();
    } catch {
      message.error('삭제에 실패했어요');
    }
  };

  const copyLink = (uuid) => {
    const url = `${getBaseUrl()}/book/${uuid}`;
    navigator.clipboard.writeText(url)
      .then(() => message.success('링크가 복사됐어요!'))
      .catch(() => message.error('복사에 실패했어요'));
  };

  if (!userInfo) {
    return (
      <div className="mk-page">
        <div className="mk-empty">
          <span className="mk-empty-icon">📌</span>
          카카오 로그인 후 이용할 수 있어요.
        </div>
      </div>
    );
  }

  return (
    <div className="mk-page">
      {shareData && (
        <SharePopup
          isOpen
          onClose={() => setShareData(null)}
          title={`${shareData.title} 예약 페이지가 만들어졌어요!`}
          subtitle="예약 링크를 공유해보세요"
          shareUrl={shareData.url}
          navigateLabel="→ 예약 페이지 보기"
          onNavigate={() => { setShareData(null); navigate(`/book/${shareData.uuid}`); }}
          userInfo={userInfo}
        />
      )}
      <div className="mk-top-row">
        <div>
          <h2 className="mk-title">📌 만날까</h2>
          <p className="mk-subtitle">나만의 예약 링크를 만들어 1:1 미팅을 쉽게 잡아보세요, {nickname}님</p>
        </div>
        <button className="mk-btn-primary" onClick={() => setShowCreate(true)}>+ 새 예약 페이지</button>
      </div>

      {loading ? (
        <div className="mk-loading"><div className="mk-spinner" /><span>불러오는 중...</span></div>
      ) : pages.length === 0 ? (
        <EmptyState
          icon="📌"
          title="만날까 페이지가 없어요"
          description="예약 링크를 만들어 1:1 미팅을 쉽게 잡아보세요"
          actionLabel="+ 새 예약 페이지"
          onAction={() => setShowCreate(true)}
        />
      ) : (
        <div className="mk-cards">
          {pages.map(page => (
            <div key={page.uuid} className="mk-card">
              <div className="mk-card-header">
                <div className="mk-card-badges">
                  {page.pending_count   > 0 && <span className="mk-badge mk-badge-pending">대기 {page.pending_count}건</span>}
                  {page.confirmed_count > 0 && <span className="mk-badge mk-badge-confirmed">확정 {page.confirmed_count}건</span>}
                </div>
              </div>
              <div className="mk-card-name">{page.title}</div>
              {page.description && <div className="mk-card-desc">{page.description}</div>}
              <div className="mk-card-meta">⏱ {page.duration}분 미팅</div>
              <button className="mk-card-link" onClick={() => copyLink(page.uuid)}>
                <span className="mk-card-link-text">{getBaseUrl()}/book/{page.uuid}</span>
                <span className="mk-card-link-copy">복사</span>
              </button>
              <div className="mk-card-actions">
                <button className="mk-btn-primary  mk-btn-sm" onClick={() => navigate(`/mannalka/manage/${page.uuid}`)}>관리하기</button>
                <button className="mk-btn-danger   mk-btn-sm" onClick={() => handleDelete(page)}>삭제</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <div className="mk-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setShowCreate(false); }}>
          <div className="mk-modal">
            <div className="mk-modal-head">
              <h3>새 예약 페이지 만들기</h3>
              <button className="mk-modal-close" onClick={() => setShowCreate(false)}>✕</button>
            </div>

            <div className="mk-modal-body">
              <div className="mk-field">
                <label>제목 <span className="mk-req">*</span></label>
                <input
                  className="mk-input"
                  value={createForm.title}
                  onChange={e => setCreateForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="예: 커피챗 / 30분 상담"
                  maxLength={50}
                  autoFocus
                />
              </div>

              <div className="mk-field">
                <label>소개</label>
                <textarea
                  className="mk-textarea"
                  value={createForm.description}
                  onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="예약 페이지에 보여줄 소개 문구"
                  rows={2}
                />
              </div>

              <div className="mk-field">
                <label>미팅 시간</label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {DURATION_OPTIONS.map(d => (
                    <button
                      key={d}
                      type="button"
                      style={createForm.duration === d ? { border: 'none' } : {}}
                      className={createForm.duration === d ? 'mk-btn-primary mk-btn-sm' : 'mk-btn-secondary mk-btn-sm'}
                      onClick={() => setCreateForm(f => ({ ...f, duration: d }))}
                    >
                      {d}분
                    </button>
                  ))}
                </div>
              </div>

              <div className="mk-field">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={createForm.showTimetable}
                    onChange={e => setCreateForm(f => ({ ...f, showTimetable: e.target.checked }))}
                    style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#FEE500' }}
                  />
                  <span>시간표 공개</span>
                </label>
                <p className="mk-slot-hint">켜면 예약자가 내 주간 시간표를 볼 수 있어요</p>
              </div>

              {/* ── 예약 모드 선택 ── */}
              <div className="mk-field">
                <label>예약 모드</label>
                <div className="mk-booking-mode-row">
                  <label className={`mk-mode-option${createForm.bookingMode === 'host_open' ? ' active' : ''}`}>
                    <input
                      type="radio"
                      name="bookingMode"
                      value="host_open"
                      checked={createForm.bookingMode === 'host_open'}
                      onChange={() => setCreateForm(f => ({ ...f, bookingMode: 'host_open' }))}
                    />
                    <div>
                      <span className="mk-mode-title">내가 가능한 시간 오픈</span>
                      <span className="mk-mode-desc">내가 열어둔 시간 중에서 예약자가 선택</span>
                    </div>
                  </label>
                  <label className={`mk-mode-option${createForm.bookingMode === 'guest_propose' ? ' active' : ''}`}>
                    <input
                      type="radio"
                      name="bookingMode"
                      value="guest_propose"
                      checked={createForm.bookingMode === 'guest_propose'}
                      onChange={() => setCreateForm(f => ({ ...f, bookingMode: 'guest_propose' }))}
                    />
                    <div>
                      <span className="mk-mode-title">고객이 가능한 시간 제안</span>
                      <span className="mk-mode-desc">예약자가 원하는 시간을 제안, 내가 확정</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* ── guest_propose: 가능 요일 + 시간 범위 ── */}
              {createForm.bookingMode === 'guest_propose' ? (
                <>
                  <div className="mk-field">
                    <label>가능한 요일</label>
                    <div className="mk-avail-days">
                      {DAY_NAMES.map((name, idx) => (
                        <label key={idx} className={`mk-avail-day${createForm.availableDays.includes(idx) ? ' checked' : ''}`}>
                          <input
                            type="checkbox"
                            checked={createForm.availableDays.includes(idx)}
                            onChange={e => {
                              const days = createForm.availableDays;
                              setCreateForm(f => ({
                                ...f,
                                availableDays: e.target.checked ? [...days, idx].sort() : days.filter(d => d !== idx),
                              }));
                            }}
                          />
                          {name}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="mk-field">
                    <label>가능한 시간 범위</label>
                    <div className="mk-avail-time-row">
                      <select
                        className="mk-slot-select"
                        value={createForm.availableStart}
                        onChange={e => setCreateForm(f => ({ ...f, availableStart: e.target.value }))}
                        style={{ width: 80 }}
                      >
                        {AVAIL_HOURS.map(h => <option key={h} value={`${pad(h)}:00`}>{pad(h)}시</option>)}
                      </select>
                      <span style={{ color: '#aaa' }}>~</span>
                      <select
                        className="mk-slot-select"
                        value={createForm.availableEnd}
                        onChange={e => setCreateForm(f => ({ ...f, availableEnd: e.target.value }))}
                        style={{ width: 80 }}
                      >
                        {AVAIL_HOURS.filter(h => h > parseInt(createForm.availableStart.split(':')[0])).map(h => (
                          <option key={h} value={`${pad(h)}:00`}>{pad(h)}시</option>
                        ))}
                      </select>
                    </div>
                    <p className="mk-slot-hint">시간표에 등록된 일정은 자동으로 예약 불가 처리됩니다</p>
                  </div>
                </>
              ) : (
                /* ── host_open: 기존 슬롯 테이블 ── */
                <div className="mk-field">
                  <label>가능한 요일 / 시간</label>
                  <button className="mk-timetable-btn" onClick={loadFromTimetable}>
                    📋 내 시간표에서 불러오기
                  </button>
                  <p className="mk-slot-hint">시간표가 없으면 아래에서 직접 설정해 주세요</p>
                  <table className="mk-slot-table">
                    <thead>
                      <tr><th /><th>요일</th><th>시작</th><th>종료</th></tr>
                    </thead>
                    <tbody>
                      {daySlots.map((slot, idx) => (
                        <tr key={idx} className={`mk-slot-row${slot.enabled ? '' : ' disabled'}`}>
                          <td>
                            <input
                              type="checkbox"
                              className="mk-slot-check"
                              checked={slot.enabled}
                              onChange={e => handleUpdateSlot(idx, { enabled: e.target.checked })}
                            />
                          </td>
                          <td>{DAY_NAMES[idx]}</td>
                          <td>
                            <select
                              className="mk-slot-select"
                              value={slot.start_time}
                              disabled={!slot.enabled}
                              onChange={e => handleUpdateSlot(idx, { start_time: e.target.value })}
                            >
                              {START_HOURS.map(h => <option key={h} value={`${pad(h)}:00`}>{pad(h)}:00</option>)}
                            </select>
                          </td>
                          <td>
                            <select
                              className="mk-slot-select"
                              value={slot.end_time}
                              disabled={!slot.enabled}
                              onChange={e => handleUpdateSlot(idx, { end_time: e.target.value })}
                            >
                              {END_HOURS
                                .filter(h => h > parseInt(slot.start_time.split(':')[0]))
                                .map(h => <option key={h} value={`${pad(h)}:00`}>{pad(h)}:00</option>)}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="mk-slot-hint" style={{ marginTop: 6 }}>시간표에 등록된 일정은 자동으로 예약 불가 처리됩니다</p>
                </div>
              )}
            </div>

            <div className="mk-modal-foot">
              <button className="mk-btn-secondary" onClick={() => setShowCreate(false)}>취소</button>
              <button className="mk-btn-primary" onClick={handleCreate} disabled={creating}>
                {creating ? '만드는 중...' : '만들기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
