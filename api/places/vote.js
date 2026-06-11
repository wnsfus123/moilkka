const { supabase } = require('../lib/supabase');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'POST') {
    const { place_id, kakao_id } = req.body;
    if (!place_id || !kakao_id) return res.status(400).json({ error: '필수 값 누락' });

    const { error } = await supabase
      .from('place_votes')
      .insert([{ place_id, kakao_id: String(kakao_id) }]);

    if (error?.code === '23505') return res.status(409).json({ error: '이미 투표했습니다.' });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  if (req.method === 'DELETE') {
    const { place_id, kakao_id } = req.body;
    if (!place_id || !kakao_id) return res.status(400).json({ error: '필수 값 누락' });

    const { error } = await supabase
      .from('place_votes')
      .delete()
      .eq('place_id', place_id)
      .eq('kakao_id', String(kakao_id));

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
