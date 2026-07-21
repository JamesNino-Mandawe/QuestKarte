create or replace function public.update_conversation_timestamp()
returns trigger language plpgsql security definer as $$
begin
  update public.conversations
  set updated_at = now()
  where id = NEW.conversation_id;
  return NEW;
end;
$$;

drop trigger if exists on_message_inserted on public.messages;

create trigger on_message_inserted
after insert on public.messages
for each row
execute function public.update_conversation_timestamp();
