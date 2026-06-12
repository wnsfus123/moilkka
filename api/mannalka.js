const { supabase } = require('./lib/supabase');
const { decrypt } = require('./lib/crypto');
const axios = require('axios');

const generateUUID = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
};

const sendKakaoMsg = async (kakaoId, text) => {
  const baseUrl = process.env.REACT_APP_BASE_URL || '';
  try {
    const { data: tokenRow } = await supabase
      .from('tokens').select('access_token').eq('kakao_id', String(kakaoId)).single();
    if (!tokenRow) return;
    const token = decrypt(tokenRow.access_token);
    await axios.post(
      'https://kapi.kakao.com/v2/api/talk/memo/default/send',
      new URLSearchParams({
        template_object: JSON.stringify({
          object_type: 'text',
          text,
          link: { web_url: baseUrl },
        }),
      }).toString(),
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
  } catch (err) {
    console.error(`[mannalka] 카카오 메시지 전송 실패 (${kakaoId}):`, err.message);
  }
};

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action, uuid, kakaoId } = req.query;

  // ── GET ──────────────────────────────────────────────────────────
  if (req.method === 'GET') {

    // 예약 페이지 정보 (게스트용)
    if (action === 'page') {
      if (!uuid) return res.status(400).json({ error: 'uuid 필요' });
      try {
        const { data: page, error } = await supabase
          .from('booking_pages').select('*').eq('uuid', uuid).single();
        if (error || !page) return res.status(404).json({ error: '페이지를 찾을 수 없습니다.' });
        const { data: user } = await supabase
          .from('users').select('nickname').eq('kakao_id', page.kakao_id).single();
        return res.status(200).json({ ...page, host_nickname: user?.nickname || '익명' });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    // 가능한 슬롯 목록
    if (action === 'slots') {
      if (!uuid) return res.status(400).json({ error: 'uuid 필요' });
      try {
        const { data, error } = await supabase
          .from('booking_slots').select('*').eq('page_uuid', uuid).order('day_of_week').order('start_time');
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json(data || []);
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    // 이미 예약된 시간 (게스트용)
    if (action === 'booked') {
      if (!uuid) return res.status(400).json({ error: 'uuid 필요' });
      try {
        const since = new Date(); since.setHours(0, 0, 0, 0);
        const { data, error } = await supabase
          .from('bookings').select('booked_at, status')
          .eq('page_uuid', uuid)
          .neq('status', 'cancelled')
          .gte('booked_at', since.toISOString());
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json(data || []);
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    // 내 예약 페이지 목록 (호스트용)
    if (action === 'list') {
      if (!kakaoId) return res.status(400).json({ error: 'kakaoId 필요' });
      try {
        const { data: pages, error } = await supabase
          .from('booking_pages').select('*')
          .eq('kakao_id', String(kakaoId))
          .order('created_at', { ascending: false });
        if (error) return res.status(500).json({ error: error.message });

        const pagesWithCounts = await Promise.all((pages || []).map(async page => {
          const { data: bks } = await supabase
            .from('bookings').select('status').eq('page_uuid', page.uuid);
          const arr = bks || [];
          return {
            ...page,
            pending_count:   arr.filter(b => b.status === 'pending').length,
            confirmed_count: arr.filter(b => b.status === 'confirmed').length,
          };
        }));
        return res.status(200).json(pagesWithCounts);
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    // 예약 신청 목록 (호스트용)
    if (action === 'requests') {
      if (!uuid) return res.status(400).json({ error: 'uuid 필요' });
      try {
        const { data: page } = await supabase
          .from('booking_pages').select('kakao_id').eq('uuid', uuid).single();
        if (!page || String(page.kakao_id) !== String(kakaoId)) {
          return res.status(403).json({ error: '권한 없음' });
        }
        const { data, error } = await supabase
          .from('bookings').select('*').eq('page_uuid', uuid).order('booked_at');
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json(data || []);
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    // 내가 신청한 예약 목록 (게스트용)
    if (action === 'mybookings') {
      if (!kakaoId) return res.status(400).json({ error: 'kakaoId 필요' });
      try {
        const { data, error } = await supabase
          .from('bookings')
          .select('id, page_uuid, guest_name, status, booked_at, booking_pages(title, uuid)')
          .eq('guest_kakao', String(kakaoId))
          .order('booked_at', { ascending: false });
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json(data || []);
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    return res.status(400).json({ error: 'action 필요' });
  }

  // ── POST ─────────────────────────────────────────────────────────
  if (req.method === 'POST') {

    // 예약 페이지 생성
    if (action === 'create') {
      try {
        const { kakao_id, title, description, duration, slots, show_timetable,
                booking_mode, available_days, available_start, available_end } = req.body;
        if (!kakao_id || !title) return res.status(400).json({ error: '필수 값 누락' });

        let pageUuid;
        for (let i = 0; i < 5; i++) {
          const c = generateUUID();
          const { data: ex } = await supabase.from('booking_pages').select('uuid').eq('uuid', c).single();
          if (!ex) { pageUuid = c; break; }
        }
        if (!pageUuid) return res.status(500).json({ error: 'UUID 생성 실패' });

        const { data: page, error } = await supabase
          .from('booking_pages')
          .insert([{
            uuid: pageUuid,
            kakao_id: String(kakao_id),
            title,
            description: description || null,
            duration: duration || 60,
            show_timetable: show_timetable || false,
            booking_mode: booking_mode || 'host_open',
            available_days: available_days || [],
            available_start: available_start || '09:00',
            available_end: available_end || '22:00',
          }])
          .select().single();
        if (error) return res.status(500).json({ error: error.message });

        if (slots && slots.length > 0) {
          await supabase.from('booking_slots').insert(
            slots.map(s => ({ page_uuid: pageUuid, day_of_week: s.day_of_week, start_time: s.start_time, end_time: s.end_time }))
          );
        }
        return res.status(200).json(page);
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    // 예약 신청 (게스트)
    if (action === 'book') {
      try {
        const { page_uuid, guest_name, guest_kakao, booked_at, memo, booking_mode: bm, proposed_times } = req.body;
        if (!page_uuid || !guest_name) return res.status(400).json({ error: '필수 값 누락' });

        // ── guest_propose 모드 ──
        if (bm === 'guest_propose') {
          if (!proposed_times || !proposed_times.length) return res.status(400).json({ error: 'proposed_times 필요' });
          const { data, error } = await supabase
            .from('bookings')
            .insert([{ page_uuid, guest_name, guest_kakao: guest_kakao || null, booked_at: new Date().toISOString(), status: 'pending', memo: memo || null, proposed_times }])
            .select().single();
          if (error) return res.status(500).json({ error: error.message });
          const { data: pg } = await supabase.from('booking_pages').select('kakao_id, title').eq('uuid', page_uuid).single();
          if (pg) {
            await sendKakaoMsg(pg.kakao_id, `📌 만날까\n${guest_name}님이 ${proposed_times.length}개 시간을 제안했어요!\n확인하고 시간을 확정해주세요 👉 모일까 앱에서 확인`);
          }
          return res.status(200).json(data);
        }

        // ── host_open 모드 (기존 로직 유지) ──
        if (!booked_at) return res.status(400).json({ error: '필수 값 누락' });

        const { data: conflict } = await supabase
          .from('bookings').select('id')
          .eq('page_uuid', page_uuid).eq('booked_at', booked_at).neq('status', 'cancelled')
          .single();
        if (conflict) return res.status(409).json({ error: '이미 예약된 시간이에요.' });

        const { data, error } = await supabase
          .from('bookings')
          .insert([{ page_uuid, guest_name, guest_kakao: guest_kakao || null, booked_at, status: 'pending', memo: memo || null, proposed_times: [] }])
          .select().single();
        if (error) return res.status(500).json({ error: error.message });

        const { data: pg } = await supabase.from('booking_pages').select('kakao_id, title').eq('uuid', page_uuid).single();
        if (pg) {
          const d = new Date(booked_at);
          const ds = d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });
          const ts = d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
          await sendKakaoMsg(pg.kakao_id, `📌 만날까\n${guest_name}님이 예약을 신청했어요!\n📅 ${ds} ${ts}\n모일까에서 확인해보세요.`);
        }
        return res.status(200).json(data);
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    // 예약 확정 (호스트)
    if (action === 'confirm') {
      try {
        const { booking_id, kakao_id, confirmed_time } = req.body;
        if (!booking_id || !kakao_id) return res.status(400).json({ error: '필수 값 누락' });

        const { data: bk } = await supabase.from('bookings').select('*').eq('id', booking_id).single();
        if (!bk) return res.status(404).json({ error: '예약을 찾을 수 없습니다.' });
        const { data: pg } = await supabase.from('booking_pages').select('kakao_id, title').eq('uuid', bk.page_uuid).single();
        if (!pg || String(pg.kakao_id) !== String(kakao_id)) return res.status(403).json({ error: '권한 없음' });

        // confirmed_time이 있으면 (guest_propose 모드) 함께 저장
        const updateData = { status: 'confirmed' };
        if (confirmed_time) updateData.confirmed_time = confirmed_time;

        const { error } = await supabase.from('bookings').update(updateData).eq('id', booking_id);
        if (error) return res.status(500).json({ error: error.message });

        if (bk.guest_kakao) {
          const timeToShow = confirmed_time || bk.booked_at;
          const d = new Date(timeToShow);
          const ds = d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });
          const ts = d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
          const msg = confirmed_time
            ? `예약이 확정됐어요! 🎉\n📅 ${ds} ${ts}\n${pg.title} — ${pg.host_nickname || '호스트'}님이 기다리고 있어요`
            : `✅ 만날까\n${pg.title} 예약이 확정됐어요!\n📅 ${ds} ${ts}\n기다리고 있을게요 😊`;
          await sendKakaoMsg(bk.guest_kakao, msg);
        }
        return res.status(200).json({ success: true });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    // 예약 취소 (호스트)
    if (action === 'cancel') {
      try {
        const { booking_id, kakao_id } = req.body;
        if (!booking_id || !kakao_id) return res.status(400).json({ error: '필수 값 누락' });

        const { data: bk } = await supabase.from('bookings').select('page_uuid').eq('id', booking_id).single();
        if (!bk) return res.status(404).json({ error: '예약을 찾을 수 없습니다.' });
        const { data: pg } = await supabase.from('booking_pages').select('kakao_id').eq('uuid', bk.page_uuid).single();
        if (!pg || String(pg.kakao_id) !== String(kakao_id)) return res.status(403).json({ error: '권한 없음' });

        const { error } = await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', booking_id);
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ success: true });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    return res.status(400).json({ error: 'action 필요' });
  }

  // ── DELETE: 예약 페이지 삭제 ────────────────────────────────────
  if (req.method === 'DELETE') {
    const delUuid = uuid;
    const kakaoIdBody = req.body?.kakao_id;
    if (!delUuid) return res.status(400).json({ error: 'uuid 필요' });
    try {
      const { data: pg } = await supabase.from('booking_pages').select('kakao_id').eq('uuid', delUuid).single();
      if (!pg) return res.status(404).json({ error: '페이지를 찾을 수 없습니다.' });
      if (String(pg.kakao_id) !== String(kakaoIdBody || kakaoId)) return res.status(403).json({ error: '권한 없음' });
      const { error } = await supabase.from('booking_pages').delete().eq('uuid', delUuid);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ success: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
