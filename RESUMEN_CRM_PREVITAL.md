# Resumen CRM Prevital

Ultima actualizacion: 2026-05-19

Este archivo resume las decisiones y cambios principales del CRM para usarlo como contexto en nuevos hilos sin tener que repetir toda la historia.

## Estructura general

- La landing publica vive en `/`.
- El CRM interno vive en `/crm`.
- No debe haber enlaces visibles al CRM desde la landing publica.
- El sistema esta desplegado en Vercel y usa Supabase.
- Antes de tocar codigo Next.js, revisar la guia local indicada en `AGENTS.md`: `node_modules/next/dist/docs/`.

## Roles y accesos

- `super_user`: acceso global.
- `administrador`: administracion general.
- `recepcion`: agenda, admision, ingreso comercial, manifiestos y operacion diaria.
- `gerencia_comercial`: asignacion comercial, comisiones y manifiestos.
- `comercial`: gestion comercial.
- `promotor_opc`: creacion y seguimiento de leads OPC.
- `supervisor_opc`: ve promotores de su grupo, reporte OPC, usuarios de grupo, comisiones y manifiestos.
- `supervisor_call_center`: ve leads y TMK de su grupo, gestion de call center, agenda, comisiones y manifiestos.
- `confirmador`: ve gestion call center de su grupo, comisiones y manifiestos.
- `tmk`: ve sus leads, agenda/pendientes por agendar, consulta cliente propia y comisiones.

## Grupos por codigo

- Los grupos se identifican con dos letras: `CB`, `AV`, `BG`, `CZ`, `GL`, etc.
- El grupo se guarda como `commission_group_code`.
- Los codigos internos de usuarios pueden usar el prefijo del grupo, por ejemplo `CB3030`.
- Se creo catalogo de grupos de comision en Supabase.
- Los supervisores deben ver y administrar solo usuarios/leads de su grupo cuando aplique.
- Para leads creados por OPC desde la fecha configurada, el grupo `CZ` es el encargado de gestionarlos en Call Center.

## Landing y CRM

- Se movio el CRM desde `app/page.tsx` hacia `app/crm/page.tsx`.
- `app/page.tsx` quedo como landing publica de Prevital Odontologia.
- Se eliminaron de la landing los textos/botones visibles relacionados con CRM, login, sistema, panel o acceso interno.

## Modulos de leads

Se separaron dos conceptos para evitar confusion:

- `/leads`: ahora se usa como `Consulta y reportes`.
- `/call-center`: ahora se usa como `Operacion Call Center`.

En el panel principal:

- Antes habia `Consultar leads` y `Gestion de leads`, ambos se sentian repetidos.
- Se renombro `Consultar leads` a `Consulta y reportes`.
- Se renombro `Gestion de leads` a `Operacion Call Center`.

En `/leads` se agregaron vistas para no saturar:

- `Resumen del dia`
- `Promotores`
- `Listado y busqueda`

## Estados de leads y llamadas

Hay que separar estados OPC/promotor de estados TMK/Call Center.

### Estados operativos para TMK / Call Center

Estos son los estados de llamadas usados en gestion:

- `Pendientes`
- `No contesta`
- `# fuera de servicio`
- `Dato falso`
- `No interesa`
- `Cita / Agendado`

Si existe una cita activa en agenda, el lead se muestra automaticamente como `Cita / Agendado`.

### Estados historicos / OPC

Se mantienen para trazabilidad y posible pago:

- `Nuevo`
- `Pendiente de contacto`
- `Contactado`
- `Agendado`
- `Asistio`
- `No asistio`
- `Vendido`
- `Cerrado`
- `Descartado`

Importante: no mezclar automaticamente estado operativo de llamada con estado pagable. Para comisiones debe existir una regla clara.

## Reportes OPC y productividad

Se creo reporte para supervisores OPC, supervisor call center CZ y confirmador CZ.

El reporte muestra:

- Leads por promotor.
- Meta diaria: 30 leads por promotor.
- Jornada esperada: 6 horas.
- Ritmo esperado: 5 leads por hora.
- Estado visual como `Va bien`, `Va quedada`, etc.
- Opcion para marcar si una promotora no trabaja hoy.
- Por defecto todas cuentan para la meta, salvo que la supervisora las marque como no disponibles.

Tambien se agrego resumen de llamadas por promotor:

- Total leads
- Citas
- Dato falso
- Pendientes
- No contesta
- # fuera de servicio
- No interesa
- Nuevos

El resumen permite filtrar por fecha porque a veces los leads se tipifican despues del mismo dia.

## Call Center

En `/call-center`:

- Se enfoco como operacion de Call Center.
- Permite asignar leads a TMK.
- Permite priorizar sin asignar, pendientes y no contestan.
- Permite actualizar estados de llamada.
- Permite ver resumen por estado.
- Permite cancelar citas y liberar cupos.
- Los supervisores y confirmadores solo deben ver su grupo cuando aplique.

## TMK

Cambios realizados:

- Se quito/importar leads del modulo TMK.
- Se agrego consulta de cliente para que TMK consulte solo sus propios registros.
- Se agrego vista de pendientes por agendar.
- El boton `Ver agenda` se cambio por una idea mas clara tipo `Agendar nuevo`.
- Los estados de llamada relevantes para TMK son los operativos: pendientes, no contesta, fuera de servicio, dato falso, no interesa y cita/agendado.

## Recepcion e ingreso comercial

Se trabajo el ingreso comercial para:

- Registrar llegada del cliente.
- Seleccionar origen/fuente de la cita.
- Seleccionar grupo TMK si aplica.
- Seleccionar OPC relacionado si aplica.
- Autoseleccionar datos desde agenda cuando el cliente llega desde una cita.
- Permitir ajustar el origen si es necesario.

Tambien se agregaron mensajes de error mas claros en espanol usando `lib/errors/spanish.ts`.

## Manifiestos

Se habilito acceso a manifiestos sin dar acceso completo a recepcion.

Roles con acceso:

- `super_user`
- `administrador`
- `gerencia_comercial`
- `supervisor_opc`
- `supervisor_call_center`
- `confirmador`
- `recepcion`

Cambios:

- Manifiestos por rango de fechas.
- Totalizacion por periodo.
- Impresion ajustada para que quepa mejor en horizontal.
- Se agrego analista/comercial que atendio.
- Se cambio valor de venta por valor caja donde correspondia.
- Se agrego valor comisionable.

Regla de valor comisionable:

- Base: valor caja menos 200.000.
- Si fue por credito como Addi, Welli, Meddipay u otras, se descuenta adicionalmente el 10% del valor caja.

## Comisiones

El calculo actual de comisiones esta principalmente en:

- `app/admin/comisiones/page.tsx`

Logica observada:

- OPC:
  - Comision fija segun si es Q y si el origen es directo o no.
  - Comision variable sobre base neta si hay venta.
- TMK:
  - Comision fija si es Q.
  - Comision variable sobre base neta si hay venta.
  - Base puede tener reglas distintas si source es `base`.
- Supervisores OPC / Call:
  - Comision por equipo segun grupo o team.
- Comerciales / gerencia:
  - Comision por venta y equipo.

Pendiente importante:

- Definir tabla exacta de escala pagable para estados de lead.
- Separar claramente `estado operativo` de `estado pagable`.
- Confirmar valores para:
  - OPC dato real pendiente.
  - OPC agendado.
  - OPC asistio No Q.
  - OPC asistio Q.
  - TMK cita/agendado.
  - TMK Q.
  - TMK venta.

## Usuarios y roles

Se agrego/mejoro:

- Filtro por rol.
- Filtro por grupo.
- Visualizacion de usuarios de un rol/grupo.
- Supervisores pueden ver personal de su grupo.
- Supervisores pueden habilitar/deshabilitar personal de su grupo, segun reglas.
- Los usuarios inactivos no deben aparecer en listas operativas:
  - Recepcion para seleccionar OPC/TMK.
  - Gerencia comercial para asignar comerciales.

## Gerencia comercial

Se corrigieron casos donde gerente comercial no veia registros comerciales actuales.

Tambien se dio acceso temporal/funcional a registro de clientes desde recepcion cuando la recepcionista no podia asistir, cuidando no dar acceso completo innecesario.

## Historias clinicas y especialistas

Se detecto que algunos clientes atendidos por especialistas no quedaban consultables como historias clinicas.

Se trabajo para que clientes de especialistas puedan quedar registrados y consultables, no solo accesibles desde agenda.

## Supabase y despliegue

Comandos frecuentes:

```powershell
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push
```

Si aparece problema de historial de migraciones:

```powershell
supabase migration repair --status reverted <version>
supabase db pull
```

Para subir cambios a Git/Vercel:

```powershell
git add <archivos>
git commit -m "Mensaje claro"
git push origin main
```

No usar `git add .` si aparece modificado:

```text
supabase/.temp/cli-latest
```

Ese archivo es temporal y normalmente no se debe subir.

## Archivos importantes tocados

- `app/page.tsx`: landing publica.
- `app/crm/page.tsx`: CRM interno.
- `lib/crm/quick-actions.ts`: tarjetas y accesos por rol.
- `app/leads/page.tsx`: consulta, reportes, resumen por promotor, vistas.
- `app/call-center/page.tsx`: operacion Call Center.
- `app/recepcion/page.tsx`: recepcion, agenda, ingreso comercial.
- `app/admin/comisiones/page.tsx`: calculo de comisiones.
- `app/manifiestos` o modulo equivalente: manifiestos.
- `app/usuarios/page.tsx` y `app/usuarios/[id]/page.tsx`: usuarios, roles y grupos.
- `lib/commissions/*`: helpers de grupos de comision.
- `lib/leads/group-routing.ts`: reglas de visibilidad por grupo.
- `lib/errors/spanish.ts`: mensajes de error en espanol.

## Pendientes recomendados

- Definir y programar escala exacta de pago por estados de lead.
- Crear una pantalla administrativa para reglas de comision, si se quiere evitar cambios de codigo cada vez.
- Revisar permisos finos para supervisores que activan/desactivan personal.
- Validar en produccion los flujos:
  - Crear lead OPC.
  - Verlo en CZ cuando aplique.
  - Asignarlo a TMK.
  - Cambiar estado de llamada.
  - Agendar cita.
  - Registrar ingreso comercial.
  - Ver manifiesto.
  - Ver comision generada.

