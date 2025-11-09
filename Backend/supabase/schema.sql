-- Note: Supabase already manages required extensions in most projects.
-- If needed, run these manually via SQL editor:
-- create extension if not exists "uuid-ossp";
-- create extension if not exists pgcrypto;

-- EVENTS
create table if not exists public.events (
  id uuid primary key default uuid_generate_v4(),
  code text unique not null, -- human-entered or generated code to join event
  title text not null,
  description text,
  organizer_id uuid, -- future: reference auth.users
  status text not null default 'draft', -- draft | live | ended
  preferences jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);
create index if not exists events_code_idx on public.events(code);

-- VIRTUAL PEOPLE (avatars / AI personas)
create table if not exists public.virtual_people (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid references public.events(id) on delete cascade,
  display_name text not null,
  persona_profile jsonb default '{}'::jsonb, -- structured preferences & traits
  created_at timestamptz default now()
);
create index if not exists virtual_people_event_idx on public.virtual_people(event_id);

-- GUESTS / INVITEES
create table if not exists public.guests (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid references public.events(id) on delete cascade,
  full_name text not null,
  email text,
  badge_number int, -- sequential number for photochek
  found boolean default false, -- whether located during event
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  unique(event_id, badge_number)
);
create index if not exists guests_event_idx on public.guests(event_id);
create index if not exists guests_event_badge_idx on public.guests(event_id, badge_number);

-- ROOMS (auto-generated conversation rooms)
create table if not exists public.rooms (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid references public.events(id) on delete cascade,
  name text not null,
  topic text,
  capacity int,
  created_at timestamptz default now()
);
create index if not exists rooms_event_idx on public.rooms(event_id);

-- TALKS (transcriptions of speeches)
create table if not exists public.talks (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid references public.events(id) on delete cascade,
  speaker text,
  source_audio_url text,
  transcript text, -- raw transcript
  summary text, -- optional summarized version
  created_at timestamptz default now()
);
create index if not exists talks_event_idx on public.talks(event_id);

-- QUESTIONS generated from talks & preferences
create table if not exists public.questions (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid references public.events(id) on delete cascade,
  room_id uuid references public.rooms(id) on delete set null,
  talk_id uuid references public.talks(id) on delete set null,
  content text not null,
  context jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);
create index if not exists questions_event_idx on public.questions(event_id);

-- Basic RLS Setup (adjust later with auth)
alter table public.events enable row level security;
alter table public.virtual_people enable row level security;
alter table public.guests enable row level security;
alter table public.rooms enable row level security;
alter table public.talks enable row level security;
alter table public.questions enable row level security;

-- Simplistic policies (open for development; tighten in production)
create policy "allow read all" on public.events for select using (true);
create policy "allow insert all" on public.events for insert with check (true);
create policy "allow update all" on public.events for update using (true);

create policy "allow read all" on public.virtual_people for select using (true);
create policy "allow crud all" on public.virtual_people for all using (true) with check (true);

create policy "allow read all" on public.guests for select using (true);
create policy "allow crud all" on public.guests for all using (true) with check (true);

create policy "allow read all" on public.rooms for select using (true);
create policy "allow crud all" on public.rooms for all using (true) with check (true);

create policy "allow read all" on public.talks for select using (true);
create policy "allow crud all" on public.talks for all using (true) with check (true);

create policy "allow read all" on public.questions for select using (true);
create policy "allow crud all" on public.questions for all using (true) with check (true);

-- Helper function to generate event code if not provided
create or replace function public.generate_event_code() returns text as $$
  select lower(substr(md5(gen_random_uuid()::text),1,8));
$$ language sql stable;

-- Trigger to set event code
create or replace function public.set_event_code() returns trigger as $$
begin
  if new.code is null then
    new.code := public.generate_event_code();
  end if;
  return new;
end;$$ language plpgsql;

create trigger set_event_code_before_insert
before insert on public.events
for each row execute procedure public.set_event_code();

-- View for room conversation topics (placeholder combining rooms + last talk summary)
create or replace view public.room_conversation_topics as
select r.id as room_id, r.name, r.topic,
       (select summary from public.talks t where t.event_id = r.event_id order by t.created_at desc limit 1) as latest_talk_summary
from public.rooms r;

-- End of schema
