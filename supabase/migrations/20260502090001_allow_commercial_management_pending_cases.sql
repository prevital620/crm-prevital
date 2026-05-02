drop policy if exists commercial_cases_management_pending_select on public.commercial_cases;
drop policy if exists commercial_cases_management_pending_update on public.commercial_cases;

create policy commercial_cases_management_pending_select
on public.commercial_cases
for select
to authenticated
using (
  status = 'pendiente_asignacion_comercial'
  and exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
      and r.code in ('super_user', 'gerente', 'gerente_comercial', 'gerencia_comercial')
  )
);

create policy commercial_cases_management_pending_update
on public.commercial_cases
for update
to authenticated
using (
  status = 'pendiente_asignacion_comercial'
  and exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
      and r.code in ('super_user', 'gerente', 'gerente_comercial', 'gerencia_comercial')
  )
)
with check (
  exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
      and r.code in ('super_user', 'gerente', 'gerente_comercial', 'gerencia_comercial')
  )
);
