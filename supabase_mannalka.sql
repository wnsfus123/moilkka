CREATE TABLE IF NOT EXISTS booking_pages (
  id          SERIAL PRIMARY KEY,
  uuid        CHAR(8) NOT NULL UNIQUE,
  kakao_id    VARCHAR(20) NOT NULL,
  title       VARCHAR(50) NOT NULL,
  description TEXT,
  duration    INT DEFAULT 60,
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS booking_slots (
  id          SERIAL PRIMARY KEY,
  page_uuid   CHAR(8) NOT NULL REFERENCES booking_pages(uuid) ON DELETE CASCADE,
  day_of_week INT NOT NULL,
  start_time  TIME NOT NULL,
  end_time    TIME NOT NULL
);

CREATE TABLE IF NOT EXISTS bookings (
  id          SERIAL PRIMARY KEY,
  page_uuid   CHAR(8) NOT NULL REFERENCES booking_pages(uuid) ON DELETE CASCADE,
  guest_name  VARCHAR(30) NOT NULL,
  guest_kakao VARCHAR(20),
  booked_at   TIMESTAMPTZ NOT NULL,
  status      VARCHAR(10) DEFAULT 'pending',
  memo        TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_booking_pages_kakao ON booking_pages(kakao_id);
CREATE INDEX IF NOT EXISTS idx_booking_slots_page  ON booking_slots(page_uuid);
CREATE INDEX IF NOT EXISTS idx_bookings_page       ON bookings(page_uuid);
CREATE INDEX IF NOT EXISTS idx_bookings_status     ON bookings(status);

GRANT ALL ON public.booking_pages TO service_role;
GRANT ALL ON public.booking_slots TO service_role;
GRANT ALL ON public.bookings TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
