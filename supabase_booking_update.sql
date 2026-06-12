-- 예약 페이지 가능 시간/요일 설정 + 예약 모드
ALTER TABLE booking_pages
  ADD COLUMN IF NOT EXISTS available_days  JSONB       DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS available_start TIME        DEFAULT '09:00',
  ADD COLUMN IF NOT EXISTS available_end   TIME        DEFAULT '22:00',
  ADD COLUMN IF NOT EXISTS booking_mode    VARCHAR(20) DEFAULT 'host_open';

-- 고객 가능 시간 제안 모드
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS proposed_times JSONB       DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS confirmed_time TIMESTAMPTZ;

-- available_days 예시:
-- []        = 모든 요일 (기존 호환)
-- [0,1,2,3,4] = 월~금 (0=월, 6=일)
-- [0,2,4]     = 월수금

-- booking_mode:
-- 'host_open'     = 호스트가 시간 오픈 (기존 방식)
-- 'guest_propose' = 게스트가 시간 제안

-- proposed_times 예시:
-- ["2026-06-16T11:00:00.000Z", "2026-06-17T14:00:00.000Z"]
