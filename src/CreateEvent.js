import React, { useEffect, useState } from "react";
import { ConfigProvider, DatePicker, TimePicker, Button, Form, Input, Card, Modal, List } from "antd";
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
    setUuid(event.target.value);
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

    const kakaoId = userInfo.id.toString(); 
    const nickname = userInfo.kakao_account.profile.nickname; 

    window.location.href = `http://9899-203-232-203-105.ngrok-free.app/test/?key=${uuid}&kakaoId=${kakaoId}&nickname=${nickname}`;
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
        window.location.href = `http://9899-203-232-203-105.ngrok-free.app/test/?key=${eventUUID}`;
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
        <h1 style={{ textAlign: "center" }}>이벤트 생성란</h1>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <Button type="primary" onClick={showModal} style={{ marginBottom: 20 }}>
            기존 이벤트 보기
          </Button>
          
          <Card title="이벤트 생성" style={{ width: 600, marginBottom: 20 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <h3 style={{ textAlign: "center" }}>이벤트 이름</h3>
              <Form.Item
                name="eventName"
                rules={[{ required: true, message: "이벤트 이름을 입력해주세요" }]}
                style={{ width: "550px", height: "30px", fontSize: "20px" }}
              >
                <Input 
                  onChange={handleEventNameChange} 
                  style={{ height: "40px", width: "100%", marginBottom: "10px" }} 
                  placeholder="이벤트 이름을 입력해주세요." 
                  size={"large"}
                />
              </Form.Item>
              <ConfigProvider locale={koKR}>
                <DatePicker.RangePicker
                  style={{width: "550px", marginBottom: '20px' }}
                  format="YYYY년 MM월 DD일"
                  onChange={(dates) => {
                    setSelectedDates(dates);
                  }}
                  placeholder={['시작 날짜', '종료 날짜']}
                  size={"large"}
                />
                <TimePicker.RangePicker
                  style={{width: "550px", marginBottom: '20px',  fontSize: '16px' }}
                  format="HH시 mm분"
                  onChange={(times) => {
                    setStartTime(times[0]);
                    setEndTime(times[1]);
                  }}
                  placeholder={['시작 시간', '종료 시간']}
                  minuteStep={60}
                  size={"large"}
                  picker={{
                    style: { width: "150px", height: "70px", fontSize: "20px", marginBottom: '20px' },
                  }}
                />
              </ConfigProvider>

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
                  style={{ width: "400px", height: "45px", fontSize: "14px" }}
                >
                  이벤트 생성
                </Button>
              </Form.Item>
            </div>
          </Card>

          <Card title="UUID 입력" style={{ width: 600 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <h3 style={{ textAlign: "center" }}>UUID</h3>
              <Form.Item
                name="uuid"
                rules={[{ required: true, message: "UUID를 입력해주세요" }]}
                style={{ width: "550px", height: "30px", fontSize: "20px" }}
              >
                <Input.Search 
                  onSearch={handleConfirm} 
                  enterButton="확인"
                  style={{ height: "40px", width: "100%", marginBottom: "10px" }} 
                  placeholder="UUID를 입력해주세요." 
                  size={"large"}
                />
              </Form.Item>
            </div>
          </Card>
        </div>

        <Modal
          title="기존 이벤트"
          visible={isModalVisible}
          onOk={handleOk}
          onCancel={handleCancel}
        >
          <List
            grid={{ gutter: 16, column: 1 }}
            dataSource={existingEvents}
            renderItem={item => (
              <List.Item>
                <Card title={item.eventname}>
                  <p>시작: {item.startday}</p>
                  <p>종료: {item.endday}</p>
                  <Button type="primary" onClick={() => window.location.href = `http://9899-203-232-203-105.ngrok-free.app/test/?key=${item.uuid}`}>
                    이벤트 바로가기
                  </Button>
                </Card>
              </List.Item>
            )}
          />
        </Modal>
      </main>

      <div>
        <h2>로그인 성공!</h2>
        {userInfo ? (
          <div>
            <p>{userInfo.id.toString()}, 안녕하세요 {userInfo.kakao_account.profile.nickname}님!</p>
            <p>Access Token: {accessToken}</p> {/* Access Token을 표시 */}
          </div>
        ) : (
          <p>사용자 정보를 불러오는 중...</p>
        )}
      </div>
    </div>
  );
};

export default CreateEvent;
