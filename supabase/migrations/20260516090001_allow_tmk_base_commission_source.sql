alter table public.commercial_cases
drop constraint if exists commercial_cases_lead_source_type_check;

alter table public.commercial_cases
add constraint commercial_cases_lead_source_type_check
check (
  lead_source_type is null
  or lead_source_type in ('opc', 'tmk', 'redes', 'base', 'otro')
);

alter table public.commercial_cases
drop constraint if exists commercial_cases_commission_source_type_check;

alter table public.commercial_cases
add constraint commercial_cases_commission_source_type_check
check (
  commission_source_type is null
  or commission_source_type in ('opc', 'tmk', 'redes', 'base', 'otro')
);
