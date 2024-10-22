import React, { useEffect, useState } from "react";
import axios from "axios";
import moment from "moment";
import { Button, Card, Typography, Row, Col, message, Tooltip, TimePicker, Input, DatePicker, Modal } from "antd";
import { CalendarOutlined, ToolOutlined } from '@ant-design/icons'; // Import the calendar icon
import ScheduleSelector from "react-schedule-selector";
import { checkKakaoLoginStatus, getUserInfoFromLocalStorage, clearUserInfoFromLocalStorage } from './Components/authUtils';
import Socialkakao from "./Components/Socialkakao";
import KakaoShareButton from "./Components/KakaoShareButton";
import { initGoogleAPI, signInWithGoogle, signOutFromGoogle, isGoogleSignedIn, addEventToGoogleCalendar } from './googleAuth'; // 로그인 관련 함수 임포트
import GoogleCalendar from './GoogleCalendar'; // 구글 캘린더 컴포넌트 임포트

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
  const [isModalVisible, setIsModalVisible] = useState(false); // 모달 상태 추가
  const [maxOverlapTimes, setMaxOverlapTimes] = useState([]);
  const [isGoogleLoggedIn, setIsGoogleLoggedIn] = useState(false); // 구글 로그인 상태 추가
  const [isGoogleModalVisible, setIsGoogleModalVisible] = useState(false); // 구글 모달 상태 추가
  const [overlappingEvents, setOverlappingEvents] = useState([]); // 구글 일정과 겹쳐진 일정 상태 추가
  
  useEffect(() => {
    const checkLoginStatus = async () => {
      const savedAccessToken = localStorage.getItem('kakaoAccessToken');
      if (savedAccessToken) {
        const status = await checkKakaoLoginStatus(savedAccessToken);
        if (status) {
          const storedUserInfo = getUserInfoFromLocalStorage();
          if (storedUserInfo) {
            setUserInfo(storedUserInfo);
          }
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
      
      const queryString = window.location.search;
      const urlParams = new URLSearchParams(queryString);
      const uuid = urlParams.get("key");

      const response = await axios.get(`/api/events/${uuid}`);
      setEventData(response.data);

      const startDate = moment(response.data.startday);
      const endDate = moment(response.data.endday);
      const diffDays = endDate.diff(startDate, "days") + 1;
      setNumDays(diffDays);

      const schedulesResponse = await axios.get(`/api/event-schedules/${uuid}`);
      setAllSchedules(schedulesResponse.data);

      const userSchedulesMap = {};
      schedulesResponse.data.forEach(schedule => {
        const time = moment(schedule.event_datetime).format("YYYY-MM-DD HH:mm");
        if (!userSchedulesMap[time]) {
          userSchedulesMap[time] = [];
        }
        userSchedulesMap[time].push(schedule.nickname);
      });
      setUserSchedules(userSchedulesMap);

      if (userInfo) {
        const userSchedule = schedulesResponse.data.filter(schedule => schedule.kakaoId === userInfo.id.toString() && schedule.event_uuid === uuid);

        const userSelectedTime = userSchedule.map(schedule => moment(schedule.event_datetime).toDate());
        setSchedule(userSelectedTime);
        setUserSelectedTimes(userSchedule.map(schedule => moment(schedule.event_datetime).format("YYYY-MM-DD HH:mm")));

        const selectedTimeByDate = {};
        userSelectedTime.forEach((time) => {
          const date = moment(time).format("YYYY-MM-DD");
          if (!selectedTimeByDate[date]) {
            selectedTimeByDate[date] = [];
          }
          selectedTimeByDate[date].push(moment(time).format("HH:mm"));
        });
        setSelectedTime(selectedTimeByDate);
        const maxOverlaps = findMaxOverlappingTimes(schedulesResponse.data);
        setMaxOverlapTimes(maxOverlaps);
        
      }

    } catch (error) {
      console.error("Error fetching event data:", error);
      message.error("Error fetching event data");
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    fetchEventData();
  }, [userInfo]);

  

  const handleConfirm = async () => {
    try {
      setConfirmLoading(true);

      await axios.delete("/api/delete-event-schedule", {
        data: {
          kakaoId: userInfo.id.toString(),
          event_uuid: eventData.uuid,
        },
      });

      for (const [date, times] of Object.entries(selectedTime)) {
        for (const time of times) {
          const datetime = moment(`${date} ${time}`, "YYYY-MM-DD HH:mm").format();

          const requestData = {
            kakaoId: userInfo.id.toString(),
            nickname: userInfo.kakao_account.profile.nickname,
            event_name: eventData.eventname,
            event_uuid: eventData.uuid,
            event_datetime: datetime,
          };

          await axios.post("/api/save-event-schedule", requestData);
        }
      }

      await fetchEventData(); // Fetch latest data

      message.success("일정이 즉시 적용되었습니다");
    } catch (error) {
      console.error("일정 저장 오류:", error);
      message.error("일정 저장 오류");
    } finally {
      setConfirmLoading(false);
    }
  };

  const handleScheduleChange = (newSchedule) => {
    setSchedule(newSchedule);
    const selectedTimeByDate = {};
    newSchedule.forEach((time) => {
      const date = moment(time).format("YYYY-MM-DD");
      if (!selectedTimeByDate[date]) {
        selectedTimeByDate[date] = [];
      }
      selectedTimeByDate[date].push(moment(time).format("HH:mm"));
    });
    setSelectedTime(selectedTimeByDate);
  };

  const handleCopyLink = () => {
    const link = `http://localhost:8080/test/?key=${eventData.uuid}`;
    navigator.clipboard.writeText(link)
      .then(() => {
        message.success('링크가 클립보드에 복사되었습니다!');
      })
      .catch(err => {
        message.error('링크 복사에 실패했습니다.');
        console.error('Error copying link:', err);
      });
  };

  // 구글 로그인 처리
  const handleGoogleLoginClick = async () => {
    try {
      await signInWithGoogle(); // 구글 로그인 팝업 띄우기
      setIsGoogleLoggedIn(isGoogleSignedIn()); // 로그인 여부 업데이트
      message.success('구글 로그인 완료!');
    } catch (error) {
      console.error('구글 로그인 실패:', error);
      message.error('구글 로그인에 실패했습니다.');
    }
  };

  // 구글 캘린더 불러오기 버튼 클릭 시
  const handleGoogleCalendarFetch = () => {
    if (!isGoogleLoggedIn) {
      message.warning('먼저 구글 캘린더 연동을 완료해주세요!');
      return;
    }
    setIsGoogleModalVisible(true); // 로그인 완료 후에만 모달 열기
  };

  // 일정 구글 캘린더에 등록하기
  const handleExportToGoogleCalendar = async () => {
    if (!isGoogleLoggedIn) {
      message.warning('먼저 구글 캘린더 연동을 완료해주세요.');
      return;
    }
  
    // 사용자가 선택한 시간을 연속된 시간 블록으로 변환
    const continuousTimeRanges = [];
    userSelectedTimes.forEach((timeRange) => {
      const startMoment = moment(timeRange, "YYYY-MM-DD HH:mm");
      const endMoment = moment(startMoment).add(30, 'minutes');
  
      // 연속된 시간 범위 추가
      if (continuousTimeRanges.length === 0) {
        continuousTimeRanges.push({ start: startMoment, end: endMoment });
      } else {
        const lastRange = continuousTimeRanges[continuousTimeRanges.length - 1];
        if (lastRange.end.isSame(startMoment)) {
          lastRange.end = endMoment; // 연속된 경우 끝 시간 업데이트
        } else {
          continuousTimeRanges.push({ start: startMoment, end: endMoment }); // 새로운 범위 추가
        }
      }
    });
  
    // 구글 캘린더에 이벤트 등록
    for (const range of continuousTimeRanges) {
      const event = {
        summary: eventData.eventname, // 이벤트 제목
        start: {
          dateTime: range.start.toISOString(), // 시작 시간
          timeZone: 'Asia/Seoul', // 시간대
        },
        end: {
          dateTime: range.end.toISOString(), // 종료 시간
          timeZone: 'Asia/Seoul', // 시간대
        }
      };
  
      try {
        await addEventToGoogleCalendar(event);
        message.success('일정이 구글 캘린더에 등록되었습니다.');
      } catch (error) {
        console.error('구글 캘린더에 일정 등록 실패:', error);
        message.error('일정 등록 중 오류가 발생했습니다.');
      }
    }
  };
  



  const handleModalClose = () => {
    setIsModalVisible(false); // 모달 닫기
  };
  
  const handleGoogleModalClose = () => {
    setIsGoogleModalVisible(false); // 모달 닫기
  };

  const showModal = () => {
    setIsModalVisible(true); // 모달 열기
  };

  const showGoogleModal = () => {
    setIsGoogleModalVisible(true); // 모달 열기
  };
  
  const handleOk = () => {
    setIsModalVisible(false); // 모달 닫기
    setIsGoogleModalVisible(false);
  };
  
  const handleCancel = () => {
    setIsModalVisible(false); // 모달 닫기
    setIsGoogleModalVisible(false);
  };
  const findMaxOverlappingTimes = (schedules) => {
    const timeCounts = {};
    
    schedules.forEach(schedule => {
      const time = moment(schedule.event_datetime).format("YYYY-MM-DD HH:mm");
      const endTime = moment(time).add(30, 'minutes').format("YYYY-MM-DD HH:mm");
      
      // 각 시간대의 겹치는 수 카운트
      for (let m = moment(time); m.isBefore(endTime); m.add(30, 'minutes')) {
        const formattedTime = m.format("YYYY-MM-DD HH:mm");
        if (!timeCounts[formattedTime]) {
          timeCounts[formattedTime] = 0;
        }
        timeCounts[formattedTime]++;
      }
    });

    // 겹치는 수가 가장 많은 시간대 찾기
    const maxCount = Math.max(...Object.values(timeCounts));
    return Object.entries(timeCounts)
      .filter(([time, count]) => count === maxCount)
      .map(([time]) => {
        const startTime = moment(time);
        const endTime = startTime.clone().add(30, 'minutes');
        return {
          date: startTime.format("YYYY/MM/DD"),
          start: startTime.format("HH시 mm분"),
          end: endTime.format("HH시 mm분"),
        };
      });
  };


  if (loading) {
    return <p>Loading...</p>;
  }

  if (!userInfo) {
    return <Socialkakao />;
  }

  if (!eventData) {
    return <p>No event data available</p>;
  }

  const startDate = moment(eventData.startday).format("YYYY-MM-DD");
  const endDate = moment(eventData.endday).format("YYYY-MM-DD");
  const startTime = moment(eventData.startday).format("HH:mm");
  const endTime = moment(eventData.endday).format("HH:mm");
  const Schedule_Start = moment(eventData.startday).toDate();
  const Schedule_End = moment(eventData.endday).toDate();

  const countOccurrences = (time) => {
    return allSchedules.filter(schedule => moment(schedule.event_datetime).isSame(time, 'minute')).length;
  };
  const mergeConsecutiveTimes = (times) => {
    if (!times || times.length === 0) return [];
  
    const mergedTimes = [];
    let start = times[0];
    let end = times[0];
  
    for (let i = 1; i < times.length; i++) {
      const currentTime = moment(times[i], "YYYY-MM-DD HH:mm");
      const previousTime = moment(end, "YYYY-MM-DD HH:mm");
  
      // Check if the current time is consecutive to the previous time (30-minute interval)
      if (currentTime.diff(previousTime, "minutes") === 30) {
        end = times[i];
      } else {
        // If not consecutive, push the current range and start a new range
        mergedTimes.push(`${start} ~ ${end}`);
        start = times[i];
        end = times[i];
      }
    }
  
    // Push the last range
    mergedTimes.push(`${start} ~ ${end}`);
    return mergedTimes;
  };
  const colors = ["blue", "red", "green", "purple", "orange", "pink"];
  const userColorMap = {};
  
  // 전체 스케줄 데이터에서 사용자 목록을 가져와 유니크하게 만듭니다.
  const allUsers = [...new Set(allSchedules.map(schedule => schedule.nickname))];

  // 사용자마다 색을 매핑합니다.
  allUsers.forEach((user, index) => {
    userColorMap[user] = colors[index % colors.length];
  });
  
  return (
    <div className="App">
      <main className="main-content">
      


            <Row gutter={[16, 16]} >
                {/* Row for Event Details and Event Management side by side */}
                <Col span={12}>
                  {/* Event Details Section */}
                  <Card style={{ margin: "20px", padding: "0px" }}>
                    <Title level={4}>
                      <CalendarOutlined style={{ marginRight: '10px' }} />
                      모임 세부 정보
                    </Title>
                    <Row gutter={[16, 16]}>
                      <Col span={12}>
                        <Text strong>📅 모임 이름: </Text>
                        <Input
                          value={eventData.eventname}
                          readOnly
                          style={{ width: "100%", backgroundColor: "white" }}
                        />
                      </Col>

                      <Col span={12}>
                        <Text strong>📅 모임 UUID: </Text>
                        <Input
                          value={eventData.uuid}
                          readOnly
                          style={{ width: "100%", backgroundColor: "white" }}
                        />
                      </Col>
                    </Row>

                    <Row gutter={[16, 16]}>
                      <Col span={12}>
                        <Text strong>📅 시작 날짜: </Text>
                        <DatePicker
                          value={moment(eventData.startday)}
                          format="YYYY-MM-DD"
                          disabled
                          style={{ width: "100%", backgroundColor: "white" }}
                        />
                      </Col>

                      <Col span={12}>
                        <Text strong>📅 종료 날짜: </Text>
                        <DatePicker
                          value={moment(eventData.endday)}
                          format="YYYY-MM-DD"
                          disabled
                          style={{ width: "100%", backgroundColor: "white" }}
                        />
                      </Col>
                    </Row>

                    <Row gutter={[16, 16]}>
                      <Col span={12}>
                        <Text strong>🕒 시작 시간: </Text>
                        <TimePicker
                          value={moment(eventData.startday)}
                          format="HH:mm"
                          disabled
                          style={{ width: "100%", backgroundColor: "white" }}
                        />
                      </Col>

                      <Col span={12}>
                        <Text strong>🕒 종료 시간: </Text>
                        <TimePicker
                          value={moment(eventData.endday)}
                          format="HH:mm"
                          disabled
                          style={{ width: "100%", backgroundColor: "white" }}
                        />
                      </Col>
                    </Row>
                  </Card>
                </Col>

                {/* Event Management Section - Placed Next to Event Details */}
                <Col span={12}>
                  <Card style={{ margin: "20px", padding: "0px" }}>
                    <Title level={4}>
                      <ToolOutlined style={{ marginRight: '10px' }} />
                      모임 관리
                    </Title>

                    {/* Kakao share and link copy button layout */}
                    <Row gutter={[16, 16]} style={{ marginTop: "20px" }}>
                    <Col span={12}>
                          <KakaoShareButton 
                            userInfo={userInfo} 
                            eventData={eventData} 
                          />
                          </Col>
                          <Col span={12}>
                          <Button 
                            type="default" 
                            block
                            onClick={handleCopyLink} 
                            style={{  marginBottom: '10px' }} // 여백 추가
                          >
                            🔗 일정 링크 복사
                          </Button>
                          </Col> 
                    </Row>

                    {/* Google Calendar buttons layout */}
                    <Row gutter={[16, 16]} style={{ marginTop: "20px" }}>
                      <Col span={12}>
                        <Button type="default" block style={{ marginBottom: "10px" }} onClick={handleGoogleLoginClick}>
                          📆 구글 캘린더 연동하기
                        </Button>
                        {isGoogleLoggedIn ? (
                         <>
                          <p>구글 로그인 완료</p>
          
                         </>
                     ) : (
                      <p>구글 로그인 필요</p>
                     )}

                      </Col>
                      <Col span={12}>
                        <Button type="default" block style={{ marginBottom: "10px" }} onClick={handleGoogleCalendarFetch}>
                          📆 구글 일정 불러오기
                        </Button>
                        <Modal
                          title="Google Calendar Events"
                          visible={isGoogleModalVisible}
                          onCancel={handleGoogleModalClose}
                          footer={null}
                        >
                          <GoogleCalendar scheduleStart={Schedule_Start} scheduleEnd={Schedule_End} setOverlappingEvents={setOverlappingEvents}/>
                          {/* 모달 안에 GoogleCalendar 컴포넌트를 표시 */}
                        </Modal>
                      </Col>
                      <Col span={12}>
                        <Button type="default" block onClick={handleExportToGoogleCalendar}>
                          📆 구글 캘린더로 내보내기
                        </Button>
                      </Col>
                      <Col span={12}>
                        <Button type="default" block>
                          📆 다른 버튼
                        </Button>
                      </Col>
                    </Row>
                  </Card>
                </Col>

              </Row>

        {/* Rest of your code remains unchanged */}
        <Row gutter={[16, 16]}>
          <Col span={12}>
            <Card style={{ margin: "20px", padding: "0px", overflowX: "auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Title level={4}>⌚ 내 일정 등록하기 !</Title>
                <Button type="primary" onClick={showModal} style={{ marginTop: "0" }}>
                  ⌚ 내가 등록한 일정 확인하기
                </Button>
              </div>

              {/* 모달 추가 */}
              <Modal
                title="내가 등록한 일정 확인하기"
                visible={isModalVisible}
                onOk={handleOk}
                onCancel={handleCancel}
              >
                {(() => {
                  const mergedTimes = [];

                  userSelectedTimes.forEach((timeRange) => {
                    const startMoment = moment(timeRange, "YYYY-MM-DD HH:mm");
                    const endMoment = moment(startMoment).add(30, 'minutes');

                    if (mergedTimes.length === 0) {
                      mergedTimes.push({ start: startMoment, end: endMoment });
                    } else {
                      const lastRange = mergedTimes[mergedTimes.length - 1];
                      if (lastRange.end.isSame(startMoment)) {
                        lastRange.end = endMoment; // 연속된 경우 끝 시간 업데이트
                      } else {
                        mergedTimes.push({ start: startMoment, end: endMoment }); // 새로운 범위 추가
                      }
                    }
                  });

                  // 날짜 및 시간 순서대로 정렬
                  const sortedRanges = mergedTimes.sort((a, b) => {
                    if (a.start.isBefore(b.start)) return -1;
                    if (a.start.isAfter(b.start)) return 1;
                    return 0;
                  });

                  // 날짜별로 그룹화
                  const groupedRanges = sortedRanges.reduce((acc, range) => {
                    const dateKey = range.start.format("YYYY/MM/DD");
                    if (!acc[dateKey]) {
                      acc[dateKey] = [];
                    }
                    acc[dateKey].push(range);
                    return acc;
                  }, {});

                  return Object.entries(groupedRanges).map(([date, ranges]) => (
                    <div key={date}>
                      <div>📅 {date}</div>
                      {ranges.map((range, index) => {
                        const formattedStartTime = range.start.format("HH시 mm분");
                        const formattedEndTime = range.end.format("HH시 mm분");
                        return (
                          <div key={index} style={{ marginLeft: "20px" }}>
                            🕒 {formattedStartTime} 부터 {formattedEndTime}까지
                          </div>
                        );
                      })}
                    </div>
                  ));
                })()}
              </Modal>

              <div className="schedule-selector-wrapper">
                <ScheduleSelector
                  selection={schedule}
                  numDays={numDays}
                  startDate={Schedule_Start}
                  minTime={moment(startTime, "HH:mm").hours()}
                  maxTime={moment(endTime, "HH:mm").hours()}
                  hourlyChunks={2}
                  rowGap="4px"
                  columnGap="7px"
                  onChange={handleScheduleChange}
                  renderTimeLabel={(time) => {
                    const formattedStartTime = moment(time).format("HH:mm");
                    const formattedEndTime = moment(time).add(30, "minutes").format("HH:mm");
                    return <div className="time-label">{formattedStartTime} - {formattedEndTime}</div>;
                  }}
                  renderDateCell={(time, selected, innerRef) => {
                    const formattedTime = moment(time).format("YYYY-MM-DD HH:mm");
              
                    // 겹치는 이벤트 가져오기
                    const overlapping = overlappingEvents.filter(event => {
                    const eventStart = moment(event.start);
                    const eventEnd = moment(event.end);
                    const timeStart = moment(time);
                    const timeEnd = moment(time).add(30, 'minutes');

                    return (eventStart.isBefore(timeEnd) && eventEnd.isAfter(timeStart)); // 겹치는지 확인
                  });
                              
                    // 기본 셀 배경색과 선택된 색상 정의
                    const backgroundColor = selected ? "#1890ff" : "#e6f7ff"; // 선택 시 파란색
                    const borderColor = selected ? "1px solid blue" : "1px solid #ccc";
              
                    return (
                      <div
                        ref={innerRef}
                        style={{
                          position: "relative",
                          padding: "5px",
                          border: borderColor,
                          height: "100%",
                          backgroundColor: backgroundColor, // 기본 색상
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = "#b3e0ff"; // 마우스 오버 시 색상
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = selected ? "#1890ff" : "#e6f7ff"; // 기본 색상으로 복원
                        }}
                      >
                        {/* 겹치는 일정 제목을 셀 중앙에 표시 */}
                        {overlapping.length > 0 && (
                          <div style={{
                            position: "absolute",
                            top: "50%",
                            right: "5px",
                            transform: "translateY(-50%)",
                            fontSize: "12px",
                            color: 'red',
                            textAlign: 'right'
                          }}>
                            {overlapping.map(event => event.title).join(", ")}
                          </div>
                        )}
                      </div>
                    );
                  }}
                />
              </div>
              <Button type="primary" onClick={handleConfirm} style={{ marginTop: "20px" }} loading={confirmLoading}>
                확인
              </Button>
            </Card>
          </Col>
        


          <Col span={12}>
          <Card style={{ margin: "20px", padding: "0px", overflowX: "auto" }}>
              <Title level={4}>📅 모든 참가자들의 일정을 확인하세요 !
                <span style={{ marginLeft: "10px", fontSize: "14px" }}>
                  {/* 각 사용자에 대한 색상 매핑을 표시 */}
                  {allUsers.map((user, index) => (
                    <span key={index} style={{ marginLeft: "5px", color: userColorMap[user] }}>
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
                  minTime={moment(startTime, "HH:mm").hours()}
                  maxTime={moment(endTime, "HH:mm").hours()}
                  hourlyChunks={2}
                  rowGap="4px"
                  columnGap="7px"
                  renderTimeLabel={(time) => {
                    const formattedStartTime = moment(time).format("HH:mm");
                    const formattedEndTime = moment(time).add(30, "minutes").format("HH:mm");
                    return <div className="time-label">{formattedStartTime} - {formattedEndTime}</div>;
                  }}
                  renderDateCell={(time, selected, innerRef) => {
                    const formattedTime = moment(time).format("YYYY-MM-DD HH:mm");
                    const users = userSchedules[formattedTime] || [];
                    const uniqueUsers = [...new Set(users)];

                    // 사용자의 색상으로 점을 표시
                    const dots = uniqueUsers.map((user, index) => {
                      const color = userColorMap[user];
                      return (
                        <span
                          key={index}
                          style={{
                            display: "inline-block",
                            marginLeft: "2px",
                            color: color,
                            fontSize: "14px"
                          }}
                        >
                          ●
                        </span>
                      );
                    });

                    return (
                      <Tooltip title={uniqueUsers.join(", ")} placement="top">
                        <div
                          ref={innerRef}
                          style={{
                            backgroundColor: `rgba(0, 128, 0, ${Math.min(0.1 + uniqueUsers.length * 0.1, 1)})`,
                            border: "1px solid #ccc",
                            height: "100%",
                            width: "100%",
                            position: "relative",
                            paddingRight: "5px"
                          }}
                        >
                          {/* 오른쪽에 점 배치 */}
                          <div style={{ position: "absolute", right: "5px", top: "50%", transform: "translateY(-50%)" }}>
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
        <Card style={{ margin: "20px", padding: "0px" }}>
          <Title level={4}>👍 모임 시간으로 적절한 시간을 추천 해드릴께요 !</Title>
          <Text>🤖 가장 일정이 많이 겹친 시간</Text>
          {maxOverlapTimes.length > 0 ? (
            maxOverlapTimes
              .reduce((acc, curr) => {
                // 동일한 날짜의 시간을 그룹화
                const existing = acc.find(item => item.date === curr.date);
                if (existing) {
                  existing.times.push(`🕒 ${curr.start} 부터 ${curr.end}까지`);
                } else {
                  acc.push({ date: curr.date, times: [`🕒 ${curr.start} 부터 ${curr.end}까지`] });
                }
                return acc;
              }, [])
              .map((timeInfo, index) => (
                <div key={index}>
                  📅 {timeInfo.date} {timeInfo.times.join(", ")}
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
