create extension if not exists pgcrypto;

create table if not exists public.whatsapp_leads (
  id uuid primary key default gen_random_uuid(),
  phone text unique not null,
  profile_name text,
  full_name text,
  email text,
  empresa text default 'Prevital',
  campaign_code text default 'PV_DETOX',
  source text default 'WhatsApp SaleADS',
  status text default 'collecting_name',
  raw_last_message jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint whatsapp_leads_status_check
    check (status in ('collecting_name', 'collecting_email', 'registered'))
);

create table if not exists public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  direction text not null,
  message_id text unique,
  body text,
  payload jsonb,
  created_at timestamptz default now(),
  constraint whatsapp_messages_direction_check
    check (direction in ('inbound', 'outbound'))
);

create index if not exists whatsapp_leads_phone_idx
  on public.whatsapp_leads(phone);

create index if not exists whatsapp_leads_campaign_code_idx
  on public.whatsapp_leads(campaign_code);

create index if not exists whatsapp_leads_status_idx
  on public.whatsapp_leads(status);

create index if not exists whatsapp_messages_phone_idx
  on public.whatsapp_messages(phone);

create index if not exists whatsapp_messages_message_id_idx
  on public.whatsapp_messages(message_id);

create or replace function public.set_whatsapp_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_whatsapp_leads_updated_at on public.whatsapp_leads;

create trigger set_whatsapp_leads_updated_at
before update on public.whatsapp_leads
for each row
execute function public.set_whatsapp_updated_at();

alter table public.whatsapp_leads enable row level security;
alter table public.whatsapp_messages enable row level security;

comment on table public.whatsapp_leads is
  'MVP WhatsApp Cloud API leads for Prevital PV_DETOX. RLS enabled; webhook writes through service role.';

comment on table public.whatsapp_messages is
  'MVP WhatsApp Cloud API message log. RLS enabled; webhook writes through service role.';
