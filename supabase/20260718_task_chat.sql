-- QuestKarte task-linked private chat.
-- Run after schema.sql and 20260717_task_progress_notifications.sql.

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
  select c.id into existing_conversation
  from public.conversations c
  where c.task_id = target_task_id
  limit 1;
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

create or replace function public.create_conversation_after_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'accepted' and old.status is distinct from 'accepted' then
    perform public.open_task_conversation(new.task_id);
  end if;
  return new;
end;
$$;

drop trigger if exists applications_open_task_chat on public.applications;
create trigger applications_open_task_chat
after update of status on public.applications
for each row execute function public.create_conversation_after_assignment();

do $$
begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null;
end;
$$;
