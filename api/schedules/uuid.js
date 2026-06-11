const { supabase } = require('../lib/supabase');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { uuid, kakaoId } = req.query;

  const { data, error } = await supabase
    .from('schedules')
    .select('*')
    .eq('event_uuid', uuid);

  if (error) {
    console.error('[schedules/uuid] Supabase 오류:', error.message);
    return res.status(500).json({ error: error.message });
  }

  // 비공개 모드: 방장이 아닌 참여자는 본인 일정만 확인 가능
  if (kakaoId) {
    const { data: event } = await supabase
      .from('events')
      .select('kakao_id, is_private')
      .eq('uuid', uuid)
      .single();

    if (event?.is_private && String(event.kakao_id) !== String(kakaoId)) {
      const filtered = (data || []).filter(s => String(s.kakao_id) === String(kakaoId));
      return res.status(200).json(filtered.map(s => ({ ...s, kakaoId: s.kakao_id, event_datetime: s.slot_time })));
    }
  }

  const mapped = (data || []).map(s => ({
    ...s,
    kakaoId: s.kakao_id,
    event_datetime: s.slot_time,
  }));

  return res.status(200).json(mapped);
};
