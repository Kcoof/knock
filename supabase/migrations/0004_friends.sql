-- KNOCK friends system (spec §9): participants may end a friendship.

drop policy if exists "participants delete friendships"
  on public.friendships;
create policy "participants delete friendships"
  on public.friendships for delete to authenticated
  using (auth.uid() = requester_id or auth.uid() = addressee_id);
