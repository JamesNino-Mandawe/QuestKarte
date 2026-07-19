-- QuestKarte: Review → Trust Factor trigger
-- Run AFTER 20260719_task_payment_and_completion_gate.sql
--
-- Maps star ratings from the reviews table into trust_events so that
-- the existing refresh_trust_factor() trigger automatically recomputes
-- profiles.trust_factor after each review.
--
-- Rating → TF delta:
--   5 stars → +2
--   4 stars → +1
--   3 stars →  0  (no event inserted)
--   2 stars → -1
--   1 star  → -2
--   0 (no-show, handled via trust_events manually by staff) → -5

create or replace function public.apply_review_trust_delta()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  delta integer;
  reason_text text;
begin
  delta := case new.rating
    when 5 then  2
    when 4 then  1
    when 3 then  0
    when 2 then -1
    when 1 then -2
    else 0
  end;

  -- No event for neutral reviews
  if delta = 0 then
    return new;
  end if;

  reason_text := format(
    '%s-star review from task "%s"',
    new.rating,
    coalesce((select title from public.tasks where id = new.task_id), 'a completed task')
  );

  insert into public.trust_events
    (user_id, task_id, points, reason, created_by)
  values
    (new.reviewee_id, new.task_id, delta, reason_text, new.reviewer_id);

  return new;
end;
$$;

drop trigger if exists review_trust_delta_after_insert on public.reviews;
create trigger review_trust_delta_after_insert
  after insert on public.reviews
  for each row
  execute function public.apply_review_trust_delta();

-- Allow the trigger to insert trust_events on behalf of any authenticated user
-- (the function is security definer so it runs as the DB owner)
grant execute on function public.apply_review_trust_delta() to authenticated;
