-- QuestKarte database foundation for Supabase
-- Run this once in Supabase Dashboard -> SQL Editor -> New query.
-- This schema uses one account per person. Any account can post tasks and apply for tasks.

create extension if not exists pgcrypto;

create type public.app_role as enum ('user', 'moderator', 'admin', 'super_admin');
create type public.verification_type as enum ('student', 'professional');
create type public.verification_status as enum ('pending', 'approved', 'rejected', 'expired');
create type public.task_status as enum ('draft', 'open', 'assigned', 'in_progress', 'completed', 'cancelled', 'disputed');
create type public.application_status as enum ('pending', 'shortlisted', 'accepted', 'rejected', 'withdrawn');
create type public.report_status as enum ('open', 'under_review', 'resolved', 'dismissed');
create type public.notification_type as enum ('application', 'task', 'message', 'verification', 'trust', 'system');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(full_name) between 2 and 100),
  username text unique check (username is null or username ~ '^[a-z0-9_]{3,30}$'),
  avatar_url text,
  bio text check (char_length(bio) <= 500),
  city text,
  skills text[] not null default '{}',
  trust_factor integer not null default 0 check (trust_factor >= 0),
  completed_tasks_count integer not null default 0 check (completed_tasks_count >= 0),
  student_verified_at timestamptz,
  professional_verified_at timestamptz,
  is_suspended boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Private account data stays separate from the public marketplace profile.
create table public.private_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  phone_number text,
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.app_role not null default 'user',
  granted_by uuid references public.profiles(id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  icon text,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  posted_by uuid not null references public.profiles(id) on delete restrict,
  category_id uuid references public.categories(id) on delete set null,
  title text not null check (char_length(title) between 6 and 140),
  description text not null check (char_length(description) between 20 and 5000),
  commission_amount numeric(12, 2) check (commission_amount is null or commission_amount >= 0),
  currency char(3) not null default 'PHP',
  is_service_swap boolean not null default false,
  swap_details text,
  requires_student_verification boolean not null default false,
  requires_professional_verification boolean not null default false,
  location_label text not null,
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  scheduled_for timestamptz,
  deadline_at timestamptz,
  status public.task_status not null default 'draft',
  moderation_state text not null default 'pending_review'
    check (moderation_state in ('pending_review', 'approved', 'rejected')),
  moderation_note text check (moderation_note is null or char_length(moderation_note) <= 1000),
  moderated_by uuid references public.profiles(id) on delete set null,
  moderated_at timestamptz,
  assigned_to uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint task_payment_or_swap check (
    (is_service_swap = false and commission_amount is not null)
    or (is_service_swap = true and nullif(trim(coalesce(swap_details, '')), '') is not null)
  )
);

create table public.task_attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  created_at timestamptz not null default now()
);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  applicant_id uuid not null references public.profiles(id) on delete cascade,
  cover_note text check (char_length(cover_note) <= 1500),
  video_pitch_url text,
  portfolio_url text,
  status public.application_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (task_id, applicant_id)
);

create table public.task_status_history (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  previous_status public.task_status,
  new_status public.task_status not null,
  changed_by uuid references public.profiles(id) on delete set null,
  note text check (char_length(note) <= 1000),
  created_at timestamptz not null default now()
);

create table public.verification_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type public.verification_type not null,
  status public.verification_status not null default 'pending',
  school_name text,
  school_email text,
  course text,
  institution_or_company text,
  notes text check (char_length(notes) <= 1500),
  document_path text not null,
  document_name text not null,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  rejection_reason text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint verification_data_matches_type check (
    (type = 'student' and school_name is not null)
    or (type = 'professional' and institution_or_company is not null)
  )
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references public.tasks(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz,
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 3000),
  is_safety_flagged boolean not null default false,
  safety_reason text,
  hidden_by_moderation boolean not null default false,
  created_at timestamptz not null default now(),
  edited_at timestamptz
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  reviewee_id uuid not null references public.profiles(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text check (char_length(comment) <= 1500),
  created_at timestamptz not null default now(),
  unique (task_id, reviewer_id),
  check (reviewer_id <> reviewee_id)
);

create table public.trust_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete set null,
  points integer not null check (points between -500 and 500),
  reason text not null check (char_length(reason) between 3 and 250),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.saved_tasks (
  user_id uuid not null references public.profiles(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, task_id)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  type public.notification_type not null,
  title text not null,
  body text not null,
  link text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reported_user_id uuid references public.profiles(id) on delete set null,
  task_id uuid references public.tasks(id) on delete set null,
  message_id uuid references public.messages(id) on delete set null,
  reason text not null check (char_length(reason) between 5 and 1000),
  status public.report_status not null default 'open',
  handled_by uuid references public.profiles(id) on delete set null,
  resolution_note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  check (num_nonnulls(reported_user_id, task_id, message_id) = 1)
);

create table public.disputes (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  opened_by uuid not null references public.profiles(id) on delete cascade,
  reason text not null check (char_length(reason) between 5 and 2000),
  status public.report_status not null default 'open',
  handled_by uuid references public.profiles(id) on delete set null,
  resolution_note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index tasks_feed_idx on public.tasks (status, category_id, published_at desc);
create index tasks_location_idx on public.tasks (latitude, longitude) where status = 'open';
create index applications_task_idx on public.applications (task_id, status);
create index messages_conversation_idx on public.messages (conversation_id, created_at);
create index notifications_recipient_idx on public.notifications (recipient_id, is_read, created_at desc);
create index verification_requests_review_idx on public.verification_requests (status, created_at);
create index trust_events_user_idx on public.trust_events (user_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, username)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1)),
    nullif(lower(new.raw_user_meta_data ->> 'username'), '')
  );
  insert into public.user_roles (user_id, role) values (new.id, 'user');
  insert into public.private_profiles (user_id) values (new.id);
  return new;
end;
$$;

create or replace function public.refresh_trust_factor()
returns trigger language plpgsql security definer set search_path = public as $$
declare target_user uuid;
begin
  target_user := coalesce(new.user_id, old.user_id);
  update public.profiles set trust_factor = greatest(0, coalesce((select sum(points) from public.trust_events where user_id = target_user), 0)) where id = target_user;
  return coalesce(new, old);
end;
$$;

create or replace function public.apply_verification_result()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'approved' and (old.status is distinct from 'approved') then
    update public.profiles set
      student_verified_at = case when new.type = 'student' then now() else student_verified_at end,
      professional_verified_at = case when new.type = 'professional' then now() else professional_verified_at end
    where id = new.user_id;
  end if;
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger private_profiles_updated_at before update on public.private_profiles for each row execute function public.set_updated_at();
create trigger tasks_updated_at before update on public.tasks for each row execute function public.set_updated_at();
create trigger applications_updated_at before update on public.applications for each row execute function public.set_updated_at();
create trigger verification_requests_updated_at before update on public.verification_requests for each row execute function public.set_updated_at();
create trigger conversations_updated_at before update on public.conversations for each row execute function public.set_updated_at();
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
create trigger trust_factor_after_insert after insert on public.trust_events for each row execute function public.refresh_trust_factor();
create trigger trust_factor_after_update after update on public.trust_events for each row execute function public.refresh_trust_factor();
create trigger trust_factor_after_delete after delete on public.trust_events for each row execute function public.refresh_trust_factor();
create trigger verification_result_after_update after update on public.verification_requests for each row execute function public.apply_verification_result();

create or replace function public.has_role(required_role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid() and role = required_role);
$$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid() and role in ('moderator', 'admin', 'super_admin'));
$$;

-- Row Level Security: users only access their own private records; public marketplace data remains visible.
alter table public.profiles enable row level security;
alter table public.private_profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.categories enable row level security;
alter table public.tasks enable row level security;
alter table public.task_attachments enable row level security;
alter table public.applications enable row level security;
alter table public.task_status_history enable row level security;
alter table public.verification_requests enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.reviews enable row level security;
alter table public.trust_events enable row level security;
alter table public.saved_tasks enable row level security;
alter table public.notifications enable row level security;
alter table public.reports enable row level security;
alter table public.disputes enable row level security;
alter table public.admin_audit_logs enable row level security;

create policy "public profiles are readable" on public.profiles for select using (true);
create policy "users update their own profile" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid() and trust_factor = (select trust_factor from public.profiles where id = auth.uid()));
create policy "users manage own private profile" on public.private_profiles for all using (user_id = auth.uid() or public.is_staff()) with check (user_id = auth.uid() or public.is_staff());
create policy "users read own roles" on public.user_roles for select using (user_id = auth.uid() or public.is_staff());
create policy "active categories are readable" on public.categories for select using (is_active or public.is_staff());
create policy "staff manage categories" on public.categories for all using (public.is_staff()) with check (public.is_staff());
create policy "open approved tasks are public" on public.tasks for select using ((status = 'open' and moderation_state = 'approved') or posted_by = auth.uid() or public.is_staff());
create policy "members submit tasks for review" on public.tasks for insert with check (posted_by = auth.uid() and status = 'draft' and moderation_state = 'pending_review');
create policy "owners edit their reviewable tasks" on public.tasks for update using (public.is_staff() or (posted_by = auth.uid() and status in ('draft', 'cancelled'))) with check (public.is_staff() or (posted_by = auth.uid() and status = 'draft' and moderation_state = 'pending_review'));
create policy "task owners delete drafts" on public.tasks for delete using ((posted_by = auth.uid() and status = 'draft') or public.is_staff());
create policy "task attachments follow task visibility" on public.task_attachments for select using (exists (select 1 from public.tasks t where t.id = task_id and ((t.status = 'open' and t.moderation_state = 'approved') or t.posted_by = auth.uid() or public.is_staff())));
create policy "owners upload task attachments" on public.task_attachments for insert with check (uploaded_by = auth.uid() and exists (select 1 from public.tasks t where t.id = task_id and t.posted_by = auth.uid()));
create policy "applicants and task owners read applications" on public.applications for select using (applicant_id = auth.uid() or exists (select 1 from public.tasks t where t.id = task_id and t.posted_by = auth.uid()) or public.is_staff());
create policy "eligible users apply" on public.applications for insert with check (applicant_id = auth.uid() and exists (select 1 from public.tasks t where t.id = task_id and t.status = 'open' and t.posted_by <> auth.uid()));
create policy "applicants withdraw own application" on public.applications for update using (applicant_id = auth.uid() or exists (select 1 from public.tasks t where t.id = task_id and t.posted_by = auth.uid()) or public.is_staff());
create policy "task status history visible to participants" on public.task_status_history for select using (exists (select 1 from public.tasks t where t.id = task_id and (t.posted_by = auth.uid() or t.assigned_to = auth.uid() or public.is_staff())));
create policy "staff record task history" on public.task_status_history for insert with check (public.is_staff());
create policy "users read own verification requests" on public.verification_requests for select using (user_id = auth.uid() or public.is_staff());
create policy "users request own verification" on public.verification_requests for insert with check (user_id = auth.uid() and status = 'pending');
create policy "staff review verification" on public.verification_requests for update using (public.is_staff()) with check (public.is_staff());
create policy "members read conversations" on public.conversations for select using (exists (select 1 from public.conversation_members cm where cm.conversation_id = id and cm.user_id = auth.uid()));
create policy "members read conversation membership" on public.conversation_members for select using (exists (select 1 from public.conversation_members mine where mine.conversation_id = conversation_id and mine.user_id = auth.uid()));
create policy "members read messages" on public.messages for select using (exists (select 1 from public.conversation_members cm where cm.conversation_id = messages.conversation_id and cm.user_id = auth.uid()));
create policy "members send messages" on public.messages for insert with check (sender_id = auth.uid() and exists (select 1 from public.conversation_members cm where cm.conversation_id = messages.conversation_id and cm.user_id = auth.uid()));
create policy "reviews are publicly readable" on public.reviews for select using (true);
create policy "participants write one review" on public.reviews for insert with check (reviewer_id = auth.uid() and exists (select 1 from public.tasks t where t.id = task_id and t.status = 'completed' and auth.uid() in (t.posted_by, t.assigned_to)));
create policy "trust history readable" on public.trust_events for select using (user_id = auth.uid() or public.is_staff());
create policy "staff manage trust events" on public.trust_events for all using (public.is_staff()) with check (public.is_staff());
create policy "users manage saved tasks" on public.saved_tasks for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users manage own notifications" on public.notifications for select using (recipient_id = auth.uid());
create policy "users mark own notifications read" on public.notifications for update using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());
create policy "users create reports" on public.reports for insert with check (reporter_id = auth.uid());
create policy "users read own reports" on public.reports for select using (reporter_id = auth.uid() or public.is_staff());
create policy "staff manage reports" on public.reports for update using (public.is_staff()) with check (public.is_staff());
create policy "participants read disputes" on public.disputes for select using (opened_by = auth.uid() or exists (select 1 from public.tasks t where t.id = task_id and auth.uid() in (t.posted_by, t.assigned_to)) or public.is_staff());
create policy "participants create disputes" on public.disputes for insert with check (opened_by = auth.uid() and exists (select 1 from public.tasks t where t.id = task_id and auth.uid() in (t.posted_by, t.assigned_to)));
create policy "staff manage disputes" on public.disputes for update using (public.is_staff()) with check (public.is_staff());
create policy "staff read audit logs" on public.admin_audit_logs for select using (public.is_staff());

-- Private verification evidence: create the bucket in Storage if it does not already exist.
insert into storage.buckets (id, name, public) values ('verification-documents', 'verification-documents', false) on conflict (id) do nothing;
create policy "users upload their verification evidence" on storage.objects for insert to authenticated with check (bucket_id = 'verification-documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users read their verification evidence" on storage.objects for select to authenticated using (bucket_id = 'verification-documents' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_staff()));
create policy "users delete their pending verification evidence" on storage.objects for delete to authenticated using (bucket_id = 'verification-documents' and (storage.foldername(name))[1] = auth.uid()::text);

-- Starter categories. Run once; it safely ignores duplicates.
insert into public.categories (name, slug, icon) values
  ('Cleaning', 'cleaning', 'sparkles'), ('Delivery', 'delivery', 'package'), ('Tutoring', 'tutoring', 'book-open'),
  ('Design & Tech', 'design-tech', 'monitor'), ('Academic Projects', 'academic-projects', 'graduation-cap'),
  ('Manual Labor', 'manual-labor', 'wrench'), ('Errands', 'errands', 'map-pin'), ('Pet Care', 'pet-care', 'paw-print')
on conflict (slug) do nothing;

-- After the first person signs up, promote trusted team members manually, for example:
-- insert into public.user_roles (user_id, role) values ('YOUR-USER-UUID', 'super_admin');
