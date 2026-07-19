-- QUESTKARTE DEVELOPMENT RESET
-- WARNING: This permanently deletes ALL test accounts and all user-created data.
-- It keeps the database schema, security policies, and default categories.
-- Use only in the Supabase SQL Editor while the project is still in testing.
-- Never expose this action to normal users in the QuestKarte website.

begin;

-- Delete private verification files first. They do not disappear automatically with database rows.
delete from storage.objects where bucket_id = 'verification-documents';

-- Clear every table that contains user-generated data.
truncate table
  public.admin_audit_logs,
  public.reports,
  public.disputes,
  public.notifications,
  public.saved_tasks,
  public.reviews,
  public.messages,
  public.conversation_members,
  public.conversations,
  public.verification_requests,
  public.task_status_history,
  public.applications,
  public.task_attachments,
  public.trust_events,
  public.tasks,
  public.user_roles,
  public.private_profiles,
  public.profiles
restart identity cascade;

-- Remove Supabase Authentication accounts last.
delete from auth.users;

commit;

-- Categories are intentionally preserved, so the app still has Cleaning, Delivery, Tutoring, etc.
