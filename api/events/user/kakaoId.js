const { supabase } = require('../../lib/supabase');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { kakaoId } = req.query;
  if (!kakaoId) return res.status(400).json({ error: 'kakaoId가 필요합니다.' });

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

  const mapped = Object.values(unique).map(e => ({
    ...e,
    eventname: e.name,
    startday: e.start_at ?? e.startday ?? null,
    endday: e.end_at ?? e.endday ?? null,
    kakaoId: e.kakao_id,
  }));

  console.log('[events/user] 날짜 형식 샘플:', JSON.stringify({
    start_at: mapped[0]?.startday ?? null,
    end_at: mapped[0]?.endday ?? null,
    count: mapped.length,
  }));
  return res.status(200).json(mapped);
};
