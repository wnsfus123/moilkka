import React, { useState, useEffect } from 'react';
import { Modal, List, Card, Button, message } from 'antd';
import axios from 'axios';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { getBaseUrl } from './authUtils';

const ExistingEvents = ({ userInfo }) => {
  const [existingEvents, setExistingEvents] = useState([]);
  const [selectedEventDetails, setSelectedEventDetails] = useState(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [deleteConfirmationVisible, setDeleteConfirmationVisible] = useState(false);
  const [eventToDelete, setEventToDelete] = useState(null);
  const [showDeleteButtons, setShowDeleteButtons] = useState(false);

  useEffect(() => {
    if (userInfo) fetchExistingEvents(userInfo.id.toString());
  }, [userInfo]);

  const fetchExistingEvents = (kakaoId) => {
    axios.get(`/api/events/user/${kakaoId}`)
      .then(res => {
        const events = Array.isArray(res.data) ? res.data : [];
        if (events[0]) console.log('[ExistingEvents] 날짜 형식 샘플:', { startday: events[0].startday, endday: events[0].endday });
        setExistingEvents(events);
      })
      .catch(err => console.error('이벤트 목록 조회 오류:', err));
  };

  const showEventDetails = (uuid) => {
    setIsModalVisible(true);
    axios.get(`/api/schedules/details/${uuid}`)
      .then(res => {
        const { eventDetails, participants, creator } = res.data;
        setSelectedEventDetails({
          ...eventDetails,
          participants: participants.length > 0 ? participants : [],
          creator: creator || { nickname: '알 수 없음' },
        });
      })
      .catch(err => {
        console.error('이벤트 상세 조회 오류:', err);
        setIsModalVisible(false);
      });
  };

  const closeModal = () => {
    setIsModalVisible(false);
    setSelectedEventDetails(null);
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return '-';
    try {
      const d = new Date(dateString);
      if (isNaN(d.getTime())) return String(dateString);
      return format(d, 'yyyy년 MM월 dd일 HH시', { locale: ko });
    } catch {
      return String(dateString) || '-';
    }
  };

  const confirmDeleteEvent = (uuid) => {
    setEventToDelete(uuid);
    setDeleteConfirmationVisible(true);
  };

  const handleDeleteEvent = () => {
    axios.delete(`/api/events/${eventToDelete}`, {
      data: { kakaoId: userInfo.id.toString() },
    })
      .then(() => {
        message.success('일정이 성공적으로 삭제되었습니다.');
        setExistingEvents(existingEvents.filter(e => e.uuid !== eventToDelete));
        setDeleteConfirmationVisible(false);
        setEventToDelete(null);
      })
      .catch(err => {
        console.error('일정 삭제 오류:', err);
        message.error('일정 삭제 중 오류가 발생했습니다.');
      });
  };

  const toggleDeleteButtons = () => setShowDeleteButtons(!showDeleteButtons);

  return (
    <div>
      <h2>👨‍👩‍👧‍👦 현재 일정을 등록한 모임 목록</h2>
      <Button color="danger" variant="solid" onClick={toggleDeleteButtons} style={{ marginBottom: 16 }}>
        {showDeleteButtons ? '삭제 취소' : '💥 일정 삭제'}
      </Button>
      <List
        grid={{ gutter: 16, xs: 1, sm: 1, md: 1, lg: 2, xl: 2 }}
        dataSource={existingEvents}
        renderItem={(event) => (
          <List.Item>
            <Card
              title={event.eventname}
              extra={
                showDeleteButtons ? (
                  <Button type="text" onClick={() => confirmDeleteEvent(event.uuid)} style={{ color: 'red' }}>
                    X
                  </Button>
                ) : null
              }
              style={{ width: '100%', minHeight: '150px', fontSize: '14px' }}
            >
              <p>{formatDateTime(event.startday)} ~ {formatDateTime(event.endday)}</p>
              <Button onClick={() => showEventDetails(event.uuid)}>상세보기</Button>
              <Button
                type="primary"
                style={{ marginLeft: 10 }}
                href={`${getBaseUrl()}/test/?key=${event.uuid}`}
                target="_blank"
              >
                모임 바로가기
              </Button>
            </Card>
          </List.Item>
        )}
        style={{ maxHeight: 'calc(150px * 6)', overflowY: 'auto', overflowX: 'hidden' }}
      />

      <Modal
        title="모임 삭제 확인"
        open={deleteConfirmationVisible}
        onOk={handleDeleteEvent}
        onCancel={() => setDeleteConfirmationVisible(false)}
        okText="확인"
        cancelText="취소"
      >
        <p>정말로 삭제하시겠습니까? 모임 생성자라면 모임 자체가 사라져요!</p>
      </Modal>

      <Modal
        title="일정 세부정보"
        open={isModalVisible}
        onOk={closeModal}
        onCancel={closeModal}
        okText="확인"
        cancelText="취소"
      >
        {selectedEventDetails ? (
          <div>
            <p><strong>생성자:</strong> {selectedEventDetails.creator.nickname}</p>
            <p><strong>일정 이름:</strong> {selectedEventDetails.eventname}</p>
            <p><strong>시작일:</strong> {formatDateTime(selectedEventDetails.startday)}</p>
            <p><strong>종료일:</strong> {formatDateTime(selectedEventDetails.endday)}</p>
            <p><strong>참여자:</strong></p>
            <ul>
              {selectedEventDetails.participants.length > 0 ? (
                selectedEventDetails.participants.map((p, i) => (
                  <li key={i}>
                    {p.nickname} - {formatDateTime(p.event_datetime)}
                  </li>
                ))
              ) : (
                <li>참여자가 없습니다.</li>
              )}
            </ul>
          </div>
        ) : (
          <p>이벤트 세부 정보를 불러오는 중입니다...</p>
        )}
      </Modal>
    </div>
  );
};

export default ExistingEvents;
