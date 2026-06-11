const { supabase } = require('../lib/supabase');

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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { uuid, eventName, startDay, endDay, startTime, endTime, kakaoId, nickname, selectedDates, timezone, is_private } = req.body;

  const tz = timezone || 'Asia/Seoul';
  const offset = getTzOffset(tz);
  const start_at = `${startDay}T${startTime}:00${offset}`;
  const end_at = `${endDay}T${endTime}:00${offset}`;

  const insertData = {
    uuid,
    name: eventName,
    start_at,
    end_at,
    kakao_id: kakaoId,
    nickname,
    timezone: tz,
  };
  if (Array.isArray(selectedDates) && selectedDates.length > 0) {
    insertData.selected_dates = selectedDates;
  }
  if (is_private !== undefined) insertData.is_private = Boolean(is_private);

  const { error } = await supabase.from('events').insert(insertData);

  if (error) {
    console.error('[events/index] Supabase insert 오류:', error.message, error.details, error.hint);
    return res.status(500).json({ error: error.message });
  }
  return res.status(200).json({ success: true });
};
