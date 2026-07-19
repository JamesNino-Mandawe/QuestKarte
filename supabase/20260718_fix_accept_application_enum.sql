-- QuestKarte: repair application acceptance enum casting.
-- Safe to run once or repeatedly in the Supabase SQL Editor.

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
    select 1
    from public.tasks
    where id = selected_task
      and posted_by = auth.uid()
      and status = 'open'
  ) then
    raise exception 'Only the task owner can accept an application';
  end if;

  -- Assign the selected applicant first. The application-status trigger opens
  -- the private task chat, and that chat requires tasks.assigned_to to exist.
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
  values (
    selected_task,
    'open'::public.task_status,
    'assigned'::public.task_status,
    auth.uid(),
    'Applicant accepted'
  );

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
