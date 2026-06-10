import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { format, addMinutes, differenceInDays, isBefore, isAfter, parse } from 'date-fns';
import { ko } from 'date-fns/locale';
import dayjs from 'dayjs';
import { message, Tooltip, Modal, DatePicker, TimePicker } from 'antd';
import ScheduleSelector from 'react-schedule-selector';
import {
  checkKakaoLoginStatus,
  getUserInfoFromLocalStorage,
  clearUserInfoFromLocalStorage,
  getBaseUrl,
} from './Components/authUtils';
import Socialkakao from './Components/Socialkakao';
import KakaoShareButton from './Components/KakaoShareButton';
import {
  initGoogleAPI,
  signInWithGoogle,
  signOutFromGoogle,
  isGoogleSignedIn,
  addEventToGoogleCalendar,
} from './googleAuth';
import GoogleCalendar from './GoogleCalendar';

import './App.css';
import './EventPage.css';

function groupConsecutiveDates(sortedDates) {
  if (!sortedDates || sortedDates.length === 0) return null;
  const groups = [[sortedDates[0]]];
  for (let i = 1; i < sortedDates.length; i++) {
    const diffMs = new Date(sortedDates[i]) - new Date(sortedDates[i - 1]);
    if (diffMs === 86400000) {
      groups[groups.length - 1].push(sortedDates[i]);
    } else {
      groups.push([sortedDates[i]]);
    }
  }
  return groups;
}

function EventPage() {
  const [eventData, setEventData] = useState(null);
  const [selectedTime, setSelectedTime] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [numDays, setNumDays] = useState(1);
  const [loading, setLoading] = useState(true);
  const [allSchedules, setAllSchedules] = useState([]);
  const [userSchedules, setUserSchedules] = useState({});
  const [userInfo, setUserInfo] = useState(null);
  const [userSelectedTimes, setUserSelectedTimes] = useState([]);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isGoogleLoggedIn, setIsGoogleLoggedIn] = useState(false);
  const [isGoogleModalVisible, setIsGoogleModalVisible] = useState(false);
  const [overlappingEvents, setOverlappingEvents] = useState([]);
  const [activeTab, setActiveTab] = useState('my');
  const [dateGroups, setDateGroups] = useState(null);

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
    initGoogleAPI();
    checkLoginStatus();
  }, []);

  const fetchEventData = async () => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const uuid = urlParams.get('key');

      const response = await axios.get(`/api/events/${uuid}`);
      console.log('[EventPage] fetchEventData full response:', JSON.stringify(response.data));
      setEventData(response.data);

      const selDates = response.data.selected_dates;
      if (Array.isArray(selDates) && selDates.length > 0) {
        const sorted = [...selDates].sort();
        setDateGroups(groupConsecutiveDates(sorted));
        setNumDays(sorted.length);
      } else {
        setDateGroups(null);
        const startD = new Date(response.data.startday);
        const endD = new Date(response.data.endday);
        const diffDays = (!isNaN(startD) && !isNaN(endD))
          ? differenceInDays(endD, startD) + 1
          : 1;
        setNumDays(Math.max(1, isNaN(diffDays) ? 1 : diffDays));
      }

      const schedulesResponse = await axios.get(`/api/schedules/${uuid}`);
      const schedules = Array.isArray(schedulesResponse.data) ? schedulesResponse.data : [];
      setAllSchedules(schedules);

      const userSchedulesMap = {};
      schedules.forEach(s => {
        if (!s.event_datetime) return;
        const time = format(new Date(s.event_datetime), 'yyyy-MM-dd HH:mm');
        if (!userSchedulesMap[time]) userSchedulesMap[time] = [];
        userSchedulesMap[time].push(s.nickname);
      });
      setUserSchedules(userSchedulesMap);

      if (userInfo) {
        const userSchedule = schedules.filter(
          s => s.kakaoId === userInfo.id.toString() && s.event_uuid === uuid
        );
        const userSelectedTime = userSchedule
          .filter(s => s.event_datetime)
          .map(s => new Date(s.event_datetime));
        setSchedule(userSelectedTime);
        setUserSelectedTimes(userSchedule
          .filter(s => s.event_datetime)
          .map(s => format(new Date(s.event_datetime), 'yyyy-MM-dd HH:mm')));

        const selectedTimeByDate = {};
        userSelectedTime.forEach(time => {
          const date = format(time, 'yyyy-MM-dd');
          if (!selectedTimeByDate[date]) selectedTimeByDate[date] = [];
          selectedTimeByDate[date].push(format(time, 'HH:mm'));
        });
        setSelectedTime(selectedTimeByDate);
      }
    } catch (error) {
      console.error('이벤트 데이터 조회 오류:', error);
      message.error('이벤트 데이터 조회 오류');
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchEventData(); }, [userInfo]);

  const handleConfirm = async () => {
    try {
      setConfirmLoading(true);
      await axios.delete('/api/schedules/save', {
        data: { kakaoId: userInfo.id.toString(), event_uuid: eventData.uuid },
      });

      for (const [date, times] of Object.entries(selectedTime)) {
        for (const time of times) {
          const datetime = parse(`${date} ${time}`, 'yyyy-MM-dd HH:mm', new Date()).toISOString();
          await axios.post('/api/schedules/save', {
            kakaoId: userInfo.id.toString(),
            nickname: userInfo?.kakao_account?.profile?.nickname || '익명',
            event_uuid: eventData.uuid,
            event_datetime: datetime,
          });
        }
      }
      await fetchEventData();
      message.success('일정이 즉시 적용되었습니다');
    } catch (error) {
      console.error('일정 저장 오류:', error);
      message.error('일정 저장 오류');
    } finally {
      setConfirmLoading(false);
    }
  };

  const handleScheduleChange = (newSchedule) => {
    setSchedule(newSchedule);
    const selectedTimeByDate = {};
    newSchedule.forEach(time => {
      const date = format(time, 'yyyy-MM-dd');
      if (!selectedTimeByDate[date]) selectedTimeByDate[date] = [];
      selectedTimeByDate[date].push(format(time, 'HH:mm'));
    });
    setSelectedTime(selectedTimeByDate);
  };

  const handleCopyLink = () => {
    const link = `${getBaseUrl()}/test/?key=${eventData.uuid}`;
    navigator.clipboard.writeText(link)
      .then(() => message.success('링크가 클립보드에 복사되었습니다!'))
      .catch(() => message.error('링크 복사에 실패했습니다.'));
  };

  const handleGoogleLoginClick = async () => {
    try {
      await signInWithGoogle();
      setIsGoogleLoggedIn(isGoogleSignedIn());
      message.success('구글 로그인 완료!');
    } catch (error) {
      console.error('구글 로그인 실패:', error);
      message.error('구글 로그인에 실패했습니다.');
    }
  };

  const handleGoogleLogoutClick = async () => {
    if (!isGoogleLoggedIn) { message.warning('먼저 구글 캘린더 연동을 완료해주세요!'); return; }
    try {
      await signOutFromGoogle();
      setIsGoogleLoggedIn(false);
      message.success('구글 로그아웃 완료!');
    } catch (error) {
      console.error('구글 로그아웃 실패:', error);
      message.error('구글 로그아웃에 실패했습니다.');
    }
  };

  const handleGoogleCalendarFetch = () => {
    if (!isGoogleLoggedIn) { message.warning('먼저 구글 캘린더 연동을 완료해주세요!'); return; }
    setIsGoogleModalVisible(true);
  };

  const handleExportToGoogleCalendar = async () => {
    if (!isGoogleLoggedIn) { message.warning('먼저 구글 캘린더 연동을 완료해주세요!'); return; }

    const continuousTimeRanges = [];
    userSelectedTimes.forEach(timeRange => {
      const startDt = parse(timeRange, 'yyyy-MM-dd HH:mm', new Date());
      const endDt = addMinutes(startDt, 30);
      if (continuousTimeRanges.length === 0) {
        continuousTimeRanges.push({ start: startDt, end: endDt });
      } else {
        const lastRange = continuousTimeRanges[continuousTimeRanges.length - 1];
        if (lastRange.end.getTime() === startDt.getTime()) {
          lastRange.end = endDt;
        } else {
          continuousTimeRanges.push({ start: startDt, end: endDt });
        }
      }
    });

    for (const range of continuousTimeRanges) {
      const event = {
        summary: eventData.eventname,
        start: { dateTime: range.start.toISOString(), timeZone: 'Asia/Seoul' },
        end: { dateTime: range.end.toISOString(), timeZone: 'Asia/Seoul' },
      };
      try {
        await addEventToGoogleCalendar(event);
        message.success('일정이 구글 캘린더에 등록되었습니다.');
      } catch (error) {
        console.error('구글 캘린더 등록 실패:', error);
        message.error('일정 등록 중 오류가 발생했습니다.');
      }
    }
  };

  const handleGoogleModalClose = () => setIsGoogleModalVisible(false);
  const showModal = () => setIsModalVisible(true);
  const handleOk = () => { setIsModalVisible(false); setIsGoogleModalVisible(false); };
  const handleCancel = () => { setIsModalVisible(false); setIsGoogleModalVisible(false); };

  const getRankedTimes = () => {
    if (allSchedules.length === 0) return [];
    const timeCounts = {};
    allSchedules.forEach(s => {
      if (!s.event_datetime) return;
      const timeDt = new Date(s.event_datetime);
      if (isNaN(timeDt.getTime())) return;
      const key = format(timeDt, 'yyyy-MM-dd HH:mm');
      timeCounts[key] = (timeCounts[key] || 0) + 1;
    });

    const uniqueCounts = [...new Set(Object.values(timeCounts))]
      .sort((a, b) => b - a)
      .slice(0, 3);

    return uniqueCounts.map((count, idx) => {
      const slots = Object.entries(timeCounts)
        .filter(([, c]) => c === count)
        .map(([time]) => {
          const startDt = parse(time, 'yyyy-MM-dd HH:mm', new Date());
          const endDt = addMinutes(startDt, 30);
          return { date: format(startDt, 'yyyy/MM/dd'), startDt, endDt };
        })
        .sort((a, b) => a.startDt - b.startDt)
        .reduce((acc, curr) => {
          if (acc.length === 0) {
            acc.push({ ...curr });
          } else {
            const last = acc[acc.length - 1];
            if (last.date === curr.date && last.endDt.getTime() === curr.startDt.getTime()) {
              last.endDt = curr.endDt;
            } else {
              acc.push({ ...curr });
            }
          }
          return acc;
        }, [])
        .map(s => ({
          date: s.date,
          start: format(s.startDt, "HH'시' mm'분'", { locale: ko }),
          end: format(s.endDt, "HH'시' mm'분'", { locale: ko }),
        }));

      return { rank: idx + 1, count, slots };
    });
  };

  if (loading) {
    return (
      <div className="ep-loading">
        <div className="ep-spinner" />
        <p>일정 정보를 불러오는 중...</p>
      </div>
    );
  }
  if (!userInfo) return <Socialkakao />;
  if (!eventData) return <div className="ep-error">이벤트 정보를 찾을 수 없습니다.</div>;

  const parseDateSafe = (str) => {
    if (!str) {
      console.warn('[EventPage] parseDateSafe: null/undefined 값, 현재 시간으로 대체:', str);
      return new Date();
    }
    const normalized = typeof str === 'string' ? str.replace(' ', 'T') : str;
    const d = new Date(normalized);
    if (isNaN(d.getTime())) {
      console.warn('[EventPage] parseDateSafe: 파싱 실패, 현재 시간으로 대체:', str);
      return new Date();
    }
    return d;
  };

  const Schedule_Start = parseDateSafe(eventData.startday);
  const Schedule_End = parseDateSafe(eventData.endday);
  const startTimeStr = format(Schedule_Start, 'HH:mm');
  const endTimeStr = format(Schedule_End, 'HH:mm');

  const colors = ['blue', 'red', 'green', 'purple', 'orange', 'pink'];
  const userColorMap = {};
  const allUsers = [...new Set(allSchedules.map(s => s.nickname))];
  allUsers.forEach((user, i) => { userColorMap[user] = colors[i % colors.length]; });

  const rankedTimes = getRankedTimes();

  const minTime = parseInt(startTimeStr.split(':')[0], 10);
  const maxTime = parseInt(endTimeStr.split(':')[0], 10);

  const makeGroupStart = (dateStr) => {
    const d = new Date(Schedule_Start);
    const [y, m, day] = dateStr.split('-').map(Number);
    d.setFullYear(y, m - 1, day);
    return d;
  };

  const renderTimeLabel = (time) => (
    <div className="time-label">{format(time, 'HH:mm')} - {format(addMinutes(time, 30), 'HH:mm')}</div>
  );

  const renderMyCell = (time, selected, innerRef) => {
    const timeEnd = addMinutes(time, 30);
    const overlapping = overlappingEvents.filter(ev => {
      const evStart = new Date(ev.start);
      const evEnd = new Date(ev.end);
      return isBefore(evStart, timeEnd) && isAfter(evEnd, time);
    });
    const bgColor = selected ? '#1890ff' : '#e6f7ff';
    const border = selected ? '1px solid blue' : '1px solid #ccc';
    return (
      <div
        ref={innerRef}
        style={{ position: 'relative', padding: '5px', border, height: '100%', backgroundColor: bgColor }}
        onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#b3e0ff'; }}
        onMouseLeave={e => { e.currentTarget.style.backgroundColor = selected ? '#1890ff' : '#e6f7ff'; }}
      >
        {overlapping.length > 0 && (
          <div style={{ position: 'absolute', top: '50%', right: '5px', transform: 'translateY(-50%)', fontSize: '12px', color: 'red', textAlign: 'right' }}>
            {overlapping.map(ev => ev.title).join(', ')}
          </div>
        )}
      </div>
    );
  };

  const renderAllCell = (time, _selected, innerRef) => {
    const formattedTime = format(time, 'yyyy-MM-dd HH:mm');
    const users = userSchedules[formattedTime] || [];
    const uniqueUsers = [...new Set(users)];
    const dots = uniqueUsers.map((user, i) => (
      <span key={i} style={{ display: 'inline-block', marginLeft: '2px', color: userColorMap[user], fontSize: '14px' }}>●</span>
    ));
    return (
      <Tooltip title={uniqueUsers.join(', ')} placement="top">
        <div
          ref={innerRef}
          style={{
            backgroundColor: `rgba(0, 128, 0, ${Math.min(0.1 + uniqueUsers.length * 0.1, 1)})`,
            border: '1px solid #ccc',
            height: '100%',
            width: '100%',
            position: 'relative',
            paddingRight: '5px',
          }}
        >
          <div style={{ position: 'absolute', right: '5px', top: '50%', transform: 'translateY(-50%)' }}>
            {dots}
          </div>
        </div>
      </Tooltip>
    );
  };

  const renderGroupLabel = (group) => (
    <div className="ep-date-group-label">
      {group.length === 1
        ? format(new Date(group[0]), 'M월 d일 (EEE)', { locale: ko })
        : `${format(new Date(group[0]), 'M/d')} ~ ${format(new Date(group[group.length - 1]), 'M/d')}`}
    </div>
  );

  return (
    <div className="App">
      <main className="main-content" style={{ background: 'var(--color-bg)', padding: 0 }}>

        {/* Hero */}
        <div className="ep-hero">
          <div className="ep-hero-top">
            <div>
              <h1 className="ep-event-name">{eventData.eventname}</h1>
              <div className="ep-hero-badges">
                <span className="ep-badge">UUID: {eventData.uuid}</span>
                <span className="ep-badge ep-badge-count">참여자 {allUsers.length}명</span>
              </div>
              <p className="ep-date-range">
                {dateGroups
                  ? <>총 {eventData.selected_dates.length}일 선택<span className="ep-time-range"> · {startTimeStr} ~ {endTimeStr}</span></>
                  : <>{format(Schedule_Start, 'yyyy.MM.dd')} ~ {format(Schedule_End, 'yyyy.MM.dd')}<span className="ep-time-range"> ({startTimeStr} ~ {endTimeStr})</span></>
                }
              </p>
            </div>
          </div>
          {dateGroups ? (
            <div className="ep-detail-row">
              <div className="ep-detail-item">
                <span className="ep-detail-label">가능 시간</span>
                <TimePicker value={dayjs(Schedule_Start)} format="HH:mm" disabled size="small" />
                <span style={{ color: '#aaa', fontSize: 13 }}>~</span>
                <TimePicker value={dayjs(Schedule_End)} format="HH:mm" disabled size="small" />
              </div>
              <div className="ep-date-chips">
                {eventData.selected_dates.sort().map(d => (
                  <span key={d} className="ep-date-chip">
                    {format(new Date(d), 'M/d (EEE)', { locale: ko })}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div className="ep-detail-row">
              <div className="ep-detail-item">
                <span className="ep-detail-label">시작</span>
                <DatePicker value={dayjs(Schedule_Start)} format="YYYY-MM-DD" disabled size="small" />
                <TimePicker value={dayjs(Schedule_Start)} format="HH:mm" disabled size="small" />
              </div>
              <div className="ep-detail-item">
                <span className="ep-detail-label">종료</span>
                <DatePicker value={dayjs(Schedule_End)} format="YYYY-MM-DD" disabled size="small" />
                <TimePicker value={dayjs(Schedule_End)} format="HH:mm" disabled size="small" />
              </div>
            </div>
          )}
        </div>

        {/* Toolbar */}
        <div className="ep-toolbar">
          <KakaoShareButton userInfo={userInfo} eventData={eventData} />
          <button className="ep-tool-btn btn-blue" onClick={handleCopyLink}>🔗 링크 복사</button>
          <button className={`ep-tool-btn btn-green${isGoogleLoggedIn ? ' connected' : ''}`} onClick={handleGoogleLoginClick}>
            {isGoogleLoggedIn ? '📆 구글 연동됨' : '📆 구글 캘린더 연동'}
          </button>
          <button className="ep-tool-btn btn-teal" onClick={handleGoogleCalendarFetch}>📆 일정 불러오기</button>
          <button className="ep-tool-btn btn-orange" onClick={handleExportToGoogleCalendar}>📆 내보내기</button>
          <button className="ep-tool-btn btn-red" onClick={handleGoogleLogoutClick}>📆 연동 해제</button>
        </div>

        {/* ── Desktop: 두 셀렉터 나란히 + 최적시간 아래 ── */}
        <div className="ep-schedule-desktop">
          <div className="ep-schedule-grid">
            {/* My schedule */}
            <div className="ep-panel">
              <div className="ep-panel-header">
                <h3 className="ep-panel-title">⌚ 내 일정 등록하기</h3>
                <button className="ep-btn-outline" onClick={showModal}>등록된 일정 확인</button>
              </div>
              <div className="schedule-selector-wrapper">
                {dateGroups ? (
                  dateGroups.map(group => (
                    <div key={group[0]} className="ep-date-group">
                      {renderGroupLabel(group)}
                      <ScheduleSelector
                        selection={schedule.filter(d => group.includes(format(d, 'yyyy-MM-dd')))}
                        numDays={group.length}
                        startDate={makeGroupStart(group[0])}
                        minTime={minTime}
                        maxTime={maxTime}
                        hourlyChunks={2}
                        rowGap="4px"
                        columnGap="7px"
                        onChange={(newSel) => {
                          const others = schedule.filter(d => !group.includes(format(d, 'yyyy-MM-dd')));
                          handleScheduleChange([...others, ...newSel]);
                        }}
                        renderTimeLabel={renderTimeLabel}
                        renderDateCell={renderMyCell}
                      />
                    </div>
                  ))
                ) : (
                  <ScheduleSelector
                    selection={schedule}
                    numDays={numDays}
                    startDate={Schedule_Start}
                    minTime={minTime}
                    maxTime={maxTime}
                    hourlyChunks={2}
                    rowGap="4px"
                    columnGap="7px"
                    onChange={handleScheduleChange}
                    renderTimeLabel={renderTimeLabel}
                    renderDateCell={renderMyCell}
                  />
                )}
              </div>
              <button className="ep-btn-confirm" onClick={handleConfirm} disabled={confirmLoading}>
                {confirmLoading ? '저장 중...' : '확인'}
              </button>
            </div>

            {/* All participants */}
            <div className="ep-panel">
              <div className="ep-panel-header">
                <h3 className="ep-panel-title">📅 전체 참가자 일정</h3>
              </div>
              {allUsers.length > 0 && (
                <div className="ep-legend">
                  {allUsers.map((user, i) => (
                    <span key={i} className="ep-legend-item">
                      <span style={{ color: userColorMap[user] }}>●</span> {user}
                    </span>
                  ))}
                </div>
              )}
              <div className="schedule-selector-wrapper">
                {dateGroups ? (
                  dateGroups.map(group => (
                    <div key={group[0]} className="ep-date-group">
                      {renderGroupLabel(group)}
                      <ScheduleSelector
                        selection={schedule.filter(d => group.includes(format(d, 'yyyy-MM-dd')))}
                        numDays={group.length}
                        startDate={makeGroupStart(group[0])}
                        minTime={minTime}
                        maxTime={maxTime}
                        hourlyChunks={2}
                        rowGap="4px"
                        columnGap="7px"
                        renderTimeLabel={renderTimeLabel}
                        renderDateCell={renderAllCell}
                      />
                    </div>
                  ))
                ) : (
                  <ScheduleSelector
                    selection={schedule}
                    numDays={numDays}
                    startDate={Schedule_Start}
                    minTime={minTime}
                    maxTime={maxTime}
                    hourlyChunks={2}
                    rowGap="4px"
                    columnGap="7px"
                    renderTimeLabel={renderTimeLabel}
                    renderDateCell={renderAllCell}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Optimal times — full width below */}
          <div className="ep-panel ep-best-panel">
            <div className="ep-panel-header">
              <h3 className="ep-panel-title">👍 최적 시간 추천</h3>
            </div>
            {rankedTimes.length > 0 ? (
              <div className="ep-rank-section">
                {rankedTimes.map(({ rank, count, slots }) => (
                  <div key={rank} className={`ep-rank-card${rank === 1 ? ' rank-first' : ''}`}>
                    <div className="ep-rank-header">
                      <span className="ep-rank-badge">{rank}위</span>
                      <span className="ep-rank-count">{count}명 가능</span>
                    </div>
                    <div className="ep-rank-times">
                      {slots.map((s, i) => (
                        <div key={i} className="ep-rank-time-item">
                          📅 {s.date} &nbsp; 🕒 {s.start} ~ {s.end}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="ep-rank-empty">등록된 일정이 없습니다.</p>
            )}
          </div>
        </div>

        {/* ── Mobile: 탭 전환 ── */}
        <div className="ep-schedule-mobile">
          <div className="ep-tabs">
            <button className={`ep-tab${activeTab === 'my' ? ' active' : ''}`} onClick={() => setActiveTab('my')}>내 일정 등록</button>
            <button className={`ep-tab${activeTab === 'all' ? ' active' : ''}`} onClick={() => setActiveTab('all')}>전체 현황</button>
            <button className={`ep-tab${activeTab === 'best' ? ' active' : ''}`} onClick={() => setActiveTab('best')}>최적 시간</button>
          </div>

          {activeTab === 'my' && (
            <div className="ep-panel">
              <div className="ep-panel-header">
                <h3 className="ep-panel-title">⌚ 내 일정 등록하기</h3>
                <button className="ep-btn-outline" onClick={showModal}>확인</button>
              </div>
              <div className="schedule-selector-wrapper">
                {dateGroups ? (
                  dateGroups.map(group => (
                    <div key={group[0]} className="ep-date-group">
                      {renderGroupLabel(group)}
                      <ScheduleSelector
                        selection={schedule.filter(d => group.includes(format(d, 'yyyy-MM-dd')))}
                        numDays={group.length}
                        startDate={makeGroupStart(group[0])}
                        minTime={minTime}
                        maxTime={maxTime}
                        hourlyChunks={2}
                        rowGap="4px"
                        columnGap="7px"
                        onChange={(newSel) => {
                          const others = schedule.filter(d => !group.includes(format(d, 'yyyy-MM-dd')));
                          handleScheduleChange([...others, ...newSel]);
                        }}
                        renderTimeLabel={renderTimeLabel}
                        renderDateCell={renderMyCell}
                      />
                    </div>
                  ))
                ) : (
                  <ScheduleSelector
                    selection={schedule}
                    numDays={numDays}
                    startDate={Schedule_Start}
                    minTime={minTime}
                    maxTime={maxTime}
                    hourlyChunks={2}
                    rowGap="4px"
                    columnGap="7px"
                    onChange={handleScheduleChange}
                    renderTimeLabel={renderTimeLabel}
                    renderDateCell={renderMyCell}
                  />
                )}
              </div>
              <button className="ep-btn-confirm" onClick={handleConfirm} disabled={confirmLoading}>
                {confirmLoading ? '저장 중...' : '확인'}
              </button>
            </div>
          )}

          {activeTab === 'all' && (
            <div className="ep-panel">
              <div className="ep-panel-header">
                <h3 className="ep-panel-title">📅 전체 참가자 일정</h3>
              </div>
              {allUsers.length > 0 && (
                <div className="ep-legend">
                  {allUsers.map((user, i) => (
                    <span key={i} className="ep-legend-item">
                      <span style={{ color: userColorMap[user] }}>●</span> {user}
                    </span>
                  ))}
                </div>
              )}
              <div className="schedule-selector-wrapper">
                {dateGroups ? (
                  dateGroups.map(group => (
                    <div key={group[0]} className="ep-date-group">
                      {renderGroupLabel(group)}
                      <ScheduleSelector
                        selection={schedule.filter(d => group.includes(format(d, 'yyyy-MM-dd')))}
                        numDays={group.length}
                        startDate={makeGroupStart(group[0])}
                        minTime={minTime}
                        maxTime={maxTime}
                        hourlyChunks={2}
                        rowGap="4px"
                        columnGap="7px"
                        renderTimeLabel={renderTimeLabel}
                        renderDateCell={renderAllCell}
                      />
                    </div>
                  ))
                ) : (
                  <ScheduleSelector
                    selection={schedule}
                    numDays={numDays}
                    startDate={Schedule_Start}
                    minTime={minTime}
                    maxTime={maxTime}
                    hourlyChunks={2}
                    rowGap="4px"
                    columnGap="7px"
                    renderTimeLabel={renderTimeLabel}
                    renderDateCell={renderAllCell}
                  />
                )}
              </div>
            </div>
          )}

          {activeTab === 'best' && (
            <div className="ep-panel">
              <div className="ep-panel-header">
                <h3 className="ep-panel-title">👍 최적 시간 추천</h3>
              </div>
              {rankedTimes.length > 0 ? (
                <div className="ep-rank-section">
                  {rankedTimes.map(({ rank, count, slots }) => (
                    <div key={rank} className={`ep-rank-card${rank === 1 ? ' rank-first' : ''}`}>
                      <div className="ep-rank-header">
                        <span className="ep-rank-badge">{rank}위</span>
                        <span className="ep-rank-count">{count}명 가능</span>
                      </div>
                      <div className="ep-rank-times">
                        {slots.map((s, i) => (
                          <div key={i} className="ep-rank-time-item">
                            📅 {s.date} &nbsp; 🕒 {s.start} ~ {s.end}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="ep-rank-empty">등록된 일정이 없습니다.</p>
              )}
            </div>
          )}
        </div>

        {/* My schedule modal */}
        <Modal
          title="내가 등록한 일정 확인하기"
          open={isModalVisible}
          onOk={handleOk}
          onCancel={handleCancel}
          okText="확인"
          cancelText="취소"
        >
          {(() => {
            const mergedTimes = [];
            userSelectedTimes.forEach(timeRange => {
              const startDt = parse(timeRange, 'yyyy-MM-dd HH:mm', new Date());
              const endDt = addMinutes(startDt, 30);
              if (mergedTimes.length === 0) {
                mergedTimes.push({ start: startDt, end: endDt });
              } else {
                const last = mergedTimes[mergedTimes.length - 1];
                if (last.end.getTime() === startDt.getTime()) {
                  last.end = endDt;
                } else {
                  mergedTimes.push({ start: startDt, end: endDt });
                }
              }
            });

            const sortedRanges = mergedTimes.sort((a, b) => a.start - b.start);
            const groupedRanges = sortedRanges.reduce((acc, range) => {
              const dateKey = format(range.start, 'yyyy/MM/dd');
              if (!acc[dateKey]) acc[dateKey] = [];
              acc[dateKey].push(range);
              return acc;
            }, {});

            return Object.entries(groupedRanges).map(([date, ranges]) => (
              <div key={date}>
                <div>📅 {date}</div>
                {ranges.map((range, i) => (
                  <div key={i} style={{ marginLeft: '20px' }}>
                    🕒 {format(range.start, "HH'시' mm'분'", { locale: ko })} 부터 {format(range.end, "HH'시' mm'분'", { locale: ko })}까지
                  </div>
                ))}
              </div>
            ));
          })()}
        </Modal>

        {/* Google Calendar modal */}
        <Modal
          title="구글 캘린더 일정"
          open={isGoogleModalVisible}
          onCancel={handleGoogleModalClose}
          footer={null}
        >
          <GoogleCalendar
            scheduleStart={Schedule_Start}
            scheduleEnd={Schedule_End}
            setOverlappingEvents={setOverlappingEvents}
          />
        </Modal>

      </main>
    </div>
  );
}

export default EventPage;
