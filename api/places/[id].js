const { supabase } = require('../lib/supabase');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'DELETE') {
    const { id } = req.query;
    const { kakao_id, event_uuid } = req.body;
    if (!id || !kakao_id) return res.status(400).json({ error: '필수 값 누락' });

    const { data: place } = await supabase
      .from('places')
      .select('kakao_id')
      .eq('id', id)
      .single();

    if (!place) return res.status(404).json({ error: '장소를 찾을 수 없습니다.' });

    let canDelete = String(place.kakao_id) === String(kakao_id);

    if (!canDelete && event_uuid) {
      const { data: event } = await supabase
        .from('events')
        .select('kakao_id')
        .eq('uuid', event_uuid)
        .single();
      if (event && String(event.kakao_id) === String(kakao_id)) canDelete = true;
    }

    if (!canDelete) return res.status(403).json({ error: '권한이 없습니다.' });

    const { error } = await supabase.from('places').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
