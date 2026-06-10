import React, { useEffect, useState } from 'react';
import { ConfigProvider, DatePicker, TimePicker, Button, Form, Input, Card, message, Row, Col } from 'antd';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import koKR from 'antd/lib/locale/ko_KR';
import 'dayjs/locale/ko';
import dayjs from 'dayjs';
import { format } from 'date-fns';
import { checkKakaoLoginStatus, getUserInfoFromLocalStorage, clearUserInfoFromLocalStorage, getBaseUrl } from './Components/authUtils';

dayjs.locale('ko');

const CreateEvent = () => {
  const [eventName, setEventName] = useState('');
  const [startTime, setStartTime] = useState(null);
  const [endTime, setEndTime] = useState(null);
  const [selectedDates, setSelectedDates] = useState([]);
  const [uuid, setUuid] = useState('');
  const [userInfo, setUserInfo] = useState(null);

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

  const handleConfirm = () => {
    if (!uuid) { message.warning('UUID를 입력해주세요!'); return; }
    if (!userInfo) { console.error('로그인 정보가 없습니다.'); return; }

    axios.get(`/api/events/${uuid}`)
      .then(res => {
        if (res.data) {
          window.location.href = `${getBaseUrl()}/test/?key=${uuid}`;
        } else {
          message.warning('해당 UUID에 맞는 모임이 없습니다!');
        }
      })
      .catch(() => message.warning('해당 UUID에 맞는 모임이 없습니다!'));
  };

  const handleCreateEvent = () => {
    if (selectedDates.length < 2) { console.error('날짜를 선택해주세요'); return; }

    const startDay = selectedDates[0].format('YYYY-MM-DD');
    const endDay = selectedDates[1].format('YYYY-MM-DD');
    const startTimeStr = startTime.format('HH:mm');
    const endTimeStr = endTime.format('HH:mm');
    const eventUUID = uuidv4().substring(0, 8);

    if (!userInfo) { console.error('로그인 정보가 없습니다.'); return; }

    const kakaoId = userInfo.id.toString();
    const nickname = userInfo?.kakao_account?.profile?.nickname || '익명';
    const createDay = format(new Date(), 'yyyy-MM-dd HH:mm:ss');

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
    })
      .then(() => {
        window.location.href = `${getBaseUrl()}/test/?key=${eventUUID}`;
      })
      .catch(err => console.error('이벤트 생성 오류:', err));
  };

  return (
    <div className="App">
      <main className="main-content">
        <h1 style={{ textAlign: 'center' }}>🗓 모임을 새롭게 만들어보세요</h1>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

          <Card title="🗓 모임 일정의 이름과 날짜, 시간을 입력하세요 !" style={{ width: '100%', marginBottom: 20 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

              <Row justify="center" style={{ width: '100%', marginBottom: '20px' }}>
                <Col xs={24} sm={24} md={12} lg={12}>
                  <Form.Item name="eventName" rules={[{ required: true, message: '일정 이름을 입력해주세요' }]}>
                    <Input
                      onChange={e => setEventName(e.target.value)}
                      placeholder="일정 이름을 입력해주세요."
                      size="large"
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Row justify="center" style={{ width: '100%', marginBottom: '20px' }}>
                <Col xs={24} sm={24} md={12} lg={12}>
                  <DatePicker.RangePicker
                    style={{ width: '100%' }}
                    format="YYYY년 MM월 DD일"
                    onChange={dates => setSelectedDates(dates)}
                    placeholder={['시작 날짜', '종료 날짜']}
                    size="large"
                    disabledDate={current => current && current < dayjs().startOf('day')}
                  />
                </Col>
              </Row>

              <Row justify="center" style={{ width: '100%', marginBottom: '20px' }}>
                <Col xs={24} sm={24} md={12} lg={12}>
                  <TimePicker.RangePicker
                    style={{ width: '100%' }}
                    format="HH시 mm분"
                    onChange={times => { setStartTime(times[0]); setEndTime(times[1]); }}
                    placeholder={['시작 시간', '종료 시간']}
                    size="large"
                    minuteStep={60}
                  />
                </Col>
              </Row>

              <Form.Item style={{ width: '100%', textAlign: 'center' }}>
                <Button
                  type="primary"
                  onClick={handleCreateEvent}
                  disabled={!selectedDates.length || !startTime || !endTime || !eventName}
                  style={{ width: '100%', height: '45px', fontSize: '14px' }}
                >
                  일정 생성
                </Button>
              </Form.Item>
            </div>
          </Card>

          <Card title="UUID 입력 ❓ UUID는 모임 링크 key= 뒤에서 확인 가능해요 !" style={{ width: '100%' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <h3 style={{ textAlign: 'center' }}>UUID</h3>
              <Form.Item
                name="uuid"
                rules={[{ required: true, message: 'UUID를 입력해주세요' }]}
                style={{ width: '100%' }}
              >
                <Input.Search
                  onSearch={handleConfirm}
                  enterButton="확인"
                  style={{ height: '40px', width: '100%', marginBottom: '10px' }}
                  placeholder="UUID를 입력해주세요."
                  size="large"
                  value={uuid}
                  onChange={e => setUuid(e.target.value)}
                />
              </Form.Item>
            </div>
          </Card>
        </div>
      </main>

      <div>
        <h2>로그인 성공!</h2>
        {userInfo ? (
          <div><p>안녕하세요 {userInfo.kakao_account.profile.nickname}님!</p></div>
        ) : (
          <p>사용자 정보를 불러오는 중...</p>
        )}
      </div>
    </div>
  );
};

const App = () => (
  <ConfigProvider locale={koKR}>
    <CreateEvent />
  </ConfigProvider>
);

export default App;
