alter table public.whatsapp_messages
add column if not exists status_updated_at timestamptz;

create index if not exists whatsapp_messages_status_updated_at_idx
  on public.whatsapp_messages(status_updated_at);
