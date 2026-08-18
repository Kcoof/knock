-- KNOCK V2 (spec §40): public room directory for everyone + visitor stats.

-- Everyone (including signed-out guests) can see rooms marked public,
-- so the world map directory works before signing in.
drop policy if exists "public rooms readable by everyone" on public.rooms;
create policy "public rooms readable by everyone"
  on public.rooms for select to anon, authenticated
  using (visibility = 'public');
