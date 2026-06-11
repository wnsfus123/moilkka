const { supabase } = require('./lib/supabase');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { kakaoId, id } = req.query;

  // ── GET: 사용자의 시간표 조회 ─────────────────────────────
  if (req.method === 'GET') {
    if (!kakaoId) return res.status(400).json({ error: 'kakaoId 필요' });
    try {
      const { data, error } = await supabase
        .from('timetable')
        .select('*')
        .eq('kakao_id', String(kakaoId))
        .order('day_of_week')
        .order('start_time');
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json(data || []);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── POST: 항목 추가 ───────────────────────────────────────
  if (req.method === 'POST') {
    try {
      const { kakao_id, title, color, day_of_week, start_time, end_time, memo } = req.body;
      if (!kakao_id || !title || day_of_week == null || !start_time || !end_time) {
        return res.status(400).json({ error: '필수 값 누락' });
      }
      const { data, error } = await supabase
        .from('timetable')
        .insert([{
          kakao_id:    String(kakao_id),
          title,
          color:       color || '#FEE500',
          day_of_week: Number(day_of_week),
          start_time,
          end_time,
          memo:        memo || null,
        }])
        .select()
        .single();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json(data);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── PUT: 항목 수정 ────────────────────────────────────────
  if (req.method === 'PUT') {
    if (!id) return res.status(400).json({ error: 'id 필요' });
    try {
      const { kakao_id, title, color, day_of_week, start_time, end_time, memo } = req.body;
      const { data: existing } = await supabase
        .from('timetable').select('kakao_id').eq('id', id).single();
      if (!existing || String(existing.kakao_id) !== String(kakao_id)) {
        return res.status(403).json({ error: '권한이 없습니다.' });
      }
      const { data, error } = await supabase
        .from('timetable')
        .update({ title, color, day_of_week: Number(day_of_week), start_time, end_time, memo: memo || null })
        .eq('id', id)
        .select()
        .single();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json(data);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── DELETE: 항목 삭제 ─────────────────────────────────────
  if (req.method === 'DELETE') {
    if (!id) return res.status(400).json({ error: 'id 필요' });
    try {
      const { data: existing } = await supabase
        .from('timetable').select('kakao_id').eq('id', id).single();
      if (!existing || String(existing.kakao_id) !== String(kakaoId)) {
        return res.status(403).json({ error: '권한이 없습니다.' });
      }
      const { error } = await supabase.from('timetable').delete().eq('id', id);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
