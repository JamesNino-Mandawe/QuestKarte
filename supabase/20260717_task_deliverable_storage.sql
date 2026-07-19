-- QuestKarte protected deliverable uploads.
-- Run AFTER 20260717_task_progress_notifications.sql.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('task-deliverables', 'task-deliverables', false, 10485760, array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update set public = false, file_size_limit = 10485760, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "task participants read deliverables" on storage.objects;
create policy "task participants read deliverables" on storage.objects for select to authenticated
using (bucket_id = 'task-deliverables' and exists (select 1 from public.task_deliverables d join public.tasks t on t.id = d.task_id where d.storage_path = name and (t.posted_by = auth.uid() or t.assigned_to = auth.uid() or public.is_staff())));

drop policy if exists "assigned providers upload deliverables" on storage.objects;
create policy "assigned providers upload deliverables" on storage.objects for insert to authenticated
with check (bucket_id = 'task-deliverables' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "providers delete own deliverables" on storage.objects;
create policy "providers delete own deliverables" on storage.objects for delete to authenticated
using (bucket_id = 'task-deliverables' and owner_id = auth.uid()::text);
