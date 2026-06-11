-- ── 장소 투표 테이블 ──
CREATE TABLE IF NOT EXISTS places (
  id             SERIAL PRIMARY KEY,
  event_uuid     CHAR(8) NOT NULL REFERENCES events(uuid) ON DELETE CASCADE,
  kakao_id       VARCHAR(20) NOT NULL,
  nickname       VARCHAR(20) NOT NULL,
  place_name     VARCHAR(100) NOT NULL,
  address        VARCHAR(200),
  lat            DECIMAL(10,7),
  lng            DECIMAL(10,7),
  kakao_place_id VARCHAR(50),
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS place_votes (
  id         SERIAL PRIMARY KEY,
  place_id   INT NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  kakao_id   VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (place_id, kakao_id)
);

CREATE INDEX IF NOT EXISTS idx_places_event ON places(event_uuid);
CREATE INDEX IF NOT EXISTS idx_votes_place  ON place_votes(place_id);

GRANT ALL ON public.places TO service_role;
GRANT ALL ON public.place_votes TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- ── 비공개 모드 컬럼 ──
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT FALSE;
