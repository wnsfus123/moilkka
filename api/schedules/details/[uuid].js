const { supabase } = require('../../lib/supabase');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { uuid } = req.query;

  const { data: event, error: e1 } = await supabase
    .from('events')
    .select('*')
    .eq('uuid', uuid)
    .single();

  if (e1) return res.status(404).json({ error: '이벤트를 찾을 수 없습니다.' });

  const { data: schedules, error: e2 } = await supabase
    .from('schedules')
    .select('kakao_id, nickname, slot_time')
    .eq('event_uuid', uuid);

  if (e2) return res.status(500).json({ error: e2.message });

  const participants = schedules.map(s => ({
    kakaoId: s.kakao_id,
    nickname: s.nickname,
    event_datetime: s.slot_time,
  }));

  return res.status(200).json({
    eventDetails: {
      ...event,
      eventname: event.name,
      startday: event.start_at,
      endday: event.end_at,
      kakaoId: event.kakao_id,
    },
    participants,
    creator: { nickname: event.nickname },
  });
};
