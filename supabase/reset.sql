-- KNOCK full reset: wipes ALL data and schema, back to zero.
-- Run this in the Supabase SQL Editor, then re-run migrations
-- 0001 → 0005 in order. Everything here is idempotent.

-- 1) stop auto-provisioning before touching users
drop trigger if exists on_auth_user_created on auth.users;

-- 2) drop all KNOCK tables (cascade removes policies, triggers, indexes)
drop table if exists public.notifications cascade;
drop table if exists public.room_messages cascade;
drop table if exists public.door_notes cascade;
drop table if exists public.knocks cascade;
drop table if exists public.friendships cascade;
drop table if exists public.rooms cascade;
drop table if exists public.profiles cascade;
drop table if exists public.events cascade;

-- 3) drop helper functions
drop function if exists public.handle_new_user() cascade;
drop function if exists public.are_friends(uuid, uuid) cascade;
drop function if exists public.set_updated_at() cascade;

-- 4) drop enums
drop type if exists public.presence_status cascade;
drop type if exists public.door_state cascade;
drop type if exists public.room_visibility cascade;
drop type if exists public.friendship_status cascade;
drop type if exists public.knock_status cascade;

-- 5) remove every account (true "start from zero")
delete from auth.users;
