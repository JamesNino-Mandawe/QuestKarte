-- QuestKarte: Task payment tracking & completion gate
-- Run AFTER all previous migrations.
--
-- What this adds:
--   1. payment_type / payment_status columns on tasks
--   2. completed_at timestamp for timeline display
--   3. pending_client_review added to task_status enum
--   4. applicant_mark_done() RPC  — applicant signals work is done; transitions in_progress → pending_client_review
--   5. client_confirm_completion() RPC — client confirms work; transitions pending_client_review → completed; releases payment

-- ─────────────────────────────────────────────────────────────
-- 1. Extend task_status enum (Postgres requires a transaction)
-- ─────────────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_enum
    where enumtypid = 'public.task_status'::regtype
      and enumlabel = 'pending_client_review'
  ) then
    alter type public.task_status add value 'pending_client_review' before 'completed';
  end if;
end
$$;

-- ─────────────────────────────────────────────────────────────
-- 2. Add columns to tasks
-- ─────────────────────────────────────────────────────────────
alter table public.tasks
  add column if not exists payment_type  text not null default 'cash'
    check (payment_type  in ('gcash','cash')),
  add column if not exists payment_status text not null default 'pending'
    check (payment_status in ('pending','held','released')),
  add column if not exists completed_at  timestamptz;

-- ─────────────────────────────────────────────────────────────
-- 3. applicant_mark_done
--    • Only the assigned provider may call this.
--    • Task must be in 'assigned' or 'in_progress'.
--    • At least one deliverable must have been uploaded first.
--    • Transitions task → pending_client_review.
--    • Notifies the task poster.
-- ─────────────────────────────────────────────────────────────
create or replace function public.applicant_mark_done(target_task_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  rec record;
begin
  select id, posted_by, assigned_to, status, payment_type
    into rec
    from public.tasks
   where id = target_task_id
     for update;

  if rec.id is null then
    raise exception 'Task not found';
  end if;

  if rec.assigned_to is distinct from auth.uid() then
    raise exception 'Only the assigned provider can mark a task as done';
  end if;

  if rec.status not in ('assigned','in_progress') then
    raise exception 'Task must be in progress before marking done';
  end if;

  -- Require at least one deliverable (camera proof)
  if not exists (
    select 1 from public.task_deliverables
     where task_id = target_task_id
       and submitted_by = auth.uid()
  ) then
    raise exception 'Upload at least one proof photo before marking done';
  end if;

  -- Transition status
  update public.tasks
     set status = 'pending_client_review'
   where id = target_task_id;

  -- History
  insert into public.task_status_history
    (task_id, previous_status, new_status, changed_by, note)
  values
    (target_task_id, rec.status, 'pending_client_review', auth.uid(),
     'Provider marked task as done and submitted proof');

  -- Notify the client
  insert into public.notifications
    (recipient_id, type, title, body, link)
  values
    (rec.posted_by, 'task',
     'Provider marked task as done',
     'Review the proof and confirm completion to release payment.',
     '/tasks');
end;
$$;

revoke all on function public.applicant_mark_done(uuid) from public;
grant execute on function public.applicant_mark_done(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 4. client_confirm_completion
--    • Only the task poster may call this.
--    • Task must be in 'pending_client_review'.
--    • Transitions task → completed.
--    • Sets payment_status to 'released', records completed_at.
--    • Notifies the provider with a receipt-style message.
--    • Increments completed_tasks_count for both participants.
-- ─────────────────────────────────────────────────────────────
create or replace function public.client_confirm_completion(target_task_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  rec record;
  receipt_body text;
begin
  select id, posted_by, assigned_to, status, payment_type,
         commission_amount, currency, title
    into rec
    from public.tasks
   where id = target_task_id
     for update;

  if rec.id is null then
    raise exception 'Task not found';
  end if;

  if rec.posted_by is distinct from auth.uid() then
    raise exception 'Only the task poster can confirm completion';
  end if;

  if rec.status <> 'pending_client_review' then
    raise exception 'Task must be pending client review to confirm';
  end if;

  -- Transition
  update public.tasks
     set status         = 'completed',
         payment_status = 'released',
         completed_at   = now()
   where id = target_task_id;

  -- History
  insert into public.task_status_history
    (task_id, previous_status, new_status, changed_by, note)
  values
    (target_task_id, 'pending_client_review', 'completed', auth.uid(),
     'Client confirmed job completion');

  -- Receipt notification body
  receipt_body := case rec.payment_type
    when 'gcash' then
      format(
        'Payment of %s %s for "%s" has been released to your account.',
        rec.currency,
        to_char(coalesce(rec.commission_amount, 0), 'FM999,999,990.00'),
        rec.title
      )
    else
      format(
        '"%s" is complete. You can now arrange the cash meetup through the task chat.',
        rec.title
      )
  end;

  -- Notify provider
  if rec.assigned_to is not null then
    insert into public.notifications
      (recipient_id, type, title, body, link)
    values
      (rec.assigned_to, 'task',
       case rec.payment_type when 'gcash' then 'Payment released!' else 'Task complete — arrange meetup' end,
       receipt_body,
       '/tasks');
  end if;

  -- Notify client (self-receipt)
  insert into public.notifications
    (recipient_id, type, title, body, link)
  values
    (rec.posted_by, 'task',
     'Job confirmed — task completed',
     format('You confirmed "%s" as complete. You can now leave a review.', rec.title),
     '/tasks');

  -- Increment completed_tasks_count for both
  update public.profiles
     set completed_tasks_count = completed_tasks_count + 1
   where id in (rec.posted_by, rec.assigned_to);

end;
$$;

revoke all on function public.client_confirm_completion(uuid) from public;
grant execute on function public.client_confirm_completion(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 5. Update the task_deliverables RLS to allow pending_client_review too
-- ─────────────────────────────────────────────────────────────
drop policy if exists "assigned members submit deliverables" on public.task_deliverables;
create policy "assigned members submit deliverables" on public.task_deliverables
  for insert with check (
    submitted_by = auth.uid()
    and exists (
      select 1 from public.tasks t
       where t.id = task_id
         and t.assigned_to = auth.uid()
         and t.status in ('assigned','in_progress','pending_client_review')
    )
  );

-- Also allow storage bucket for deliverables (idempotent)
insert into storage.buckets (id, name, public)
  values ('task-deliverables', 'task-deliverables', false)
  on conflict (id) do nothing;

drop policy if exists "assigned providers upload deliverables" on storage.objects;
create policy "assigned providers upload deliverables" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'task-deliverables'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "task participants view deliverables" on storage.objects;
create policy "task participants view deliverables" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'task-deliverables'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_staff()
      or exists (
        select 1 from public.tasks t
         where t.id::text = (storage.foldername(name))[2]
           and t.posted_by = auth.uid()
      )
    )
  );
