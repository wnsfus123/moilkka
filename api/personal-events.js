const { supabase } = require('./lib/supabase');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    const { kakaoId } = req.query;
    if (!kakaoId) return res.status(400).json({ error: 'kakaoId 필요' });

    const { data, error } = await supabase
      .from('personal_events')
      .select('*')
      .eq('kakao_id', String(kakaoId))
      .order('event_date', { ascending: true });

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data || []);
  }

  if (req.method === 'POST') {
    const { kakaoId, title, memo, event_date } = req.body;
    if (!kakaoId || !title || !event_date) return res.status(400).json({ error: '필수 값 누락' });

    const { data, error } = await supabase
      .from('personal_events')
      .insert([{ kakao_id: String(kakaoId), title, memo: memo || null, event_date }])
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  if (req.method === 'DELETE') {
    const { id, kakaoId } = req.query;
    if (!id || !kakaoId) return res.status(400).json({ error: '필수 값 누락' });

    const { error } = await supabase
      .from('personal_events')
      .delete()
      .eq('id', id)
      .eq('kakao_id', String(kakaoId));

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
