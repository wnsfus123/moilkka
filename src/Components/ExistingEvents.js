import React, { useState, useEffect, useCallback } from 'react';
import { message } from 'antd';
import axios from 'axios';
import { format, differenceInDays } from 'date-fns';
import { ko } from 'date-fns/locale';
import { getBaseUrl } from './authUtils';
import EmptyState from './EmptyState';
import './ExistingEvents.css';

const STATUS_LABEL = { pending: '대기중', confirmed: '확정', cancelled: '취소' };
const STATUS_CLASS  = { pending: 'badge-pending', confirmed: 'badge-confirmed', cancelled: 'badge-cancelled' };

const ExistingEvents = ({ userInfo }) => {
  const [eeTab, setEeTab] = useState('events');

  // 모임 목록
  const [existingEvents, setExistingEvents] = useState([]);
  const [selectedEventDetails, setSelectedEventDetails] = useState(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [deleteConfirmationVisible, setDeleteConfirmationVisible] = useState(false);
  const [eventToDelete, setEventToDelete] = useState(null);
  const [showDeleteButtons, setShowDeleteButtons] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [loadingList, setLoadingList] = useState(false);

  // 예약 목록
  const [mannalkaPages, setMannalkaPages] = useState([]);
  const [myBookings,    setMyBookings]    = useState([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [showPast, setShowPast] = useState(false);

  useEffect(() => {
    if (userInfo) {
      setLoadingList(true);
      fetchExistingEvents(userInfo.id.toString());
    }
  }, [userInfo]);

  const fetchMannalkaData = useCallback(async (kakaoId) => {
    setLoadingBookings(true);
    try {
      const [pagesRes, bookingsRes] = await Promise.all([
        axios.get(`/api/mannalka?action=list&kakaoId=${kakaoId}`),
        axios.get(`/api/mannalka?action=mybookings&kakaoId=${kakaoId}`),
      ]);
      setMannalkaPages(Array.isArray(pagesRes.data) ? pagesRes.data : []);
      setMyBookings(Array.isArray(bookingsRes.data) ? bookingsRes.data : []);
    } catch (err) {
      console.error('[ExistingEvents] 예약 데이터 오류:', err);
    } finally {
      setLoadingBookings(false);
    }
  }, []);

  useEffect(() => {
    if (eeTab === 'bookings' && userInfo) {
      fetchMannalkaData(userInfo.id.toString());
    }
  }, [eeTab, userInfo, fetchMannalkaData]);

  const fetchExistingEvents = (kakaoId) => {
    console.log('[ExistingEvents] 이벤트 목록 조회 kakaoId:', kakaoId);
    axios.get(`/api/events/user/${kakaoId}`)
      .then(res => {
        console.log('[ExistingEvents] 응답:', JSON.stringify(res.data));
        const events = Array.isArray(res.data) ? res.data : [];
        setExistingEvents(events);
      })
      .catch(err => console.error('[ExistingEvents] API 오류:', err.response?.status, err.response?.data || err.message))
      .finally(() => setLoadingList(false));
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

  const formatFull = (dateString) => {
    if (!dateString) return '-';
    try {
      const d = new Date(typeof dateString === 'string' ? dateString.replace(' ', 'T') : dateString);
      if (isNaN(d.getTime())) return String(dateString);
      return format(d, 'yyyy.MM.dd(EEE)', { locale: ko });
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

  const handleCopyEventLink = (uuid) => {
    const link = `${getBaseUrl()}/meet/?key=${uuid}`;
    navigator.clipboard.writeText(link)
      .then(() => message.success('링크가 복사되었습니다!'))
      .catch(() => message.error('복사에 실패했습니다.'));
  };

  const getUniqueParticipants = (participants) => {
    const seen = new Map();
    participants.forEach(p => {
      if (!seen.has(p.nickname)) {
        seen.set(p.nickname, { ...p, slots: [p.event_datetime].filter(Boolean) });
      } else {
        seen.get(p.nickname).slots.push(p.event_datetime);
      }
    });
    return [...seen.values()];
  };

  const copyBookingLink = (uuid) => {
    const url = `${getBaseUrl()}/book/${uuid}`;
    navigator.clipboard.writeText(url)
      .then(() => message.success('링크가 복사됐어요!'))
      .catch(() => message.error('복사에 실패했어요'));
  };

  return (
    <div className="existing-events">
      {/* 상단 탭 */}
      <div className="ee-tab-row">
        <div className="ee-tabs">
          <button className={`ee-tab${eeTab === 'events' ? ' active' : ''}`} onClick={() => setEeTab('events')}>
            📅 모임 목록
          </button>
          <button className={`ee-tab${eeTab === 'bookings' ? ' active' : ''}`} onClick={() => setEeTab('bookings')}>
            📌 예약 목록
          </button>
        </div>
        {eeTab === 'events' && (
          <button
            className={`ee-delete-toggle${showDeleteButtons ? ' active' : ''}`}
            onClick={() => setShowDeleteButtons(v => !v)}
          >
            {showDeleteButtons ? '취소' : '삭제'}
          </button>
        )}
      </div>

      {/* ── 모임 목록 탭 ── */}
      {eeTab === 'events' && (
        <>
      {loadingList ? (
        <div className="ee-loading">
          <div className="ee-spinner" />
          <p>모임 목록을 불러오는 중...</p>
        </div>
      ) : existingEvents.length === 0 ? (
        <EmptyState
          icon="📭"
          title="아직 모임이 없어요"
          description="새 모임을 만들거나 코드로 참여해보세요"
        />
      ) : (() => {
        const todayMidnight = new Date(); todayMidnight.setHours(0,0,0,0);
        const isPastEvent = (ev) => {
          if (!ev.endday) return false;
          const d = new Date(ev.endday.replace ? ev.endday.replace(' ', 'T') : ev.endday);
          return !isNaN(d) && d < todayMidnight;
        };
        const upcoming = existingEvents.filter(e => !isPastEvent(e));
        const past = existingEvents.filter(e => isPastEvent(e));
        const renderCard = (event) => {
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
                  {event.is_private && (
                    <span className="badge badge-private">🔒 비공개</span>
                  )}
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
                  href={`${getBaseUrl()}/meet/?key=${event.uuid}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  모임 바로가기
                </a>
              </div>
            </div>
          );
        };
        return (
          <>
            {upcoming.length > 0 ? (
              <div className="ee-list">{upcoming.map(renderCard)}</div>
            ) : (
              <EmptyState icon="📭" title="진행 중인 모임이 없어요" description="새 모임을 만들어보세요" />
            )}
            {past.length > 0 && (
              <div className="ee-past-section">
                <button
                  className="ee-past-toggle"
                  onClick={() => setShowPast(v => !v)}
                >
                  {showPast ? '▾' : '▸'} 지난 모임 {past.length}개
                </button>
                {showPast && (
                  <div className="ee-list ee-list-past">{past.map(renderCard)}</div>
                )}
              </div>
            )}
          </>
        );
      })()}
        </>
      )}

      {/* ── 예약 목록 탭 ── */}
      {eeTab === 'bookings' && (
        <>
          {loadingBookings ? (
            <div className="ee-loading"><div className="ee-spinner" /><p>예약 목록을 불러오는 중...</p></div>
          ) : (
            <>
              {/* 내 예약 페이지 (호스트) */}
              <div className="ee-section-label">내 예약 페이지</div>
              {mannalkaPages.length === 0 ? (
                <EmptyState icon="📌" title="만날까 페이지가 없어요" description="예약 링크를 만들어보세요" />
              ) : (
                <div className="ee-list">
                  {mannalkaPages.map(page => (
                    <div key={page.uuid} className="ee-card">
                      <div className="ee-card-header">
                        <div className="ee-badges">
                          {page.pending_count > 0 && (
                            <span className="badge badge-pending">대기 {page.pending_count}건</span>
                          )}
                          {page.confirmed_count > 0 && (
                            <span className="badge badge-confirmed">확정 {page.confirmed_count}건</span>
                          )}
                        </div>
                      </div>
                      <div className="ee-card-name">{page.title}</div>
                      {page.description && <div className="ee-card-date">{page.description}</div>}
                      <div className="ee-card-actions">
                        <button className="ee-btn-outline" onClick={() => copyBookingLink(page.uuid)}>
                          🔗 링크 복사
                        </button>
                        <a className="ee-btn-primary" href={`/mannalka/manage/${page.uuid}`}>
                          관리하기
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 내가 신청한 예약 (게스트) */}
              <div className="ee-section-label" style={{ marginTop: 20 }}>내가 신청한 예약</div>
              {myBookings.length === 0 ? (
                <EmptyState icon="📋" title="신청한 예약이 없어요" description="만날까 링크로 예약을 신청해보세요" />
              ) : (
                <div className="ee-list">
                  {myBookings.map(bk => {
                    const pageTitle = bk.booking_pages?.title || bk.page_uuid;
                    const bookedDate = bk.booked_at ? new Date(bk.booked_at) : null;
                    return (
                      <div key={bk.id} className="ee-card">
                        <div className="ee-card-header">
                          <span className={`badge ${STATUS_CLASS[bk.status] || 'badge-participant'}`}>
                            {STATUS_LABEL[bk.status] || bk.status}
                          </span>
                        </div>
                        <div className="ee-card-name">{pageTitle}</div>
                        {bookedDate && (
                          <div className="ee-card-date">
                            {format(bookedDate, 'M월 d일 (EEE) HH:mm', { locale: ko })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </>
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
          <div className="modal-box detail-modal-box" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={closeModal}>✕</button>

            {loadingDetail ? (
              <p className="modal-loading">불러오는 중...</p>
            ) : selectedEventDetails ? (() => {
              const uniqueParticipants = getUniqueParticipants(selectedEventDetails.participants);
              const dday = getDDay(selectedEventDetails.startday);
              return (
                <>
                  {/* 헤더 */}
                  <div className="detail-header">
                    <div className="detail-title-row">
                      <h3 className="detail-event-name">{selectedEventDetails.eventname}</h3>
                      {dday && (
                        <span className={`badge badge-dday${dday === 'D-Day' ? ' today' : dday.startsWith('D+') ? ' past' : ''}`}>
                          {dday}
                        </span>
                      )}
                    </div>
                    <p className="detail-creator">주최자: {selectedEventDetails.creator.nickname}</p>
                  </div>

                  {/* 빠른 액션 */}
                  <div className="detail-quick-actions">
                    <a
                      className="detail-action-btn primary"
                      href={`${getBaseUrl()}/meet/?key=${selectedEventDetails.uuid}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      🗓 모임 바로가기
                    </a>
                    <button
                      className="detail-action-btn secondary"
                      onClick={() => handleCopyEventLink(selectedEventDetails.uuid)}
                    >
                      🔗 링크 복사
                    </button>
                  </div>

                  {/* 일정 정보 그리드 */}
                  <div className="detail-info-grid">
                    <div className="detail-info-cell">
                      <span className="detail-info-label">시작일</span>
                      <span className="detail-info-value">{formatFull(selectedEventDetails.startday)}</span>
                    </div>
                    <div className="detail-info-cell">
                      <span className="detail-info-label">종료일</span>
                      <span className="detail-info-value">{formatFull(selectedEventDetails.endday)}</span>
                    </div>
                  </div>

                  {/* UUID */}
                  <div className="detail-uuid-row">
                    <span className="detail-info-label">UUID</span>
                    <code className="detail-uuid-code">{selectedEventDetails.uuid}</code>
                    <button
                      className="uuid-copy-btn"
                      onClick={() => {
                        navigator.clipboard.writeText(selectedEventDetails.uuid)
                          .then(() => message.success('UUID 복사됨'))
                          .catch(() => {});
                      }}
                    >
                      복사
                    </button>
                  </div>

                  {/* 참여자 */}
                  <div className="detail-participants-section">
                    <div className="detail-participants-header">
                      <span className="detail-info-label">일정 등록 현황</span>
                      <span className="detail-participants-count">
                        {uniqueParticipants.length}명 등록 완료
                      </span>
                    </div>
                    {uniqueParticipants.length > 0 ? (
                      <div className="participant-chips">
                        {uniqueParticipants.map((p, i) => (
                          <div key={i} className="participant-chip">
                            <span className="chip-avatar">{p.nickname.charAt(0)}</span>
                            <div className="chip-info">
                              <span className="chip-name">{p.nickname}</span>
                              <span className="chip-slots">{p.slots.length}개 슬롯</span>
                            </div>
                            <span className="chip-check">✓</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="no-participants">아직 일정을 등록한 참여자가 없습니다.</p>
                    )}
                  </div>

                  <div className="modal-actions">
                    <button className="modal-btn-primary" onClick={closeModal}>닫기</button>
                  </div>
                </>
              );
            })() : null}
          </div>
        </div>
      )}
    </div>
  );
};

export default ExistingEvents;
