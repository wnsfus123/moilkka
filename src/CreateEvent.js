import React, { useEffect, useState } from "react";
import { ConfigProvider, DatePicker, TimePicker, Button, Form, Input, Card, Modal, List,Row,Col } from "antd";
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import koKR from 'antd/lib/locale/ko_KR';
import 'dayjs/locale/ko';
import dayjs from 'dayjs';
import moment from 'moment';
import Socialkakao from "./Components/Socialkakao";
import { checkKakaoLoginStatus, getUserInfoFromLocalStorage, clearUserInfoFromLocalStorage } from './Components/authUtils';

dayjs.locale('ko');

const CreateEvent = () => {
  const [eventName, setEventName] = useState("");
  const [startTime, setStartTime] = useState(null);
  const [endTime, setEndTime] = useState(null);
  const [selectedDates, setSelectedDates] = useState([]);
  const [uuid, setUuid] = useState("");
  const [userInfo, setUserInfo] = useState(null);
  const [accessToken, setAccessToken] = useState('');
  const [existingEvents, setExistingEvents] = useState([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [availableTimes, setAvailableTimes] = useState([]); // 겹치는 시간대 저장

  useEffect(() => {
    const checkLoginStatus = async () => {
      const savedAccessToken = localStorage.getItem('kakaoAccessToken');
      if (savedAccessToken) {
        setAccessToken(savedAccessToken);
        const status = await checkKakaoLoginStatus(savedAccessToken);
        if (status) {
          const storedUserInfo = getUserInfoFromLocalStorage();
          if (storedUserInfo) {
            setUserInfo(storedUserInfo);
            fetchExistingEvents(storedUserInfo.id.toString()); // 사용자 ID를 기반으로 기존 이벤트를 가져옵니다.
          }
        } else {
          clearUserInfoFromLocalStorage();
          setUserInfo(null);
        }
      }
    };

    checkLoginStatus();
  }, []);

  const fetchExistingEvents = (kakaoId) => {
    axios.get(`/api/events/user/${kakaoId}`)
      .then(response => {
        setExistingEvents(response.data);
      })
      .catch(error => {
        console.error("Error fetching existing events:", error);
      });
  };

  const handleEventNameChange = (event) => {
    setEventName(event.target.value);
  };

  const handleUuidChange = (event) => {
    setUuid(event.target.value); //사용자가 입력한 UUID를 상태에 저장
  };

  const handleConfirm = () => {
    if (!uuid) {
      console.error("UUID를 입력해주세요");
      return;
    }

    if (!userInfo) {
      console.error("로그인 정보가 없습니다.");
      return;
    }
    axios.get(`/api/events/${uuid}`)
    .then(response => {
      if (response.data) {
        // 이벤트가 존재할 경우, 기존 이벤트 상태 업데이트
        setExistingEvents([response.data]); // 배열 형태로 업데이트하여 모달에서 표시
        setIsModalVisible(true); // 모달 열기
      } else {
        console.error("해당 UUID에 맞는 이벤트가 없습니다.");
        alert("해당 UUID에 맞는 이벤트가 없습니다.");
      }
    })
    .catch(error => {
      console.error("UUID 확인 중 오류 발생:", error);
      alert("UUID 확인 중 오류가 발생했습니다.");
    });

    const kakaoId = userInfo.id.toString(); 
    const nickname = userInfo.kakao_account.profile.nickname; 

    window.location.href = `http://localhost:8080/test/?key=${uuid}&kakaoId=${kakaoId}&nickname=${nickname}`;
  };

  const handleCreateEvent = () => {
    if (selectedDates.length < 2) {
      console.error("At least two dates should be selected");
      return;
    }

    const startDay = selectedDates[0];
    const endDay = selectedDates[1];
    const startTimeStr = startTime.format("HH:mm");
    const endTimeStr = endTime.format("HH:mm");
    const eventUUID = uuidv4().substring(0, 8);
    const startDayLocal = startDay.format("YYYY-MM-DD");
    const endDayLocal = endDay.format("YYYY-MM-DD");

    if (!userInfo) {
      console.error("로그인 정보가 없습니다.");
      return;
    }

    const kakaoId = userInfo.id.toString(); 
    const nickname = userInfo.kakao_account.profile.nickname; 
    const createDay = moment().format("YYYY-MM-DD HH:mm:ss");

    axios
      .post("/api/events", {
        uuid: eventUUID,
        eventName: eventName,
        startDay: startDayLocal,
        endDay: endDayLocal,
        startTime: startTimeStr,
        endTime: endTimeStr,
        kakaoId: kakaoId,
        nickname: nickname,
        createDay: createDay
      })
      .then((response) => {
        window.location.href = `http://localhost:8080/test/?key=${eventUUID}`;
      })
      .catch((error) => {
        console.error("Error sending data:", error);
      });
  };

  const showModal = () => {
    setIsModalVisible(true);
  };

  const handleOk = () => {
    setIsModalVisible(false);
  };

  const handleCancel = () => {
    setIsModalVisible(false);
  };

  if (!userInfo) {
    return <Socialkakao />;
  }

  return (
    <div className="App">
      <main className="main-content">
        <h1 style={{ textAlign: "center" }}>🗓 모임을 새롭게 만들어보세요</h1>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>

          <Card title="🗓 모임 일정의 이름과 날짜, 시간을 입력하세요 !" style={{ width: "100%", marginBottom: 20 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              
              {/* 일정 이름 입력 */}
              <Row justify="center" style={{ width: "100%", marginBottom: "20px" }}>
                <Col xs={24} sm={24} md={12} lg={12}> 
                  <Form.Item
                    name="eventName"
                    rules={[{ required: true, message: "일정 이름을 입력해주세요" }]}
                  >
                    <Input
                      onChange={handleEventNameChange}
                      placeholder="일정 이름을 입력해주세요."
                      size={"large"}
                      style={{ width: "100%" }}
                    />
                  </Form.Item>
                </Col>
              </Row>

              {/* 날짜 선택 */}
              <Row justify="center" style={{ width: "100%", marginBottom: "20px" }}>
                <Col xs={24} sm={24} md={12} lg={12}>
                  <DatePicker.RangePicker
                    style={{ width: "100%" }}
                    format="YYYY년 MM월 DD일"
                    onChange={(dates) => setSelectedDates(dates)}
                    placeholder={['시작 날짜', '종료 날짜']}
                    size={"large"}
                  />
                </Col>
              </Row>

              {/* 시간 선택 */}
              <Row justify="center" style={{ width: "100%", marginBottom: "20px" }}>
                <Col xs={24} sm={24} md={12} lg={12}>
                  <TimePicker.RangePicker
                    style={{ width: "100%" }}
                    format="HH시 mm분"
                    onChange={(times) => {
                      setStartTime(times[0]);
                      setEndTime(times[1]);
                    }}
                    placeholder={['시작 시간', '종료 시간']}
                    size={"large"}
                    minuteStep={60}
                  />
                </Col>
              </Row>

              <Form.Item style={{ width: "100%", textAlign: "center" }}>
                <Button
                  type="primary"
                  htmlType="submit"
                  onClick={handleCreateEvent}
                  disabled={
                    !selectedDates.length ||
                    !startTime ||
                    !endTime ||
                    !eventName
                  }
                  style={{ width: "100%", height: "45px", fontSize: "14px" }}
                >
                  일정 생성
                </Button>
              </Form.Item>
            </div>
          </Card>

          <Card title="UUID 입력 ❓ UUID는 모임 링크 key= 뒤에서 확인 가능해요 !" style={{ width: "100%" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <h3 style={{ textAlign: "center" }}>UUID</h3>
              <Form.Item
                name="uuid"
                rules={[{ required: true, message: "UUID를 입력해주세요" }]}
                style={{ width: "100%", height: "30px", fontSize: "20px" }}
              >
                <Input.Search 
                  onSearch={handleConfirm} 
                  enterButton="확인"
                  style={{ height: "40px", width: "100%", marginBottom: "10px" }} 
                  placeholder="UUID를 입력해주세요." 
                  size={"large"}
                  value={uuid} // 상태 연결
                  onChange={handleUuidChange} // 핸들러 추가
                />
              </Form.Item>
            </div>
          </Card>

          {/* 기존 일정 모달 */}
          <Modal title="기존 일정" visible={isModalVisible} onOk={handleOk} onCancel={handleCancel}>
            <List
              dataSource={existingEvents}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta
                    title={item.eventName}
                    description={`시작일: ${item.startDay}, 종료일: ${item.endDay}, 시작시간: ${item.startTime}, 종료시간: ${item.endTime}`}
                  />
                </List.Item>
              )}
            />
          </Modal>
        </div>
      </main>
    </div>
  );
};

const App = () => (
  <ConfigProvider locale={koKR}>
    <CreateEvent />
  </ConfigProvider>
);

export default App;
