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
  const [loadingMoilkka, setLoadingMoilkka] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [loadingKakao, setLoadingKakao] = useState(false);

  // ── Fetch helpers ──

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
    setIsKakaoLinked(true);
    await fetchKakaoEvents(activeMonth);
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

  // ── Tile content ──
  const tileContent = ({ date, view }) => {
    if (view !== 'month') return null;
    const key = format(date, 'yyyy-MM-dd');
    const m = moilkkaDates[key] || [];
    const g = googleDates[key] || [];
    const k = kakaoDates[key] || [];
    if (m.length + g.length + k.length === 0) return null;
    return (
      <div className="cp-tile-dots">
        {m.length > 0 && <span className="cp-dot cp-dot-moilkka" />}
        {g.length > 0 && <span className="cp-dot cp-dot-google" />}
        {k.length > 0 && <span className="cp-dot cp-dot-kakao" />}
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
  const selMoilkka = selKey ? (moilkkaDates[selKey] || []) : [];
  const selGoogle  = selKey ? (googleDates[selKey]  || []) : [];
  const selKakao   = selKey ? (kakaoDates[selKey]   || []) : [];

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
            calendarType="gregory"
            locale="ko-KR"
          />
          <div className="cp-legend">
            <span><span className="cp-dot cp-dot-moilkka" />모일까 모임</span>
            {isGoogleLinked && <span><span className="cp-dot cp-dot-google" />구글 일정</span>}
            {isKakaoLinked  && <span><span className="cp-dot cp-dot-kakao"  />카카오 일정</span>}
          </div>
        </div>

        {/* Sidebar */}
        <div className="cp-sidebar">
          {selectedDate ? (
            <>
              <h3 className="cp-sidebar-title">
                {format(selectedDate, 'M월 d일 (EEE)', { locale: ko })}
              </h3>

              {selMoilkka.length + selGoogle.length + selKakao.length === 0 && (
                <div className="cp-sidebar-empty">이 날 일정이 없어요</div>
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
                      href={`${getBaseUrl()}/test/?key=${ev.uuid}`}
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

    </div>
  );
};

export default CalendarPage;
