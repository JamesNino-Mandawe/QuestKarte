-- QuestKarte member trust and verification foundation.
-- Run AFTER schema.sql and 20260717_staff_moderation.sql.

alter table public.profiles
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists verification_status text not null default 'unverified'
    check (verification_status in ('unverified', 'pending', 'verified', 'rejected')),
  add column if not exists average_rating numeric(3,2) not null default 0 check (average_rating between 0 and 5),
  add column if not exists rating_count integer not null default 0 check (rating_count >= 0);

alter table public.profiles drop constraint if exists profiles_trust_factor_check;
alter table public.profiles add constraint profiles_trust_factor_check check (trust_factor between 0 and 100);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, username, terms_accepted_at)
  values (new.id, coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1)), nullif(lower(new.raw_user_meta_data ->> 'username'), ''), case when new.raw_user_meta_data ? 'terms_accepted_at' then (new.raw_user_meta_data ->> 'terms_accepted_at')::timestamptz else null end);
  insert into public.user_roles (user_id, role) values (new.id, 'user');
  insert into public.private_profiles (user_id) values (new.id);
  return new;
end;
$$;

-- Trust is derived from protected events and can never exceed 100.
create or replace function public.refresh_trust_factor()
returns trigger language plpgsql security definer set search_path = public as $$
declare target_user uuid;
begin
  target_user := coalesce(new.user_id, old.user_id);
  update public.profiles
  set trust_factor = least(100, greatest(0, coalesce((select sum(points) from public.trust_events where user_id = target_user), 0)))
  where id = target_user;
  return coalesce(new, old);
end;
$$;

create or replace function public.refresh_review_summary()
returns trigger language plpgsql security definer set search_path = public as $$
declare target_user uuid;
begin
  target_user := coalesce(new.reviewee_id, old.reviewee_id);
  update public.profiles set
    average_rating = coalesce((select round(avg(rating)::numeric, 2) from public.reviews where reviewee_id = target_user), 0),
    rating_count = (select count(*) from public.reviews where reviewee_id = target_user)
  where id = target_user;
  return coalesce(new, old);
end;
$$;

drop trigger if exists reviews_refresh_summary on public.reviews;
create trigger reviews_refresh_summary after insert or update or delete on public.reviews
for each row execute function public.refresh_review_summary();

create or replace function public.apply_verification_result()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'approved' and old.status is distinct from 'approved' then
    update public.profiles set
      verification_status = 'verified',
      student_verified_at = case when new.type = 'student' then now() else student_verified_at end,
      professional_verified_at = case when new.type = 'professional' then now() else professional_verified_at end
    where id = new.user_id;
    insert into public.trust_events (user_id, points, reason, created_by)
    select new.user_id, 80, 'Verified QuestKarte member', new.reviewed_by
    where not exists (select 1 from public.trust_events where user_id = new.user_id and reason = 'Verified QuestKarte member');
  elsif new.status = 'rejected' then
    update public.profiles set verification_status = 'rejected' where id = new.user_id;
  end if;
  return new;
end;
$$;

create or replace function public.apply_review_trust_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare points integer;
begin
  points := case new.rating when 5 then 2 when 4 then 1 when 3 then 0 when 2 then -1 when 1 then -2 else 0 end;
  insert into public.trust_events (user_id, task_id, points, reason, created_by)
  values (new.reviewee_id, new.task_id, points, 'Task rating received', new.reviewer_id);
  return new;
end;
$$;

drop trigger if exists review_trust_change on public.reviews;
create trigger review_trust_change after insert on public.reviews
for each row execute function public.apply_review_trust_change();

drop policy if exists "members submit tasks for review" on public.tasks;
drop policy if exists "verified members submit tasks for review" on public.tasks;
create policy "verified members submit tasks for review" on public.tasks for insert
with check (posted_by = auth.uid() and status = 'draft' and moderation_state = 'pending_review' and exists (select 1 from public.profiles where id = auth.uid() and verification_status = 'verified'));

drop policy if exists "eligible users apply" on public.applications;
drop policy if exists "verified trusted users apply" on public.applications;
create policy "verified trusted users apply" on public.applications for insert
with check (applicant_id = auth.uid() and exists (select 1 from public.profiles where id = auth.uid() and verification_status = 'verified' and trust_factor >= 50) and exists (select 1 from public.tasks t where t.id = task_id and t.status = 'open' and t.moderation_state = 'approved' and t.posted_by <> auth.uid()));

-- Members can edit their public presentation, but protected trust, verification,
-- and review summary fields remain controlled by the platform.
drop policy if exists "users update their own profile" on public.profiles;
create policy "users update their own profile" on public.profiles for update
using (id = auth.uid())
with check (
  id = auth.uid()
  and trust_factor = (select trust_factor from public.profiles where id = auth.uid())
  and verification_status = (select verification_status from public.profiles where id = auth.uid())
  and average_rating = (select average_rating from public.profiles where id = auth.uid())
  and rating_count = (select rating_count from public.profiles where id = auth.uid())
  and terms_accepted_at is not distinct from (select terms_accepted_at from public.profiles where id = auth.uid())
);

-- Keep the public account status in sync while staff review private evidence.
create or replace function public.mark_verification_pending()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set verification_status = 'pending' where id = new.user_id;
  return new;
end;
$$;

drop trigger if exists verification_request_pending_after_insert on public.verification_requests;
create trigger verification_request_pending_after_insert
after insert on public.verification_requests
for each row execute function public.mark_verification_pending();
