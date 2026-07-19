-- QuestKarte: mandatory member verification and private evidence.
-- Run this AFTER the earlier QuestKarte schema and verification migrations.
-- Supabase SQL Editor query name: Require Member Verification and Evidence

create table if not exists public.verification_evidence (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.verification_requests(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  evidence_kind text not null check (evidence_kind in ('student_id', 'study_load', 'institutional_email', 'nbi_clearance', 'government_id', 'face_verification')),
  storage_path text not null,
  file_name text not null,
  mime_type text,
  created_at timestamptz not null default now(),
  unique (request_id, evidence_kind)
);

alter table public.verification_evidence enable row level security;

drop policy if exists "members read own verification evidence" on public.verification_evidence;
create policy "members read own verification evidence" on public.verification_evidence
for select to authenticated using (user_id = auth.uid() or public.is_staff());

drop policy if exists "members add own verification evidence" on public.verification_evidence;
create policy "members add own verification evidence" on public.verification_evidence
for insert to authenticated with check (
  user_id = auth.uid()
  and exists (select 1 from public.verification_requests request where request.id = request_id and request.user_id = auth.uid())
);

create index if not exists verification_evidence_request_id_idx on public.verification_evidence(request_id);

-- Let a member record Terms acceptance, but not alter trust or staff-controlled verification fields.
-- The SECURITY DEFINER helper reads the existing row without recursive RLS evaluation.
create or replace function public.member_profile_update_is_safe(
  target_id uuid,
  proposed_trust_factor integer,
  proposed_verification_status text,
  proposed_average_rating numeric,
  proposed_rating_count integer,
  proposed_is_suspended boolean,
  proposed_terms_accepted_at timestamptz
)
returns boolean language sql security definer set search_path = public as $$
  select target_id = auth.uid()
    and proposed_terms_accepted_at is not null
    and exists (
      select 1 from public.profiles profile
      where profile.id = target_id
        and profile.trust_factor is not distinct from proposed_trust_factor
        and profile.verification_status is not distinct from proposed_verification_status
        and profile.average_rating is not distinct from proposed_average_rating
        and profile.rating_count is not distinct from proposed_rating_count
        and profile.is_suspended is not distinct from proposed_is_suspended
    );
$$;
revoke all on function public.member_profile_update_is_safe(uuid, integer, text, numeric, integer, boolean, timestamptz) from public;
grant execute on function public.member_profile_update_is_safe(uuid, integer, text, numeric, integer, boolean, timestamptz) to authenticated;

drop policy if exists "users update their own profile" on public.profiles;
create policy "users update their own profile" on public.profiles
for update to authenticated using (id = auth.uid()) with check (
  public.member_profile_update_is_safe(id, trust_factor, verification_status, average_rating, rating_count, is_suspended, terms_accepted_at)
);

-- Only moderator-approved members may create a task. This protects the UI gate at database level too.
drop policy if exists "verified members submit tasks for review" on public.tasks;
drop policy if exists "members submit tasks for review" on public.tasks;
create policy "verified members submit tasks for review" on public.tasks
for insert to authenticated with check (
  posted_by = auth.uid()
  and status = 'draft'
  and moderation_state = 'pending_review'
  and exists (select 1 from public.profiles profile where profile.id = auth.uid() and profile.verification_status = 'verified')
);
