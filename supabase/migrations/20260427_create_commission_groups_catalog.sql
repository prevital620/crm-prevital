create table if not exists public.commission_groups (
  code text primary key,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.commission_groups
drop constraint if exists commission_groups_code_format_check;

alter table public.commission_groups
add constraint commission_groups_code_format_check
check (code ~ '^[A-Z]{2}$');

insert into public.commission_groups (code)
select distinct group_code
from (
  select upper(trim(commission_group_code)) as group_code
  from public.profiles
  where commission_group_code ~ '^[A-Za-z]{2}$'

  union

  select upper(left(employee_code, 2)) as group_code
  from public.profiles
  where employee_code ~ '^[A-Za-z]{2}[0-9]{4}$'
) groups
where group_code is not null
on conflict (code) do nothing;

update public.profiles
set commission_group_code = upper(trim(commission_group_code))
where commission_group_code is not null;

update public.profiles
set commission_group_code = null
where commission_group_code is not null
  and commission_group_code !~ '^[A-Z]{2}$';

alter table public.profiles
drop constraint if exists profiles_commission_group_code_fkey;

alter table public.profiles
add constraint profiles_commission_group_code_fkey
foreign key (commission_group_code)
references public.commission_groups (code);
