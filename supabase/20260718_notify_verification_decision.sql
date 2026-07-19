-- QuestKarte verification outcome notifications.
-- Run after the main schema and member verification migrations.
-- This sends an in-app notification whenever staff approve or reject a request.

create or replace function public.notify_verification_decision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status
     and new.status in ('approved', 'rejected') then
    insert into public.notifications (recipient_id, type, title, body, link)
    values (
      new.user_id,
      'verification',
      case when new.status = 'approved'
        then 'Your account verification was approved'
        else 'Your account verification needs attention'
      end,
      case when new.status = 'approved'
        then 'Your QuestKarte account is now open. You can post tasks, apply, and message members.'
        else coalesce(nullif(trim(new.rejection_reason), ''), 'A moderator requested clearer or updated documents. Open QuestKarte to review the note and resubmit.')
      end,
      '/account'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists verification_decision_notification_after_update on public.verification_requests;
create trigger verification_decision_notification_after_update
after update of status on public.verification_requests
for each row execute function public.notify_verification_decision();
