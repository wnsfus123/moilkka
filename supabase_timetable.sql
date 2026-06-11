CREATE TABLE IF NOT EXISTS timetable (
  id           SERIAL PRIMARY KEY,
  kakao_id     VARCHAR(20)  NOT NULL,
  title        VARCHAR(50)  NOT NULL,
  color        VARCHAR(10)  NOT NULL DEFAULT '#FEE500',
  day_of_week  SMALLINT     NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=월 … 6=일
  start_time   TIME         NOT NULL,
  end_time     TIME         NOT NULL,
  memo         TEXT,
  created_at   TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_timetable_kakao ON timetable(kakao_id);

GRANT ALL ON public.timetable TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
