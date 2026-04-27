alter table public.commercial_cases
alter column support_code drop default;

update public.commercial_cases
set support_code = null
where not (
  coalesce(volume_amount, sale_value, 0) > 0
  or nullif(trim(coalesce(purchased_service, '')), '') is not null
);

with ventas as (
  select
    id,
    row_number() over (
      order by coalesce(closed_at, created_at), created_at, id
    ) as rn
  from public.commercial_cases
  where
    coalesce(volume_amount, sale_value, 0) > 0
    or nullif(trim(coalesce(purchased_service, '')), '') is not null
)
update public.commercial_cases cc
set support_code = lpad((1000 + ventas.rn)::text, 6, '0')
from ventas
where cc.id = ventas.id;

with current_max as (
  select coalesce(max(support_code::bigint), 1000) as value
  from public.commercial_cases
  where support_code ~ '^[0-9]{6}$'
)
select setval(
  'public.commercial_cases_support_code_seq',
  (select value from current_max),
  true
);

create or replace function public.assign_support_code_on_sale()
returns trigger
language plpgsql
as $$
begin
  if new.support_code is null
     and (
       coalesce(new.volume_amount, new.sale_value, 0) > 0
       or nullif(trim(coalesce(new.purchased_service, '')), '') is not null
     ) then
    new.support_code := lpad(nextval('public.commercial_cases_support_code_seq')::text, 6, '0');
  end if;

  return new;
end;
$$;

drop trigger if exists trg_assign_support_code_on_sale on public.commercial_cases;

create trigger trg_assign_support_code_on_sale
before insert or update on public.commercial_cases
for each row
execute function public.assign_support_code_on_sale();
