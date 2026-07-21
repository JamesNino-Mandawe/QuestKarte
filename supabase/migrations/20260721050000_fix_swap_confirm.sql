-- 20260721050000_fix_swap_confirm.sql
create or replace function public.client_confirm_completion(target_task_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  rec record;
  receipt_body text;
begin
  select id, posted_by, assigned_to, status, payment_type,
         commission_amount, currency, title, is_service_swap
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

  if coalesce(rec.is_service_swap, false) then
    -- It's a swap, go to swap_in_progress
    update public.tasks
       set status = 'swap_in_progress'
     where id = target_task_id;

    insert into public.task_status_history
      (task_id, previous_status, new_status, changed_by, note)
    values
      (target_task_id, 'pending_client_review', 'swap_in_progress', auth.uid(),
       'Client confirmed initial job completion, starting swap');
       
    if rec.assigned_to is not null then
      insert into public.notifications
        (recipient_id, type, title, body, link)
      values
        (rec.assigned_to, 'task', 'Swap phase started!', 'The client confirmed your work. Now they will perform the swap service.', '/tasks');
    end if;

  else
    -- Not a swap, just complete it
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
  end if;
end;
$$;
