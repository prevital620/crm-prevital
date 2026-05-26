alter table public.whatsapp_leads
add column if not exists last_inbound_at timestamptz,
add column if not exists last_outbound_at timestamptz,
add column if not exists reply_window_expires_at timestamptz,
add column if not exists safe_deadline_at timestamptz,
add column if not exists felicitation_scheduled_for timestamptz,
add column if not exists felicitation_sent_at timestamptz,
add column if not exists selected_at timestamptz,
add column if not exists assigned_to uuid null,
add column if not exists notes text,
add column if not exists priority text default 'normal';

alter table public.whatsapp_messages
add column if not exists message_type text default 'text',
add column if not exists media_url text,
add column if not exists media_caption text,
add column if not exists meta_message_id text,
add column if not exists status text,
add column if not exists error text;

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
    'en_gestion_callcenter',
    'agendado',
    'sin_respuesta',
    'requiere_template',
    'cerrado'
  )
);

create index if not exists whatsapp_leads_felicitation_scheduled_for_idx
  on public.whatsapp_leads(felicitation_scheduled_for);

create index if not exists whatsapp_leads_reply_window_expires_at_idx
  on public.whatsapp_leads(reply_window_expires_at);

create index if not exists whatsapp_messages_phone_created_at_idx
  on public.whatsapp_messages(phone, created_at);

create index if not exists whatsapp_messages_meta_message_id_idx
  on public.whatsapp_messages(meta_message_id);
