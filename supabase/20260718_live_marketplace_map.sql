-- QuestKarte live marketplace map pins.
-- Run after schema.sql and the staff moderation migration.
-- It allows the browser map to receive approved-task changes without a reload.

do $$
begin
  alter publication supabase_realtime add table public.tasks;
exception
  when duplicate_object then null;
end;
$$;
