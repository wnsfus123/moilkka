-- 모임 확정 시스템: status, confirmed_at, confirmed_time 컬럼 추가
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS status VARCHAR(10) DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS confirmed_time TIMESTAMPTZ;
