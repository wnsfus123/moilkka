const { supabase } = require('../lib/supabase');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { kakaoId, nickname } = req.body;

  let error;
  if (nickname) {
    // 닉네임 있음: 신규 삽입 또는 기존 레코드 닉네임 업데이트
    ({ error } = await supabase.from('users').upsert({
      kakao_id: kakaoId,
      nickname,
    }, { onConflict: 'kakao_id', ignoreDuplicates: false }));
  } else {
    // 닉네임 없음: 신규이면 '익명'으로 삽입, 기존이면 기존 닉네임 유지
    ({ error } = await supabase.from('users').upsert({
      kakao_id: kakaoId,
      nickname: '익명',
    }, { onConflict: 'kakao_id', ignoreDuplicates: true }));
  }

  if (error) {
    console.error('[users/save] Supabase upsert 오류:', error.message, error.details);
    return res.status(500).json({ error: error.message });
  }
  console.log('[users/save] 저장 성공 kakaoId:', kakaoId);
  return res.status(200).json({ success: true });
};
