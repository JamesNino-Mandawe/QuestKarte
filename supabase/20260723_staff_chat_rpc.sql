-- QuestKarte: Staff 2-Way Chat RPC
-- Run this script in your Supabase SQL Editor to allow Admins and Moderators to initiate direct chats seamlessly.

create or replace function public.open_staff_conversation(p_target_user_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_conv_id uuid;
begin
  -- Check if conversation already exists between auth.uid() and p_target_user_id
  select cm1.conversation_id into v_conv_id
  from public.conversation_members cm1
  join public.conversation_members cm2 on cm1.conversation_id = cm2.conversation_id
  where cm1.user_id = auth.uid() and cm2.user_id = p_target_user_id
  limit 1;

  if v_conv_id is not null then
    return v_conv_id;
  end if;

  -- Create new conversation
  insert into public.conversations (created_at) values (now()) returning id into v_conv_id;

  -- Add both staff members
  insert into public.conversation_members (conversation_id, user_id)
  values (v_conv_id, auth.uid()), (v_conv_id, p_target_user_id)
  on conflict do nothing;

  return v_conv_id;
end;
$$;

grant execute on function public.open_staff_conversation(uuid) to authenticated;
