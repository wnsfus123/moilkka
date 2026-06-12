import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { message } from 'antd';
import './PlaceSection.css';

const PlaceSection = ({ eventData, userInfo }) => {
  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const searchTimerRef = useRef(null);
  const dropdownRef = useRef(null);

  const kakaoId = userInfo?.id?.toString();
  const isCreator = eventData?.kakaoId?.toString() === kakaoId || eventData?.kakao_id?.toString() === kakaoId;
  const REST_API_KEY = process.env.REACT_APP_KAKAO_REST_API_KEY;
  const MAP_KEY = process.env.REACT_APP_KAKAO_MAP_KEY;

  // ── 장소 목록 조회 ──
  const fetchPlaces = useCallback(async () => {
    if (!eventData?.uuid) return;
    setLoading(true);
    try {
      const res = await axios.get(`/api/places?event_uuid=${eventData.uuid}`);
      setPlaces(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('[PlaceSection] 장소 조회 오류:', err);
    } finally {
      setLoading(false);
    }
  }, [eventData]);

  useEffect(() => { fetchPlaces(); }, [fetchPlaces]);

  // ── 카카오맵 SDK 로드 ──
  const initMap = useCallback(() => {
    if (!mapContainerRef.current || !window.kakao?.maps) return;
    try {
      const map = new window.kakao.maps.Map(mapContainerRef.current, {
        center: new window.kakao.maps.LatLng(37.5665, 126.9780),
        level: 5,
      });
      mapInstanceRef.current = map;
    } catch (e) {
      console.warn('[PlaceSection] 지도 초기화 실패:', e);
    }
  }, []);

  useEffect(() => {
    if (!MAP_KEY) return;
    if (window.kakao?.maps) { initMap(); return; }
    const script = document.createElement('script');
    script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${MAP_KEY}&autoload=false`;
    script.async = true;
    script.onload = () => {
      window.kakao.maps.load(() => initMap());
    };
    script.onerror = () => console.warn('[PlaceSection] 카카오맵 SDK 로드 실패 — Kakao Developers 콘솔에서 JavaScript 키와 사이트 도메인을 확인하세요. 현재 도메인:', window.location.origin);
    document.head.appendChild(script);
  }, [MAP_KEY, initMap]);

  // ── 마커 업데이트 ──
  useEffect(() => {
    if (!mapInstanceRef.current || !window.kakao?.maps) return;
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];

    const validPlaces = places.filter(p => p.lat && p.lng);
    validPlaces.forEach(p => {
      try {
        const marker = new window.kakao.maps.Marker({
          position: new window.kakao.maps.LatLng(p.lat, p.lng),
          map: mapInstanceRef.current,
        });
        const iw = new window.kakao.maps.InfoWindow({
          content: `<div style="padding:5px 9px;font-size:12px;font-weight:600;">${p.place_name}</div>`,
        });
        window.kakao.maps.event.addListener(marker, 'click', () => iw.open(mapInstanceRef.current, marker));
        markersRef.current.push(marker);
      } catch (e) {}
    });

    if (validPlaces.length > 0) {
      try {
        const bounds = new window.kakao.maps.LatLngBounds();
        validPlaces.forEach(p => bounds.extend(new window.kakao.maps.LatLng(p.lat, p.lng)));
        mapInstanceRef.current.setBounds(bounds);
      } catch (e) {}
    }
  }, [places]);

  // ── 외부 클릭 시 드롭다운 닫기 ──
  useEffect(() => {
    const handleOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  // ── 장소 검색 (디바운스) ──
  const handleSearchInput = (e) => {
    const q = e.target.value;
    setSearchQuery(q);
    clearTimeout(searchTimerRef.current);
    if (!q.trim()) { setSearchResults([]); setIsDropdownOpen(false); return; }
    searchTimerRef.current = setTimeout(() => doSearch(q), 400);
  };

  const doSearch = async (query) => {
    if (!query.trim() || !REST_API_KEY) return;
    setSearching(true);
    try {
      const res = await axios.get('https://dapi.kakao.com/v2/local/search/keyword.json', {
        params: { query, size: 5 },
        headers: { Authorization: `KakaoAK ${REST_API_KEY}` },
      });
      const docs = res.data.documents || [];
      setSearchResults(docs);
      setIsDropdownOpen(docs.length > 0);
    } catch (err) {
      console.error('[PlaceSection] 장소 검색 오류:', err);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  // ── 장소 추가 ──
  const handleSelectPlace = async (place) => {
    if (!kakaoId) { message.warning('로그인이 필요합니다.'); return; }
    const nickname = userInfo?.kakao_account?.profile?.nickname || userInfo?.properties?.nickname || '익명';
    try {
      const res = await axios.post('/api/places', {
        event_uuid: eventData.uuid,
        kakao_id: kakaoId,
        nickname,
        place_name: place.place_name,
        address: place.road_address_name || place.address_name || '',
        lat: parseFloat(place.y),
        lng: parseFloat(place.x),
        kakao_place_id: place.id,
      });
      setPlaces(prev => [...prev, res.data]);
      setSearchQuery('');
      setSearchResults([]);
      setIsDropdownOpen(false);
      message.success('장소가 추가됐어요!');
    } catch {
      message.error('장소 추가에 실패했습니다.');
    }
  };

  // ── 투표 토글 ──
  const handleVote = async (placeId, hasVoted) => {
    if (!kakaoId) { message.warning('로그인이 필요합니다.'); return; }
    try {
      if (hasVoted) {
        await axios.delete('/api/places/vote', { data: { place_id: placeId, kakao_id: kakaoId } });
        setPlaces(prev => prev.map(p => p.id === placeId
          ? { ...p, vote_count: p.vote_count - 1, voted_by: p.voted_by.filter(id => id !== kakaoId) }
          : p));
      } else {
        await axios.post('/api/places/vote', { place_id: placeId, kakao_id: kakaoId });
        setPlaces(prev => prev.map(p => p.id === placeId
          ? { ...p, vote_count: p.vote_count + 1, voted_by: [...(p.voted_by || []), kakaoId] }
          : p));
      }
    } catch {
      message.error('투표 처리에 실패했습니다.');
    }
  };

  // ── 장소 삭제 ──
  const handleDelete = async (placeId) => {
    try {
      await axios.delete(`/api/places/${placeId}`, {
        data: { kakao_id: kakaoId, event_uuid: eventData.uuid },
      });
      setPlaces(prev => prev.filter(p => p.id !== placeId));
      message.success('장소가 삭제됐어요.');
    } catch {
      message.error('삭제에 실패했습니다.');
    }
  };

  const maxVotes = Math.max(...places.map(p => p.vote_count || 0), 0);

  return (
    <div className="ps-root">

      {/* ── 검색창 ── */}
      <div className="ps-search-wrap" ref={dropdownRef}>
        <div className="ps-search-row">
          <input
            className="ps-search-input"
            type="text"
            placeholder="장소 검색 (예: 강남역 카페, 홍대 맛집)"
            value={searchQuery}
            onChange={handleSearchInput}
            onFocus={() => searchResults.length > 0 && setIsDropdownOpen(true)}
          />
          {searching && <span className="ps-search-spinner" />}
        </div>
        {isDropdownOpen && searchResults.length > 0 && (
          <div className="ps-dropdown">
            {searchResults.map(place => (
              <button
                key={place.id}
                className="ps-dropdown-item"
                onMouseDown={() => handleSelectPlace(place)}
              >
                <span className="ps-di-name">{place.place_name}</span>
                <span className="ps-di-category">{place.category_group_name}</span>
                <span className="ps-di-addr">{place.road_address_name || place.address_name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── 지도 ── */}
      {MAP_KEY && (
        <div ref={mapContainerRef} className="ps-map" />
      )}

      {/* ── 장소 목록 ── */}
      {loading ? (
        <div className="ps-loading"><div className="ps-spinner" /><span>불러오는 중...</span></div>
      ) : places.length === 0 ? (
        <div className="ps-empty">
          <span className="ps-empty-icon">📍</span>
          <p>아직 등록된 장소가 없어요</p>
          <span className="ps-empty-sub">위 검색창에서 장소를 추가해보세요</span>
        </div>
      ) : (
        <div className="ps-list">
          {places.map(place => {
            const hasVoted = (place.voted_by || []).includes(kakaoId);
            const isTop = maxVotes > 0 && place.vote_count === maxVotes;
            const canDelete = String(place.kakao_id) === kakaoId || isCreator;
            return (
              <div key={place.id} className={`ps-card${isTop ? ' ps-top' : ''}`}>
                <div className="ps-card-top">
                  <div className="ps-card-name-row">
                    {isTop && <span className="ps-trophy">🏆</span>}
                    <span className="ps-card-name">{place.place_name}</span>
                  </div>
                  {canDelete && (
                    <button className="ps-del-btn" onClick={() => handleDelete(place.id)} title="삭제">×</button>
                  )}
                </div>
                {place.address && (
                  <div className="ps-card-addr">{place.address}</div>
                )}
                <div className="ps-card-actions">
                  <a
                    className="ps-map-link"
                    href={`https://map.kakao.com/link/map/${encodeURIComponent(place.place_name)},${place.lat},${place.lng}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    🗺 지도 보기
                  </a>
                  <button
                    className={`ps-vote-btn${hasVoted ? ' voted' : ''}`}
                    onClick={() => handleVote(place.id, hasVoted)}
                  >
                    ❤️ {place.vote_count || 0}명
                  </button>
                </div>
                <div className="ps-card-by">{place.nickname}님이 추가</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PlaceSection;
