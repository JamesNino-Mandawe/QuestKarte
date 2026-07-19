-- STEP 1: Add the new enum value.
-- Run this completely on its own, then clear the SQL editor.
-- Postgres requires this to be committed before it can be used in policies.

alter type public.task_status add value if not exists 'pending_client_review' before 'completed';
