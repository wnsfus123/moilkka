const { supabase } = require('../lib/supabase');
const { decrypt } = require('../lib/crypto');
const axios = require('axios');
const { addDays, format, startOfDay } = require('date-fns');
const { toZonedTime } = require('date-fns-tz');

module.exports = async (req, res) => {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const nowKST = toZonedTime(new Date(), 'Asia/Seoul');
  const today = startOfDay(nowKST);
  const threeDaysAfter = format(addDays(today, 3), 'yyyy-MM-dd');
  const oneDayAfter = format(addDays(today, 1), 'yyyy-MM-dd');
  const baseUrl = process.env.REACT_APP_BASE_URL || '';

  const sendMessage = async (accessToken, kakaoId, message) => {
    try {
      await axios.post(
        'https://kapi.kakao.com/v2/api/talk/memo/default/send',
        new URLSearchParams({
          template_object: JSON.stringify({
            object_type: 'text',
            text: message,
            link: { web_url: baseUrl },
          }),
        }).toString(),
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );
    } catch (err) {
      console.error(`카카오 메시지 전송 실패 (${kakaoId}):`, err.message);
    }
  };

  // 만료된 이벤트 삭제
  await supabase.from('events').delete().lt('end_at', today.toISOString());

  // 3일 후, 1일 후 이벤트 알림
  for (const [dayStr, label] of [[threeDaysAfter, '3일'], [oneDayAfter, '1일']]) {
    const { data: events } = await supabase
      .from('events')
      .select('kakao_id, name')
      .gte('start_at', `${dayStr}T00:00:00+09:00`)
      .lte('start_at', `${dayStr}T23:59:59+09:00`);

    for (const { kakao_id, name } of (events || [])) {
      const { data: tokenRow } = await supabase
        .from('tokens')
        .select('access_token')
        .eq('kakao_id', kakao_id)
        .single();

      if (!tokenRow) continue;

      try {
        const token = decrypt(tokenRow.access_token);
        await sendMessage(token, kakao_id, `모일까에서 ${name} 모임이 ${label} 남았어요! 얼른 일정을 등록하고 확인해주세요!`);
      } catch (err) {
        console.error(`토큰 복호화 실패 (${kakao_id}):`, err.message);
      }
    }
  }

  return res.status(200).json({ success: true, message: '알림 전송 완료' });
};
