import React, { useEffect, useState, useCallback } from 'react';
import DatePicker, { registerLocale } from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { ConfigProvider, Select, message } from 'antd';
import { TIMEZONE_OPTIONS } from './Components/timezones';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import koKR from 'antd/lib/locale/ko_KR';
import 'dayjs/locale/ko';
import dayjs from 'dayjs';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  checkKakaoLoginStatus,
  getUserInfoFromLocalStorage,
  getBaseUrl,
  redirectToLogin,
} from './Components/authUtils';
import SharePopup from './Components/SharePopup';
import './CreateEvent.css';

dayjs.locale('ko');
registerLocale('ko', ko);

// 월요일 시작 요일 헤더 (MonthCalendar + WeekdayPicker 공통)
const MC_DAYS = ['월', '화', '수', '목', '금', '토', '일'];

// WeekdayPicker 버튼 순서 (월요일부터)
const WD_DAYS = [
  { label: '월', key: 'mon', dow: 1 },
  { label: '화', key: 'tue', dow: 2 },
  { label: '수', key: 'wed', dow: 3 },
  { label: '목', key: 'thu', dow: 4 },
  { label: '금', key: 'fri', dow: 5 },
  { label: '토', key: 'sat', dow: 6 },
  { label: '일', key: 'sun', dow: 0 },
];
// getDay() index → weekday key
const DOW_KEY_MAP = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

/* ── 월 달력 (개별 날짜 선택) ── */
const MonthCalendar = ({ selected, onChange, baseMonth, onMonthChange }) => {
  const year  = baseMonth.year();
  const month = baseMonth.month();
  const rawFirst = new Date(year, month, 1).getDay(); // 0=Sun
  const firstDay = (rawFirst + 6) % 7; // 0=Mon
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = dayjs().startOf('day');

  const toggle = (dateStr) => {
    const next = new Set(selected);
    next.has(dateStr) ? next.delete(dateStr) : next.add(dateStr);
    onChange(next);
  };

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="mc-wrap">
      <div className="mc-nav">
        <button className="mc-nav-btn" onClick={() => onMonthChange(baseMonth.subtract(1, 'month'))}>‹</button>
        <span className="mc-nav-title">{baseMonth.format('YYYY년 M월')}</span>
        <button className="mc-nav-btn" onClick={() => onMonthChange(baseMonth.add(1, 'month'))}>›</button>
      </div>
      <div className="mc-grid-head">
        {MC_DAYS.map((l, i) => (
          <span key={l} className={`mc-dow${i === 5 ? ' mc-dow-sat' : i === 6 ? ' mc-dow-sun' : ''}`}>{l}</span>
        ))}
      </div>
      <div className="mc-grid">
        {cells.map((d, i) => {
          if (!d) return <span key={`e${i}`} />;
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          const isPast  = dayjs(dateStr).isBefore(today);
          const isSel   = selected.has(dateStr);
          const dow     = new Date(year, month, d).getDay(); // 0=Sun,6=Sat
          return (
            <button
              key={dateStr}
              className={`mc-day${isSel ? ' selected' : ''}${isPast ? ' past' : ''}${dow === 6 ? ' mc-sat' : dow === 0 ? ' mc-sun' : ''}`}
              onClick={() => !isPast && toggle(dateStr)}
              disabled={isPast}
            >
              {d}
            </button>
          );
        })}
      </div>
      <div className="mc-summary">
        {selected.size > 0 ? `${selected.size}일 선택됨` : '날짜를 클릭해 선택하세요'}
      </div>
    </div>
  );
};

/* ── 요일 선택 (특정 월의 특정 요일 전체 선택) ── */
const WeekdayPicker = ({ selectedWeekdays, onChange, month, onMonthChange }) => {
  const toggle = (key) => {
    const next = new Set(selectedWeekdays);
    next.has(key) ? next.delete(key) : next.add(key);
    onChange(next);
  };

  const previewDates = getWeekdayDates(month, selectedWeekdays);

  return (
    <div className="wd-wrap">
      <div className="wd-month-row">
        <span className="ce-label">기준 월</span>
        <input
          type="month"
          className="ce-input"
          style={{ width: 150 }}
          value={month.format('YYYY-MM')}
          min={dayjs().format('YYYY-MM')}
          onChange={e => e.target.value && onMonthChange(dayjs(e.target.value))}
        />
      </div>
      <div className="wd-days">
        {WD_DAYS.map(({ label, key }, idx) => (
          <button
            key={key}
            className={`wd-day-btn${selectedWeekdays.has(key) ? ' selected' : ''}${idx === 5 ? ' sat' : idx === 6 ? ' sun' : ''}`}
            onClick={() => toggle(key)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="wd-preview">
        {previewDates.length > 0
          ? previewDates.map(d => <span key={d} className="wd-chip">{dayjs(d).format('M/D(ddd)')}</span>)
          : <span className="wd-empty">요일을 선택하면 해당 월의 날짜가 표시됩니다</span>}
      </div>
    </div>
  );
};

function getWeekdayDates(month, weekdaySet) {
  if (!month || weekdaySet.size === 0) return [];
  const year = month.year();
  const m    = month.month();
  const days = new Date(year, m + 1, 0).getDate();
  const result = [];
  for (let d = 1; d <= days; d++) {
    const date   = new Date(year, m, d);
    const dayKey = DOW_KEY_MAP[date.getDay()];
    if (weekdaySet.has(dayKey)) {
      result.push(`${year}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    }
  }
  return result;
}

/* ── 시간 select 옵션 ── */
const TIME_OPTIONS = Array.from({ length: 24 }, (_, h) => ({
  value: `${String(h).padStart(2, '0')}:00`,
  label: `${h}시`,
}));

/* ── 메인 컴포넌트 ── */
const CreateEvent = () => {
  const [activeTab,        setActiveTab]        = useState('create');
  const [eventName,        setEventName]        = useState('');
  const [startTime,        setStartTime]        = useState(null);
  const [endTime,          setEndTime]          = useState(null);
  const [uuid,             setUuid]             = useState('');
  const [userInfo,         setUserInfo]         = useState(null);

  const [timezone,         setTimezone]         = useState('Asia/Seoul');
  const [isPrivate,        setIsPrivate]        = useState(false);
  const [dateMode,         setDateMode]         = useState('range');
  const [rangeStart,       setRangeStart]       = useState(null);
  const [rangeEnd,         setRangeEnd]         = useState(null);
  const [mobileRangeStart, setMobileRangeStart] = useState('');
  const [mobileRangeEnd,   setMobileRangeEnd]   = useState('');
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
  const [customDates,      setCustomDates]      = useState(new Set());
  const [calMonth,         setCalMonth]         = useState(dayjs());
  const [selectedWeekdays, setSelectedWeekdays] = useState(new Set());
  const [wdMonth,          setWdMonth]          = useState(dayjs());
  const [shareData,        setShareData]        = useState(null);

  useEffect(() => {
    const checkLoginStatus = async () => {
      const savedAccessToken = localStorage.getItem('kakaoAccessToken');
      if (savedAccessToken) {
        const status = await checkKakaoLoginStatus(savedAccessToken);
        if (status) {
          const storedUserInfo = getUserInfoFromLocalStorage();
          if (storedUserInfo) setUserInfo(storedUserInfo);
        } else {
          redirectToLogin(); return;
        }
      }
    };
    checkLoginStatus();
  }, []);

  const getDateList = useCallback(() => {
    if (dateMode === 'range') {
      if (!rangeStart || !rangeEnd) return [];
      const list = [];
      const cur  = new Date(rangeStart);
      cur.setHours(0, 0, 0, 0);
      const end  = new Date(rangeEnd);
      end.setHours(0, 0, 0, 0);
      while (cur <= end) {
        list.push(format(cur, 'yyyy-MM-dd'));
        cur.setDate(cur.getDate() + 1);
      }
      return list;
    }
    if (dateMode === 'custom') return [...customDates].sort();
    if (dateMode === 'weekday') return getWeekdayDates(wdMonth, selectedWeekdays);
    return [];
  }, [dateMode, rangeStart, rangeEnd, customDates, wdMonth, selectedWeekdays]);

  const isDateReady = () => getDateList().length > 0;

  const handleConfirm = () => {
    if (!uuid) { message.warning('UUID를 입력해주세요!'); return; }
    if (!userInfo) { redirectToLogin(); return; }
    axios.get(`/api/events/${uuid}`)
      .then(res => {
        if (res.data) window.location.href = `${getBaseUrl()}/meet/?key=${uuid}`;
        else message.warning('해당 UUID에 맞는 모임이 없습니다!');
      })
      .catch(() => message.warning('해당 UUID에 맞는 모임이 없습니다!'));
  };

  const handleCreateEvent = () => {
    const dateList = getDateList();
    if (dateList.length === 0) { message.warning('날짜를 선택해주세요'); return; }
    if (!startTime || !endTime)  { message.warning('시간을 선택해주세요'); return; }
    if (!eventName.trim())       { message.warning('모임 이름을 입력해주세요'); return; }
    if (!userInfo)               { redirectToLogin(); return; }

    const startDay    = dateList[0];
    const endDay      = dateList[dateList.length - 1];
    const eventUUID   = uuidv4().substring(0, 8);
    const kakaoId     = userInfo.id.toString();
    const nickname    = userInfo?.kakao_account?.profile?.nickname || userInfo?.properties?.nickname || '익명';
    const createDay   = format(new Date(), 'yyyy-MM-dd HH:mm:ss');

    axios.post('/api/events', {
      uuid: eventUUID, eventName, startDay, endDay,
      startTime, endTime, kakaoId, nickname, createDay,
      selectedDates: dateList, timezone, is_private: isPrivate,
    })
      .then(() => {
        const dateRange = `${dateList[0]} ~ ${dateList[dateList.length - 1]}`;
        setShareData({
          url: `${getBaseUrl()}/meet/?key=${eventUUID}`,
          title: `${eventName}이(가) 만들어졌어요!`,
          subtitle: dateRange,
          goUrl: `${getBaseUrl()}/meet/?key=${eventUUID}`,
        });
      })
      .catch(err => { console.error('이벤트 생성 오류:', err); message.error('모임 생성에 실패했어요'); });
  };

  const dateList = getDateList();

  /* ── 날짜 선택 영역 렌더 ── */
  const renderDateContent = () => {
    if (dateMode === 'range') {
      if (isMobile) {
        return (
          <div className="ce-native-date-row">
            <div className="ce-native-date-item">
              <label className="ce-label-sm">시작 날짜</label>
              <input
                type="date"
                className="ce-input"
                min={dayjs().format('YYYY-MM-DD')}
                value={mobileRangeStart}
                onChange={e => {
                  const val = e.target.value;
                  setMobileRangeStart(val);
                  if (val && mobileRangeEnd && val <= mobileRangeEnd) {
                    setRangeStart(new Date(val));
                    setRangeEnd(new Date(mobileRangeEnd));
                  } else { setRangeStart(null); setRangeEnd(null); }
                }}
              />
            </div>
            <span className="ce-date-sep">~</span>
            <div className="ce-native-date-item">
              <label className="ce-label-sm">종료 날짜</label>
              <input
                type="date"
                className="ce-input"
                min={mobileRangeStart || dayjs().format('YYYY-MM-DD')}
                value={mobileRangeEnd}
                onChange={e => {
                  const val = e.target.value;
                  setMobileRangeEnd(val);
                  if (mobileRangeStart && val && mobileRangeStart <= val) {
                    setRangeStart(new Date(mobileRangeStart));
                    setRangeEnd(new Date(val));
                  } else { setRangeStart(null); setRangeEnd(null); }
                }}
              />
            </div>
          </div>
        );
      }
      return (
        <DatePicker
          selectsRange
          inline
          startDate={rangeStart}
          endDate={rangeEnd}
          onChange={([start, end]) => { setRangeStart(start); setRangeEnd(end); }}
          locale="ko"
          calendarStartDay={1}
          minDate={new Date()}
          dayClassName={date => {
            const d = date.getDay();
            if (d === 6) return 'rdp-sat';
            if (d === 0) return 'rdp-sun';
            return null;
          }}
        />
      );
    }
    if (dateMode === 'custom') {
      return (
        <MonthCalendar
          selected={customDates}
          onChange={setCustomDates}
          baseMonth={calMonth}
          onMonthChange={setCalMonth}
        />
      );
    }
    if (dateMode === 'weekday') {
      return (
        <WeekdayPicker
          selectedWeekdays={selectedWeekdays}
          onChange={setSelectedWeekdays}
          month={wdMonth}
          onMonthChange={setWdMonth}
        />
      );
    }
    return null;
  };

  return (
    <ConfigProvider locale={koKR}>
      {shareData && (
        <SharePopup
          isOpen
          onClose={() => { window.location.href = shareData.goUrl; }}
          title={shareData.title}
          subtitle={shareData.subtitle}
          shareUrl={shareData.url}
          navigateLabel="→ 모임 바로가기"
          onNavigate={() => { window.location.href = shareData.goUrl; }}
          userInfo={userInfo}
        />
      )}
      <div className="create-event">
        <div className="ce-tabs">
          <button className={`ce-tab${activeTab === 'create' ? ' active' : ''}`} onClick={() => setActiveTab('create')}>
            새 모임 만들기
          </button>
          <button className={`ce-tab${activeTab === 'join' ? ' active' : ''}`} onClick={() => setActiveTab('join')}>
            코드로 참여하기
          </button>
        </div>

        {activeTab === 'create' ? (
          <div className="ce-panel">
            {/* 모임 이름 */}
            <div className="ce-field">
              <label className="ce-label">모임 이름</label>
              <input
                className="ce-input"
                placeholder="일정 이름을 입력해주세요"
                value={eventName}
                onChange={e => setEventName(e.target.value)}
              />
            </div>

            {/* 2컬럼: 날짜 | 시간 */}
            <div className="ce-two-col">
              {/* ── 날짜 컬럼 ── */}
              <div className="ce-col-date">
                <div className="ce-field">
                  <label className="ce-label">날짜 선택 방식</label>
                  <div className="date-mode-tabs">
                    {[
                      { key: 'range',   label: '📅 연속 범위' },
                      { key: 'custom',  label: '🗓 개별 선택' },
                      { key: 'weekday', label: '📆 특정 요일' },
                    ].map(({ key, label }) => (
                      <button
                        key={key}
                        className={`date-mode-btn${dateMode === key ? ' active' : ''}`}
                        onClick={() => setDateMode(key)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="ce-field">
                  {renderDateContent()}
                </div>
                {dateList.length > 0 && (
                  <div className="ce-date-summary">
                    <span className="ce-date-count">총 {dateList.length}일 선택</span>
                    <span className="ce-date-range-text">{dateList[0]} ~ {dateList[dateList.length - 1]}</span>
                  </div>
                )}
              </div>

              {/* ── 시간/시간대 컬럼 ── */}
              <div className="ce-col-time">
                <div className="ce-field">
                  <label className="ce-label">시작 시간</label>
                  <select
                    className="ce-input"
                    value={startTime || ''}
                    onChange={e => setStartTime(e.target.value || null)}
                  >
                    <option value="">시작 시간 선택</option>
                    {TIME_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div className="ce-field">
                  <label className="ce-label">종료 시간</label>
                  <select
                    className="ce-input"
                    value={endTime || ''}
                    onChange={e => setEndTime(e.target.value || null)}
                  >
                    <option value="">종료 시간 선택</option>
                    {TIME_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div className="ce-field">
                  <label className="ce-label">시간대</label>
                  <Select
                    value={timezone}
                    onChange={setTimezone}
                    options={TIMEZONE_OPTIONS.map(t => ({ label: t.label, value: t.value }))}
                    style={{ width: '100%' }}
                    size="large"
                  />
                </div>
              </div>
            </div>

            {/* 비공개 모드 */}
            <div className="ce-field ce-private-row">
              <div className="ce-private-info">
                <span className="ce-private-label">🔒 비공개 모드</span>
                <span className="ce-private-desc">방장만 전체 일정 현황을 볼 수 있어요</span>
              </div>
              <button
                type="button"
                className={`ce-toggle${isPrivate ? ' on' : ''}`}
                onClick={() => setIsPrivate(v => !v)}
                aria-label="비공개 모드 토글"
              >
                <span className="ce-toggle-knob" />
              </button>
            </div>

            <button
              className="ce-btn-primary"
              onClick={handleCreateEvent}
              disabled={!isDateReady() || !startTime || !endTime || !eventName.trim()}
            >
              모임 만들기
            </button>
          </div>
        ) : (
          <div className="ce-panel">
            <div className="ce-field">
              <label className="ce-label">UUID 입력</label>
              <p className="ce-hint">모임 링크의 key= 뒤에 있는 코드를 입력하세요</p>
              <div className="ce-search-row">
                <input
                  className="ce-input"
                  placeholder="UUID를 입력해주세요"
                  value={uuid}
                  onChange={e => setUuid(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleConfirm()}
                />
                <button className="ce-btn-search" onClick={handleConfirm}>참여하기</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ConfigProvider>
  );
};

export default CreateEvent;
