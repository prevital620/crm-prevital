alter table public.opc_work_sessions
add column if not exists is_scheduled boolean not null default true;

alter table public.opc_work_sessions
add column if not exists unavailable_reason text null;

drop policy if exists opc_work_sessions_insert_team on public.opc_work_sessions;
drop policy if exists opc_work_sessions_update_team on public.opc_work_sessions;

create policy opc_work_sessions_insert_team
on public.opc_work_sessions
for insert
to authenticated
with check (
  exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    left join public.profiles p on p.id = ur.user_id
    where ur.user_id = auth.uid()
      and (
        r.code in ('super_user', 'supervisor_opc')
        or (
          r.code in ('supervisor_call_center', 'confirmador')
          and upper(coalesce(p.commission_group_code, '')) = 'CZ'
        )
      )
  )
);

create policy opc_work_sessions_update_team
on public.opc_work_sessions
for update
to authenticated
using (
  exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    left join public.profiles p on p.id = ur.user_id
    where ur.user_id = auth.uid()
      and (
        r.code in ('super_user', 'supervisor_opc')
        or (
          r.code in ('supervisor_call_center', 'confirmador')
          and upper(coalesce(p.commission_group_code, '')) = 'CZ'
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    left join public.profiles p on p.id = ur.user_id
    where ur.user_id = auth.uid()
      and (
        r.code in ('super_user', 'supervisor_opc')
        or (
          r.code in ('supervisor_call_center', 'confirmador')
          and upper(coalesce(p.commission_group_code, '')) = 'CZ'
        )
      )
  )
);

notify pgrst, 'reload schema';
