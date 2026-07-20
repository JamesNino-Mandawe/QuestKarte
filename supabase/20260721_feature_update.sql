-- 1. Update messages for attachments
alter table public.messages drop constraint if exists messages_body_check;
alter table public.messages alter column body drop not null;
alter table public.messages 
  add column if not exists attachment_url text,
  add column if not exists attachment_type text,
  add column if not exists attachment_name text,
  add constraint messages_body_check check (
    (body is not null and char_length(body) between 1 and 3000) or 
    (attachment_url is not null)
  );

-- 2. Update tasks for hiding completed tasks
alter table public.tasks 
  add column if not exists hidden_by_poster boolean not null default false,
  add column if not exists hidden_by_assignee boolean not null default false;

-- 3. Update profiles for daily trust recovery
alter table public.profiles
  add column if not exists last_trust_recovery_at timestamptz;

-- 4. Storage Bucket for Chat Attachments
insert into storage.buckets (id, name, public) values ('chat-attachments', 'chat-attachments', false) on conflict (id) do nothing;

-- 5. Storage RLS for chat-attachments
create policy "conversation members can upload attachments" on storage.objects for insert to authenticated 
with check (
  bucket_id = 'chat-attachments' and 
  exists (
    select 1 from public.conversation_members 
    where conversation_id = (storage.foldername(name))[1]::uuid
    and user_id = auth.uid()
  )
);

create policy "conversation members can read attachments" on storage.objects for select to authenticated 
using (
  bucket_id = 'chat-attachments' and 
  exists (
    select 1 from public.conversation_members 
    where conversation_id = (storage.foldername(name))[1]::uuid
    and user_id = auth.uid()
  )
);

-- 6. Update send_message_safe to support attachment_name
create or replace function public.send_message_safe(
  p_conversation_id uuid,
  p_body text,
  p_attachment_url text default null,
  p_attachment_type text default null,
  p_attachment_name text default null,
  p_is_system boolean default false
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_is_flagged boolean := false;
  v_safety_reason text := null;
  v_sender_id uuid;
begin
  if p_is_system then
    v_sender_id := null;
  else
    v_sender_id := auth.uid();
    if p_body ~* '(gcash direct|bank transfer|bayad sa labas|pay outside|send money directly|pay me directly)' then
      v_is_flagged := true;
      v_safety_reason := 'Detected potential off-platform payment attempt.';
    end if;
  end if;

  insert into public.messages (
    conversation_id,
    sender_id,
    body,
    attachment_url,
    attachment_type,
    attachment_name,
    is_safety_flagged,
    safety_reason
  ) values (
    p_conversation_id,
    v_sender_id,
    p_body,
    p_attachment_url,
    p_attachment_type,
    p_attachment_name,
    v_is_flagged,
    v_safety_reason
  );

  if v_is_flagged then
    insert into public.messages (
      conversation_id,
      sender_id,
      body
    ) values (
      p_conversation_id,
      null,
      '?? Warning: For your safety, all payments must go through QuestKarte''s escrow system. Transactions outside the app are not protected.'
    );
  end if;
end;
$$;

create or replace function hide_task(p_task_id uuid)\nreturns void\nlanguage plpgsql\nsecurity definer\nas \nbegin\n  update public.tasks \n  set \n    hidden_by_poster = case when posted_by = auth.uid() then true else hidden_by_poster end,\n    hidden_by_assignee = case when assigned_to = auth.uid() then true else hidden_by_assignee end\n  where id = p_task_id and (posted_by = auth.uid() or assigned_to = auth.uid());\nend;\n;\n\n-- Recover daily trust
create or replace function recover_daily_trust()
returns void
language plpgsql
security definer
as $$
declare
  v_user_id uuid;
  v_last_recovery timestamp with time zone;
  v_trust_factor integer;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    return;
  end if;

  select last_trust_recovery_at, trust_factor 
  into v_last_recovery, v_trust_factor
  from public.profiles 
  where id = v_user_id;

  if v_trust_factor < 50 and (v_last_recovery is null or v_last_recovery < (now() - interval '1 day')) then
    update public.profiles 
    set 
      trust_factor = least(50, trust_factor + 1),
      last_trust_recovery_at = now()
    where id = v_user_id;

    insert into public.trust_events (user_id, task_id, points, reason)
    values (v_user_id, null, 1, 'Daily Trust Factor recovery');
  end if;
end;
$$;

