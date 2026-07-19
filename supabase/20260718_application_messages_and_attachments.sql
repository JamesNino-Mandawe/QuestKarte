-- QuestKarte: richer member applications.
-- Run after schema.sql and the earlier QuestKarte migrations.

alter table public.applications
  add column if not exists service_swap_offer text;

create table if not exists public.application_attachments (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text,
  created_at timestamptz not null default now()
);

alter table public.application_attachments enable row level security;

drop policy if exists "application participants read attachments" on public.application_attachments;
create policy "application participants read attachments"
on public.application_attachments for select to authenticated
using (
  uploaded_by = auth.uid()
  or exists (
    select 1 from public.applications a
    join public.tasks t on t.id = a.task_id
    where a.id = application_id
      and (a.applicant_id = auth.uid() or t.posted_by = auth.uid() or public.is_staff())
  )
);

drop policy if exists "applicants upload own application attachments" on public.application_attachments;
create policy "applicants upload own application attachments"
on public.application_attachments for insert to authenticated
with check (
  uploaded_by = auth.uid()
  and exists (select 1 from public.applications a where a.id = application_id and a.applicant_id = auth.uid())
);

drop policy if exists "applicants delete own application attachments" on public.application_attachments;
create policy "applicants delete own application attachments"
on public.application_attachments for delete to authenticated
using (uploaded_by = auth.uid());

insert into storage.buckets (id, name, public)
values ('application-attachments', 'application-attachments', false)
on conflict (id) do nothing;

drop policy if exists "applicants upload application files" on storage.objects;
create policy "applicants upload application files"
on storage.objects for insert to authenticated
with check (bucket_id = 'application-attachments' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "application participants read files" on storage.objects;
create policy "application participants read files"
on storage.objects for select to authenticated
using (
  bucket_id = 'application-attachments'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_staff()
    or exists (
      select 1 from public.application_attachments aa
      join public.applications a on a.id = aa.application_id
      join public.tasks t on t.id = a.task_id
      where aa.storage_path = name and t.posted_by = auth.uid()
    )
  )
);

drop policy if exists "applicants delete application files" on storage.objects;
create policy "applicants delete application files"
on storage.objects for delete to authenticated
using (bucket_id = 'application-attachments' and (storage.foldername(name))[1] = auth.uid()::text);
