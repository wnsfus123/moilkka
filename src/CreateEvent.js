import React, { useEffect, useState } from 'react';
import { ConfigProvider, DatePicker, TimePicker, message } from 'antd';
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

const CreateEvent = () => {
  const [activeTab, setActiveTab] = useState('create');
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
          if (storedUserInfo) setUserInfo(storedUserInfo);
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
    if (selectedDates.length < 2) { message.warning('날짜를 선택해주세요'); return; }
    if (!startTime || !endTime) { message.warning('시간을 선택해주세요'); return; }
    if (!eventName.trim()) { message.warning('일정 이름을 입력해주세요'); return; }
    if (!userInfo) { console.error('로그인 정보가 없습니다.'); return; }

    const startDay = selectedDates[0].format('YYYY-MM-DD');
    const endDay = selectedDates[1].format('YYYY-MM-DD');
    const startTimeStr = startTime.format('HH:mm');
    const endTimeStr = endTime.format('HH:mm');
    const eventUUID = uuidv4().substring(0, 8);

    const kakaoId = userInfo.id.toString();
    const nickname =
      userInfo?.kakao_account?.profile?.nickname ||
      userInfo?.properties?.nickname ||
      '익명';
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
    <ConfigProvider locale={koKR}>
      <div className="create-event">
        <div className="ce-tabs">
          <button
            className={`ce-tab${activeTab === 'create' ? ' active' : ''}`}
            onClick={() => setActiveTab('create')}
          >
            새 모임 만들기
          </button>
          <button
            className={`ce-tab${activeTab === 'join' ? ' active' : ''}`}
            onClick={() => setActiveTab('join')}
          >
            코드로 참여하기
          </button>
        </div>

        {activeTab === 'create' ? (
          <div className="ce-panel">
            <div className="ce-field">
              <label className="ce-label">모임 이름</label>
              <input
                className="ce-input"
                placeholder="일정 이름을 입력해주세요"
                value={eventName}
                onChange={e => setEventName(e.target.value)}
              />
            </div>

            <div className="ce-field">
              <label className="ce-label">날짜 범위</label>
              <DatePicker.RangePicker
                style={{ width: '100%' }}
                format="YYYY년 MM월 DD일"
                onChange={dates => setSelectedDates(dates || [])}
                placeholder={['시작 날짜', '종료 날짜']}
                size="large"
                disabledDate={current => current && current < dayjs().startOf('day')}
              />
            </div>

            <div className="ce-field">
              <label className="ce-label">가능 시간 범위</label>
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
            </div>

            <button
              className="ce-btn-primary"
              onClick={handleCreateEvent}
              disabled={!selectedDates.length || !startTime || !endTime || !eventName.trim()}
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
                <button className="ce-btn-search" onClick={handleConfirm}>
                  참여하기
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ConfigProvider>
  );
};

export default CreateEvent;
