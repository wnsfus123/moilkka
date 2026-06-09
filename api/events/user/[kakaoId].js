const { supabase } = require('../../lib/supabase');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { kakaoId } = req.query;

  const { data: createdRaw, error: e1 } = await supabase
    .from('events')
    .select('*')
    .eq('kakao_id', kakaoId);
  if (e1) {
    console.error('[events/user] created 조회 오류:', e1.message);
    return res.status(500).json({ error: e1.message });
  }
  const created = createdRaw || [];

  const { data: schedulesRaw, error: e2 } = await supabase
    .from('schedules')
    .select('event_uuid')
    .eq('kakao_id', kakaoId);
  if (e2) {
    console.error('[events/user] schedules 조회 오류:', e2.message);
    return res.status(500).json({ error: e2.message });
  }
  const schedules = schedulesRaw || [];

  const participatedUuids = [...new Set(schedules.map(s => s.event_uuid))];
  let participated = [];
  if (participatedUuids.length > 0) {
    const { data, error: e3 } = await supabase
      .from('events')
      .select('*')
      .in('uuid', participatedUuids);
    if (e3) {
      console.error('[events/user] participated 조회 오류:', e3.message);
      return res.status(500).json({ error: e3.message });
    }
    participated = data || [];
  }

  const allEvents = [...created, ...participated];
  const unique = {};
  allEvents.forEach(e => { unique[e.uuid] = e; });

  // 프론트엔드 호환 필드 매핑
  const mapped = Object.values(unique).map(e => ({
    ...e,
    eventname: e.name,
    startday: e.start_at,
    endday: e.end_at,
    kakaoId: e.kakao_id,
  }));

  return res.status(200).json(mapped);
};
