-- QuestKarte: fix applicant acceptance and automatic chat creation.
-- Run this in Supabase SQL Editor after the task chat migration.

create or replace function public.accept_application(target_application_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_task uuid;
  selected_applicant uuid;
begin
  select task_id, applicant_id
  into selected_task, selected_applicant
  from public.applications
  where id = target_application_id
  for update;

  if selected_task is null then
    raise exception 'Application not found';
  end if;

  if not exists (
    select 1 from public.tasks
    where id = selected_task and posted_by = auth.uid() and status = 'open'
  ) then
    raise exception 'Only the task poster can accept an application for an open task';
  end if;

  -- This must happen before the accepted application fires the chat trigger.
  update public.tasks
  set assigned_to = selected_applicant,
      status = 'assigned'::public.task_status
  where id = selected_task;

  update public.applications
  set status = case
    when id = target_application_id then 'accepted'::public.application_status
    else 'rejected'::public.application_status
  end
  where task_id = selected_task
    and status in ('pending'::public.application_status, 'shortlisted'::public.application_status);

  insert into public.task_status_history (task_id, previous_status, new_status, changed_by, note)
  values (selected_task, 'open'::public.task_status, 'assigned'::public.task_status, auth.uid(), 'Applicant accepted');

  insert into public.notifications (recipient_id, type, title, body, link)
  values (
    selected_applicant,
    'application'::public.notification_type,
    'Application accepted',
    'Your application was accepted. You can now coordinate and begin the task.',
    '/tasks'
  );
end;
$$;

revoke all on function public.accept_application(uuid) from public;
grant execute on function public.accept_application(uuid) to authenticated;

create or replace function public.open_task_conversation(target_task_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_task public.tasks%rowtype;
  existing_conversation uuid;
  new_conversation uuid;
begin
  select * into current_task from public.tasks where id = target_task_id;
  if not found or current_task.assigned_to is null then
    raise exception 'Choose and accept an applicant first. A private task chat is created after an applicant is selected.';
  end if;
  if auth.uid() not in (current_task.posted_by, current_task.assigned_to) and not public.is_staff() then
    raise exception 'Only task participants can open this conversation.';
  end if;
  select id into existing_conversation from public.conversations where task_id = target_task_id limit 1;
  if existing_conversation is not null then return existing_conversation; end if;
  insert into public.conversations (task_id) values (target_task_id) returning id into new_conversation;
  insert into public.conversation_members (conversation_id, user_id)
  values (new_conversation, current_task.posted_by), (new_conversation, current_task.assigned_to)
  on conflict do nothing;
  return new_conversation;
end;
$$;

revoke all on function public.open_task_conversation(uuid) from public;
grant execute on function public.open_task_conversation(uuid) to authenticated;
