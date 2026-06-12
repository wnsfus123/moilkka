-- 만날까 v2: show_timetable 컬럼 추가
ALTER TABLE booking_pages
  ADD COLUMN IF NOT EXISTS show_timetable BOOLEAN DEFAULT FALSE;
