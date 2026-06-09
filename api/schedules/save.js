const { supabase } = require('../lib/supabase');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'POST') {
    const { kakaoId, nickname, event_uuid, event_datetime } = req.body;

    const { error } = await supabase.from('schedules').upsert({
      event_uuid,
      kakao_id: kakaoId,
      nickname,
      slot_time: event_datetime,
    }, { onConflict: 'event_uuid,kakao_id,slot_time' });

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  if (req.method === 'DELETE') {
    const { kakaoId, event_uuid } = req.body;

    const { error } = await supabase
      .from('schedules')
      .delete()
      .eq('event_uuid', event_uuid)
      .eq('kakao_id', kakaoId);

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
