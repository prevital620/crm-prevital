revoke all on schema clinical from anon, authenticated;

alter table clinical.patients enable row level security;
alter table clinical.encounters enable row level security;
alter table clinical.histories enable row level security;
alter table clinical.backgrounds enable row level security;
alter table clinical.evolutions enable row level security;
alter table clinical.consents enable row level security;
alter table clinical.attachments enable row level security;
alter table clinical.audit_events enable row level security;

drop policy if exists clinical_patients_block_all on clinical.patients;
drop policy if exists clinical_encounters_block_all on clinical.encounters;
drop policy if exists clinical_histories_block_all on clinical.histories;
drop policy if exists clinical_backgrounds_block_all on clinical.backgrounds;
drop policy if exists clinical_evolutions_block_all on clinical.evolutions;
drop policy if exists clinical_consents_block_all on clinical.consents;
drop policy if exists clinical_attachments_block_all on clinical.attachments;
drop policy if exists clinical_audit_events_block_all on clinical.audit_events;

create policy clinical_patients_block_all
on clinical.patients
for all
to authenticated
using (false)
with check (false);

create policy clinical_encounters_block_all
on clinical.encounters
for all
to authenticated
using (false)
with check (false);

create policy clinical_histories_block_all
on clinical.histories
for all
to authenticated
using (false)
with check (false);

create policy clinical_backgrounds_block_all
on clinical.backgrounds
for all
to authenticated
using (false)
with check (false);

create policy clinical_evolutions_block_all
on clinical.evolutions
for all
to authenticated
using (false)
with check (false);

create policy clinical_consents_block_all
on clinical.consents
for all
to authenticated
using (false)
with check (false);

create policy clinical_attachments_block_all
on clinical.attachments
for all
to authenticated
using (false)
with check (false);

create policy clinical_audit_events_block_all
on clinical.audit_events
for all
to authenticated
using (false)
with check (false);
