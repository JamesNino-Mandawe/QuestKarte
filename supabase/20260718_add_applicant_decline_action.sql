-- QuestKarte: let the original task poster decline one pending application.
-- Run after the existing application acceptance migration.

create or replace function public.decline_application(target_application_id uuid)
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
    raise exception 'Only the task poster can decline an application';
  end if;

  update public.applications
  set status = 'rejected'::public.application_status
  where id = target_application_id
    and status in ('pending'::public.application_status, 'shortlisted'::public.application_status);

  if not found then
    raise exception 'This application can no longer be declined';
  end if;

  insert into public.notifications (recipient_id, type, title, body, link)
  values (
    selected_applicant,
    'application'::public.notification_type,
    'Application declined',
    'The task poster declined your application. You can continue exploring open tasks.',
    '/tasks'
  );
end;
$$;

revoke all on function public.decline_application(uuid) from public;
grant execute on function public.decline_application(uuid) to authenticated;
