import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ko } from 'date-fns/locale';
import { gapi } from 'gapi-script';
import { message } from 'antd';
import { getUserInfoFromLocalStorage, getBaseUrl } from './Components/authUtils';
import { initGoogleAPI, signInWithGoogle, isGoogleSignedIn } from './googleAuth';
import EmptyState from './Components/EmptyState';
import './styles/CalendarPage.css';

const CalendarPage = () => {
  const userInfo = getUserInfoFromLocalStorage();

  const [selectedDate, setSelectedDate] = useState(null);
  const [activeMonth, setActiveMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [moilkkaEvents, setMoilkkaEvents] = useState([]);
  const [googleEvents, setGoogleEvents] = useState([]);
  const [kakaoEvents, setKakaoEvents] = useState([]);
  const [isGoogleLinked, setIsGoogleLinked] = useState(false);
  const [isKakaoLinked, setIsKakaoLinked] = useState(false);
  const [personalEvents, setPersonalEvents] = useState([]);
  const [loadingMoilkka, setLoadingMoilkka] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [loadingKakao, setLoadingKakao] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ title: '', memo: '' });
  const [savingPersonal, setSavingPersonal] = useState(false);

  // ── Fetch helpers ──

  const fetchPersonalEvents = useCallback(async () => {
    if (!userInfo?.id) return;
    try {
      const res = await axios.get(`/api/personal-events?kakaoId=${userInfo.id}`);
      setPersonalEvents(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('[CalendarPage] 개인 일정 조회 오류:', err);
    }
  }, [userInfo]);

  const fetchMoilkkaEvents = useCallback(async () => {
    if (!userInfo) return;
    setLoadingMoilkka(true);
    try {
      const res = await axios.get(`/api/events/user/${userInfo.id}`);
      setMoilkkaEvents(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('[CalendarPage] 모일까 이벤트 조회 오류:', err);
    } finally {
      setLoadingMoilkka(false);
    }
  }, [userInfo]);

  const fetchGoogleEvents = useCallback(async (month) => {
    setLoadingGoogle(true);
    try {
      const timeMin = startOfMonth(month).toISOString();
      const timeMax = endOfMonth(month).toISOString();
      const response = await gapi.client.calendar.events.list({
        calendarId: 'primary',
        timeMin,
        timeMax,
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: 100,
      });
      setGoogleEvents(response.result.items || []);
    } catch (err) {
      console.error('[CalendarPage] 구글 캘린더 조회 오류:', err);
      setGoogleEvents([]);
    } finally {
      setLoadingGoogle(false);
    }
  }, []);

  const fetchKakaoEvents = useCallback(async (month) => {
    const token = localStorage.getItem('kakaoAccessToken');
    if (!token) return;
    setLoadingKakao(true);
    try {
      const from = startOfMonth(month).toISOString();
      const to = endOfMonth(month).toISOString();
      const res = await axios.get('https://kapi.kakao.com/v2/api/calendar/events', {
        headers: { Authorization: `Bearer ${token}` },
        params: { from, to, limit: 100 },
      });
      setKakaoEvents(res.data.events || []);
    } catch (err) {
      console.error('[CalendarPage] 카카오 캘린더 조회 오류:', err);
      setKakaoEvents([]);
    } finally {
      setLoadingKakao(false);
    }
  }, []);

  // ── Init ──
  useEffect(() => {
    initGoogleAPI();
    fetchMoilkkaEvents();
    fetchPersonalEvents();

    // 카카오 캘린더 동의 완료 후 돌아온 경우 자동 연동
    const params = new URLSearchParams(window.location.search);
    if (params.get('kakao_linked') === '1') {
      window.history.replaceState({}, '', '/calendar');
      setIsKakaoLinked(true);
      fetchKakaoEvents(activeMonth);
    }

    // Check if Google was already signed in (delayed — gapi init is async)
    const timer = setTimeout(() => {
      try {
        if (isGoogleSignedIn()) {
          setIsGoogleLinked(true);
          fetchGoogleEvents(activeMonth);
        }
      } catch {}
    }, 1200);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Personal event handlers ──
  const handleOpenAddModal = () => {
    setAddForm({ title: '', memo: '' });
    setShowAddModal(true);
  };

  const handleAddPersonal = async () => {
    if (!addForm.title.trim() || !selectedDate || !userInfo?.id) return;
    setSavingPersonal(true);
    try {
      await axios.post('/api/personal-events', {
        kakaoId: userInfo.id,
        title: addForm.title.trim(),
        memo: addForm.memo.trim() || undefined,
        event_date: format(selectedDate, 'yyyy-MM-dd'),
      });
      message.success('일정이 저장됐어요!');
      setShowAddModal(false);
      await fetchPersonalEvents();
    } catch {
      message.error('저장에 실패했습니다.');
    } finally {
      setSavingPersonal(false);
    }
  };

  const handleDeletePersonal = async (id) => {
    try {
      await axios.delete(`/api/personal-events?id=${id}&kakaoId=${userInfo.id}`);
      setPersonalEvents(prev => prev.filter(e => e.id !== id));
    } catch {
      message.error('삭제에 실패했습니다.');
    }
  };

  // ── Month change: refetch Google/Kakao ──
  const changeMonth = useCallback((newMonth) => {
    setActiveMonth(newMonth);
    if (isGoogleLinked) fetchGoogleEvents(newMonth);
    if (isKakaoLinked) fetchKakaoEvents(newMonth);
  }, [isGoogleLinked, isKakaoLinked, fetchGoogleEvents, fetchKakaoEvents]);

  // ── Connect handlers ──
  const handleGoogleConnect = async () => {
    try {
      await signInWithGoogle();
      setIsGoogleLinked(true);
      await fetchGoogleEvents(activeMonth);
      message.success('구글 캘린더 연동 완료!');
    } catch (err) {
      console.error(err);
      message.error('구글 캘린더 연동에 실패했습니다.');
    }
  };

  const handleKakaoConnect = async () => {
    const token = localStorage.getItem('kakaoAccessToken');
    if (!token) { message.warning('카카오 로그인이 필요합니다.'); return; }

    // 이미 연동된 경우 바로 로드
    if (isKakaoLinked) {
      await fetchKakaoEvents(activeMonth);
      return;
    }

    // talk_calendar 동의 화면으로 이동 (incremental auth)
    const REST_API_KEY = process.env.REACT_APP_KAKAO_REST_API_KEY;
    const REDIRECT_URI = process.env.REACT_APP_KAKAO_REDIRECT_URI;
    sessionStorage.setItem('returnAfterAuth', '/calendar');
    window.location.href = `https://kauth.kakao.com/oauth/authorize?client_id=${REST_API_KEY}&redirect_uri=${REDIRECT_URI}&response_type=code&scope=talk_calendar&prompt=consent`;
  };

  // ── Build date maps ──
  const safeDateKey = (raw) => {
    if (!raw) return null;
    try {
      const d = new Date(typeof raw === 'string' ? raw.replace(' ', 'T') : raw);
      return isNaN(d.getTime()) ? null : format(d, 'yyyy-MM-dd');
    } catch { return null; }
  };

  const moilkkaDates = {};
  moilkkaEvents.forEach(ev => {
    const key = safeDateKey(ev.startday || ev.start_at);
    if (key) {
      if (!moilkkaDates[key]) moilkkaDates[key] = [];
      moilkkaDates[key].push(ev);
    }
    // Also mark confirmed slot dates
    (ev.confirmed_slots || []).forEach(slot => {
      const slotKey = slot.split(' ')[0];
      if (slotKey && slotKey !== key) {
        if (!moilkkaDates[slotKey]) moilkkaDates[slotKey] = [];
        moilkkaDates[slotKey].push({ ...ev, _confirmedSlot: slot });
      }
    });
  });

  const googleDates = {};
  googleEvents.forEach(ev => {
    const key = safeDateKey(ev.start?.dateTime || ev.start?.date);
    if (key) {
      if (!googleDates[key]) googleDates[key] = [];
      googleDates[key].push(ev);
    }
  });

  const kakaoDates = {};
  kakaoEvents.forEach(ev => {
    const key = safeDateKey(ev.time?.start_at || ev.start_at);
    if (key) {
      if (!kakaoDates[key]) kakaoDates[key] = [];
      kakaoDates[key].push(ev);
    }
  });

  const personalDates = {};
  personalEvents.forEach(ev => {
    const key = ev.event_date;
    if (key) {
      if (!personalDates[key]) personalDates[key] = [];
      personalDates[key].push(ev);
    }
  });

  // ── Tile content ──
  const tileContent = ({ date, view }) => {
    if (view !== 'month') return null;
    const key = format(date, 'yyyy-MM-dd');
    const m = moilkkaDates[key] || [];
    const g = googleDates[key] || [];
    const k = kakaoDates[key] || [];
    const p = personalDates[key] || [];
    if (m.length + g.length + k.length + p.length === 0) return null;
    return (
      <div className="cp-tile-dots">
        {m.length > 0 && <span className="cp-dot cp-dot-moilkka" />}
        {g.length > 0 && <span className="cp-dot cp-dot-google" />}
        {k.length > 0 && <span className="cp-dot cp-dot-kakao" />}
        {p.length > 0 && <span className="cp-dot cp-dot-personal" />}
      </div>
    );
  };

  const tileClassName = ({ date, view }) => {
    if (view !== 'month') return null;
    const dow = date.getDay();
    if (dow === 0) return 'cp-tile-sun';
    if (dow === 6) return 'cp-tile-sat';
    return null;
  };

  // ── Sidebar ──
  const selKey = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : null;
  const selMoilkka  = selKey ? (moilkkaDates[selKey]  || []) : [];
  const selGoogle   = selKey ? (googleDates[selKey]   || []) : [];
  const selKakao    = selKey ? (kakaoDates[selKey]    || []) : [];
  const selPersonal = selKey ? (personalDates[selKey] || []) : [];

  // ── Summary ──
  const y = activeMonth.getFullYear();
  const m = activeMonth.getMonth();
  const monthMoilkka = moilkkaEvents.filter(ev => {
    const d = new Date((ev.startday || ev.start_at || '').replace(' ', 'T'));
    return !isNaN(d) && d.getFullYear() === y && d.getMonth() === m;
  });
  const monthPrefix = `${y}-${String(m + 1).padStart(2, '0')}`;
  const allDayMap = {};
  [
    ...Object.entries(moilkkaDates),
    ...Object.entries(googleDates),
    ...Object.entries(kakaoDates),
  ].forEach(([date, evs]) => {
    if (!date.startsWith(monthPrefix)) return;
    allDayMap[date] = (allDayMap[date] || 0) + evs.length;
  });
  const busiestEntry = Object.entries(allDayMap).sort(([, a], [, b]) => b - a)[0];
  const busiestDay = busiestEntry
    ? format(new Date(busiestEntry[0]), 'M월 d일 (EEE)', { locale: ko })
    : null;

  return (
    <div className="cp-root">

      {/* ── Header ── */}
      <div className="cp-header">
        <div className="cp-month-nav">
          <button className="cp-nav-btn" onClick={() => changeMonth(new Date(y, m - 1, 1))}>‹</button>
          <h2 className="cp-month-title">{format(activeMonth, 'yyyy년 M월')}</h2>
          <button className="cp-nav-btn" onClick={() => changeMonth(new Date(y, m + 1, 1))}>›</button>
        </div>
        <div className="cp-connect-btns">
          <button
            className={`cp-connect-btn cp-connect-google${isGoogleLinked ? ' linked' : ''}`}
            onClick={handleGoogleConnect}
            disabled={loadingGoogle}
          >
            {loadingGoogle ? '불러오는 중...' : isGoogleLinked ? '📅 구글 연동됨' : '📅 구글 연동'}
          </button>
          <button
            className={`cp-connect-btn cp-connect-kakao${isKakaoLinked ? ' linked' : ''}`}
            onClick={handleKakaoConnect}
            disabled={loadingKakao}
          >
            {loadingKakao ? '불러오는 중...' : isKakaoLinked ? '💬 카카오 연동됨' : '💬 카카오 연동'}
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="cp-body">

        {/* Calendar */}
        <div className="cp-calendar-wrap">
          <Calendar
            value={selectedDate}
            onChange={setSelectedDate}
            activeStartDate={activeMonth}
            onActiveStartDateChange={({ activeStartDate }) => changeMonth(activeStartDate)}
            showNavigation={false}
            showNeighboringMonth={false}
            tileContent={tileContent}
            tileClassName={tileClassName}
            formatDay={(locale, date) => date.getDate().toString()}
            calendarType="iso8601"
            locale="ko-KR"
          />
          <div className="cp-legend">
            <span><span className="cp-dot cp-dot-moilkka" />모일까 모임</span>
            {isGoogleLinked && <span><span className="cp-dot cp-dot-google" />구글 일정</span>}
            {isKakaoLinked  && <span><span className="cp-dot cp-dot-kakao"  />카카오 일정</span>}
            {personalEvents.length > 0 && <span><span className="cp-dot cp-dot-personal" />내 메모</span>}
          </div>
        </div>

        {/* Sidebar */}
        <div className="cp-sidebar">
          {selectedDate ? (
            <>
              <div className="cp-sidebar-title-row">
                <h3 className="cp-sidebar-title">
                  {format(selectedDate, 'M월 d일 (EEE)', { locale: ko })}
                </h3>
                <button className="cp-add-btn" onClick={handleOpenAddModal} title="메모 추가">+</button>
              </div>

              {selMoilkka.length + selGoogle.length + selKakao.length + selPersonal.length === 0 && (
                <div className="cp-sidebar-empty">
                  이 날 일정이 없어요
                  <button className="cp-sidebar-add-link" onClick={handleOpenAddModal}>+ 메모 추가</button>
                </div>
              )}

              {/* Moilkka */}
              {selMoilkka.map((ev, i) => {
                const isUnconfirmed = !ev.confirmed_slots || ev.confirmed_slots.length === 0;
                return (
                  <div key={i} className={`cp-event-card cp-event-moilkka${isUnconfirmed ? ' unconfirmed' : ''}`}>
                    <div className="cp-event-header">
                      <span className="cp-event-dot cp-dot-moilkka" />
                      <span className="cp-event-title">{ev.eventname || ev.name}</span>
                      {isUnconfirmed && <span className="cp-badge-unconfirmed">미확정</span>}
                    </div>
                    <a
                      className="cp-event-action"
                      href={`${getBaseUrl()}/meet/?key=${ev.uuid}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      모임 바로가기 →
                    </a>
                  </div>
                );
              })}

              {/* Google */}
              {selGoogle.map((ev, i) => (
                <div key={i} className="cp-event-card cp-event-google">
                  <div className="cp-event-header">
                    <span className="cp-event-dot cp-dot-google" />
                    <span className="cp-event-title">{ev.summary || '(제목 없음)'}</span>
                  </div>
                  {(ev.start?.dateTime || ev.start?.date) && (
                    <div className="cp-event-time">
                      {ev.start.dateTime
                        ? `${format(new Date(ev.start.dateTime), 'HH:mm')} ~ ${format(new Date(ev.end.dateTime), 'HH:mm')}`
                        : '종일'}
                    </div>
                  )}
                </div>
              ))}

              {/* Kakao */}
              {selKakao.map((ev, i) => (
                <div key={i} className="cp-event-card cp-event-kakao">
                  <div className="cp-event-header">
                    <span className="cp-event-dot cp-dot-kakao" />
                    <span className="cp-event-title">{ev.title || '(제목 없음)'}</span>
                  </div>
                  {ev.time?.start_at && (
                    <div className="cp-event-time">
                      {format(new Date(ev.time.start_at), 'HH:mm')}
                      {ev.time?.end_at && ` ~ ${format(new Date(ev.time.end_at), 'HH:mm')}`}
                    </div>
                  )}
                </div>
              ))}

              {/* Personal memo */}
              {selPersonal.map((ev) => (
                <div key={ev.id} className="cp-event-card cp-event-personal">
                  <div className="cp-event-header">
                    <span className="cp-event-dot cp-dot-personal" />
                    <span className="cp-event-title">{ev.title}</span>
                    <button
                      className="cp-personal-del-btn"
                      onClick={() => handleDeletePersonal(ev.id)}
                      title="삭제"
                    >×</button>
                  </div>
                  {ev.memo && <div className="cp-event-time">{ev.memo}</div>}
                </div>
              ))}
            </>
          ) : (
            <div className="cp-sidebar-placeholder">
              <span className="cp-sidebar-placeholder-icon">📅</span>
              <p>날짜를 클릭하면<br />일정을 확인할 수 있어요</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Summary ── */}
      <div className="cp-summary">
        <div className="cp-summary-item">
          <span className="cp-summary-label">이번달 모임</span>
          <span className="cp-summary-value">
            {loadingMoilkka ? '...' : `${monthMoilkka.length}개`}
          </span>
        </div>
        <div className="cp-summary-divider" />
        <div className="cp-summary-item">
          <span className="cp-summary-label">확정된 모임</span>
          <span className="cp-summary-value">
            {loadingMoilkka ? '...' : `${monthMoilkka.filter(e => e.confirmed_slots?.length > 0).length}개`}
          </span>
        </div>
        {busiestDay && (
          <>
            <div className="cp-summary-divider" />
            <div className="cp-summary-item">
              <span className="cp-summary-label">가장 바쁜 날</span>
              <span className="cp-summary-value">{busiestDay}</span>
            </div>
          </>
        )}
      </div>

      {/* ── 이번 달 모임 없을 때 Empty State ── */}
      {!loadingMoilkka && monthMoilkka.length === 0 && (
        <EmptyState
          icon="📅"
          title="이번 달 모임이 없어요"
          description="새 모임을 만들어보세요"
          actionLabel="새 모임 만들기"
          onAction={() => { window.location.href = '/create'; }}
        />
      )}

      {/* ── Add personal memo modal ── */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="cp-add-modal" onClick={e => e.stopPropagation()}>
            <div className="cp-add-modal-header">
              <h3 className="cp-add-modal-title">
                {selectedDate && format(selectedDate, 'M월 d일')} 메모 추가
              </h3>
              <button className="modal-close" onClick={() => setShowAddModal(false)}>✕</button>
            </div>
            <div className="cp-add-modal-body">
              <label className="cp-form-label">제목 <span className="cp-form-required">*</span></label>
              <input
                className="cp-form-input"
                type="text"
                placeholder="일정 제목을 입력하세요"
                value={addForm.title}
                onChange={e => setAddForm(f => ({ ...f, title: e.target.value }))}
                autoFocus
                onKeyDown={e => e.key === 'Enter' && handleAddPersonal()}
              />
              <label className="cp-form-label" style={{ marginTop: 12 }}>메모 (선택)</label>
              <textarea
                className="cp-form-input cp-form-textarea"
                placeholder="간단한 메모를 남겨보세요"
                value={addForm.memo}
                onChange={e => setAddForm(f => ({ ...f, memo: e.target.value }))}
                rows={3}
              />
            </div>
            <div className="cp-add-modal-actions">
              <button className="modal-btn-cancel" onClick={() => setShowAddModal(false)}>취소</button>
              <button
                className="modal-btn-primary"
                onClick={handleAddPersonal}
                disabled={!addForm.title.trim() || savingPersonal}
              >
                {savingPersonal ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default CalendarPage;
