create table if not exists leads (
  id serial primary key,
  name text not null,
  email text not null,
  event_date text,
  venue text,
  services text,
  message text,
  created_at timestamptz not null default now()
);
