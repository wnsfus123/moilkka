import React, { useState, useEffect, useCallback, useMemo, Fragment } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { message } from 'antd';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { getUserInfoFromLocalStorage } from './Components/authUtils';
import './styles/MannalkaPage.css';

const BK_HOURS = [7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22];
const BK_DAYS  = ['월','화','수','목','금','토','일'];
const pad2 = n => String(n).padStart(2, '0');

const DAY_NAMES = ['월', '화', '수', '목', '금', '토', '일'];
const pad = n => String(n).padStart(2, '0');
const startOfDay = (d) => { const n = new Date(d); n.setHours(0, 0, 0, 0); return n; };

const getTimeSlotsForDate = (date, slots, bookedTimes, duration) => {
  const dayOfWeek = (date.getDay() + 6) % 7;
  const daySlots  = slots.filter(s => s.day_of_week === dayOfWeek);
  const result    = [];
  daySlots.forEach(s => {
    const [sh] = s.start_time.split(':').map(Number);
    const [eh] = s.end_time.split(':').map(Number);
    for (let h = sh; h + duration / 60 <= eh; h += duration / 60) {
      const timeStr = `${pad(Math.floor(h))}:${pad((h % 1) * 60)}`;
      const slotDt  = new Date(date);
      slotDt.setHours(Math.floor(h), (h % 1) * 60, 0, 0);
      const isBooked = bookedTimes.some(b => Math.abs(new Date(b.booked_at).getTime() - slotDt.getTime()) < 30000);
      result.push({ time: timeStr, datetime: slotDt, isBooked });
    }
  });
  return result;
};

const getWeeklySummary = (slots) => {
  if (!slots || !slots.length) return '현재 예약 가능한 시간이 없어요';
  const groups = {};
  slots.forEach(s => {
    const h = parseInt(s.start_time.split(':')[0]);
    const p = h < 12 ? '오전' : h < 18 ? '오후' : '저녁';
    if (!groups[s.day_of_week]) groups[s.day_of_week] = new Set();
    groups[s.day_of_week].add(p);
  });
  const parts = Object.entries(groups)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([d, p]) => `${DAY_NAMES[Number(d)]} ${[...p].join('/')}`)
    .join(', ');
  return `매주 ${parts} 예약 가능`;
};

export default function BookingPage() {
  const { uuid }   = useParams();
  const userInfo   = getUserInfoFromLocalStorage();
  const guestKakao = userInfo?.id?.toString();
  const guestNick  = userInfo?.kakao_account?.profile?.nickname || userInfo?.properties?.nickname || '';

  const [page,         setPage]         = useState(null);
  const [slots,        setSlots]        = useState([]);
  const [bookedTimes,  setBookedTimes]  = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [step,         setStep]         = useState('calendar');
  const [form,         setForm]         = useState({ guest_name: guestNick, guest_kakao: guestKakao || '', memo: '' });
  const [submitting,   setSubmitting]   = useState(false);
  const [doneBooking,      setDoneBooking]      = useState(null);
  const [showTimetableView, setShowTimetableView] = useState(false);
  const [hostTimetable,     setHostTimetable]     = useState([]);
  const [loadingTimetable,  setLoadingTimetable]  = useState(false);

  const fetchAll = useCallback(async () => {
    if (!uuid) return;
    setLoading(true);
    try {
      const [pageRes, slotsRes, bookedRes] = await Promise.all([
        axios.get(`/api/mannalka?action=page&uuid=${uuid}`),
        axios.get(`/api/mannalka?action=slots&uuid=${uuid}`),
        axios.get(`/api/mannalka?action=booked&uuid=${uuid}`),
      ]);
      setPage(pageRes.data);
      setSlots(slotsRes.data || []);
      setBookedTimes(bookedRes.data || []);
    } catch {
      message.error('페이지를 불러오지 못했어요');
    } finally {
      setLoading(false);
    }
  }, [uuid]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    setForm(f => ({
      ...f,
      guest_name:  guestNick  || f.guest_name,
      guest_kakao: guestKakao || f.guest_kakao,
    }));
  }, [guestNick, guestKakao]);

  useEffect(() => {
    if (!page?.show_timetable || !page?.kakao_id) return;
    setLoadingTimetable(true);
    axios.get(`/api/timetable?kakaoId=${page.kakao_id}`)
      .then(res => setHostTimetable(res.data || []))
      .catch(() => setHostTimetable([]))
      .finally(() => setLoadingTimetable(false));
  }, [page?.show_timetable, page?.kakao_id]);

  const duration = page?.duration || 60;

  const isAvailableDate = useCallback((date) => {
    if (startOfDay(date) < startOfDay(new Date())) return false;
    const ts = getTimeSlotsForDate(date, slots, bookedTimes, duration);
    return ts.some(s => !s.isBooked);
  }, [slots, bookedTimes, duration]);

  const timeSlots = useMemo(() => {
    if (!selectedDate) return [];
    return getTimeSlotsForDate(selectedDate, slots, bookedTimes, duration);
  }, [selectedDate, slots, bookedTimes, duration]);

  const handleDateChange = (date) => {
    setSelectedDate(date);
    setSelectedSlot(null);
    setStep('calendar');
  };

  const handleSlotSelect = (slot) => {
    if (slot.isBooked) return;
    setSelectedSlot(slot);
    setStep('form');
  };

  const handleSubmit = async () => {
    if (!form.guest_name.trim()) { message.warning('이름을 입력해주세요'); return; }
    if (!selectedSlot) return;
    setSubmitting(true);
    try {
      const res = await axios.post('/api/mannalka?action=book', {
        page_uuid:   uuid,
        guest_name:  form.guest_name.trim(),
        guest_kakao: form.guest_kakao || null,
        booked_at:   selectedSlot.datetime.toISOString(),
        memo:        form.memo.trim() || null,
      });
      setDoneBooking(res.data);
      setStep('done');
      fetchAll();
    } catch (err) {
      if (err.response?.status === 409) message.error('이미 예약된 시간이에요. 다른 시간을 선택해주세요.');
      else message.error('예약에 실패했어요');
    } finally {
      setSubmitting(false);
    }
  };

  const fmtDate = (dt) => dt.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
  const fmtTime = (dt) => dt.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

  if (loading) {
    return <div className="mk-page"><div className="mk-loading"><div className="mk-spinner" /><span>불러오는 중...</span></div></div>;
  }

  if (!page || !page.is_active) {
    return (
      <div className="mk-page">
        <div className="mk-empty"><span className="mk-empty-icon">🔒</span> 페이지를 찾을 수 없어요.</div>
      </div>
    );
  }

  return (
    <div className="mk-page">
      {/* 호스트 카드 */}
      <div className="bk-host-card">
        <p className="bk-host-name">📌 {page.host_nickname}님의 예약 페이지</p>
        <h1 className="bk-page-title">{page.title}</h1>
        {page.description && <p className="bk-page-desc">{page.description}</p>}
        <div className="bk-meta-row">
          <span className="bk-meta-chip">⏱ {duration}분 미팅</span>
          <span className="bk-avail-text">{getWeeklySummary(slots)}</span>
        </div>
      </div>

      {/* 시간표 / 날짜선택 뷰 전환 */}
      {page.show_timetable && step !== 'done' && (
        <div className="bk-view-toggle">
          <button
            className={`bk-view-btn${!showTimetableView ? ' active' : ''}`}
            onClick={() => setShowTimetableView(false)}
          >
            📅 날짜 선택
          </button>
          <button
            className={`bk-view-btn${showTimetableView ? ' active' : ''}`}
            onClick={() => setShowTimetableView(true)}
          >
            📋 시간표 보기
          </button>
        </div>
      )}

      {/* 읽기전용 시간표 */}
      {showTimetableView && step !== 'done' && (
        loadingTimetable ? (
          <div className="mk-loading"><div className="mk-spinner" /><span>시간표 불러오는 중...</span></div>
        ) : (() => {
          const slotSet = new Set();
          slots.forEach(s => {
            const sh = parseInt(s.start_time);
            const eh = parseInt(s.end_time);
            for (let h = sh; h < eh; h++) slotSet.add(`${s.day_of_week}-${h}`);
          });
          const bmap = {};
          hostTimetable.forEach(entry => {
            const sh = parseInt(entry.start_time);
            const eh = parseInt(entry.end_time);
            for (let h = sh; h < eh; h++) {
              if (!bmap[entry.day_of_week]) bmap[entry.day_of_week] = {};
              bmap[entry.day_of_week][h] = { ...entry, isFirst: h === sh, isLast: h === eh - 1 };
            }
          });
          return (
            <div className="bk-tt-outer">
              <div className="bk-tt-legend">
                <span><span className="bk-tt-legend-busy" />바쁜 시간</span>
                <span><span className="bk-tt-legend-avail" />예약 가능</span>
              </div>
              <div className="bk-tt-grid-wrap">
                <div className="bk-tt-corner" />
                {BK_DAYS.map((day, i) => (
                  <div key={i} className={`bk-tt-day-header${i === 5 ? ' sat' : i === 6 ? ' sun' : ''}`}>{day}</div>
                ))}
                {BK_HOURS.map(hour => (
                  <Fragment key={hour}>
                    <div className="bk-tt-time-label">{pad2(hour)}:00</div>
                    {BK_DAYS.map((_, dayIdx) => {
                      const block = bmap[dayIdx]?.[hour];
                      const isAvail = slotSet.has(`${dayIdx}-${hour}`);
                      let cls = 'bk-tt-cell';
                      if (isAvail && !block) cls += ' bk-tt-cell-avail';
                      if (block) cls += ' bk-tt-cell-block';
                      const c = block?.color || '#FEE500';
                      const style = block ? {
                        background: c + '33',
                        borderLeft: `2px solid ${c}`,
                        borderRight: `2px solid ${c}`,
                        ...(block.isFirst && { borderTop: `2px solid ${c}`, borderTopLeftRadius: 4, borderTopRightRadius: 4 }),
                        ...(block.isLast  && { borderBottom: `2px solid ${c}`, borderBottomLeftRadius: 4, borderBottomRightRadius: 4 }),
                        boxSizing: 'border-box',
                      } : {};
                      return (
                        <div key={dayIdx} className={cls} style={style}>
                          {block?.isFirst && <span className="bk-tt-block-label">{block.title}</span>}
                        </div>
                      );
                    })}
                  </Fragment>
                ))}
              </div>
            </div>
          );
        })()
      )}

      {/* 완료 화면 */}
      {step === 'done' && doneBooking && (
        <div className="bk-done">
          <span className="bk-done-icon">✅</span>
          <h2 className="bk-done-title">예약 신청 완료!</h2>
          <p className="bk-done-sub">호스트가 확정하면 카카오톡으로 알림을 드릴게요</p>
          <div className="bk-done-summary">
            <div>📌 {page.title}</div>
            <div>👤 {doneBooking.guest_name}</div>
            <div>📅 {fmtDate(new Date(doneBooking.booked_at))}</div>
            <div>🕐 {fmtTime(new Date(doneBooking.booked_at))}</div>
          </div>
        </div>
      )}

      {step !== 'done' && !showTimetableView && (
        <>
          <p className="bk-step-heading">
            {!selectedDate
              ? '📅 날짜를 선택해주세요'
              : !selectedSlot
                ? '🕐 시간을 선택해주세요'
                : '✏️ 예약 정보를 입력해주세요'}
          </p>

          {/* 달력 + 슬롯 (2단 고정 레이아웃) */}
          <div className="bk-grid">
            <div className="bk-cal-card">
              <Calendar
                onChange={handleDateChange}
                value={selectedDate}
                minDate={new Date()}
                locale="ko-KR"
                calendarType="iso8601"
                formatDay={(locale, date) => date.getDate().toString()}
                tileClassName={({ date, view }) => {
                  if (view !== 'month') return null;
                  const classes = [];
                  if (isAvailableDate(date)) classes.push('mk-cal-available');
                  const dow = date.getDay();
                  if (dow === 6) classes.push('cal-saturday');
                  if (dow === 0) classes.push('cal-sunday');
                  return classes.length ? classes.join(' ') : null;
                }}
                tileDisabled={({ date, view }) => {
                  if (view !== 'month') return false;
                  return !isAvailableDate(date);
                }}
              />
            </div>

            <div className="bk-slots-card">
              {!selectedDate ? (
                <div className="bk-slots-placeholder">
                  <span>📅</span>
                  <p>날짜를 선택해주세요</p>
                </div>
              ) : (
                <div key={selectedDate.toDateString()} className="bk-animate-in">
                  <p className="bk-slots-heading">{fmtDate(selectedDate)}</p>
                  <p className="bk-slots-hint">⏱ {duration}분 미팅</p>
                  {timeSlots.length === 0 ? (
                    <div className="bk-no-slots">이 날은 가능한 시간이 없어요</div>
                  ) : (
                    <div className="bk-time-grid">
                      {timeSlots.map((slot, i) => (
                        <button
                          key={i}
                          className={`bk-time-btn${slot.isBooked ? ' booked' : ''}${selectedSlot?.time === slot.time ? ' selected' : ''}`}
                          onClick={() => handleSlotSelect(slot)}
                          disabled={slot.isBooked}
                        >
                          {slot.time}
                          {slot.isBooked && <span className="bk-time-btn-label">예약됨</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 예약 폼 — 슬롯 선택 시 슬라이드 인 */}
          {step === 'form' && selectedSlot && (
            <div key={selectedSlot.datetime.getTime()} className="bk-form-card bk-animate-in">
              <h3 className="bk-form-title">예약 신청하기</h3>
              <div className="bk-summary-box">
                <div><strong>📌 {page.title}</strong></div>
                <div>📅 {fmtDate(selectedDate)} {selectedSlot.time}</div>
                <div>⏱ {duration}분 &nbsp;·&nbsp; 👤 {page.host_nickname}님</div>
              </div>
              <div className="bk-form-fields">
                <div className="mk-field">
                  <label>이름 <span className="mk-req">*</span></label>
                  <input
                    className="mk-input"
                    value={form.guest_name}
                    onChange={e => setForm(f => ({ ...f, guest_name: e.target.value }))}
                    placeholder="홍길동"
                    maxLength={30}
                  />
                </div>
                <div className="mk-field">
                  <label>연락처 (선택)</label>
                  <input
                    className="mk-input"
                    value={form.guest_kakao}
                    onChange={e => setForm(f => ({ ...f, guest_kakao: e.target.value }))}
                    placeholder="카카오 로그인 시 자동 입력"
                  />
                </div>
                <div className="mk-field">
                  <label>메모 (선택)</label>
                  <textarea
                    className="mk-textarea"
                    value={form.memo}
                    onChange={e => setForm(f => ({ ...f, memo: e.target.value }))}
                    placeholder="전달할 내용이 있으면 남겨주세요"
                    rows={2}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="mk-btn-secondary" onClick={() => { setStep('calendar'); setSelectedSlot(null); }}>
                  ← 다시 선택
                </button>
                <button className="mk-btn-primary" onClick={handleSubmit} disabled={submitting} style={{ flex: 1 }}>
                  {submitting ? '신청 중...' : '예약 신청하기'}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
