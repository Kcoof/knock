-- KNOCK events (spec §26): lightweight community events inside existing
-- world spaces — an event board, not an event-management platform.

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 60),
  hub text not null default 'india',
  starts_at timestamptz not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.events enable row level security;

-- everyone signed in can read the board; any builder can post an event
create policy "events readable by authenticated users"
  on public.events for select to authenticated using (true);

create policy "authenticated users create events"
  on public.events for insert to authenticated
  with check (auth.uid() = created_by);

create policy "creators delete their events"
  on public.events for delete to authenticated
  using (auth.uid() = created_by);

create index events_starts_at_idx on public.events (starts_at);
