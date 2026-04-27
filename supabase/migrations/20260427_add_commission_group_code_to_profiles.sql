alter table public.profiles
add column if not exists commission_group_code text null;

update public.profiles
set commission_group_code = upper(left(employee_code, 2))
where
  commission_group_code is null
  and employee_code ~ '^[A-Za-z]{2}[0-9]{4}$';

alter table public.profiles
drop constraint if exists profiles_commission_group_code_format_check;

alter table public.profiles
add constraint profiles_commission_group_code_format_check
check (
  commission_group_code is null
  or commission_group_code ~ '^[A-Za-z]{2}$'
);
