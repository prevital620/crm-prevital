do $$
begin
  if to_regclass('public.agenda_slot_settings') is not null then
    update public.agenda_slot_settings
    set capacity = 10
    where capacity = 6;
  end if;

  if to_regclass('public.agenda_day_settings') is not null then
    update public.agenda_day_settings
    set daily_capacity = 100
    where daily_capacity = 60;
  end if;
end $$;
