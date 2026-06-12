import React, { useEffect, useState, useRef, useCallback } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import axios from 'axios';
import { format, addMinutes, differenceInDays, isBefore, isAfter, parse } from 'date-fns';
import { ko } from 'date-fns/locale';
import dayjs from 'dayjs';
import { message, Tooltip, Modal, DatePicker, TimePicker, Dropdown } from 'antd';
import { formatInTimeZone } from 'date-fns-tz';
import { TIMEZONE_OPTIONS } from './Components/timezones';
import ScheduleSelector from 'react-schedule-selector';
import {
  checkKakaoLoginStatus,
  getUserInfoFromLocalStorage,
  clearUserInfoFromLocalStorage,
  getBaseUrl,
} from './Components/authUtils';
import Socialkakao from './Components/Socialkakao';
import KakaoShareButton from './Components/KakaoShareButton';
import PlaceSection from './Components/PlaceSection';
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

function GroupsScroller({ children }) {
  const scrollRef = useRef(null);
  const scroll = (dir) => scrollRef.current?.scrollBy({ left: dir * 260, behavior: 'smooth' });
  return (
    <div className="groups-scroller">
      <button className="gs-btn" onClick={() => scroll(-1)}>‹</button>
      <div className="groups-scroller-inner">
        <div className="ep-groups-row" ref={scrollRef}>{children}</div>
      </div>
      <button className="gs-btn" onClick={() => scroll(1)}>›</button>
    </div>
  );
}

function CalendarView({ allSchedules, allUsers, userSchedules, Schedule_Start }) {
  const [calMonth, setCalMonth] = useState(() => new Date(Schedule_Start));
  const [selectedDate, setSelectedDate] = useState(null);

  const dateParticipants = {};
  allSchedules.forEach(s => {
    if (!s.event_datetime) return;
    const d = format(new Date(s.event_datetime), 'yyyy-MM-dd');
    if (!dateParticipants[d]) dateParticipants[d] = new Set();
    dateParticipants[d].add(s.nickname);
  });

  const year = calMonth.getFullYear();
  const month = calMonth.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const getColor = (dateStr) => {
    const count = dateParticipants[dateStr]?.size || 0;
    if (count === 0) return null;
    const total = allUsers.length;
    if (total === 0) return '#aaaaaa';
    const ratio = count / total;
    if (ratio >= 0.6) return '#52c41a';
    if (ratio >= 0.3) return '#faad14';
    return '#aaaaaa';
  };

  const getTimeSlots = (dateStr) =>
    Object.entries(userSchedules)
      .filter(([key]) => key.startsWith(dateStr))
      .map(([key, users]) => [key.split(' ')[1], users])
      .sort(([a], [b]) => a.localeCompare(b));

  const DOW_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

  return (
    <div className="cal-view">
      <div className="cal-nav">
        <button className="cal-nav-btn" onClick={() => setCalMonth(new Date(year, month - 1, 1))}>‹</button>
        <span className="cal-nav-title">{year}년 {month + 1}월</span>
        <button className="cal-nav-btn" onClick={() => setCalMonth(new Date(year, month + 1, 1))}>›</button>
      </div>
      <div className="cal-head">
        {DOW_LABELS.map(d => <span key={d} className="cal-head-dow">{d}</span>)}
      </div>
      <div className="cal-grid">
        {Array.from({ length: firstDow }, (_, i) => <div key={`b${i}`} />)}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const color = getColor(dateStr);
          const count = dateParticipants[dateStr]?.size || 0;
          const dow = new Date(year, month, day).getDay();
          const isSelected = selectedDate === dateStr;
          return (
            <div
              key={day}
              className={`cal-day${color ? ' cal-day-has' : ''}${isSelected ? ' cal-day-sel' : ''}`}
              onClick={() => color && setSelectedDate(isSelected ? null : dateStr)}
            >
              <span className={`cal-day-num${dow === 0 ? ' cal-sun' : dow === 6 ? ' cal-sat' : ''}`}>{day}</span>
              {count > 0 && <span className="cal-dot" style={{ background: color }} />}
            </div>
          );
        })}
      </div>
      <div className="cal-legend">
        <span><span className="cal-legend-dot" style={{ background: '#52c41a' }} />많음</span>
        <span><span className="cal-legend-dot" style={{ background: '#faad14' }} />보통</span>
        <span><span className="cal-legend-dot" style={{ background: '#aaaaaa' }} />적음</span>
      </div>
      {selectedDate && (() => {
        const slots = getTimeSlots(selectedDate);
        const dayCount = dateParticipants[selectedDate]?.size || 0;
        return (
          <div className="cal-detail">
            <div className="cal-detail-hd">
              {format(new Date(selectedDate), 'M월 d일 (EEE)', { locale: ko })}
              <span className="cal-detail-count">{dayCount}명 가능</span>
            </div>
            {slots.length > 0 ? slots.map(([time, users]) => {
              const ratio = allUsers.length > 0 ? users.length / allUsers.length : 0;
              return (
                <div key={time} className="cal-slot">
                  <span className="cal-slot-time">{time}</span>
                  <div className="cal-slot-bar-wrap">
                    <div className="cal-slot-bar" style={{ width: `${ratio * 100}%`, background: `rgba(22,163,74,${0.2 + ratio * 0.6})` }} />
                  </div>
                  <span className="cal-slot-count">{users.length}명</span>
                </div>
              );
            }) : <div className="cal-detail-empty">등록된 시간이 없습니다.</div>}
          </div>
        );
      })()}
    </div>
  );
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
  const [allView, setAllView] = useState('grid');
  const [isConfirmModalVisible, setIsConfirmModalVisible] = useState(false);
  const [confirmSelections, setConfirmSelections] = useState(new Set());
  const [timetableBlocks, setTimetableBlocks] = useState(new Set());
  const [timetableLoaded, setTimetableLoaded] = useState(false);
  // 기능1: 모임 확정
  const [confirmTimeModal,    setConfirmTimeModal]    = useState(false);
  const [confirmTimeTarget,   setConfirmTimeTarget]   = useState(null);
  const [confirmingEventTime, setConfirmingEventTime] = useState(false);
  // 기능2: 독촉
  const [registeredUsers, setRegisteredUsers] = useState([]);
  const [remindInput,     setRemindInput]     = useState('');
  const [reminding,       setReminding]       = useState(false);
  // 기능3: QR
  const [showQrModal, setShowQrModal] = useState(false);
  // FAB 팝업
  const [showRecommendPop, setShowRecommendPop] = useState(false);
  const [showRemindPop, setShowRemindPop] = useState(false);

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

      const kakaoIdParam = userInfo?.id ? `?kakaoId=${userInfo.id}` : '';
      const schedulesResponse = await axios.get(`/api/schedules/${uuid}${kakaoIdParam}`);
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
    const filtered = timetableBlocks.size > 0
      ? newSchedule.filter(d => !timetableBlocks.has(`${(d.getDay() + 6) % 7}-${d.getHours()}`))
      : newSchedule;
    setSchedule(filtered);
    const selectedTimeByDate = {};
    filtered.forEach(time => {
      const date = format(time, 'yyyy-MM-dd');
      if (!selectedTimeByDate[date]) selectedTimeByDate[date] = [];
      selectedTimeByDate[date].push(format(time, 'HH:mm'));
    });
    setSelectedTime(selectedTimeByDate);
  };

  const loadTimetable = async () => {
    if (!userInfo?.id) { message.warning('로그인 후 이용할 수 있어요'); return; }
    try {
      const res = await axios.get(`/api/timetable?kakaoId=${userInfo.id}`);
      const entries = res.data || [];
      const blocks = new Set();
      entries.forEach(entry => {
        const startH = parseInt(entry.start_time.split(':')[0]);
        const endH   = parseInt(entry.end_time.split(':')[0]);
        for (let h = startH; h < endH; h++) blocks.add(`${entry.day_of_week}-${h}`);
      });
      setTimetableBlocks(blocks);
      setTimetableLoaded(true);
      if (entries.length > 0) message.success(`시간표 ${entries.length}개 항목 적용됨`);
      else message.info('등록된 시간표가 없어요. 내 시간표에서 먼저 등록해 주세요.');
    } catch (err) {
      message.error('시간표를 불러오지 못했어요');
    }
  };

  const fetchRegistered = useCallback(async () => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const uuid = urlParams.get('key');
      const res = await axios.get(`/api/events/${uuid}?action=unregistered`);
      setRegisteredUsers(res.data || []);
    } catch (err) {
      console.error('[EventPage] fetchRegistered 오류:', err);
    }
  }, []);

  // 방장일 때 등록자 목록 로드
  useEffect(() => {
    if (!eventData?.uuid || !userInfo?.id) return;
    if (String(userInfo.id) === String(eventData.kakaoId)) fetchRegistered();
  }, [eventData?.uuid, userInfo?.id, fetchRegistered]); // eslint-disable-line

  const handleConfirmEvent = async () => {
    if (!confirmTimeTarget) return;
    setConfirmingEventTime(true);
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const uuid = urlParams.get('key');
      await axios.put(`/api/events/${uuid}?action=confirm`, {
        kakaoId: userInfo.id,
        confirmed_time: confirmTimeTarget.isoString,
      });
      await fetchEventData();
      setConfirmTimeModal(false);
      message.success('모임이 확정됐어요! 참여자들에게 알림을 보냈어요 🎉');
    } catch (err) {
      console.error(err);
      message.error('확정에 실패했어요');
    } finally {
      setConfirmingEventTime(false);
    }
  };

  const handleAddConfirmedToGoogle = async () => {
    if (!isGoogleLoggedIn) { message.warning('먼저 구글 캘린더 연동을 완료해주세요!'); return; }
    const start = new Date(eventData.confirmed_time);
    const end = addMinutes(start, 60);
    try {
      await addEventToGoogleCalendar({
        summary: eventData.eventname,
        start: { dateTime: start.toISOString(), timeZone: 'Asia/Seoul' },
        end: { dateTime: end.toISOString(), timeZone: 'Asia/Seoul' },
      });
      message.success('구글 캘린더에 추가됐어요!');
    } catch (err) {
      message.error('추가에 실패했어요');
    }
  };

  const handleRemind = async () => {
    const ids = remindInput.split(',').map(s => s.trim()).filter(Boolean);
    if (!ids.length) { message.warning('카카오 ID를 입력해주세요'); return; }
    setReminding(true);
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const uuid = urlParams.get('key');
      await axios.post(`/api/events/${uuid}?action=remind`, {
        kakaoId: userInfo.id,
        target_kakao_ids: ids,
      });
      message.success('독촉 메시지를 보냈어요!');
      setRemindInput('');
    } catch (err) {
      message.error('전송에 실패했어요');
    } finally {
      setReminding(false);
    }
  };

  const handleCopyLink = () => {
    const link = `${getBaseUrl()}/meet/?key=${eventData.uuid}`;
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
      const endDt = addMinutes(startDt, 60);
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

  const openConfirmModal = () => {
    const existing = new Set(eventData.confirmed_slots || []);
    setConfirmSelections(existing);
    setIsConfirmModalVisible(true);
  };

  const handleConfirmShare = () => {
    if (confirmedSlots.length === 0) return;
    const senderName = userInfo?.kakao_account?.profile?.nickname || userInfo?.properties?.nickname || '누군가';
    const shareUrl = `${getBaseUrl()}/meet/?key=${eventData.uuid}`;

    const parsed = confirmedSlots
      .map(s => parse(s, 'yyyy-MM-dd HH:mm', new Date()))
      .sort((a, b) => a - b);
    const merged = [];
    parsed.forEach(start => {
      const end = addMinutes(start, 60);
      if (merged.length > 0 && merged[merged.length - 1].end.getTime() === start.getTime()) {
        merged[merged.length - 1].end = end;
      } else {
        merged.push({ start, end });
      }
    });
    const timeText = merged
      .map(r => `${format(r.start, 'M월 d일 (EEE)', { locale: ko })} ${format(r.start, 'HH:mm')}~${format(r.end, 'HH:mm')}`)
      .join('\n');

    if (window.Kakao) {
      window.Kakao.Link.sendDefault({
        objectType: 'feed',
        content: {
          title: `📌 모임 확정 - ${eventData.eventname}`,
          description: `${senderName}님이 모임 시간을 확정했어요!\n\n${timeText}`,
          imageUrl: 'https://postfiles.pstatic.net/MjAyNDA2MjFfMTA4/MDAxNzE4OTU1MTA1MDg5.27seNkhpUz3k3bJv8rcsBYWXuvdMi-NYIGmm4MQfsCkg.4W9fU1m-u4DhuToJXqW5OTI-wySg-w_LByzoezu0szUg.PNG/logo2.png?type=w966',
          link: { mobileWebUrl: shareUrl, webUrl: shareUrl },
        },
        buttons: [{ title: '모임 확인하기', link: { mobileWebUrl: shareUrl, webUrl: shareUrl } }],
      });
    } else {
      message.warning('카카오톡 공유를 사용할 수 없습니다.');
    }
  };

  const handleConfirmSave = async () => {
    try {
      await axios.patch(`/api/events/${eventData.uuid}`, {
        kakaoId: userInfo.id,
        confirmed_slots: [...confirmSelections],
      });
      await fetchEventData();
      setIsConfirmModalVisible(false);
      message.success('모임 시간이 확정되었습니다!');
    } catch (err) {
      console.error(err);
      message.error('확정 저장 중 오류가 발생했습니다.');
    }
  };

  const showModal = () => setIsModalVisible(true);
  const handleOk = () => { setIsModalVisible(false); setIsGoogleModalVisible(false); };
  const handleCancel = () => { setIsModalVisible(false); setIsGoogleModalVisible(false); };


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
  const tz = eventData.timezone || 'Asia/Seoul';
  const startTimeStr = format(Schedule_Start, 'HH:mm');
  const endTimeStr = format(Schedule_End, 'HH:mm');
  const displayStartTime = formatInTimeZone(Schedule_Start, tz, 'HH:mm');
  const displayEndTime = formatInTimeZone(Schedule_End, tz, 'HH:mm');
  const tzOption = TIMEZONE_OPTIONS.find(t => t.value === tz);
  const tzShort = tzOption ? tzOption.short : tz;

  const isCreator = userInfo?.id?.toString() === eventData?.kakaoId;
  const confirmedSlots = eventData.confirmed_slots || [];
  const isEventConfirmed = eventData.status === 'confirmed';

  // 최적 시간 추천: 참여자 많은 순 상위 5개
  const topSlots = Object.entries(userSchedules)
    .filter(([, users]) => users.length > 0)
    .sort(([, a], [, b]) => b.length - a.length)
    .slice(0, 5);
  const confirmedSet = new Set(confirmedSlots);

  const colors = ['blue', 'red', 'green', 'purple', 'orange', 'pink'];
  const userColorMap = {};
  const allUsers = [...new Set(allSchedules.map(s => s.nickname))];
  allUsers.forEach((user, i) => { userColorMap[user] = colors[i % colors.length]; });

  const minTime = parseInt(startTimeStr.split(':')[0], 10);
  const maxTime = parseInt(endTimeStr.split(':')[0], 10);

  const makeGroupStart = (dateStr) => {
    const d = new Date(Schedule_Start);
    const [y, m, day] = dateStr.split('-').map(Number);
    d.setFullYear(y, m - 1, day);
    return d;
  };

  const renderTimeLabel = (time) => (
    <div className="tg-time-label">{format(time, 'HH:00')}</div>
  );

  const renderMyCell = (time, selected, innerRef) => {
    const timeEnd = addMinutes(time, 60);
    const overlapping = overlappingEvents.filter(ev => {
      const evStart = new Date(ev.start);
      const evEnd = new Date(ev.end);
      return isBefore(evStart, timeEnd) && isAfter(evEnd, time);
    });
    const isTTBlocked = timetableBlocks.has(`${(time.getDay() + 6) % 7}-${time.getHours()}`);
    return (
      <div ref={innerRef} className={`tg-cell${selected ? ' tg-cell-sel' : ''}${isTTBlocked ? ' tg-cell-blocked' : ''}`}>
        {overlapping.length > 0 && (
          <span className="tg-cell-event-dot" title={overlapping.map(ev => ev.title).join(', ')} />
        )}
      </div>
    );
  };

  const renderAllCell = (time, _selected, innerRef) => {
    const key = format(time, 'yyyy-MM-dd HH:mm');
    const uniqueUsers = [...new Set(userSchedules[key] || [])];
    const ratio = allUsers.length > 0 ? uniqueUsers.length / allUsers.length : 0;
    const alpha = uniqueUsers.length > 0 ? 0.12 + ratio * 0.65 : 0;
    const isConfirmed = confirmedSet.has(key);
    return (
      <Tooltip title={uniqueUsers.length > 0 ? uniqueUsers.join(', ') : ''} placement="top">
        <div
          ref={innerRef}
          className={`tg-cell tg-cell-all${isConfirmed ? ' tg-cell-confirmed' : ''}`}
          style={{ backgroundColor: isConfirmed ? undefined : `rgba(22, 163, 74, ${alpha})` }}
        >
          {isConfirmed && <span className="tg-cell-confirm-mark">✓</span>}
          {uniqueUsers.length > 0 && (
            <div className="tg-cell-dots">
              {uniqueUsers.slice(0, 5).map((user, i) => (
                <span key={i} style={{ color: userColorMap[user] }}>●</span>
              ))}
              {uniqueUsers.length > 5 && <span className="tg-cell-more">+{uniqueUsers.length - 5}</span>}
            </div>
          )}
        </div>
      </Tooltip>
    );
  };

  const renderDateLabel = (date) => {
    const dow = date.getDay();
    const dowColor = dow === 0 ? '#f5222d' : dow === 6 ? '#1677ff' : '#888';
    return (
      <div className="tg-date-label">
        <span className="tg-date-dow" style={{ color: dowColor }}>{format(date, 'EEE', { locale: ko })}</span>
        <span className="tg-date-num" style={{ color: dow === 0 ? '#f5222d' : dow === 6 ? '#1677ff' : '#222' }}>{format(date, 'd')}</span>
      </div>
    );
  };


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
                  ? <>총 {eventData.selected_dates.length}일 선택<span className="ep-time-range"> · {displayStartTime} ~ {displayEndTime}</span></>
                  : <>{format(Schedule_Start, 'yyyy.MM.dd')} ~ {format(Schedule_End, 'yyyy.MM.dd')}<span className="ep-time-range"> ({displayStartTime} ~ {displayEndTime})</span></>
                }
                <span className="ep-badge ep-badge-tz">🌏 {tzShort}</span>
              </p>
            </div>
          </div>
          {dateGroups ? (
            <div className="ep-detail-row">
              <div className="ep-detail-item">
                <span className="ep-detail-label">가능 시간</span>
                <TimePicker value={dayjs(displayStartTime, 'HH:mm')} format="HH:mm" disabled size="small" />
                <span style={{ color: '#aaa', fontSize: 13 }}>~</span>
                <TimePicker value={dayjs(displayEndTime, 'HH:mm')} format="HH:mm" disabled size="small" />
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
                <DatePicker value={dayjs(formatInTimeZone(Schedule_Start, tz, 'yyyy-MM-dd'))} format="YYYY-MM-DD" disabled size="small" />
                <TimePicker value={dayjs(displayStartTime, 'HH:mm')} format="HH:mm" disabled size="small" />
              </div>
              <div className="ep-detail-item">
                <span className="ep-detail-label">종료</span>
                <DatePicker value={dayjs(formatInTimeZone(Schedule_End, tz, 'yyyy-MM-dd'))} format="YYYY-MM-DD" disabled size="small" />
                <TimePicker value={dayjs(displayEndTime, 'HH:mm')} format="HH:mm" disabled size="small" />
              </div>
            </div>
          )}

          {/* Confirmed slots banner */}
          {confirmedSlots.length > 0 && (() => {
            const parsed = confirmedSlots
              .map(s => parse(s, 'yyyy-MM-dd HH:mm', new Date()))
              .sort((a, b) => a - b);
            const merged = [];
            parsed.forEach(start => {
              const end = addMinutes(start, 60);
              if (merged.length > 0 && merged[merged.length - 1].end.getTime() === start.getTime()) {
                merged[merged.length - 1].end = end;
              } else {
                merged.push({ start, end });
              }
            });
            return (
              <div className="ep-confirmed-banner">
                <div className="ep-confirmed-main">
                  <span className="ep-confirmed-label">✅ 확정된 시간</span>
                  <div className="ep-confirmed-slots">
                    {merged.map((r, i) => (
                      <span key={i} className="ep-confirmed-slot">
                        {format(r.start, 'M월 d일 (EEE)', { locale: ko })} &nbsp;
                        {format(r.start, 'HH:mm')} ~ {format(r.end, 'HH:mm')}
                      </span>
                    ))}
                  </div>
                </div>
                <button className="ep-confirmed-share-btn" onClick={handleConfirmShare}>
                  💬 카톡 공유
                </button>
              </div>
            );
          })()}

          {/* 확정된 모임 배너 */}
          {isEventConfirmed && eventData.confirmed_time && (
            <div className="ep-status-confirmed-banner">
              <div className="ep-status-confirmed-main">
                <span className="ep-status-confirmed-icon">✅</span>
                <div>
                  <strong className="ep-status-confirmed-label">확정된 모임</strong>
                  <span className="ep-status-confirmed-time">
                    {new Date(eventData.confirmed_time).toLocaleString('ko-KR', {
                      year: 'numeric', month: 'long', day: 'numeric',
                      weekday: 'short', hour: '2-digit', minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
              <button className="ep-status-gcal-btn" onClick={handleAddConfirmedToGoogle}>
                📆 구글 캘린더에 추가
              </button>
            </div>
          )}

          {/* Share actions */}
          <div className="ep-hero-actions">
            <KakaoShareButton userInfo={userInfo} eventData={eventData} />
            <button className="ep-tool-btn btn-blue" onClick={handleCopyLink}>🔗 링크 복사</button>
            <button className="ep-tool-btn" onClick={() => setShowQrModal(true)}>🔲 QR코드</button>
            {isCreator && (
              <button className={`ep-tool-btn btn-confirm${confirmedSlots.length > 0 ? ' confirmed' : ''}`} onClick={openConfirmModal}>
                📌 {confirmedSlots.length > 0 ? '확정 수정' : '모임 확정'}
              </button>
            )}
            <Dropdown
              menu={{
                items: [
                  !isGoogleLoggedIn && { key: 'connect', label: '🔗 캘린더 연동', onClick: handleGoogleLoginClick },
                  isGoogleLoggedIn && { key: 'fetch', label: '📥 일정 불러오기', onClick: handleGoogleCalendarFetch },
                  isGoogleLoggedIn && { key: 'export', label: '📤 캘린더에 내보내기', onClick: handleExportToGoogleCalendar },
                  isGoogleLoggedIn && { type: 'divider' },
                  isGoogleLoggedIn && { key: 'disconnect', label: '연동 해제', onClick: handleGoogleLogoutClick, danger: true },
                ].filter(Boolean),
              }}
              trigger={['click']}
            >
              <button className={`ep-tool-btn btn-green${isGoogleLoggedIn ? ' connected' : ''}`}>
                📆 구글 {isGoogleLoggedIn ? '연동됨' : '캘린더'} ▾
              </button>
            </Dropdown>
          </div>
        </div>

        {/* ── Desktop: 두 셀렉터 나란히 + 최적시간 아래 ── */}
        <div className="ep-schedule-desktop">
          <div className="ep-schedule-grid">
            {/* My schedule */}
            <div className="ep-panel">
              <div className="ep-panel-header">
                <h3 className="ep-panel-title">⌚ 내 일정 등록하기</h3>
                <div className="ep-panel-actions">
                  <button
                    className={`ep-btn-outline ep-btn-tt${timetableLoaded ? ' tt-loaded' : ''}`}
                    onClick={loadTimetable}
                    title="내 시간표 불러오기"
                  >
                    {timetableLoaded ? '📋 시간표 ✓' : '📋 시간표'}
                  </button>
                  <button className="ep-btn-outline" onClick={showModal}>등록된 일정 확인</button>
                  <button className="ep-btn-save" onClick={handleConfirm} disabled={confirmLoading}>
                    {confirmLoading ? '저장 중...' : '💾 저장'}
                  </button>
                </div>
              </div>
              <div className="schedule-selector-wrapper">
                {dateGroups ? (
                  <GroupsScroller>
                    {dateGroups.map(group => (
                      <div key={group[0]} className="ep-date-group" style={{ width: `${group.length * 82 + 62}px` }}>
                        <ScheduleSelector
                          selection={schedule.filter(d => group.includes(format(d, 'yyyy-MM-dd')))}
                          numDays={group.length}
                          startDate={makeGroupStart(group[0])}
                          minTime={minTime}
                          maxTime={maxTime}
                          hourlyChunks={1}
                          cellHeight={44}
                          rowGap="3px"
                          columnGap="6px"
                          onChange={(newSel) => {
                            const others = schedule.filter(d => !group.includes(format(d, 'yyyy-MM-dd')));
                            handleScheduleChange([...others, ...newSel]);
                          }}
                          renderTimeLabel={renderTimeLabel}
                          renderDateLabel={renderDateLabel}
                          renderDateCell={renderMyCell}
                        />
                      </div>
                    ))}
                  </GroupsScroller>
                ) : (
                  <ScheduleSelector
                    selection={schedule}
                    numDays={numDays}
                    startDate={Schedule_Start}
                    minTime={minTime}
                    maxTime={maxTime}
                    hourlyChunks={1}
                    cellHeight={44}
                    rowGap="3px"
                    columnGap="6px"
                    onChange={handleScheduleChange}
                    renderTimeLabel={renderTimeLabel}
                    renderDateLabel={renderDateLabel}
                    renderDateCell={renderMyCell}
                  />
                )}
              </div>
            </div>

            {/* All participants */}
            <div className="ep-panel">
              <div className="ep-panel-header">
                <h3 className="ep-panel-title">📅 전체 참가자 일정</h3>
                {eventData.is_private && !isCreator && (
                  <span className="ep-private-badge">🔒 비공개</span>
                )}
                <div className="ep-view-toggle">
                  <button className={`ep-vt-btn${allView === 'grid' ? ' active' : ''}`} onClick={() => setAllView('grid')}>시간대</button>
                  <button className={`ep-vt-btn${allView === 'cal' ? ' active' : ''}`} onClick={() => setAllView('cal')}>캘린더</button>
                </div>
              </div>
              {eventData.is_private && !isCreator ? (
                <div className="ep-private-notice">
                  🔒 이 모임은 비공개 모드예요. 방장만 전체 현황을 볼 수 있어요.
                </div>
              ) : allView === 'cal' ? (
                <CalendarView
                  allSchedules={allSchedules}
                  allUsers={allUsers}
                  userSchedules={userSchedules}
                  Schedule_Start={Schedule_Start}
                />
              ) : (
                <>
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
                      <GroupsScroller>
                        {dateGroups.map(group => (
                          <div key={group[0]} className="ep-date-group" style={{ width: `${group.length * 82 + 62}px` }}>
                            <ScheduleSelector
                              selection={schedule.filter(d => group.includes(format(d, 'yyyy-MM-dd')))}
                              numDays={group.length}
                              startDate={makeGroupStart(group[0])}
                              minTime={minTime}
                              maxTime={maxTime}
                              hourlyChunks={1}
                              cellHeight={44}
                              rowGap="3px"
                              columnGap="6px"
                              renderTimeLabel={renderTimeLabel}
                              renderDateLabel={renderDateLabel}
                              renderDateCell={renderAllCell}
                            />
                          </div>
                        ))}
                      </GroupsScroller>
                    ) : (
                      <ScheduleSelector
                        selection={schedule}
                        numDays={numDays}
                        startDate={Schedule_Start}
                        minTime={minTime}
                        maxTime={maxTime}
                        hourlyChunks={1}
                        cellHeight={44}
                        rowGap="3px"
                        columnGap="6px"
                        renderTimeLabel={renderTimeLabel}
                        renderDateLabel={renderDateLabel}
                        renderDateCell={renderAllCell}
                      />
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── Desktop: 장소 투표 (전체 너비) ── */}
        <div className="ep-schedule-desktop">
          <div className="ep-panel ep-panel-place">
            <div className="ep-panel-header">
              <h3 className="ep-panel-title">📍 장소 투표</h3>
            </div>
            <PlaceSection eventData={eventData} userInfo={userInfo} />
          </div>
        </div>

        {/* ── FAB 버튼 + 슬라이드업 팝업 (방장 전용) ── */}
        {isCreator && (
          <>
            {/* 독촉 FAB */}
            <button
              className="ep-fab ep-fab-remind"
              title="미등록자 독촉 알림"
              onClick={() => { setShowRemindPop(p => !p); setShowRecommendPop(false); }}
            >
              📢
            </button>

            {/* 최적 시간 FAB (확정 전, 슬롯 있을 때만) */}
            {!isEventConfirmed && topSlots.length > 0 && (
              <button
                className="ep-fab ep-fab-recommend"
                title="최적 시간 추천"
                onClick={() => { setShowRecommendPop(p => !p); setShowRemindPop(false); }}
              >
                🏆
              </button>
            )}

            {/* 독촉 팝업 */}
            {showRemindPop && (
              <div className="ep-fab-popup ep-fab-popup-remind">
                <div className="ep-fab-popup-header">
                  <span className="ep-fab-popup-title">📢 미등록자 독촉 알림</span>
                  <button className="ep-fab-popup-close" onClick={() => setShowRemindPop(false)}>✕</button>
                </div>
                {registeredUsers.length > 0 ? (
                  <div className="ep-registered-list">
                    <p className="ep-registered-label">일정 등록 완료:</p>
                    <div className="ep-registered-chips">
                      {registeredUsers.map((u, i) => (
                        <span key={i} className="ep-registered-chip">{u.nickname}</span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="ep-registered-empty">아직 일정을 등록한 참여자가 없어요.</p>
                )}
                <div className="ep-remind-input-row">
                  <input
                    className="ep-remind-input"
                    placeholder="카카오 ID (쉼표로 여러 명)"
                    value={remindInput}
                    onChange={e => setRemindInput(e.target.value)}
                  />
                  <button
                    className="ep-remind-btn"
                    onClick={handleRemind}
                    disabled={reminding}
                  >
                    {reminding ? '전송 중...' : '알림 보내기'}
                  </button>
                </div>
              </div>
            )}

            {/* 최적 시간 팝업 */}
            {showRecommendPop && !isEventConfirmed && topSlots.length > 0 && (
              <div className="ep-fab-popup ep-fab-popup-recommend">
                <div className="ep-fab-popup-header">
                  <span className="ep-fab-popup-title">🏆 최적 시간 추천</span>
                  <button className="ep-fab-popup-close" onClick={() => setShowRecommendPop(false)}>✕</button>
                </div>
                <p className="ep-fab-popup-sub">참여자 많은 순으로 정렬됐어요</p>
                <div className="ep-recommend-list">
                  {topSlots.map(([timeKey, users]) => {
                    const [datePart, timePart] = timeKey.split(' ');
                    const dateObj = new Date(`${datePart}T${timePart}:00`);
                    const endTime = format(addMinutes(dateObj, 60), 'HH:mm');
                    const label = `${format(dateObj, 'M월 d일 (EEE)', { locale: ko })} ${timePart} ~ ${endTime}`;
                    return (
                      <div key={timeKey} className="ep-recommend-item">
                        <div className="ep-recommend-info">
                          <span className="ep-recommend-time">{label}</span>
                          <span className="ep-recommend-count">{users.length}명 참여 가능</span>
                        </div>
                        <button
                          className="ep-confirm-time-btn"
                          onClick={() => {
                            setConfirmTimeTarget({ label, isoString: dateObj.toISOString(), users });
                            setConfirmTimeModal(true);
                            setShowRecommendPop(false);
                          }}
                        >
                          이 시간으로 확정
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Mobile: 탭 전환 ── */}
        <div className="ep-schedule-mobile">
          <div className="ep-tabs">
            <button className={`ep-tab${activeTab === 'my' ? ' active' : ''}`} onClick={() => setActiveTab('my')}>내 일정 등록</button>
            {(!eventData.is_private || isCreator) && (
              <button className={`ep-tab${activeTab === 'all' ? ' active' : ''}`} onClick={() => setActiveTab('all')}>전체 현황</button>
            )}
            <button className={`ep-tab${activeTab === 'cal' ? ' active' : ''}`} onClick={() => setActiveTab('cal')}>캘린더</button>
            <button className={`ep-tab${activeTab === 'place' ? ' active' : ''}`} onClick={() => setActiveTab('place')}>📍 장소</button>
          </div>

          {eventData.is_private && !isCreator && (
            <div className="ep-private-notice">
              🔒 이 모임은 비공개 모드예요. 방장만 전체 현황을 볼 수 있어요.
            </div>
          )}

          {activeTab === 'my' && (
            <div className="ep-panel">
              <div className="ep-panel-header">
                <h3 className="ep-panel-title">⌚ 내 일정 등록하기</h3>
                <div className="ep-panel-actions">
                  <button
                    className={`ep-btn-outline ep-btn-tt${timetableLoaded ? ' tt-loaded' : ''}`}
                    onClick={loadTimetable}
                    title="내 시간표 불러오기"
                  >
                    {timetableLoaded ? '📋 ✓' : '📋'}
                  </button>
                  <button className="ep-btn-outline" onClick={showModal}>내 일정 보기</button>
                  <button className="ep-btn-save" onClick={handleConfirm} disabled={confirmLoading}>
                    {confirmLoading ? '저장 중...' : '💾 저장'}
                  </button>
                </div>
              </div>
              <div className="schedule-selector-wrapper">
                {dateGroups ? (
                  <GroupsScroller>
                    {dateGroups.map(group => (
                      <div key={group[0]} className="ep-date-group" style={{ width: `${group.length * 82 + 62}px` }}>
                        <ScheduleSelector
                          selection={schedule.filter(d => group.includes(format(d, 'yyyy-MM-dd')))}
                          numDays={group.length}
                          startDate={makeGroupStart(group[0])}
                          minTime={minTime}
                          maxTime={maxTime}
                          hourlyChunks={1}
                          cellHeight={44}
                          rowGap="3px"
                          columnGap="6px"
                          onChange={(newSel) => {
                            const others = schedule.filter(d => !group.includes(format(d, 'yyyy-MM-dd')));
                            handleScheduleChange([...others, ...newSel]);
                          }}
                          renderTimeLabel={renderTimeLabel}
                          renderDateLabel={renderDateLabel}
                          renderDateCell={renderMyCell}
                        />
                      </div>
                    ))}
                  </GroupsScroller>
                ) : (
                  <ScheduleSelector
                    selection={schedule}
                    numDays={numDays}
                    startDate={Schedule_Start}
                    minTime={minTime}
                    maxTime={maxTime}
                    hourlyChunks={1}
                    cellHeight={44}
                    rowGap="3px"
                    columnGap="6px"
                    onChange={handleScheduleChange}
                    renderTimeLabel={renderTimeLabel}
                    renderDateLabel={renderDateLabel}
                    renderDateCell={renderMyCell}
                  />
                )}
              </div>
            </div>
          )}

          {activeTab === 'cal' && (
            <div className="ep-panel">
              <CalendarView
                allSchedules={allSchedules}
                allUsers={allUsers}
                userSchedules={userSchedules}
                Schedule_Start={Schedule_Start}
              />
            </div>
          )}

          {activeTab === 'place' && (
            <div className="ep-panel">
              <div className="ep-panel-header">
                <h3 className="ep-panel-title">📍 장소 투표</h3>
              </div>
              <PlaceSection eventData={eventData} userInfo={userInfo} />
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
                  <GroupsScroller>
                    {dateGroups.map(group => (
                      <div key={group[0]} className="ep-date-group" style={{ width: `${group.length * 82 + 62}px` }}>
                        <ScheduleSelector
                          selection={schedule.filter(d => group.includes(format(d, 'yyyy-MM-dd')))}
                          numDays={group.length}
                          startDate={makeGroupStart(group[0])}
                          minTime={minTime}
                          maxTime={maxTime}
                          hourlyChunks={1}
                          cellHeight={44}
                          rowGap="3px"
                          columnGap="6px"
                          renderTimeLabel={renderTimeLabel}
                          renderDateLabel={renderDateLabel}
                          renderDateCell={renderAllCell}
                        />
                      </div>
                    ))}
                  </GroupsScroller>
                ) : (
                  <ScheduleSelector
                    selection={schedule}
                    numDays={numDays}
                    startDate={Schedule_Start}
                    minTime={minTime}
                    maxTime={maxTime}
                    hourlyChunks={1}
                    cellHeight={44}
                    rowGap="3px"
                    columnGap="6px"
                    renderTimeLabel={renderTimeLabel}
                    renderDateLabel={renderDateLabel}
                    renderDateCell={renderAllCell}
                  />
                )}
              </div>
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
              const endDt = addMinutes(startDt, 60);
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

        {/* Confirm modal */}
        <Modal
          title="모임 시간 확정하기"
          open={isConfirmModalVisible}
          onOk={handleConfirmSave}
          onCancel={() => setIsConfirmModalVisible(false)}
          okText="확정하기"
          cancelText="취소"
          okButtonProps={{ style: { background: '#52c41a', borderColor: '#52c41a' } }}
        >
          {(() => {
            const slotsByDate = {};
            Object.entries(userSchedules)
              .sort(([, a], [, b]) => b.length - a.length)
              .forEach(([key, users]) => {
                const date = key.split(' ')[0];
                if (!slotsByDate[date]) slotsByDate[date] = [];
                slotsByDate[date].push({ key, users });
              });
            const sortedDates = Object.keys(slotsByDate).sort();

            if (sortedDates.length === 0) {
              return <div style={{ color: '#aaa', textAlign: 'center', padding: '20px 0' }}>아직 참가자 일정이 없습니다.</div>;
            }

            return (
              <div className="confirm-modal-body">
                <p className="confirm-modal-hint">참여 가능한 시간을 선택하세요. 여러 개 선택 가능합니다.</p>
                {sortedDates.map(date => (
                  <div key={date} className="confirm-date-group">
                    <div className="confirm-date-label">
                      {format(new Date(date), 'M월 d일 (EEE)', { locale: ko })}
                    </div>
                    {slotsByDate[date].sort((a, b) => b.users.length - a.users.length).map(({ key, users }) => {
                      const time = key.split(' ')[1];
                      const endTime = format(addMinutes(parse(time, 'HH:mm', new Date()), 60), 'HH:mm');
                      const ratio = allUsers.length > 0 ? users.length / allUsers.length : 0;
                      const checked = confirmSelections.has(key);
                      return (
                        <div
                          key={key}
                          className={`confirm-slot${checked ? ' selected' : ''}`}
                          onClick={() => {
                            const next = new Set(confirmSelections);
                            if (checked) next.delete(key); else next.add(key);
                            setConfirmSelections(next);
                          }}
                        >
                          <span className="confirm-slot-check">{checked ? '☑' : '☐'}</span>
                          <span className="confirm-slot-time">{time} ~ {endTime}</span>
                          <div className="confirm-slot-bar-wrap">
                            <div className="confirm-slot-bar" style={{ width: `${ratio * 100}%` }} />
                          </div>
                          <span className="confirm-slot-count">{users.length}/{allUsers.length}명</span>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            );
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

        {/* QR 코드 모달 */}
        <Modal
          title="모임 링크 QR코드"
          open={showQrModal}
          onCancel={() => setShowQrModal(false)}
          footer={null}
          centered
        >
          <div className="ep-qr-body">
            <QRCodeCanvas
              id="event-qr-canvas"
              value={`${getBaseUrl()}/meet/?key=${eventData.uuid}`}
              size={200}
              includeMargin
            />
            <p className="ep-qr-hint">QR코드를 스캔하면 모임 페이지로 바로 이동해요</p>
            <div className="ep-qr-actions">
              <button
                className="ep-tool-btn btn-blue"
                onClick={() => {
                  const canvas = document.getElementById('event-qr-canvas');
                  if (!canvas) return;
                  const url = canvas.toDataURL('image/png');
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${eventData.eventname || '모임'}_QR.png`;
                  a.click();
                }}
              >
                QR코드 저장
              </button>
              <button
                className="ep-tool-btn"
                onClick={() => {
                  navigator.clipboard.writeText(`${getBaseUrl()}/meet/?key=${eventData.uuid}`);
                  message.success('링크가 복사됐어요!');
                }}
              >
                🔗 링크 복사
              </button>
            </div>
          </div>
        </Modal>

        {/* 모임 확정 확인 모달 */}
        <Modal
          title="모임 시간 확정"
          open={confirmTimeModal}
          onOk={handleConfirmEvent}
          onCancel={() => setConfirmTimeModal(false)}
          okText="확정하기"
          cancelText="취소"
          confirmLoading={confirmingEventTime}
          okButtonProps={{ style: { background: '#52c41a', borderColor: '#52c41a' } }}
        >
          {confirmTimeTarget && (
            <div style={{ padding: '8px 0' }}>
              <p style={{ fontWeight: 600, fontSize: 16, marginBottom: 8 }}>{confirmTimeTarget.label}</p>
              <p style={{ color: '#555' }}>
                참여 가능 인원: <strong>{confirmTimeTarget.users?.length}명</strong>
              </p>
              <p style={{ color: '#888', fontSize: 13, marginTop: 12 }}>
                확정 시 참여자 전원에게 카카오 알림이 발송됩니다.
              </p>
            </div>
          )}
        </Modal>

      </main>
    </div>
  );
}

export default EventPage;
