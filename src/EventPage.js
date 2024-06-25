import React, { useEffect, useState } from "react";
import axios from "axios";
import moment from "moment";
import { Button, Card, Typography, Row, Col, message, Tooltip } from "antd";
import ScheduleSelector from "react-schedule-selector";
import { checkKakaoLoginStatus, getUserInfoFromLocalStorage, clearUserInfoFromLocalStorage } from './Components/authUtils';
import Socialkakao from "./Components/Socialkakao";
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
  const [userSelectedTimes, setUserSelectedTimes] = useState([]); // 현재 접속한 유저의 이벤트 시간을 저장

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

    checkLoginStatus();
  }, []);

  useEffect(() => {
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

        console.log('User Info:', userInfo); // 사용자 정보 확인
        console.log('Schedules Response:', schedulesResponse.data); // 전체 스케줄 확인

        // User's existing schedule
        if (userInfo) {
          const userSchedule = schedulesResponse.data.filter(schedule => schedule.kakaoId === userInfo.id.toString() && schedule.event_uuid === uuid);
          console.log('User Schedule:', userSchedule); // 사용자 스케줄 확인

          const userSelectedTime = userSchedule.map(schedule => moment(schedule.event_datetime).toDate());
          setSchedule(userSelectedTime);
          setUserSelectedTimes(userSchedule.map(schedule => moment(schedule.event_datetime).format("YYYY-MM-DD HH:mm"))); // 현재 접속한 유저의 이벤트 시간 설정
          // Set selectedTime for the handleConfirm function
          const selectedTimeByDate = {};
          userSelectedTime.forEach((time) => {
            const date = moment(time).format("YYYY-MM-DD");
            if (!selectedTimeByDate[date]) {
              selectedTimeByDate[date] = [];
            }
            selectedTimeByDate[date].push(moment(time).format("HH:mm"));
          });
          setSelectedTime(selectedTimeByDate);
        }

      } catch (error) {
        console.error("Error fetching event data:", error);
        message.error("Error fetching event data");
      } finally {
        setLoading(false);
      }
    };

    fetchEventData();
  }, [userInfo]); // userInfo가 변경될 때마다 fetchEventData를 호출합니다.

  const handleConfirm = async () => {
    try {
      // 기존 일정을 삭제
      await axios.delete("/api/delete-event-schedule", {
        data: {
          kakaoId: userInfo.id.toString(),
          event_uuid: eventData.uuid,
        },
      });

      // 새로운 일정을 저장
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
      message.success("일정이 수정되었습니다");
    } catch (error) {
      console.error("Error saving event schedule:", error);
      message.error("Error saving event schedule");
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

  return (
    <div className="App">
      <main className="main-content">
        <Card style={{ margin: "20px", padding: "20px" }}>
          <Title level={2}>Event Details</Title>
          <Row gutter={[16, 16]}>
            <Col span={12}>
              <Text strong>Event Name: </Text>
              <Text>{eventData.eventname}</Text>
            </Col>
            <Col span={12}>
              <Text strong>Event UUID: </Text>
              <Text>{eventData.uuid}</Text>
            </Col>
          </Row>
          <Row gutter={[16, 16]}>
            <Col span={12}>
              <Text strong>Start Day: </Text>
              <Text>{startDate}</Text>
            </Col>
            <Col span={12}>
              <Text strong>End Day: </Text>
              <Text>{endDate}</Text>
            </Col>
          </Row>
          <Row gutter={[16, 16]}>
            <Col span={12}>
              <Text strong>Start Time: </Text>
              <Text>{startTime}</Text>
            </Col>
            <Col span={12}>
              <Text strong>End Time: </Text>
              <Text>{endTime}</Text>
            </Col>
          </Row>
        </Card>

        <Row gutter={[16, 16]}>
          <Col span={12}>
            <Card style={{ margin: "20px", padding: "20px", overflowX: "auto" }}>
              <Title level={3}>Select Schedule</Title>
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
                />
              </div>
              <Button type="primary" onClick={handleConfirm} style={{ marginTop: "20px" }}>
                Confirm
              </Button>
              {/* 선택된 시간 출력 */}
              <Card style={{ margin: "20px", padding: "20px", overflowX: "auto" }}>
                <Title level={3}>Selected Schedule Times</Title>
                {userSelectedTimes.map((time, index) => (
                  <div key={index}>{time}</div>
                ))}
              </Card>
            </Card>
          </Col>

          <Col span={12}>
            <Card style={{ margin: "20px", padding: "20px", overflowX: "auto" }}>
              <Title level={3}>Selected Times</Title>
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
                    const occurrences = countOccurrences(time);
                    const opacity = Math.min(0.1 + occurrences * 0.1, 1);
                    const formattedTime = moment(time).format("YYYY-MM-DD HH:mm");
                    const users = userSchedules[formattedTime] || [];
                    return (
                      <Tooltip title={users.join(", ")} placement="top">
                        <div
                          ref={innerRef}
                          style={{
                            backgroundColor: `rgba(0, 128, 0, ${opacity})`,
                            border: "1px solid #ccc",
                            height: "100%",
                            width: "100%",
                          }}
                        />
                      </Tooltip>
                    );
                  }}
                />
              </div>
            </Card>
          </Col>
        </Row>
      </main>
    </div>
  );
}

export default EventPage;
