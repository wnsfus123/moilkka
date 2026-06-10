import React, { useState, useEffect } from 'react';
import { message } from 'antd';
import axios from 'axios';
import { format, differenceInDays } from 'date-fns';
import { ko } from 'date-fns/locale';
import { getBaseUrl } from './authUtils';
import './ExistingEvents.css';

const ExistingEvents = ({ userInfo }) => {
  const [existingEvents, setExistingEvents] = useState([]);
  const [selectedEventDetails, setSelectedEventDetails] = useState(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [deleteConfirmationVisible, setDeleteConfirmationVisible] = useState(false);
  const [eventToDelete, setEventToDelete] = useState(null);
  const [showDeleteButtons, setShowDeleteButtons] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    if (userInfo) fetchExistingEvents(userInfo.id.toString());
  }, [userInfo]);

  const fetchExistingEvents = (kakaoId) => {
    console.log('[ExistingEvents] 이벤트 목록 조회 kakaoId:', kakaoId);
    axios.get(`/api/events/user/${kakaoId}`)
      .then(res => {
        console.log('[ExistingEvents] 응답:', JSON.stringify(res.data));
        const events = Array.isArray(res.data) ? res.data : [];
        setExistingEvents(events);
      })
      .catch(err => console.error('[ExistingEvents] API 오류:', err.response?.status, err.response?.data || err.message));
  };

  const showEventDetails = (uuid) => {
    setIsModalVisible(true);
    setLoadingDetail(true);
    axios.get(`/api/schedules/details/${uuid}`)
      .then(res => {
        const { eventDetails, participants, creator } = res.data;
        const safeParticipants = Array.isArray(participants) ? participants : [];
        setSelectedEventDetails({
          ...eventDetails,
          participants: safeParticipants,
          creator: creator || { nickname: '알 수 없음' },
        });
        setLoadingDetail(false);
      })
      .catch(err => {
        console.error('이벤트 상세 조회 오류:', err);
        setIsModalVisible(false);
        setLoadingDetail(false);
      });
  };

  const closeModal = () => {
    setIsModalVisible(false);
    setSelectedEventDetails(null);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    try {
      const d = new Date(typeof dateString === 'string' ? dateString.replace(' ', 'T') : dateString);
      if (isNaN(d.getTime())) return String(dateString);
      return format(d, 'MM.dd(EEE)', { locale: ko });
    } catch { return String(dateString) || '-'; }
  };

  const getDDay = (startday) => {
    if (!startday) return null;
    try {
      const d = new Date(typeof startday === 'string' ? startday.replace(' ', 'T') : startday);
      if (isNaN(d.getTime())) return null;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      d.setHours(0, 0, 0, 0);
      const diff = differenceInDays(d, today);
      if (diff === 0) return 'D-Day';
      if (diff > 0) return `D-${diff}`;
      return `D+${Math.abs(diff)}`;
    } catch { return null; }
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

  const isCreator = (event) =>
    event.kakao_id?.toString() === userInfo?.id?.toString();

  return (
    <div className="existing-events">
      <div className="ee-header">
        <h2 className="ee-title">내 모임 목록</h2>
        <button
          className={`ee-delete-toggle${showDeleteButtons ? ' active' : ''}`}
          onClick={() => setShowDeleteButtons(v => !v)}
        >
          {showDeleteButtons ? '취소' : '삭제'}
        </button>
      </div>

      {existingEvents.length === 0 ? (
        <div className="ee-empty">
          <p>참여한 모임이 없습니다.</p>
        </div>
      ) : (
        <div className="ee-list">
          {existingEvents.map(event => {
            const dday = getDDay(event.startday);
            const creator = isCreator(event);
            return (
              <div key={event.uuid} className="ee-card">
                <div className="ee-card-header">
                  <div className="ee-badges">
                    {creator
                      ? <span className="badge badge-creator">주최자</span>
                      : <span className="badge badge-participant">참여자</span>
                    }
                    {dday && (
                      <span className={`badge badge-dday${dday === 'D-Day' ? ' today' : dday.startsWith('D+') ? ' past' : ''}`}>
                        {dday}
                      </span>
                    )}
                  </div>
                  {showDeleteButtons && (
                    <button
                      className="ee-delete-btn"
                      onClick={() => confirmDeleteEvent(event.uuid)}
                    >
                      ✕
                    </button>
                  )}
                </div>

                <div className="ee-card-name">{event.eventname}</div>
                <div className="ee-card-date">
                  {formatDate(event.startday)} ~ {formatDate(event.endday)}
                </div>

                <div className="ee-card-actions">
                  <button className="ee-btn-outline" onClick={() => showEventDetails(event.uuid)}>
                    상세보기
                  </button>
                  <a
                    className="ee-btn-primary"
                    href={`${getBaseUrl()}/test/?key=${event.uuid}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    모임 바로가기
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete confirm modal */}
      {deleteConfirmationVisible && (
        <div className="modal-overlay" onClick={() => setDeleteConfirmationVisible(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">모임 삭제</h3>
            <p className="modal-body">
              정말로 삭제하시겠습니까?<br />
              모임 생성자라면 모임 자체가 사라져요!
            </p>
            <div className="modal-actions">
              <button className="modal-btn-cancel" onClick={() => setDeleteConfirmationVisible(false)}>
                취소
              </button>
              <button className="modal-btn-danger" onClick={handleDeleteEvent}>
                삭제
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail modal */}
      {isModalVisible && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">일정 세부정보</h3>
            <button className="modal-close" onClick={closeModal}>✕</button>
            {loadingDetail ? (
              <p className="modal-loading">불러오는 중...</p>
            ) : selectedEventDetails ? (
              <div className="modal-detail">
                <div className="detail-row">
                  <span className="detail-label">생성자</span>
                  <span>{selectedEventDetails.creator.nickname}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">일정 이름</span>
                  <span>{selectedEventDetails.eventname}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">시작</span>
                  <span>{formatDate(selectedEventDetails.startday)}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">종료</span>
                  <span>{formatDate(selectedEventDetails.endday)}</span>
                </div>
                <div className="detail-participants">
                  <span className="detail-label">
                    참여자 ({selectedEventDetails.participants.length}명)
                  </span>
                  {selectedEventDetails.participants.length > 0 ? (
                    <ul className="participant-list">
                      {selectedEventDetails.participants.map((p, i) => (
                        <li key={i} className="participant-item">
                          <span className="participant-name">{p.nickname}</span>
                          <span className="participant-time">{formatDate(p.event_datetime)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="no-participants">참여자가 없습니다.</p>
                  )}
                </div>
              </div>
            ) : null}
            <div className="modal-actions">
              <button className="modal-btn-primary" onClick={closeModal}>확인</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExistingEvents;
