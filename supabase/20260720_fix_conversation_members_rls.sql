-- Fix conversation_members RLS policy to avoid infinite recursion
drop policy if exists "members read conversation membership" on public.conversation_members;

create or replace function public.get_my_conversation_ids()
returns setof uuid
language sql
security definer
set search_path = public
as $$
  select conversation_id from public.conversation_members where user_id = auth.uid();
$$;

create policy "members read conversation membership" on public.conversation_members
for select using (
  user_id = auth.uid()
  or conversation_id in (select public.get_my_conversation_ids())
);

-- Fix tasks RLS so the assigned applicant can still view the task details
drop policy if exists "open approved tasks are public" on public.tasks;

create policy "open approved tasks are public" on public.tasks for select
using (
  (status = 'open' and moderation_state = 'approved') 
  or posted_by = auth.uid() 
  or assigned_to = auth.uid() 
  or public.is_staff()
);
