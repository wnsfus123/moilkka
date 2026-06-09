const { supabase } = require('../lib/supabase');
const { encrypt } = require('../lib/crypto');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { kakaoId, accessToken, refreshToken, expiresIn } = req.body;
  const issuedAt = Math.floor(Date.now() / 1000);

  try {
    const encryptedAccess = encrypt(accessToken);
    const encryptedRefresh = encrypt(refreshToken);

    const { error } = await supabase.from('tokens').upsert({
      kakao_id: kakaoId,
      access_token: encryptedAccess,
      refresh_token: encryptedRefresh,
      issued_at: issuedAt,
      expires_in: expiresIn,
    }, { onConflict: 'kakao_id' });

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: '암호화 중 오류 발생: ' + err.message });
  }
};
