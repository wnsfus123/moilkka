const { supabase } = require('../lib/supabase');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { uuid } = req.query;

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('uuid', uuid)
      .single();

    if (error) return res.status(404).json({ error: '이벤트를 찾을 수 없습니다.' });

    console.log('[events/uuid] Supabase data keys:', Object.keys(data || {}));
    console.log('[events/uuid] start_at:', data.start_at, '/ startday:', data.startday);

    const startday = data.start_at ?? data.startday ?? null;
    const endday = data.end_at ?? data.endday ?? null;

    return res.status(200).json({
      ...data,
      eventname: data.name,
      startday,
      endday,
      kakaoId: data.kakao_id,
    });
  }

  if (req.method === 'DELETE') {
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
        .from('schedules')
        .delete()
        .eq('event_uuid', uuid)
        .eq('kakao_id', kakaoId);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ success: true, message: '참여자 데이터가 삭제되었습니다.' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
