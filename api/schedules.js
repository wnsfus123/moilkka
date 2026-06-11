const { supabase } = require('./lib/supabase');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { uuid, kakaoId: kakaoIdQuery, details } = req.query;

  // ── GET ──────────────────────────────────────────────────
  if (req.method === 'GET') {
    if (!uuid) return res.status(400).json({ error: 'uuid가 필요합니다.' });

    try {
      // 상세 조회 (ExistingEvents 모달용)
      if (details === 'true') {
        const { data: event, error: e1 } = await supabase
          .from('events').select('*').eq('uuid', uuid).single();
        if (e1) return res.status(404).json({ error: '이벤트를 찾을 수 없습니다.' });

        const { data: schedules, error: e2 } = await supabase
          .from('schedules').select('kakao_id, nickname, slot_time').eq('event_uuid', uuid);
        if (e2) return res.status(500).json({ error: e2.message });

        const participants = (schedules || []).map(s => ({
          kakaoId: s.kakao_id,
          nickname: s.nickname,
          event_datetime: s.slot_time,
        }));
        return res.status(200).json({
          eventDetails: {
            ...event,
            eventname: event.name,
            startday:  event.start_at ?? event.startday ?? null,
            endday:    event.end_at   ?? event.endday   ?? null,
            kakaoId:   event.kakao_id,
          },
          participants,
          creator: { nickname: event.nickname },
        });
      }

      // 일반 일정 목록 조회
      const { data, error } = await supabase
        .from('schedules').select('*').eq('event_uuid', uuid);
      if (error) return res.status(500).json({ error: error.message });

      // 비공개 모드: kakaoId가 있고 방장이 아닌 참여자면 본인 것만 반환
      if (kakaoIdQuery) {
        const { data: event } = await supabase
          .from('events').select('kakao_id, is_private').eq('uuid', uuid).single();
        if (event?.is_private && String(event.kakao_id) !== String(kakaoIdQuery)) {
          const filtered = (data || []).filter(s => String(s.kakao_id) === String(kakaoIdQuery));
          return res.status(200).json(filtered.map(s => ({ ...s, kakaoId: s.kakao_id, event_datetime: s.slot_time })));
        }
      }

      return res.status(200).json((data || []).map(s => ({
        ...s,
        kakaoId: s.kakao_id,
        event_datetime: s.slot_time,
      })));
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── POST (일정 저장) ──────────────────────────────────────
  if (req.method === 'POST') {
    try {
      const { kakaoId, nickname, event_uuid, event_datetime } = req.body;
      const { error } = await supabase.from('schedules').upsert({
        event_uuid,
        kakao_id:  kakaoId,
        nickname,
        slot_time: event_datetime,
      }, { onConflict: 'event_uuid,kakao_id,slot_time' });
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── DELETE (일정 삭제) ────────────────────────────────────
  if (req.method === 'DELETE') {
    try {
      const { kakaoId, event_uuid } = req.body;
      const { error } = await supabase
        .from('schedules').delete().eq('event_uuid', event_uuid).eq('kakao_id', kakaoId);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
