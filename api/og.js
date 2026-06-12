const { supabase } = require('./lib/supabase');

const OG_IMAGE = 'https://postfiles.pstatic.net/MjAyNDA2MjFfMTA4/MDAxNzE4OTU1MTA1MDg5.27seNkhpUz3k3bJv8rcsBYWXuvdMi-NYIGmm4MQfsCkg.4W9fU1m-u4DhuToJXqW5OTI-wySg-w_LByzoezu0szUg.PNG/logo2.png?type=w966';
const BASE_URL = 'https://moilkka2.vercel.app';

module.exports = async (req, res) => {
  const { uuid } = req.query;

  let title = '모일까 - 스마트 일정 조율';
  let description = '카카오 로그인으로 간편하게 모임 일정을 조율해보세요';
  let shareUrl = BASE_URL;

  if (uuid) {
    try {
      const { data } = await supabase
        .from('events')
        .select('eventname, startday, endday')
        .eq('uuid', uuid)
        .single();
      if (data) {
        title = `${data.eventname} - 모일까`;
        const s = data.startday ? String(data.startday).substring(0, 10) : '';
        const e = data.endday   ? String(data.endday).substring(0, 10)   : '';
        description = s && e
          ? `${s} ~ ${e} · 지금 일정을 등록해보세요`
          : '지금 일정을 등록해보세요';
        shareUrl = `${BASE_URL}/meet/?key=${uuid}`;
      }
    } catch (_) {}
  }

  const escaped = (s) => s.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300');
  res.status(200).send(`<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta property="og:title" content="${escaped(title)}" />
<meta property="og:description" content="${escaped(description)}" />
<meta property="og:image" content="${OG_IMAGE}" />
<meta property="og:url" content="${escaped(shareUrl)}" />
<meta property="og:type" content="website" />
<meta name="twitter:card" content="summary_large_image" />
<script>window.location.replace("${escaped(shareUrl)}");</script>
</head>
<body></body>
</html>`);
};
