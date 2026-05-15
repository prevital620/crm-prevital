update public.opc_work_sessions
set
  is_scheduled = true,
  unavailable_reason = null,
  updated_at = now()
where work_date = current_date
  and is_scheduled is false
  and unavailable_reason = 'No trabaja hoy';

notify pgrst, 'reload schema';
