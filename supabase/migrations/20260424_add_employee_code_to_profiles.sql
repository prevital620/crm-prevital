alter table public.profiles
add column if not exists employee_code text null;

alter table public.profiles
drop constraint if exists profiles_employee_code_format_check;

alter table public.profiles
add constraint profiles_employee_code_format_check
check (
  employee_code is null
  or employee_code ~ '^[A-Za-z]{2}[0-9]{4}$'
);

create unique index if not exists profiles_employee_code_unique_idx
on public.profiles (upper(employee_code))
where employee_code is not null;
