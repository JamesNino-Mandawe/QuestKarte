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

  if rec.id is null then raise exception 'Task not found'; end if;
  if auth.uid() not in (rec.posted_by, rec.assigned_to) then raise exception 'Only participants can update payment status'; end if;

  if role = 'client' then
    if auth.uid() <> rec.posted_by then raise exception 'Not the client'; end if;
    new_status := 'client_paid';
    if current_status = 'provider_paid' then new_status := 'paid'; end if;
  elsif role = 'provider' then
    if auth.uid() <> rec.assigned_to then raise exception 'Not the provider'; end if;
    new_status := 'provider_paid';
    if current_status = 'client_paid' then new_status := 'paid'; end if;
  end if;

  update public.tasks set payment_status = new_status where id = target_task_id;

  if new_status = 'paid' then
    insert into public.task_status_history (task_id, previous_status, new_status, changed_by, note)
    values (target_task_id, 'completed', 'completed', auth.uid(), 'Cash payment was successfully exchanged');

    insert into public.notifications (recipient_id, type, title, body, link)
    values (rec.posted_by, 'task', 'Job confirmed — task completed', format('You confirmed "%s" as complete. You can now leave a review.', rec.title), '/tasks');

    insert into public.notifications (recipient_id, type, title, body, link)
    values (rec.assigned_to, 'task', 'Payment Received!', format('Cash payment for "%s" has been confirmed.', rec.title), '/tasks');
  end if;
end;
$$;
