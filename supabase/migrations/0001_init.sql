-- KNOCK initial schema (Phase 2)
-- Tables, enums, triggers and Row Level Security policies per spec §18/§33.
-- UUID primary keys, timestamps, foreign keys throughout.

-- ===========================================================================
-- Enums
-- ===========================================================================

create type public.presence_status as enum (
  'available', 'working', 'focus', 'away', 'offline'
);

create type public.door_state as enum (
  'open', 'knock', 'focus', 'private'
);

create type public.room_visibility as enum (
  'public', 'friends', 'knock', 'private'
);

create type public.friendship_status as enum (
  'pending', 'accepted', 'blocked'
);

create type public.knock_status as enum (
  'pending', 'accepted', 'declined', 'expired'
);

-- ===========================================================================
-- Profiles (one per auth user)
-- ===========================================================================

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique not null check (char_length(username) between 3 and 20),
  display_name text not null default 'New Builder',
  status public.presence_status not null default 'available',
  activity_text text not null default '',
  country text,
  avatar text not null default 'builder',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ===========================================================================
-- Rooms (each user owns exactly one personal room)
-- ===========================================================================

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.profiles (id) on delete cascade,
  name text not null default 'My Room',
  door_state public.door_state not null default 'knock',
  visibility public.room_visibility not null default 'friends',
  -- future map placement (tiles); nullable until the world phase
  map_x integer,
  map_y integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ===========================================================================
-- Friendships
-- ===========================================================================

create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  addressee_id uuid not null references public.profiles (id) on delete cascade,
  status public.friendship_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);

-- ===========================================================================
-- Knocks (a visitor requesting entry at a room's door)
-- ===========================================================================

create table public.knocks (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  visitor_id uuid not null references public.profiles (id) on delete cascade,
  reason text not null default 'Just visiting',
  message text not null default '' check (char_length(message) <= 200),
  status public.knock_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ===========================================================================
-- Door notes (left when the owner is away)
-- ===========================================================================

create table public.door_notes (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  message text not null check (char_length(message) between 1 and 200),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- ===========================================================================
-- Room chat messages
-- ===========================================================================

create table public.room_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  content text not null check (char_length(content) between 1 and 500),
  created_at timestamptz not null default now()
);

create index room_messages_room_id_created_at_idx
  on public.room_messages (room_id, created_at desc);

-- ===========================================================================
-- Notifications
-- ===========================================================================

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_id_created_at_idx
  on public.notifications (user_id, created_at desc);

-- ===========================================================================
-- updated_at maintenance
-- ===========================================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger rooms_set_updated_at
  before update on public.rooms
  for each row execute function public.set_updated_at();

create trigger friendships_set_updated_at
  before update on public.friendships
  for each row execute function public.set_updated_at();

create trigger knocks_set_updated_at
  before update on public.knocks
  for each row execute function public.set_updated_at();

-- ===========================================================================
-- Auto-provision profile + personal room for every new auth user
-- ===========================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  chosen_username text;
begin
  chosen_username := coalesce(
    nullif(new.raw_user_meta_data ->> 'username', ''),
    'builder_' || substr(new.id::text, 1, 8)
  );

  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    chosen_username,
    coalesce(nullif(new.raw_user_meta_data ->> 'username', ''), 'New Builder')
  );

  insert into public.rooms (owner_id, name)
  values (new.id, coalesce(nullif(new.raw_user_meta_data ->> 'username', ''), 'New Builder') || '''s Room');

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ===========================================================================
-- Row Level Security
-- ===========================================================================

alter table public.profiles enable row level security;
alter table public.rooms enable row level security;
alter table public.friendships enable row level security;
alter table public.knocks enable row level security;
alter table public.door_notes enable row level security;
alter table public.room_messages enable row level security;
alter table public.notifications enable row level security;

-- profiles: visible to signed-in users, editable only by the owner
create policy "profiles are readable by authenticated users"
  on public.profiles for select to authenticated using (true);

create policy "users update their own profile"
  on public.profiles for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

-- rooms: readable by signed-in users; managed by the owner
create policy "rooms are readable by authenticated users"
  on public.rooms for select to authenticated using (true);

create policy "users manage their own room"
  on public.rooms for update to authenticated
  using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- helper: friend of a given user (used by later visibility policies)
create or replace function public.are_friends(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester_id = a and f.addressee_id = b)
        or (f.requester_id = b and f.addressee_id = a))
  );
$$;

-- friendships: only the two involved users can see or act on them
create policy "friendships visible to participants"
  on public.friendships for select to authenticated
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

create policy "users send friend requests"
  on public.friendships for insert to authenticated
  with check (auth.uid() = requester_id);

create policy "participants update friendships"
  on public.friendships for update to authenticated
  using (auth.uid() = requester_id or auth.uid() = addressee_id)
  with check (auth.uid() = requester_id or auth.uid() = addressee_id);

-- knocks: visitors create them; the room owner and visitor can read/update
create policy "knocks visible to visitor and room owner"
  on public.knocks for select to authenticated
  using (
    auth.uid() = visitor_id
    or auth.uid() = (
      select r.owner_id from public.rooms r where r.id = knocks.room_id
    )
  );

create policy "authenticated users knock"
  on public.knocks for insert to authenticated
  with check (auth.uid() = visitor_id);

create policy "visitor or owner updates a knock"
  on public.knocks for update to authenticated
  using (
    auth.uid() = visitor_id
    or auth.uid() = (
      select r.owner_id from public.rooms r where r.id = knocks.room_id
    )
  );

-- door notes: readable by the room owner and the author
create policy "door notes visible to owner and author"
  on public.door_notes for select to authenticated
  using (
    auth.uid() = author_id
    or auth.uid() = (
      select r.owner_id from public.rooms r where r.id = door_notes.room_id
    )
  );

create policy "authenticated users leave door notes"
  on public.door_notes for insert to authenticated
  with check (auth.uid() = author_id);

-- room messages: readable by authenticated users while in the room scope
create policy "room messages readable by authenticated users"
  on public.room_messages for select to authenticated using (true);

create policy "users send their own messages"
  on public.room_messages for insert to authenticated
  with check (auth.uid() = author_id);

-- notifications: strictly private to the recipient
create policy "users read their own notifications"
  on public.notifications for select to authenticated
  using (auth.uid() = user_id);

create policy "users update their own notifications"
  on public.notifications for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
