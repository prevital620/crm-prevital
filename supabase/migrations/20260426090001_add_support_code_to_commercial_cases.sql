create sequence if not exists public.commercial_cases_support_code_seq;

alter table public.commercial_cases
add column if not exists support_code text;

with current_max as (
  select coalesce(max(support_code::bigint), 0) as value
  from public.commercial_cases
  where support_code ~ '^[0-9]{1,}$'
)
select setval(
  'public.commercial_cases_support_code_seq',
  greatest((select value from current_max), 1),
  ((select value from current_max) > 0)
);

alter table public.commercial_cases
alter column support_code
set default lpad(nextval('public.commercial_cases_support_code_seq')::text, 6, '0');

update public.commercial_cases
set support_code = lpad(nextval('public.commercial_cases_support_code_seq')::text, 6, '0')
where support_code is null;

alter table public.commercial_cases
drop constraint if exists commercial_cases_support_code_format_check;

alter table public.commercial_cases
add constraint commercial_cases_support_code_format_check
check (support_code is null or support_code ~ '^[0-9]{6}$');

create unique index if not exists commercial_cases_support_code_unique_idx
on public.commercial_cases (support_code)
where support_code is not null;
