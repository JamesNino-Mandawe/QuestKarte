alter table public.tasks drop constraint if exists tasks_payment_status_check;
alter table public.tasks add constraint tasks_payment_status_check 
  check (payment_status in ('pending', 'held', 'released', 'client_paid', 'provider_paid', 'paid'));
