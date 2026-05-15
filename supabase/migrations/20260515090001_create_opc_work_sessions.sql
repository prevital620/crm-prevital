create table if not exists public.opc_work_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  work_date date not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz null,
  is_scheduled boolean not null default true,
  unavailable_reason text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, work_date)
);

alter table public.opc_work_sessions
add column if not exists is_scheduled boolean not null default true;

alter table public.opc_work_sessions
add column if not exists unavailable_reason text null;

alter table public.opc_work_sessions enable row level security;

drop policy if exists opc_work_sessions_select on public.opc_work_sessions;
drop policy if exists opc_work_sessions_insert_own on public.opc_work_sessions;
drop policy if exists opc_work_sessions_update_own on public.opc_work_sessions;
drop policy if exists opc_work_sessions_insert_team on public.opc_work_sessions;
drop policy if exists opc_work_sessions_update_team on public.opc_work_sessions;

create policy opc_work_sessions_select
on public.opc_work_sessions
for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
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

create policy opc_work_sessions_insert_own
on public.opc_work_sessions
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
      and r.code = 'promotor_opc'
  )
);

create policy opc_work_sessions_update_own
on public.opc_work_sessions
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

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
