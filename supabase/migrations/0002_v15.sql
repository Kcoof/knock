-- KNOCK V1.5 additions (spec §39)
-- Character customization lives in profiles.avatar (already present).
-- Adds GitHub context fields and room interior themes.

alter table public.profiles
  add column if not exists github_username text,
  add column if not exists github_repo text;

alter table public.rooms
  add column if not exists theme text not null default 'warm';

-- RLS already covers these tables; no policy changes needed (owner-only
-- updates via existing "users update their own profile" /
-- "users manage their own room" policies).
