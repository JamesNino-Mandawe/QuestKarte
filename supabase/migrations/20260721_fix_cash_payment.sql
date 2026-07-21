-- QuestKarte: Cash Payment RPC

-- 1. Create RPC for mark_cash_payment
create or replace function public.mark_cash_payment(target_task_id uuid, role text, current_status text)
returns void language plpgsql security definer set search_path = public as $$
declare
  rec record;
  new_status text;
begin
  select id, posted_by, assigned_to, payment_status, title
    into rec
    from public.tasks
   where id = target_task_id
     for update;

  if rec.id is null then
    raise exception 'Task not found';
  end if;

  if auth.uid() not in (rec.posted_by, rec.assigned_to) then
    raise exception 'Only participants can update payment status';
  end if;

  if role = 'client' then
    if auth.uid() <> rec.posted_by then raise exception 'Not the client'; end if;
    new_status := 'client_paid';
    if current_status = 'provider_paid' then new_status := 'paid'; end if;
  elsif role = 'provider' then
    if auth.uid() <> rec.assigned_to then raise exception 'Not the provider'; end if;
    new_status := 'provider_paid';
    if current_status = 'client_paid' then new_status := 'paid'; end if;
  else
    raise exception 'Invalid role';
  end if;

  update public.tasks
     set payment_status = new_status
   where id = target_task_id;

  -- If it became paid, send notifications!
  if new_status = 'paid' then
    -- History
    insert into public.task_status_history
      (task_id, previous_status, new_status, changed_by, note)
    values
      (target_task_id, rec.payment_status, 'paid', auth.uid(),
       'Cash payment was successfully exchanged');

    -- Notify client
    insert into public.notifications
      (recipient_id, type, title, body, link)
    values
      (rec.posted_by, 'task',
       'Job confirmed — task completed',
       format('You confirmed "%s" as complete. You can now leave a review.', rec.title),
       '/tasks');

    -- Notify provider
    insert into public.notifications
      (recipient_id, type, title, body, link)
    values
      (rec.assigned_to, 'task',
       'Payment Received!',
       format('Cash payment for "%s" has been confirmed.', rec.title),
       '/tasks');
  end if;

end;
$$;

revoke all on function public.mark_cash_payment(uuid, text, text) from public;
grant execute on function public.mark_cash_payment(uuid, text, text) to authenticated;

-- 2. Update client_confirm_completion to NOT say "task completed" for cash payments
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
  if rec.payment_type = 'gcash' then
    insert into public.notifications
      (recipient_id, type, title, body, link)
    values
      (rec.posted_by, 'task',
       'Job confirmed — task completed',
       format('You confirmed "%s" as complete. You can now leave a review.', rec.title),
       '/tasks');
  else
    insert into public.notifications
      (recipient_id, type, title, body, link)
    values
      (rec.posted_by, 'task',
       'Job confirmed — Meet up for cash',
       format('You confirmed "%s" as complete. Please meet up to hand over the cash payment.', rec.title),
       '/tasks');
  end if;

  -- Increment completed_tasks_count for both
  update public.profiles
     set completed_tasks_count = completed_tasks_count + 1
   where id in (rec.posted_by, rec.assigned_to);

end;
$$;
