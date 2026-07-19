-- QuestKarte task reference-photo storage.
-- Run after schema.sql and 20260717_staff_moderation.sql.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('task-attachments', 'task-attachments', false, 4194304, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = 4194304, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "task owners upload reference photos" on storage.objects;
create policy "task owners upload reference photos" on storage.objects for insert to authenticated
with check (bucket_id = 'task-attachments' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "task participants view reference photos" on storage.objects;
create policy "task participants view reference photos" on storage.objects for select to authenticated
using (bucket_id = 'task-attachments' and exists (
  select 1 from public.task_attachments attachment
  join public.tasks task on task.id = attachment.task_id
  where attachment.storage_path = name
    and ((task.status = 'open' and task.moderation_state = 'approved') or task.posted_by = auth.uid() or public.is_staff())
));

drop policy if exists "task owners delete reference photos" on storage.objects;
create policy "task owners delete reference photos" on storage.objects for delete to authenticated
using (bucket_id = 'task-attachments' and (storage.foldername(name))[1] = auth.uid()::text);
