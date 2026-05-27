alter table public.whatsapp_leads
drop constraint if exists whatsapp_leads_status_check;

alter table public.whatsapp_leads
add constraint whatsapp_leads_status_check
check (
  status in (
    'collecting_name',
    'collecting_email',
    'registered',
    'registrado',
    'felicitacion_programada',
    'felicitacion_enviada',
    'respondio_para_agendar',
    'pendiente_agendar',
    'ofreciendo_horarios',
    'esperando_confirmacion_horario',
    'en_gestion_callcenter',
    'agendado',
    'sin_respuesta',
    'requiere_template',
    'requiere_humano',
    'cerrado'
  )
);
