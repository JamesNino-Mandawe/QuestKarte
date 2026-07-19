-- QuestKarte: allow every signed-in Member to submit a task for moderation.
-- Verification remains valuable for trust badges, but is not required to post.
-- Moderators must still approve a task before it is visible in the marketplace.

drop policy if exists "verified members submit tasks for review" on public.tasks;
drop policy if exists "members submit tasks for review" on public.tasks;

create policy "members submit tasks for review"
on public.tasks
for insert
to authenticated
with check (
  posted_by = auth.uid()
  and status = 'draft'
  and moderation_state = 'pending_review'
);
