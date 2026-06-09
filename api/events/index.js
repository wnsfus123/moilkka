const { supabase } = require('../lib/supabase');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { uuid, eventName, startDay, endDay, startTime, endTime, kakaoId, nickname } = req.body;

  const start_at = `${startDay}T${startTime}:00+09:00`;
  const end_at = `${endDay}T${endTime}:00+09:00`;

  const { error } = await supabase.from('events').insert({
    uuid,
    name: eventName,
    start_at,
    end_at,
    kakao_id: kakaoId,
    nickname,
  });

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ success: true });
};
