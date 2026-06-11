const { supabase } = require('./lib/supabase');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // action / id 는 쿼리 파라미터로 판별 (vercel.json rewrite가 주입)
  const { action, id } = req.query;

  // ── GET: 장소 목록 ────────────────────────────────────────
  if (req.method === 'GET') {
    const { event_uuid } = req.query;
    if (!event_uuid) return res.status(400).json({ error: 'event_uuid 필요' });
    try {
      const { data: places, error } = await supabase
        .from('places').select('*').eq('event_uuid', event_uuid).order('created_at', { ascending: true });
      if (error) return res.status(500).json({ error: error.message });

      const placeIds = (places || []).map(p => p.id);
      let votes = [];
      if (placeIds.length > 0) {
        const { data: voteData } = await supabase
          .from('place_votes').select('place_id, kakao_id').in('place_id', placeIds);
        votes = voteData || [];
      }
      const result = (places || []).map(p => {
        const pVotes = votes.filter(v => v.place_id === p.id);
        return { ...p, vote_count: pVotes.length, voted_by: pVotes.map(v => v.kakao_id) };
      });
      return res.status(200).json(result);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── POST: 장소 추가(action=add 또는 없음) / 투표(action=vote) ──
  if (req.method === 'POST') {
    // 투표 추가
    if (action === 'vote') {
      try {
        const { place_id, kakao_id } = req.body;
        if (!place_id || !kakao_id) return res.status(400).json({ error: '필수 값 누락' });
        const { error } = await supabase
          .from('place_votes').insert([{ place_id, kakao_id: String(kakao_id) }]);
        if (error?.code === '23505') return res.status(409).json({ error: '이미 투표했습니다.' });
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ success: true });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    // 장소 추가 (action=add 또는 action 없음)
    try {
      const { event_uuid, kakao_id, nickname, place_name, address, lat, lng, kakao_place_id } = req.body;
      if (!event_uuid || !kakao_id || !place_name) return res.status(400).json({ error: '필수 값 누락' });
      const { data, error } = await supabase
        .from('places')
        .insert([{
          event_uuid,
          kakao_id:       String(kakao_id),
          nickname:       nickname || '익명',
          place_name,
          address:        address        || null,
          lat:            lat            || null,
          lng:            lng            || null,
          kakao_place_id: kakao_place_id || null,
        }])
        .select()
        .single();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ...data, vote_count: 0, voted_by: [] });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── DELETE: 투표 취소(action=vote) / 장소 삭제(id in query) ──
  if (req.method === 'DELETE') {
    // 투표 취소
    if (action === 'vote') {
      try {
        const { place_id, kakao_id } = req.body;
        if (!place_id || !kakao_id) return res.status(400).json({ error: '필수 값 누락' });
        const { error } = await supabase
          .from('place_votes').delete().eq('place_id', place_id).eq('kakao_id', String(kakao_id));
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ success: true });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    // 장소 삭제 (id는 rewrite로 쿼리에 주입됨)
    if (id) {
      try {
        const { kakao_id, event_uuid } = req.body;
        if (!kakao_id) return res.status(400).json({ error: '필수 값 누락' });

        const { data: place } = await supabase
          .from('places').select('kakao_id').eq('id', id).single();
        if (!place) return res.status(404).json({ error: '장소를 찾을 수 없습니다.' });

        let canDelete = String(place.kakao_id) === String(kakao_id);
        if (!canDelete && event_uuid) {
          const { data: event } = await supabase
            .from('events').select('kakao_id').eq('uuid', event_uuid).single();
          if (event && String(event.kakao_id) === String(kakao_id)) canDelete = true;
        }
        if (!canDelete) return res.status(403).json({ error: '권한이 없습니다.' });

        const { error } = await supabase.from('places').delete().eq('id', id);
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ success: true });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    return res.status(400).json({ error: 'action 또는 id가 필요합니다.' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
