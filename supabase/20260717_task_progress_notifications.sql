-- QuestKarte task lifecycle, deliverables, and notifications.
-- Run AFTER the previous QuestKarte migrations.

create table if not exists public.task_categories (
  task_id uuid not null references public.tasks(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  primary key (task_id, category_id)
);

create table if not exists public.task_deliverables (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  submitted_by uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  caption text check (char_length(caption) <= 1000),
  created_at timestamptz not null default now()
);

alter table public.task_categories enable row level security;
alter table public.task_deliverables enable row level security;

drop policy if exists "task categories visible with task" on public.task_categories;
create policy "task categories visible with task" on public.task_categories for select using (exists (select 1 from public.tasks t where t.id = task_id and ((t.status = 'open' and t.moderation_state = 'approved') or t.posted_by = auth.uid() or t.assigned_to = auth.uid() or public.is_staff())));
drop policy if exists "owners add task categories" on public.task_categories;
create policy "owners add task categories" on public.task_categories for insert with check (exists (select 1 from public.tasks t where t.id = task_id and t.posted_by = auth.uid() and t.status = 'draft'));
drop policy if exists "participants read deliverables" on public.task_deliverables;
create policy "participants read deliverables" on public.task_deliverables for select using (exists (select 1 from public.tasks t where t.id = task_id and (t.posted_by = auth.uid() or t.assigned_to = auth.uid() or public.is_staff())));
drop policy if exists "assigned members submit deliverables" on public.task_deliverables;
create policy "assigned members submit deliverables" on public.task_deliverables for insert with check (submitted_by = auth.uid() and exists (select 1 from public.tasks t where t.id = task_id and t.assigned_to = auth.uid() and t.status in ('assigned','in_progress')));

create or replace function public.accept_application(target_application_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare selected_task uuid; selected_applicant uuid;
begin
  select task_id, applicant_id into selected_task, selected_applicant from public.applications where id = target_application_id for update;
  if selected_task is null then raise exception 'Application not found'; end if;
  if not exists (select 1 from public.tasks where id = selected_task and posted_by = auth.uid() and status = 'open') then raise exception 'Only the task owner can accept an application'; end if;
  update public.applications
  set status = case
    when id = target_application_id then 'accepted'::public.application_status
    else 'rejected'::public.application_status
  end
  where task_id = selected_task and status in ('pending','shortlisted');
  update public.tasks set assigned_to = selected_applicant, status = 'assigned' where id = selected_task;
  insert into public.task_status_history (task_id, previous_status, new_status, changed_by, note) values (selected_task, 'open', 'assigned', auth.uid(), 'Applicant accepted');
  insert into public.notifications (recipient_id, type, title, body, link) values (selected_applicant, 'application', 'Application accepted', 'Your application was accepted. You can now coordinate and begin the task.', '/tasks');
end;
$$;

create or replace function public.update_task_progress(target_task_id uuid, next_status public.task_status, progress_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare previous public.task_status; owner_id uuid; worker_id uuid;
begin
  select status, posted_by, assigned_to into previous, owner_id, worker_id from public.tasks where id = target_task_id for update;
  if previous is null then raise exception 'Task not found'; end if;
  if auth.uid() not in (owner_id, worker_id) and not public.is_staff() then raise exception 'Only task participants can update progress'; end if;
  if next_status not in ('in_progress','completed','disputed','cancelled') then raise exception 'Invalid task progress state'; end if;
  update public.tasks set status = next_status where id = target_task_id;
  insert into public.task_status_history (task_id, previous_status, new_status, changed_by, note) values (target_task_id, previous, next_status, auth.uid(), progress_note);
  insert into public.notifications (recipient_id, type, title, body, link)
  select case when auth.uid() = owner_id then worker_id else owner_id end, 'task', 'Task status updated', coalesce(progress_note, 'A task you are part of was updated.'), '/tasks'
  where case when auth.uid() = owner_id then worker_id else owner_id end is not null;
end;
$$;

create or replace function public.notify_task_owner_of_application()
returns trigger language plpgsql security definer set search_path = public as $$
declare owner_id uuid;
begin
  select posted_by into owner_id from public.tasks where id = new.task_id;
  insert into public.notifications (recipient_id, type, title, body, link) values (owner_id, 'application', 'New application received', 'A member applied to your task. Review their profile and application.', '/tasks');
  return new;
end;
$$;

drop trigger if exists application_notification_after_insert on public.applications;
create trigger application_notification_after_insert after insert on public.applications for each row execute function public.notify_task_owner_of_application();

revoke all on function public.accept_application(uuid) from public;
grant execute on function public.accept_application(uuid) to authenticated;
revoke all on function public.update_task_progress(uuid, public.task_status, text) from public;
grant execute on function public.update_task_progress(uuid, public.task_status, text) to authenticated;
