alter table public.commercial_cases
add column if not exists manager_commission_user_id uuid references public.profiles(id) on delete set null;

create index if not exists commercial_cases_manager_commission_user_id_idx
on public.commercial_cases(manager_commission_user_id);
