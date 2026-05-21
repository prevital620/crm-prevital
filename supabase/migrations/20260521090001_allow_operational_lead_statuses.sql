alter table public.leads
drop constraint if exists leads_status_check;

alter table public.leads
add constraint leads_status_check
check (
  status = any (
    array[
      'nuevo',
      'pendiente_contacto',
      'interesado',
      'no_responde',
      'fuera_servicio',
      'contactado',
      'reagendar',
      'agendado',
      'asistio',
      'no_asistio',
      'vendido',
      'cerrado',
      'descartado',
      'dato_falso',
      'no_interesa'
    ]::text[]
  )
);
