create table if not exists public.meta_conversion_events (
  id uuid primary key default gen_random_uuid(),
  whatsapp_lead_id uuid null references public.whatsapp_leads(id) on delete set null,
  appointment_id uuid null references public.appointments(id) on delete set null,
  commercial_case_id uuid null references public.commercial_cases(id) on delete set null,
  event_name text not null,
  event_time timestamptz not null,
  event_value numeric null,
  currency text null,
  meta_ctwa_clid text null,
  meta_source_id text null,
  meta_ad_id text null,
  event_id text not null,
  payload_preview jsonb,
  status text not null default 'pending',
  error_message text null,
  sent_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meta_conversion_events_status_check
    check (status in ('pending', 'sent', 'error', 'skipped'))
);

create unique index if not exists meta_conversion_events_event_id_key
  on public.meta_conversion_events(event_id);

create index if not exists meta_conversion_events_status_idx
  on public.meta_conversion_events(status);

create index if not exists meta_conversion_events_whatsapp_lead_id_idx
  on public.meta_conversion_events(whatsapp_lead_id);

create index if not exists meta_conversion_events_appointment_id_idx
  on public.meta_conversion_events(appointment_id);

create index if not exists meta_conversion_events_commercial_case_id_idx
  on public.meta_conversion_events(commercial_case_id);

create index if not exists meta_conversion_events_created_at_idx
  on public.meta_conversion_events(created_at);

drop trigger if exists set_meta_conversion_events_updated_at on public.meta_conversion_events;

create trigger set_meta_conversion_events_updated_at
before update on public.meta_conversion_events
for each row
execute function public.set_whatsapp_updated_at();

alter table public.meta_conversion_events enable row level security;

comment on table public.meta_conversion_events is
  'Cola e historial auditado para conversiones Meta preparadas desde el CRM Prevital. El envio real queda protegido y no se ejecuta automaticamente.';
