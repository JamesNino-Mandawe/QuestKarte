-- STEP 3: Review Trust Factor trigger
-- Ensure your SQL editor is cleared.
-- VERY IMPORTANT: Do NOT highlight any lines of code when you click "Run".
-- Just leave your cursor anywhere and click the green Run button.

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

grant execute on function public.apply_review_trust_delta() to authenticated;
