-- QuestKarte: Service Swap Two-Phase Progress Tracking
--
-- This migration updates the task completion flow specifically for "Service Swaps".
-- When a service swap task is approved by the client, it moves to 'swap_in_progress'
-- where the provider (poster) must now submit their swapped deliverables. 
-- The applicant (doer) then reviews and marks it fully completed.

-- 1. Extend task_status enum
do $$
begin
  if not exists (select 1 from pg_enum where enumtypid = 'public.task_status'::regtype and enumlabel = 'swap_in_progress') then
    alter type public.task_status add value 'swap_in_progress' before 'completed';
  end if;
  if not exists (select 1 from pg_enum where enumtypid = 'public.task_status'::regtype and enumlabel = 'pending_swap_review') then
    alter type public.task_status add value 'pending_swap_review' before 'completed';
  end if;
end
$$;

-- 2. Update client_confirm_completion
create or replace function public.client_confirm_completion(target_task_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  rec record;
  receipt_body text;
begin
  select id, posted_by, assigned_to, status, payment_type, commission_amount, currency, title, is_service_swap
    into rec
    from public.tasks
   where id = target_task_id
     for update;

  if rec.id is null then raise exception 'Task not found'; end if;
  if rec.posted_by is distinct from auth.uid() then raise exception 'Only the task poster can confirm completion'; end if;
  if rec.status <> 'pending_client_review' then raise exception 'Task must be pending client review to confirm'; end if;

  if rec.is_service_swap then
    -- Service Swap Flow: Move to swap_in_progress
    update public.tasks set status = 'swap_in_progress' where id = target_task_id;
    
    insert into public.task_status_history (task_id, previous_status, new_status, changed_by, note)
    values (target_task_id, 'pending_client_review', 'swap_in_progress', auth.uid(), 'Client confirmed applicant work. Swap phase started.');

    -- Notify applicant
    if rec.assigned_to is not null then
      insert into public.notifications (recipient_id, type, title, body, link)
      values (rec.assigned_to, 'task', 'Your work was approved!', 'The client approved your work. They will now complete their part of the service swap.', '/tasks');
    end if;

    -- Notify client (self)
    insert into public.notifications (recipient_id, type, title, body, link)
    values (rec.posted_by, 'task', 'Swap phase started', format('You approved the applicant''s work for "%s". It is now your turn to provide the swapped service and submit proof.', rec.title), '/tasks');

  else
    -- Normal Flow: Move to completed
    update public.tasks
       set status         = 'completed',
           payment_status = 'released',
           completed_at   = now()
     where id = target_task_id;

    insert into public.task_status_history (task_id, previous_status, new_status, changed_by, note)
    values (target_task_id, 'pending_client_review', 'completed', auth.uid(), 'Client confirmed job completion');

    receipt_body := case rec.payment_type
      when 'gcash' then format('Payment of %s %s for "%s" has been released to your account.', rec.currency, to_char(coalesce(rec.commission_amount, 0), 'FM999,999,990.00'), rec.title)
      else format('"%s" is complete. You can now arrange the cash meetup through the task chat.', rec.title)
    end;

    if rec.assigned_to is not null then
      insert into public.notifications (recipient_id, type, title, body, link)
      values (rec.assigned_to, 'task', case rec.payment_type when 'gcash' then 'Payment released!' else 'Task complete — arrange meetup' end, receipt_body, '/tasks');
    end if;

    insert into public.notifications (recipient_id, type, title, body, link)
    values (rec.posted_by, 'task', 'Job confirmed — task completed', format('You confirmed "%s" as complete. You can now leave a review.', rec.title), '/tasks');

    update public.profiles set completed_tasks_count = completed_tasks_count + 1 where id in (rec.posted_by, rec.assigned_to);
  end if;
end;
$$;

-- 3. New RPC: provider_mark_swap_done
create or replace function public.provider_mark_swap_done(target_task_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  rec record;
begin
  select id, posted_by, assigned_to, status, is_service_swap
    into rec
    from public.tasks
   where id = target_task_id
     for update;

  if rec.id is null then raise exception 'Task not found'; end if;
  if rec.posted_by is distinct from auth.uid() then raise exception 'Only the task poster can mark swap as done'; end if;
  if rec.status <> 'swap_in_progress' then raise exception 'Task must be in swap progress phase'; end if;

  if not exists (
    select 1 from public.task_deliverables
     where task_id = target_task_id
       and submitted_by = auth.uid()
  ) then
    raise exception 'Upload at least one proof photo before marking your swap done';
  end if;

  update public.tasks set status = 'pending_swap_review' where id = target_task_id;

  insert into public.task_status_history (task_id, previous_status, new_status, changed_by, note)
  values (target_task_id, 'swap_in_progress', 'pending_swap_review', auth.uid(), 'Provider marked their swap service as done and submitted proof');

  if rec.assigned_to is not null then
    insert into public.notifications (recipient_id, type, title, body, link)
    values (rec.assigned_to, 'task', 'Provider finished swap service', 'The provider marked their service swap as done. Review the proof to fully complete the task.', '/tasks');
  end if;
end;
$$;

-- 4. New RPC: applicant_confirm_swap_completion
create or replace function public.applicant_confirm_swap_completion(target_task_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  rec record;
begin
  select id, posted_by, assigned_to, status, title
    into rec
    from public.tasks
   where id = target_task_id
     for update;

  if rec.id is null then raise exception 'Task not found'; end if;
  if rec.assigned_to is distinct from auth.uid() then raise exception 'Only the assigned applicant can confirm the swap completion'; end if;
  if rec.status <> 'pending_swap_review' then raise exception 'Task must be pending swap review'; end if;

  update public.tasks
     set status = 'completed',
         completed_at = now()
   where id = target_task_id;

  insert into public.task_status_history (task_id, previous_status, new_status, changed_by, note)
  values (target_task_id, 'pending_swap_review', 'completed', auth.uid(), 'Applicant confirmed provider''s swap work. Task is fully completed.');

  insert into public.notifications (recipient_id, type, title, body, link)
  values (rec.posted_by, 'task', 'Service swap complete!', format('The applicant approved your swap work for "%s". The task is now fully complete.', rec.title), '/tasks');
  
  insert into public.notifications (recipient_id, type, title, body, link)
  values (rec.assigned_to, 'task', 'Service swap complete!', format('You confirmed "%s" is complete. You can now leave a review.', rec.title), '/tasks');

  update public.profiles set completed_tasks_count = completed_tasks_count + 1 where id in (rec.posted_by, rec.assigned_to);
end;
$$;

revoke all on function public.provider_mark_swap_done(uuid) from public;
grant execute on function public.provider_mark_swap_done(uuid) to authenticated;
revoke all on function public.applicant_confirm_swap_completion(uuid) from public;
grant execute on function public.applicant_confirm_swap_completion(uuid) to authenticated;


-- 5. Update RLS policies for deliverables
drop policy if exists "assigned members submit deliverables" on public.task_deliverables;
create policy "assigned members submit deliverables" on public.task_deliverables
  for insert with check (
    submitted_by = auth.uid()
    and exists (
      select 1 from public.tasks t
       where t.id = task_id
         and (
           (t.assigned_to = auth.uid() and t.status in ('assigned','in_progress','pending_client_review'))
           or
           (t.posted_by = auth.uid() and t.status in ('swap_in_progress','pending_swap_review'))
         )
    )
  );
