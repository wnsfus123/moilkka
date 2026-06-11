const { supabase } = require('./lib/supabase');

function getTzOffset(timezone) {
  try {
    const parts = new Intl.DateTimeFormat('en', {
      timeZone: timezone,
      timeZoneName: 'shortOffset',
    }).formatToParts(new Date());
    const raw = parts.find(p => p.type === 'timeZoneName')?.value ?? 'GMT+0';
    const m = raw.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
    if (!m) return '+09:00';
    const sign = m[1];
    const h = String(parseInt(m[2], 10)).padStart(2, '0');
    const min = String(m[3] ? parseInt(m[3], 10) : 0).padStart(2, '0');
    return `${sign}${h}:${min}`;
  } catch {
    return '+09:00';
  }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { uuid, kakaoId: kakaoIdQuery } = req.query;

  // ── GET ──────────────────────────────────────────────────
  if (req.method === 'GET') {
    // 단건 조회
    if (uuid) {
      try {
        const { data, error } = await supabase
          .from('events')
          .select('*')
          .eq('uuid', uuid)
          .single();
        if (error) return res.status(404).json({ error: '이벤트를 찾을 수 없습니다.' });
        const startday = data.start_at ?? data.startday ?? null;
        const endday   = data.end_at   ?? data.endday   ?? null;
        console.log('[events] GET uuid 응답 startday:', startday, '/ endday:', endday);
        return res.status(200).json({ ...data, eventname: data.name, startday, endday, kakaoId: data.kakao_id });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    // 유저별 목록 조회
    if (kakaoIdQuery) {
      try {
        const { data: createdRaw, error: e1 } = await supabase
          .from('events')
          .select('*')
          .eq('kakao_id', kakaoIdQuery);
        if (e1) return res.status(500).json({ error: e1.message });

        const { data: schedulesRaw, error: e2 } = await supabase
          .from('schedules')
          .select('event_uuid')
          .eq('kakao_id', kakaoIdQuery);
        if (e2) return res.status(500).json({ error: e2.message });

        const participatedUuids = [...new Set((schedulesRaw || []).map(s => s.event_uuid))];
        let participated = [];
        if (participatedUuids.length > 0) {
          const { data, error: e3 } = await supabase
            .from('events')
            .select('*')
            .in('uuid', participatedUuids);
          if (e3) return res.status(500).json({ error: e3.message });
          participated = data || [];
        }

        const unique = {};
        [...(createdRaw || []), ...participated].forEach(e => { unique[e.uuid] = e; });
        const mapped = Object.values(unique).map(e => ({
          ...e,
          eventname: e.name,
          startday:  e.start_at ?? e.startday ?? null,
          endday:    e.end_at   ?? e.endday   ?? null,
          kakaoId:   e.kakao_id,
        }));
        return res.status(200).json(mapped);
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    return res.status(400).json({ error: 'uuid 또는 kakaoId 쿼리가 필요합니다.' });
  }

  // ── POST (이벤트 생성) ────────────────────────────────────
  if (req.method === 'POST') {
    try {
      const { uuid: bodyUuid, eventName, startDay, endDay, startTime, endTime,
              kakaoId, nickname, selectedDates, timezone, is_private } = req.body;

      const tz     = timezone || 'Asia/Seoul';
      const offset = getTzOffset(tz);
      const start_at = `${startDay}T${startTime}:00${offset}`;
      const end_at   = `${endDay}T${endTime}:00${offset}`;

      const insertData = {
        uuid:      bodyUuid,
        name:      eventName,
        start_at,
        end_at,
        kakao_id:  kakaoId,
        nickname,
        timezone:  tz,
      };
      if (Array.isArray(selectedDates) && selectedDates.length > 0) {
        insertData.selected_dates = selectedDates;
      }
      if (is_private !== undefined) insertData.is_private = Boolean(is_private);

      const { error } = await supabase.from('events').insert(insertData);
      if (error) {
        console.error('[events] POST Supabase insert 오류:', error.message);
        return res.status(500).json({ error: error.message });
      }
      return res.status(200).json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── DELETE ────────────────────────────────────────────────
  if (req.method === 'DELETE') {
    if (!uuid) return res.status(400).json({ error: 'uuid가 필요합니다.' });
    try {
      const { kakaoId } = req.body;

      const { data: event, error: findError } = await supabase
        .from('events')
        .select('kakao_id')
        .eq('uuid', uuid)
        .single();
      if (findError) return res.status(404).json({ error: '이벤트를 찾을 수 없습니다.' });

      if (event.kakao_id === kakaoId) {
        await supabase.from('schedules').delete().eq('event_uuid', uuid);
        const { error } = await supabase.from('events').delete().eq('uuid', uuid);
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ success: true, message: '이벤트가 삭제되었습니다.' });
      } else {
        const { error } = await supabase
          .from('schedules').delete().eq('event_uuid', uuid).eq('kakao_id', kakaoId);
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ success: true, message: '참여자 데이터가 삭제되었습니다.' });
      }
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── PATCH (확정 슬롯 저장) ────────────────────────────────
  if (req.method === 'PATCH') {
    if (!uuid) return res.status(400).json({ error: 'uuid가 필요합니다.' });
    try {
      const { confirmed_slots, kakaoId } = req.body;

      const { data: event, error: findError } = await supabase
        .from('events').select('kakao_id').eq('uuid', uuid).single();
      if (findError) return res.status(404).json({ error: '이벤트를 찾을 수 없습니다.' });
      if (event.kakao_id !== String(kakaoId)) return res.status(403).json({ error: '권한이 없습니다.' });

      const { error } = await supabase
        .from('events').update({ confirmed_slots: confirmed_slots || [] }).eq('uuid', uuid);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
