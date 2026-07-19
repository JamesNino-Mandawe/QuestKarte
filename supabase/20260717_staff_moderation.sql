-- QuestKarte: staff moderation workflow
-- Run this once in Supabase SQL Editor after the base schema.sql query.

alter table public.tasks
  add column if not exists moderation_state text not null default 'pending_review'
    check (moderation_state in ('pending_review', 'approved', 'rejected')),
  add column if not exists moderation_note text
    check (moderation_note is null or char_length(moderation_note) <= 1000),
  add column if not exists moderated_by uuid references public.profiles(id) on delete set null,
  add column if not exists moderated_at timestamptz;

-- Existing open tasks are preserved as already approved posts.
update public.tasks
set moderation_state = 'approved'
where status = 'open' and moderation_state = 'pending_review';

drop policy if exists "tasks are visible when published" on public.tasks;
drop policy if exists "open approved tasks are public" on public.tasks;
create policy "open approved tasks are public" on public.tasks for select using (
  (status = 'open' and moderation_state = 'approved')
  or posted_by = auth.uid()
  or public.is_staff()
);

drop policy if exists "users create tasks" on public.tasks;
drop policy if exists "members submit tasks for review" on public.tasks;
create policy "members submit tasks for review" on public.tasks for insert with check (
  posted_by = auth.uid()
  and status = 'draft'
  and moderation_state = 'pending_review'
);

drop policy if exists "owners update own unassigned tasks" on public.tasks;
drop policy if exists "owners edit their reviewable tasks" on public.tasks;
create policy "owners edit their reviewable tasks" on public.tasks for update using (
  public.is_staff()
  or (posted_by = auth.uid() and status in ('draft', 'cancelled'))
) with check (
  public.is_staff()
  or (posted_by = auth.uid() and status = 'draft' and moderation_state = 'pending_review')
);

drop policy if exists "task attachments visible with task" on public.task_attachments;
drop policy if exists "task attachments follow task visibility" on public.task_attachments;
create policy "task attachments follow task visibility" on public.task_attachments for select using (
  exists (
    select 1 from public.tasks t
    where t.id = task_id
      and ((t.status = 'open' and t.moderation_state = 'approved') or t.posted_by = auth.uid() or public.is_staff())
  )
);

drop policy if exists "staff record task history" on public.task_status_history;
create policy "staff record task history" on public.task_status_history for insert with check (public.is_staff());

create index if not exists tasks_moderation_queue_idx
  on public.tasks (moderation_state, created_at asc)
  where moderation_state = 'pending_review';

-- Only the one Admin can manage marketplace categories or promote moderators.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role in ('admin', 'super_admin')
  );
$$;

drop policy if exists "staff manage categories" on public.categories;
create policy "admins manage categories" on public.categories for all
  using (public.is_admin()) with check (public.is_admin());

create or replace function public.promote_to_moderator(target_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'Only the QuestKarte Admin can promote moderators';
  end if;

  if not exists (select 1 from public.profiles where id = target_user_id) then
    raise exception 'Member account was not found';
  end if;

  insert into public.user_roles (user_id, role, granted_by)
  values (target_user_id, 'moderator', auth.uid())
  on conflict (user_id, role) do nothing;

  insert into public.admin_audit_logs (admin_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'promoted_moderator', 'profile', target_user_id, jsonb_build_object('role', 'moderator'));
end;
$$;

revoke all on function public.promote_to_moderator(uuid) from public;
grant execute on function public.promote_to_moderator(uuid) to authenticated;
