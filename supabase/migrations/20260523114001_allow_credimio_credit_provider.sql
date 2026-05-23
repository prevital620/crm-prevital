alter table public.commercial_cases
drop constraint if exists commercial_cases_credit_provider_check;

alter table public.commercial_cases
add constraint commercial_cases_credit_provider_check
check (
  credit_provider is null
  or credit_provider in ('addi', 'welly', 'medipay', 'sumaspay', 'credimio')
);
