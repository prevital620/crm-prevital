alter table public.opc_work_sessions
add column if not exists shift_started_at timestamptz null;

update public.opc_work_sessions
set shift_started_at = started_at
where shift_started_at is null
  and is_scheduled is true
  and unavailable_reason is null;

notify pgrst, 'reload schema';
