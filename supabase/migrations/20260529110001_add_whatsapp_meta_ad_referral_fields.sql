alter table public.whatsapp_leads
add column if not exists meta_campaign_id text,
add column if not exists meta_campaign_name text,
add column if not exists meta_adset_id text,
add column if not exists meta_adset_name text,
add column if not exists meta_ad_id text,
add column if not exists meta_ad_name text,
add column if not exists meta_source_id text,
add column if not exists meta_source_url text,
add column if not exists meta_source_type text,
add column if not exists meta_ctwa_clid text,
add column if not exists meta_referral jsonb;

create index if not exists whatsapp_leads_meta_campaign_id_idx
  on public.whatsapp_leads(meta_campaign_id);

create index if not exists whatsapp_leads_meta_adset_id_idx
  on public.whatsapp_leads(meta_adset_id);

create index if not exists whatsapp_leads_meta_ad_id_idx
  on public.whatsapp_leads(meta_ad_id);

create index if not exists whatsapp_leads_meta_source_id_idx
  on public.whatsapp_leads(meta_source_id);
