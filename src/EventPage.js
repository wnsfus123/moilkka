import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { format, addMinutes, differenceInDays, isBefore, isAfter, parse } from 'date-fns';
import { ko } from 'date-fns/locale';
import dayjs from 'dayjs';
import { Button, Card, Typography, Row, Col, message, Tooltip, TimePicker, Input, DatePicker, Modal } from 'antd';
import { CalendarOutlined, ToolOutlined } from '@ant-design/icons';
import ScheduleSelector from 'react-schedule-selector';
import { checkKakaoLoginStatus, getUserInfoFromLocalStorage, clearUserInfoFromLocalStorage, getBaseUrl } from './Components/authUtils';
import Socialkakao from './Components/Socialkakao';
import KakaoShareButton from './Components/KakaoShareButton';
import { initGoogleAPI, signInWithGoogle, signOutFromGoogle, isGoogleSignedIn, addEventToGoogleCalendar } from './googleAuth';
import GoogleCalendar from './GoogleCalendar';

import './App.css';

const { Title, Text } = Typography;

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
  const [maxOverlapTimes, setMaxOverlapTimes] = useState([]);
  const [isGoogleLoggedIn, setIsGoogleLoggedIn] = useState(false);
  const [isGoogleModalVisible, setIsGoogleModalVisible] = useState(false);
  const [overlappingEvents, setOverlappingEvents] = useState([]);

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
      setEventData(response.data);

      const diffDays = differenceInDays(new Date(response.data.endday), new Date(response.data.startday)) + 1;
      setNumDays(diffDays);

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
        setMaxOverlapTimes(findMaxOverlappingTimes(schedules));
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
            nickname: userInfo.kakao_account.profile.nickname,
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

  const findMaxOverlappingTimes = (schedules) => {
    const timeCounts = {};
    schedules.forEach(s => {
      if (!s.event_datetime) return;
      const timeDt = new Date(s.event_datetime);
      if (isNaN(timeDt.getTime())) return;
      const endTimeDt = addMinutes(timeDt, 30);
      let m = timeDt;
      while (isBefore(m, endTimeDt)) {
        const key = format(m, 'yyyy-MM-dd HH:mm');
        timeCounts[key] = (timeCounts[key] || 0) + 1;
        m = addMinutes(m, 30);
      }
    });

    if (Object.keys(timeCounts).length === 0) return [];
    const maxCount = Math.max(...Object.values(timeCounts));
    return Object.entries(timeCounts)
      .filter(([, count]) => count === maxCount)
      .map(([time]) => {
        const startDt = parse(time, 'yyyy-MM-dd HH:mm', new Date());
        const endDt = addMinutes(startDt, 30);
        return {
          date: format(startDt, 'yyyy/MM/dd'),
          start: format(startDt, "HH'시' mm'분'", { locale: ko }),
          end: format(endDt, "HH'시' mm'분'", { locale: ko }),
        };
      });
  };

  if (loading) return <p>Loading...</p>;
  if (!userInfo) return <Socialkakao />;
  if (!eventData) return <p>No event data available</p>;

  const parseDateSafe = (str) => {
    if (!str) return new Date();
    const d = new Date(str);
    return isNaN(d.getTime()) ? new Date() : d;
  };
  const Schedule_Start = parseDateSafe(eventData.startday);
  const Schedule_End = parseDateSafe(eventData.endday);
  const startTimeStr = format(Schedule_Start, 'HH:mm');
  const endTimeStr = format(Schedule_End, 'HH:mm');

  const colors = ['blue', 'red', 'green', 'purple', 'orange', 'pink'];
  const userColorMap = {};
  const allUsers = [...new Set(allSchedules.map(s => s.nickname))];
  allUsers.forEach((user, i) => { userColorMap[user] = colors[i % colors.length]; });

  return (
    <div className="App">
      <main className="main-content">
        <Row gutter={[16, 16]}>
          <Col span={12}>
            <Card style={{ margin: '20px', padding: '0px' }}>
              <Title level={4}>
                <CalendarOutlined style={{ marginRight: '10px' }} />
                모임 세부 정보
              </Title>
              <Row gutter={[16, 16]}>
                <Col span={12}>
                  <Text strong>📅 모임 이름: </Text>
                  <Input value={eventData.eventname} readOnly style={{ width: '100%', backgroundColor: 'white' }} />
                </Col>
                <Col span={12}>
                  <Text strong>📅 모임 UUID: </Text>
                  <Input value={eventData.uuid} readOnly style={{ width: '100%', backgroundColor: 'white' }} />
                </Col>
              </Row>
              <Row gutter={[16, 16]}>
                <Col span={12}>
                  <Text strong>📅 시작 날짜: </Text>
                  <DatePicker value={dayjs(eventData.startday)} format="YYYY-MM-DD" disabled style={{ width: '100%', backgroundColor: 'white' }} />
                </Col>
                <Col span={12}>
                  <Text strong>📅 종료 날짜: </Text>
                  <DatePicker value={dayjs(eventData.endday)} format="YYYY-MM-DD" disabled style={{ width: '100%', backgroundColor: 'white' }} />
                </Col>
              </Row>
              <Row gutter={[16, 16]}>
                <Col span={12}>
                  <Text strong>🕒 시작 시간: </Text>
                  <TimePicker value={dayjs(eventData.startday)} format="HH:mm" disabled style={{ width: '100%', backgroundColor: 'white' }} />
                </Col>
                <Col span={12}>
                  <Text strong>🕒 종료 시간: </Text>
                  <TimePicker value={dayjs(eventData.endday)} format="HH:mm" disabled style={{ width: '100%', backgroundColor: 'white' }} />
                </Col>
              </Row>
            </Card>
          </Col>

          <Col span={12}>
            <Card style={{ margin: '20px', padding: '0px' }}>
              <Title level={4}>
                <ToolOutlined style={{ marginRight: '10px' }} />
                모임 관리
              </Title>
              <Row gutter={[16, 16]} style={{ marginTop: '20px' }}>
                <Col span={12}>
                  <KakaoShareButton userInfo={userInfo} eventData={eventData} />
                </Col>
                <Col span={12}>
                  <Button type="default" block onClick={handleCopyLink} style={{ marginBottom: '10px' }}>
                    🔗 모임 링크 복사
                  </Button>
                </Col>
              </Row>
              <Row gutter={[16, 16]} style={{ marginTop: '20px' }}>
                <Col span={12}>
                  <Button type="default" block style={{ marginBottom: '10px' }} onClick={handleGoogleLoginClick}>
                    {isGoogleLoggedIn ? '📆 구글 캘린더 연동완료' : '📆 구글 캘린더 연동하기'}
                  </Button>
                </Col>
                <Col span={12}>
                  <Button type="default" block style={{ marginBottom: '10px' }} onClick={handleGoogleCalendarFetch}>
                    📆 구글 일정 불러오기
                  </Button>
                  <Modal title="구글 캘린더 일정" open={isGoogleModalVisible} onCancel={handleGoogleModalClose} footer={null}>
                    <GoogleCalendar scheduleStart={Schedule_Start} scheduleEnd={Schedule_End} setOverlappingEvents={setOverlappingEvents} />
                  </Modal>
                </Col>
                <Col span={12}>
                  <Button type="default" block onClick={handleExportToGoogleCalendar}>
                    📆 구글 캘린더로 내보내기
                  </Button>
                </Col>
                <Col span={12}>
                  <Button type="default" block style={{ marginBottom: '10px' }} onClick={handleGoogleLogoutClick}>
                    📆 구글 캘린더 연동해제
                  </Button>
                </Col>
              </Row>
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]}>
          <Col span={12}>
            <Card style={{ margin: '20px', padding: '0px', overflowX: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Title level={4}>⌚ 내 일정 등록하기 !</Title>
                <Button type="primary" onClick={showModal} style={{ marginTop: '0' }}>
                  ⌚ 내가 등록한 일정 확인하기
                </Button>
              </div>

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

              <div className="schedule-selector-wrapper">
                <ScheduleSelector
                  selection={schedule}
                  numDays={numDays}
                  startDate={Schedule_Start}
                  minTime={parseInt(startTimeStr.split(':')[0], 10)}
                  maxTime={parseInt(endTimeStr.split(':')[0], 10)}
                  hourlyChunks={2}
                  rowGap="4px"
                  columnGap="7px"
                  onChange={handleScheduleChange}
                  renderTimeLabel={(time) => (
                    <div className="time-label">
                      {format(time, 'HH:mm')} - {format(addMinutes(time, 30), 'HH:mm')}
                    </div>
                  )}
                  renderDateCell={(time, selected, innerRef) => {
                    const timeEnd = addMinutes(time, 30);
                    const overlapping = overlappingEvents.filter(event => {
                      const eventStart = new Date(event.start);
                      const eventEnd = new Date(event.end);
                      return isBefore(eventStart, timeEnd) && isAfter(eventEnd, time);
                    });
                    const backgroundColor = selected ? '#1890ff' : '#e6f7ff';
                    const borderColor = selected ? '1px solid blue' : '1px solid #ccc';
                    return (
                      <div
                        ref={innerRef}
                        style={{ position: 'relative', padding: '5px', border: borderColor, height: '100%', backgroundColor }}
                        onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#b3e0ff'; }}
                        onMouseLeave={e => { e.currentTarget.style.backgroundColor = selected ? '#1890ff' : '#e6f7ff'; }}
                      >
                        {overlapping.length > 0 && (
                          <div style={{ position: 'absolute', top: '50%', right: '5px', transform: 'translateY(-50%)', fontSize: '12px', color: 'red', textAlign: 'right' }}>
                            {overlapping.map(e => e.title).join(', ')}
                          </div>
                        )}
                      </div>
                    );
                  }}
                />
              </div>
              <Button type="primary" onClick={handleConfirm} style={{ marginTop: '20px' }} loading={confirmLoading}>
                확인
              </Button>
            </Card>
          </Col>

          <Col span={12}>
            <Card style={{ margin: '20px', padding: '0px', overflowX: 'auto' }}>
              <Title level={4}>
                📅 모든 참가자들의 일정을 확인하세요 !
                <span style={{ marginLeft: '10px', fontSize: '14px' }}>
                  {allUsers.map((user, i) => (
                    <span key={i} style={{ marginLeft: '5px', color: userColorMap[user] }}>
                      ●( {userColorMap[user]} ) {user}
                    </span>
                  ))}
                </span>
              </Title>
              <div className="schedule-selector-wrapper">
                <ScheduleSelector
                  selection={schedule}
                  numDays={numDays}
                  startDate={Schedule_Start}
                  minTime={parseInt(startTimeStr.split(':')[0], 10)}
                  maxTime={parseInt(endTimeStr.split(':')[0], 10)}
                  hourlyChunks={2}
                  rowGap="4px"
                  columnGap="7px"
                  renderTimeLabel={(time) => (
                    <div className="time-label">
                      {format(time, 'HH:mm')} - {format(addMinutes(time, 30), 'HH:mm')}
                    </div>
                  )}
                  renderDateCell={(time, selected, innerRef) => {
                    const formattedTime = format(time, 'yyyy-MM-dd HH:mm');
                    const users = userSchedules[formattedTime] || [];
                    const uniqueUsers = [...new Set(users)];
                    const dots = uniqueUsers.map((user, i) => (
                      <span key={i} style={{ display: 'inline-block', marginLeft: '2px', color: userColorMap[user], fontSize: '14px' }}>
                        ●
                      </span>
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
                  }}
                />
              </div>
            </Card>
          </Col>
        </Row>

        <Card style={{ margin: '20px', padding: '0px' }}>
          <Title level={4}>👍 모임 시간으로 적절한 시간을 추천 해드릴께요 !</Title>
          <Text>🤖 가장 일정이 많이 겹친 시간</Text>
          {maxOverlapTimes.length > 0 ? (
            maxOverlapTimes
              .reduce((acc, curr) => {
                const existing = acc.find(item => item.date === curr.date);
                const currentStartDt = parse(curr.start, "HH'시' mm'분'", new Date());
                const currentEndDt = parse(curr.end, "HH'시' mm'분'", new Date());

                if (existing) {
                  const lastTimeStr = existing.times[existing.times.length - 1];
                  const lastEndStr = lastTimeStr.split('부터')[1].trim().replace('까지', '').trim();
                  const lastEndDt = parse(lastEndStr, "HH'시' mm'분'", new Date());
                  const lastStartStr = lastTimeStr.split('부터')[0].replace('🕒 ', '').trim();
                  const lastStartDt = parse(lastStartStr, "HH'시' mm'분'", new Date());

                  if (lastEndDt.getTime() === currentStartDt.getTime()) {
                    existing.times[existing.times.length - 1] =
                      `🕒 ${format(lastStartDt, "HH'시' mm'분'", { locale: ko })} 부터 ${format(currentEndDt, "HH'시' mm'분'", { locale: ko })}까지`;
                  } else {
                    existing.times.push(`🕒 ${curr.start} 부터 ${curr.end}까지`);
                  }
                } else {
                  acc.push({ date: curr.date, times: [`🕒 ${curr.start} 부터 ${curr.end}까지`] });
                }
                return acc;
              }, [])
              .map((timeInfo, i) => (
                <div key={i}>
                  📅 {timeInfo.date} {timeInfo.times.join(', ')}
                </div>
              ))
          ) : (
            <Text>일정이 없습니다.</Text>
          )}
        </Card>
      </main>
    </div>
  );
}

export default EventPage;
