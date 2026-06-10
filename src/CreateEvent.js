import React, { useEffect, useState, useCallback } from 'react';
import { ConfigProvider, DatePicker, TimePicker, Select, message } from 'antd';
import { TIMEZONE_OPTIONS } from './Components/timezones';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import koKR from 'antd/lib/locale/ko_KR';
import 'dayjs/locale/ko';
import dayjs from 'dayjs';
import { format } from 'date-fns';
import {
  checkKakaoLoginStatus,
  getUserInfoFromLocalStorage,
  clearUserInfoFromLocalStorage,
  getBaseUrl,
} from './Components/authUtils';
import './CreateEvent.css';

dayjs.locale('ko');

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
const WEEKDAY_KEYS   = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

/* ── 월 달력 (멀티 날짜 선택) ── */
const MonthCalendar = ({ selected, onChange, baseMonth, onMonthChange }) => {
  const year  = baseMonth.year();
  const month = baseMonth.month(); // 0-indexed
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
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
        {WEEKDAY_LABELS.map(l => <span key={l} className="mc-dow">{l}</span>)}
      </div>
      <div className="mc-grid">
        {cells.map((d, i) => {
          if (!d) return <span key={`e${i}`} />;
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          const isPast  = dayjs(dateStr).isBefore(today);
          const isSel   = selected.has(dateStr);
          return (
            <button
              key={dateStr}
              className={`mc-day${isSel ? ' selected' : ''}${isPast ? ' past' : ''}`}
              onClick={() => !isPast && toggle(dateStr)}
              disabled={isPast}
            >
              {d}
            </button>
          );
        })}
      </div>
      <div className="mc-summary">
        {selected.size > 0
          ? `${selected.size}일 선택됨`
          : '날짜를 클릭해 선택하세요'}
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
        <DatePicker
          picker="month"
          value={month}
          onChange={v => v && onMonthChange(v)}
          format="YYYY년 MM월"
          size="middle"
          style={{ width: 150 }}
          disabledDate={c => c && c < dayjs().startOf('month')}
        />
      </div>
      <div className="wd-days">
        {WEEKDAY_KEYS.map((key, idx) => (
          <button
            key={key}
            className={`wd-day-btn${selectedWeekdays.has(key) ? ' selected' : ''}${idx === 0 ? ' sun' : idx === 6 ? ' sat' : ''}`}
            onClick={() => toggle(key)}
          >
            {WEEKDAY_LABELS[idx]}
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
    const date    = new Date(year, m, d);
    const dayKey  = WEEKDAY_KEYS[date.getDay()];
    if (weekdaySet.has(dayKey)) {
      result.push(`${year}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    }
  }
  return result;
}

/* ── 메인 컴포넌트 ── */
const CreateEvent = () => {
  const [activeTab,       setActiveTab]       = useState('create');
  const [eventName,       setEventName]       = useState('');
  const [startTime,       setStartTime]       = useState(null);
  const [endTime,         setEndTime]         = useState(null);
  const [uuid,            setUuid]            = useState('');
  const [userInfo,        setUserInfo]        = useState(null);

  // 날짜 선택 모드
  const [timezone,        setTimezone]        = useState('Asia/Seoul');
  const [dateMode,        setDateMode]        = useState('range');   // 'range' | 'custom' | 'weekday'
  const [rangeDates,      setRangeDates]      = useState([]);        // [dayjs, dayjs]
  const [mobileRangeStart, setMobileRangeStart] = useState('');
  const [mobileRangeEnd,   setMobileRangeEnd]   = useState('');
  const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;
  const [customDates,     setCustomDates]     = useState(new Set()); // Set<'YYYY-MM-DD'>
  const [calMonth,        setCalMonth]        = useState(dayjs());
  const [selectedWeekdays,setSelectedWeekdays]= useState(new Set());
  const [wdMonth,         setWdMonth]         = useState(dayjs());

  useEffect(() => {
    const checkLoginStatus = async () => {
      const savedAccessToken = localStorage.getItem('kakaoAccessToken');
      if (savedAccessToken) {
        const status = await checkKakaoLoginStatus(savedAccessToken);
        if (status) {
          const storedUserInfo = getUserInfoFromLocalStorage();
          if (storedUserInfo) setUserInfo(storedUserInfo);
        } else {
          clearUserInfoFromLocalStorage();
          setUserInfo(null);
        }
      }
    };
    checkLoginStatus();
  }, []);

  // 선택된 날짜 배열 계산
  const getDateList = useCallback(() => {
    if (dateMode === 'range') {
      if (rangeDates.length < 2) return [];
      const start = rangeDates[0];
      const end   = rangeDates[1];
      const list  = [];
      let cur = start.clone();
      while (!cur.isAfter(end)) {
        list.push(cur.format('YYYY-MM-DD'));
        cur = cur.add(1, 'day');
      }
      return list;
    }
    if (dateMode === 'custom') {
      return [...customDates].sort();
    }
    if (dateMode === 'weekday') {
      return getWeekdayDates(wdMonth, selectedWeekdays);
    }
    return [];
  }, [dateMode, rangeDates, customDates, wdMonth, selectedWeekdays]);

  const isDateReady = () => getDateList().length > 0;

  const handleConfirm = () => {
    if (!uuid) { message.warning('UUID를 입력해주세요!'); return; }
    if (!userInfo) { message.error('로그인이 필요합니다.'); return; }
    axios.get(`/api/events/${uuid}`)
      .then(res => {
        if (res.data) window.location.href = `${getBaseUrl()}/test/?key=${uuid}`;
        else message.warning('해당 UUID에 맞는 모임이 없습니다!');
      })
      .catch(() => message.warning('해당 UUID에 맞는 모임이 없습니다!'));
  };

  const handleCreateEvent = () => {
    const dateList = getDateList();
    if (dateList.length === 0) { message.warning('날짜를 선택해주세요'); return; }
    if (!startTime || !endTime)  { message.warning('시간을 선택해주세요'); return; }
    if (!eventName.trim())        { message.warning('모임 이름을 입력해주세요'); return; }
    if (!userInfo)                 { message.error('로그인이 필요합니다.'); return; }

    const startDay    = dateList[0];
    const endDay      = dateList[dateList.length - 1];
    const startTimeStr = startTime.format('HH:mm');
    const endTimeStr   = endTime.format('HH:mm');
    const eventUUID   = uuidv4().substring(0, 8);
    const kakaoId     = userInfo.id.toString();
    const nickname    = userInfo?.kakao_account?.profile?.nickname || userInfo?.properties?.nickname || '익명';
    const createDay   = format(new Date(), 'yyyy-MM-dd HH:mm:ss');

    axios.post('/api/events', {
      uuid: eventUUID,
      eventName,
      startDay,
      endDay,
      startTime: startTimeStr,
      endTime: endTimeStr,
      kakaoId,
      nickname,
      createDay,
      selectedDates: dateList,
      timezone,
    })
      .then(() => { window.location.href = `${getBaseUrl()}/test/?key=${eventUUID}`; })
      .catch(err => console.error('이벤트 생성 오류:', err));
  };

  const dateList = getDateList();

  return (
    <ConfigProvider locale={koKR}>
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

            {/* 날짜 선택 모드 토글 */}
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

            {/* 모드별 날짜 입력 */}
            {dateMode === 'range' && (
              isMobile ? (
                <div className="ce-field">
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
                            setRangeDates([dayjs(val), dayjs(mobileRangeEnd)]);
                          } else { setRangeDates([]); }
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
                            setRangeDates([dayjs(mobileRangeStart), dayjs(val)]);
                          } else { setRangeDates([]); }
                        }}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="ce-field">
                  <DatePicker.RangePicker
                    style={{ width: '100%' }}
                    format="YYYY년 MM월 DD일"
                    onChange={dates => setRangeDates(dates || [])}
                    placeholder={['시작 날짜', '종료 날짜']}
                    size="large"
                    disabledDate={current => current && current < dayjs().startOf('day')}
                  />
                </div>
              )
            )}

            {dateMode === 'custom' && (
              <div className="ce-field">
                <MonthCalendar
                  selected={customDates}
                  onChange={setCustomDates}
                  baseMonth={calMonth}
                  onMonthChange={setCalMonth}
                />
              </div>
            )}

            {dateMode === 'weekday' && (
              <div className="ce-field">
                <WeekdayPicker
                  selectedWeekdays={selectedWeekdays}
                  onChange={setSelectedWeekdays}
                  month={wdMonth}
                  onMonthChange={setWdMonth}
                />
              </div>
            )}

            {/* 선택된 날짜 요약 */}
            {dateList.length > 0 && (
              <div className="ce-date-summary">
                <span className="ce-date-count">총 {dateList.length}일 선택</span>
                <span className="ce-date-range-text">
                  {dateList[0]} ~ {dateList[dateList.length - 1]}
                </span>
              </div>
            )}

            {/* 시간 */}
            <div className="ce-field">
              <label className="ce-label">가능 시간 범위</label>
              {isMobile ? (
                <div className="ce-native-time-row">
                  <input
                    type="time"
                    step="3600"
                    className="ce-input ce-time-input"
                    value={startTime ? startTime.format('HH:mm') : ''}
                    onChange={e => setStartTime(e.target.value ? dayjs(e.target.value, 'HH:mm') : null)}
                  />
                  <span className="ce-date-sep">~</span>
                  <input
                    type="time"
                    step="3600"
                    className="ce-input ce-time-input"
                    value={endTime ? endTime.format('HH:mm') : ''}
                    onChange={e => setEndTime(e.target.value ? dayjs(e.target.value, 'HH:mm') : null)}
                  />
                </div>
              ) : (
                <TimePicker.RangePicker
                  style={{ width: '100%' }}
                  format="HH시 mm분"
                  onChange={times => {
                    if (times) { setStartTime(times[0]); setEndTime(times[1]); }
                    else { setStartTime(null); setEndTime(null); }
                  }}
                  placeholder={['시작 시간', '종료 시간']}
                  size="large"
                  minuteStep={60}
                />
              )}
            </div>

            {/* 시간대 */}
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
