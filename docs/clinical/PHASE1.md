# Fase 1 Clinica Segura

## Objetivo

Crear una base clinica separada del modulo comercial y operativo, con acceso
solo por API de servidor y sin exponer contenido clinico a roles no
asistenciales.

## Principios

- No mezclar historia clinica con `commercial_cases`.
- No consultar contenido clinico desde el cliente con la publishable key.
- No dar acceso libre al `super_user` tecnico al contenido clinico.
- Registrar auditoria de cada acceso o modificacion clinica.
- Mantener la operacion actual del CRM mientras se migra por fases.

## Roles y permisos

### Sin acceso a contenido clinico

- `super_user`
- `gerencia_comercial`
- `comercial`
- `recepcion`
- `supervisor_call_center`
- `tmk`
- `confirmador`
- `promotor_opc`
- `supervisor_opc`

Estos roles pueden seguir viendo:

- agenda
- plan adquirido
- datos basicos operativos permitidos

Pero no deben leer:

- historia clinica
- evoluciones
- antecedentes completos
- consentimientos
- anexos clinicos

### Con acceso clinico asistencial

- `nutricionista`
- `fisioterapeuta`
- `medico_general`

Permisos:

- ver y editar solo sus encuentros clinicos
- crear historia, antecedentes y evoluciones
- leer datos basicos del paciente necesarios para la atencion

### Con acceso clinico amplio futuro

- `coordinador_clinico`
- `auditor_clinico`

Permisos previstos:

- leer encuentros clinicos de varios profesionales
- revisar trazabilidad y auditoria
- sin mezclar funciones comerciales

## Esquema de datos

Se creo un schema `clinical` con estas tablas:

- `clinical.patients`
- `clinical.encounters`
- `clinical.histories`
- `clinical.backgrounds`
- `clinical.evolutions`
- `clinical.consents`
- `clinical.attachments`
- `clinical.audit_events`

## Estrategia de seguridad

1. Las tablas clinicas viven fuera de `public`.
2. Se accede por `app/api/clinical/*`.
3. Las rutas usan autenticacion del servidor.
4. El contenido clinico debe consultarse con `service_role` y validacion
   explicita de permisos por encuentro.
5. La siguiente migracion debe activar RLS en `clinical` y dejar bloqueado el
   acceso directo a `anon` y `authenticated`.

## Archivos base creados en esta fase

- `supabase/migrations/20260422_clinical_phase1.sql`
- `supabase/migrations/20260422_clinical_phase1_rls.sql`
- `lib/clinical/types.ts`
- `lib/clinical/access.ts`
- `lib/clinical/audit.ts`
- `app/api/clinical/patients/route.ts`
- `app/api/clinical/encounters/route.ts`
- `app/api/clinical/encounters/[id]/route.ts`
- `app/api/clinical/encounters/[id]/history/route.ts`
- `app/api/clinical/encounters/[id]/evolutions/route.ts`

## Siguiente paso recomendado

Conectar:

- `app/nutricion/atencion/[appointmentId]/page.tsx`
- `app/fisioterapia/atencion/[appointmentId]/page.tsx`

para que lean y guarden en `clinical.*` por API de servidor, en vez de depender
de tablas clinicas expuestas en el cliente.
