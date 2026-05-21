alter table public.leads
add column if not exists qualification_result text;

alter table public.leads
drop constraint if exists leads_qualification_result_check;

alter table public.leads
add constraint leads_qualification_result_check
check (
  qualification_result is null
  or qualification_result = any (array['q', 'no_q']::text[])
);
