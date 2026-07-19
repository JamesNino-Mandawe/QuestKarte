-- QuestKarte: Messaging Enhancements (Feature 5)
-- Run this in your Supabase SQL Editor.
-- Please clear the editor before pasting this in, and do not highlight anything when you run it.

-- 1. Add attachment columns to messages
alter table public.messages
  add column if not exists attachment_url text,
  add column if not exists attachment_type text check (attachment_type in ('image', 'file', 'location'));

-- 2. Allow system messages by making sender_id nullable
-- If sender_id is null, it's rendered as a system pill in the chat.
alter table public.messages
  alter column sender_id drop not null;

-- 3. Add an RPC to handle message sending with the AI Safety Scanner
create or replace function public.send_message_safe(
  p_conversation_id uuid,
  p_body text,
  p_attachment_url text default null,
  p_attachment_type text default null,
  p_is_system boolean default false
) returns void language plpgsql security definer set search_path = public as $$
declare
  v_is_flagged boolean := false;
  v_safety_reason text := null;
  v_sender_id uuid;
begin
  if p_is_system then
    -- System message, no sender
    v_sender_id := null;
  else
    v_sender_id := auth.uid();
    
    -- AI Safety Scanner: Simple regex keyword detection for off-platform payments
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
    is_safety_flagged,
    safety_reason
  ) values (
    p_conversation_id,
    v_sender_id,
    p_body,
    p_attachment_url,
    p_attachment_type,
    v_is_flagged,
    v_safety_reason
  );

  -- If flagged, we also insert an automated system warning into the chat
  if v_is_flagged then
    insert into public.messages (
      conversation_id,
      sender_id,
      body
    ) values (
      p_conversation_id,
      null,
      '⚠️ Warning: For your safety, all payments must go through QuestKarte''s escrow system. Transactions outside the app are not protected.'
    );
  end if;
end;
$$;

revoke all on function public.send_message_safe(uuid, text, text, text, boolean) from public;
grant execute on function public.send_message_safe(uuid, text, text, text, boolean) to authenticated;
