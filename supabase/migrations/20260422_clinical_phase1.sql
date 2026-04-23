create extension if not exists pgcrypto;

create schema if not exists clinical;

create table if not exists clinical.patients (
  id uuid primary key default gen_random_uuid(),
  source_user_id uuid null,
  source_lead_id uuid null,
  full_name text not null,
  document_number text null,
  phone text null,
  city text null,
  eps text null,
  occupation text null,
  birth_date date null,
  age integer null,
  sex text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists clinical.encounters (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references clinical.patients(id) on delete cascade,
  appointment_id uuid null,
  specialist_user_id uuid not null,
  specialty text not null,
  status text not null default 'open',
  started_at timestamptz not null default now(),
  closed_at timestamptz null,
  created_at timestamptz not null default now()
);

create table if not exists clinical.histories (
  id uuid primary key default gen_random_uuid(),
  encounter_id uuid not null unique references clinical.encounters(id) on delete cascade,
  chief_complaint text null,
  current_illness text null,
  review_of_systems text null,
  physical_exam text null,
  assessment text null,
  plan text null,
  created_by uuid not null,
  updated_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists clinical.backgrounds (
  id uuid primary key default gen_random_uuid(),
  encounter_id uuid not null unique references clinical.encounters(id) on delete cascade,
  pathological text null,
  surgical text null,
  toxic text null,
  allergies text null,
  medications text null,
  family_history text null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists clinical.evolutions (
  id uuid primary key default gen_random_uuid(),
  encounter_id uuid not null references clinical.encounters(id) on delete cascade,
  evolution_date timestamptz not null default now(),
  note text not null,
  created_by uuid not null,
  created_at timestamptz not null default now()
);

create table if not exists clinical.consents (
  id uuid primary key default gen_random_uuid(),
  encounter_id uuid not null references clinical.encounters(id) on delete cascade,
  consent_type text not null,
  accepted boolean not null default false,
  accepted_at timestamptz null,
  accepted_by uuid null,
  document_url text null,
  created_at timestamptz not null default now()
);

create table if not exists clinical.attachments (
  id uuid primary key default gen_random_uuid(),
  encounter_id uuid not null references clinical.encounters(id) on delete cascade,
  file_name text not null,
  file_url text not null,
  mime_type text null,
  uploaded_by uuid not null,
  created_at timestamptz not null default now()
);

create table if not exists clinical.audit_events (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid null references clinical.patients(id) on delete set null,
  encounter_id uuid null references clinical.encounters(id) on delete set null,
  actor_user_id uuid not null,
  actor_role text not null,
  action text not null,
  target_table text not null,
  target_id uuid null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists clinical_patients_document_idx
  on clinical.patients (document_number);

create index if not exists clinical_patients_phone_idx
  on clinical.patients (phone);

create index if not exists clinical_encounters_specialist_idx
  on clinical.encounters (specialist_user_id, status, started_at desc);

create index if not exists clinical_evolutions_encounter_idx
  on clinical.evolutions (encounter_id, evolution_date desc);

create index if not exists clinical_audit_events_encounter_idx
  on clinical.audit_events (encounter_id, created_at desc);
