const { supabase } = require('../lib/supabase');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    const { event_uuid } = req.query;
    if (!event_uuid) return res.status(400).json({ error: 'event_uuid 필요' });

    const { data: places, error } = await supabase
      .from('places')
      .select('*')
      .eq('event_uuid', event_uuid)
      .order('created_at', { ascending: true });

    if (error) return res.status(500).json({ error: error.message });

    const placeIds = (places || []).map(p => p.id);
    let votes = [];
    if (placeIds.length > 0) {
      const { data: voteData } = await supabase
        .from('place_votes')
        .select('place_id, kakao_id')
        .in('place_id', placeIds);
      votes = voteData || [];
    }

    const result = (places || []).map(p => {
      const pVotes = votes.filter(v => v.place_id === p.id);
      return { ...p, vote_count: pVotes.length, voted_by: pVotes.map(v => v.kakao_id) };
    });

    return res.status(200).json(result);
  }

  if (req.method === 'POST') {
    const { event_uuid, kakao_id, nickname, place_name, address, lat, lng, kakao_place_id } = req.body;
    if (!event_uuid || !kakao_id || !place_name) return res.status(400).json({ error: '필수 값 누락' });

    const { data, error } = await supabase
      .from('places')
      .insert([{
        event_uuid,
        kakao_id: String(kakao_id),
        nickname: nickname || '익명',
        place_name,
        address: address || null,
        lat: lat || null,
        lng: lng || null,
        kakao_place_id: kakao_place_id || null,
      }])
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ...data, vote_count: 0, voted_by: [] });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
