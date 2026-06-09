-- 모일까 Supabase 스키마
-- Supabase SQL Editor에서 실행하세요

create table if not exists events (
  id         bigserial primary key,
  uuid       char(8) unique not null,
  name       varchar(50) not null,
  start_at   timestamptz not null,
  end_at     timestamptz not null,
  kakao_id   varchar(20) not null,
  nickname   varchar(30) not null,
  created_at timestamptz default now()
);

create table if not exists schedules (
  id          bigserial primary key,
  event_uuid  char(8) not null references events(uuid) on delete cascade,
  kakao_id    varchar(20) not null,
  nickname    varchar(30) not null,
  slot_time   timestamptz not null,
  unique (event_uuid, kakao_id, slot_time)
);

create table if not exists tokens (
  kakao_id      varchar(20) primary key,
  access_token  text not null,
  refresh_token text not null,
  issued_at     bigint not null,
  expires_in    int not null,
  updated_at    timestamptz default now()
);

create table if not exists users (
  kakao_id   varchar(20) primary key,
  nickname   varchar(30) not null,
  created_at timestamptz default now()
);

-- RLS: API 서버가 service key를 사용하므로 RLS 비활성화 (선택)
alter table events disable row level security;
alter table schedules disable row level security;
alter table tokens disable row level security;
alter table users disable row level security;
