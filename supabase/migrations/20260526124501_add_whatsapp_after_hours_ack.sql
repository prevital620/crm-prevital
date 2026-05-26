alter table public.whatsapp_leads
add column if not exists after_hours_ack_sent_at timestamptz;

create index if not exists whatsapp_leads_after_hours_ack_sent_at_idx
  on public.whatsapp_leads(after_hours_ack_sent_at);
