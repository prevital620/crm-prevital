# Resumen CRM Prevital

Ultima actualizacion: 2026-05-26

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
- Para leads creados por OPC desde el 2026-05-27 1:11 p. m. hora Colombia, el grupo `CB` es el encargado de gestionarlos en Call Center.

## Landing y CRM

- Se movio el CRM desde `app/page.tsx` hacia `app/crm/page.tsx`.
- `app/page.tsx` quedo como landing publica de Prevital Odontologia.
- Se eliminaron de la landing los textos/botones visibles relacionados con CRM, login, sistema, panel o acceso interno.
- El logo vivo actual usado en login/CRM/admin/WhatsApp esta en `public/prevital-logo-vivo.png`.
- Se crearon paginas legales publicas para Meta/WhatsApp:
  - `/politica-de-privacidad`
  - `/terminos-y-condiciones`
  - `/eliminacion-de-datos`

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
- `Leads WhatsApp` vive en `/leads/whatsapp` como bandeja operativa de WhatsApp.

## WhatsApp Cloud API

Se implemento un MVP y luego una bandeja operativa para la campana `PV_DETOX`.

Datos base de la integracion:

- Empresa: `Prevital`.
- Campana: `PV_DETOX`.
- Origen: `WhatsApp SaleADS`.
- Numero API actual: `+57 304 598 6958`.
- Webhook principal: `app/api/whatsapp/webhook/route.ts`.
- Vista operativa: `/leads/whatsapp`.
- La integracion usa tablas propias y no crea leads en la tabla principal del CRM todavia.

Tablas nuevas de Supabase:

- `whatsapp_leads`: telefono, nombre de perfil, nombre completo, correo, empresa, campana, origen, estado, ultimos tiempos de inbound/outbound, ventana de WhatsApp, programacion de felicitacion, notas y prioridad.
- `whatsapp_messages`: historial inbound/outbound por telefono, texto, payload seguro, tipo de mensaje, URL de media, caption, id de Meta, estado y error.

Migraciones relacionadas:

- `supabase/migrations/20260524090001_create_whatsapp_mvp_tables.sql`.
- `supabase/migrations/20260526110001_add_whatsapp_scheduled_flow_fields.sql`.
- `supabase/migrations/20260526124501_add_whatsapp_after_hours_ack.sql`.

Estados usados en `whatsapp_leads`:

- `collecting_name`
- `collecting_email`
- `registered`
- `registrado`
- `felicitacion_programada`
- `felicitacion_enviada`
- `respondio_para_agendar`
- `en_gestion_callcenter`
- `agendado`
- `sin_respuesta`
- `requiere_template`
- `cerrado`

Flujo automatico actual:

- Si entra un numero nuevo, se crea en `whatsapp_leads` con estado `collecting_name`.
- Cuando el usuario envia nombre, pasa a `collecting_email`.
- Cuando envia correo valido, queda registrado y se envia mensaje de confirmacion.
- Se envia imagen de inscripcion si existe `WHATSAPP_IMAGE_INSCRIPCION_URL`.
- Se calcula `reply_window_expires_at`, `safe_deadline_at` y `felicitation_scheduled_for`.
- Si el usuario responde despues de `felicitacion_enviada`, pasa a `respondio_para_agendar`.
- Existe acuse automatico fuera de horario para respuestas despues de felicitacion, controlado por `after_hours_ack_sent_at` para no repetirlo.

Regla actual de programacion de felicitacion:

- Timezone: `America/Bogota`.
- Si completa inscripcion entre 4:00 p. m. y 7:59 a. m., se programa para el proximo dia/calendario valido a las 12:43 p. m.
- Si completa inscripcion entre 8:00 a. m. y 3:59 p. m., se programa para el dia siguiente a las 8:26 a. m.
- Antes de enviar se valida que no exista `felicitation_sent_at`, que el estado siga siendo `felicitacion_programada` o `registrado`, y que no haya vencido la ventana libre de 24 horas de WhatsApp.
- Si la ventana vencio, se marca `requiere_template` y no se envia mensaje libre.

Scheduler:

- Endpoint interno: `POST /api/whatsapp/process-scheduled`.
- Protegido con `CRON_SECRET`.
- No se usa Vercel Cron frecuente porque el proyecto esta en plan Hobby.
- Se debe llamar con scheduler externo cada 10 o 15 minutos entre 8:00 a. m. y 4:00 p. m. hora Colombia.
- Debe enviarse el secreto por header autorizado segun el endpoint.

Imagenes de campana:

- `public/whatsapp/inscripcion-detox.png`
- `public/whatsapp/felicitacion-detox.png`
- URLs esperadas en produccion:
  - `https://www.prevital.co/whatsapp/inscripcion-detox.png`
  - `https://www.prevital.co/whatsapp/felicitacion-detox.png`

Variables de entorno WhatsApp:

- `WHATSAPP_VERIFY_TOKEN`
- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_API_VERSION`
- `WHATSAPP_IMAGE_INSCRIPCION_URL`
- `WHATSAPP_IMAGE_FELICITACION_URL`
- `CRON_SECRET`

Importante:

- Nunca usar `NEXT_PUBLIC_` para tokens de WhatsApp.
- No imprimir tokens en logs.
- El webhook responde 200 rapido y guarda logs seguros.
- Los mensajes outbound se envian con helpers server-side en `lib/whatsapp/sendMessage.ts` y `lib/whatsapp/outbound.ts`.

## Bandeja WhatsApp en `/leads/whatsapp`

La vista de WhatsApp se movio a Consulta y reportes, no al modulo admin.

Acceso previsto:

- Super usuario.
- Usuarios autorizados de leads/call center segun `lib/server/whatsapp-access.ts`.
- Bibiana Calle del call center CB debe poder verla.

Funcionalidad actual:

- Lista de conversaciones/leads.
- Panel de conversacion estilo WhatsApp.
- Historial desde `whatsapp_messages`, ordenado por fecha.
- Burbujas inbound/outbound.
- Envio manual de texto por `POST /api/whatsapp/messages/send`.
- Guarda mensajes salientes en `whatsapp_messages` con `direction = outbound`.
- Si se responde manualmente a un lead en `respondio_para_agendar`, puede pasar a `en_gestion_callcenter`.
- Respuestas rapidas y emojis en el textarea.
- Boton de adjuntar imagen visible, pero el envio manual de imagen queda bloqueado hasta configurar storage publico seguro.
- Contadores: pendientes por agendar, respuestas sin atender, ventana por vencer, requieren plantilla, felicitaciones programadas hoy.
- Colores por estado para distinguir rapido:
  - registrado: verde suave.
  - felicitacion_programada: azul suave.
  - felicitacion_enviada: lila.
  - respondio_para_agendar: naranja/rojo suave y prioridad alta.
  - en_gestion_callcenter: teal.
  - agendado: verde fuerte.
  - sin_respuesta/no_response: gris.
  - requiere_template: amarillo/naranja.
  - cerrado: gris oscuro.

Endpoints WhatsApp:

- `GET/POST /api/whatsapp/webhook`
- `GET /api/whatsapp/leads`
- `GET /api/whatsapp/messages?phone=...`
- `POST /api/whatsapp/messages/send`
- `POST /api/whatsapp/process-scheduled`

Casos operativos recientes:

- Para leads ya contactados o agendados por llamada, se puede marcar `status = agendado` y limpiar `felicitation_scheduled_for` para evitar mensajes automaticos fuera de contexto.
- Ejemplo aplicado: `JHON MARULANDA` / `573023667930` quedo `agendado` con nota interna y sin felicitacion programada.
- Se hizo un envio puntual a tres leads anteriores a la automatizacion y se dejo respaldo automatico fuera de horario para no dejar respuestas sin acuse.

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

Se creo reporte para supervisores OPC, supervisor call center CB y confirmador CB.

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
  - Q desde base paga 10.000.
  - Q de origen de lead redes, referidos u OPC/inbound paga 5.000.
  - No debe existir `TMK` como origen del lead; si recepcion indica origen de cita TMK, aun asi el dato del lead debe venir de base, redes, referidos u OPC.
  - Comision variable sobre base neta si hay venta.
  - Base puede tener reglas distintas si source es `base`.
- Supervisores OPC / Call:
  - Comision por equipo segun grupo o team.
- Comerciales / gerencia:
  - Comision por venta y equipo.

Notas de comisiones recientes:

- En comisiones se agregaron filtros por rol, grupo/equipo, fuente, fechas, colaborador y busqueda.
- Se quitaron botones/filtros inferiores redundantes.
- La meta AM/PM se quito de la parte visible de filtros para reducir ruido.
- El area `Call center` debe mostrarse como `Confirmador TMK`.
- `Credimio` se agrego como plataforma de credito y aplica la regla de descuento adicional del 10% para base comisionable como los otros creditos.
- Para comerciales, se agrego el concepto de `gerente encargado` para definir quien comisiona cuando hay reemplazos o asignaciones especiales.

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
- Gerencia comercial puede habilitar/inhabilitar comerciales.
- Si un usuario no puede entrar, revisar en Supabase:
  - `profiles.is_active`
  - existencia en `auth.users`
  - `auth.users.banned_until`
  - roles en `user_roles`
  - `profiles.must_change_password`
- Contrasena temporal estandar: `Prevital2026*`.

## Gerencia comercial

Se corrigieron casos donde gerente comercial no veia registros comerciales actuales.

Tambien se dio acceso temporal/funcional a registro de clientes desde recepcion cuando la recepcionista no podia asistir, cuidando no dar acceso completo innecesario.

## Historias clinicas y especialistas

Se detecto que algunos clientes atendidos por especialistas no quedaban consultables como historias clinicas.

Se trabajo para que clientes de especialistas puedan quedar registrados y consultables, no solo accesibles desde agenda.

## Nutricion, fisioterapia y agenda

- Las historias clinicas de nutricion deben poder ser consultadas por la nutricionista actual aunque hayan sido creadas por la anterior.
- Se agrego manejo para cerrar citas antiguas de nutricion y evitar que sigan apareciendo como pendientes del dia.
- En resumen de recepcion/especialistas, las citas deben mostrarse por fecha del dia y permitir filtro por fecha.
- Si una cita esta ocupada, la agenda debe bloquear la hora segun la configuracion de duracion/cupos para evitar duplicados.
- Si hay citas duplicadas manuales, revisar y dejar una sola cita valida.

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

Verificaciones frecuentes:

```powershell
npx tsc --noEmit
npm run build
```

Vercel:

- El proyecto esta desplegado en Vercel.
- Si se necesita forzar despliegue manual, usar el flujo ya vinculado del proyecto con Vercel CLI.
- No depender de Vercel Cron frecuente en Hobby; para WhatsApp usar scheduler externo contra `/api/whatsapp/process-scheduled`.

## Archivos importantes tocados

- `app/page.tsx`: landing publica.
- `app/crm/page.tsx`: CRM interno.
- `app/login/page.tsx`: login y logo del CRM.
- `lib/crm/quick-actions.ts`: tarjetas y accesos por rol.
- `app/leads/page.tsx`: consulta, reportes, resumen por promotor, vistas.
- `app/leads/whatsapp/page.tsx`: bandeja operativa de WhatsApp.
- `app/call-center/page.tsx`: operacion Call Center.
- `app/recepcion/page.tsx`: recepcion, agenda, ingreso comercial.
- `app/admin/comisiones/page.tsx`: calculo de comisiones.
- `app/manifiestos` o modulo equivalente: manifiestos.
- `app/usuarios/page.tsx` y `app/usuarios/[id]/page.tsx`: usuarios, roles y grupos.
- `app/api/whatsapp/*`: webhook, leads, mensajes, envio manual y scheduler.
- `lib/whatsapp/sendMessage.ts`: helper server-side para WhatsApp Cloud API.
- `lib/whatsapp/outbound.ts`: envio y registro de mensajes salientes.
- `lib/whatsapp/scheduling.ts`: calculo de horarios de felicitacion.
- `lib/server/whatsapp-access.ts`: permisos server-side para WhatsApp Leads.
- `lib/commissions/*`: helpers de grupos de comision.
- `lib/leads/group-routing.ts`: reglas de visibilidad por grupo.
- `lib/errors/spanish.ts`: mensajes de error en espanol.
- `public/whatsapp/*`: imagenes de campana Detox.
- `app/politica-de-privacidad/page.tsx`: pagina legal publica.
- `app/terminos-y-condiciones/page.tsx`: pagina legal publica.
- `app/eliminacion-de-datos/page.tsx`: pagina legal publica.

## Pendientes recomendados

- Definir y programar escala exacta de pago por estados de lead.
- Crear una pantalla administrativa para reglas de comision, si se quiere evitar cambios de codigo cada vez.
- Revisar permisos finos para supervisores que activan/desactivan personal.
- Definir storage publico seguro para envio manual de imagenes desde `/leads/whatsapp`.
- Conectar WhatsApp Leads con la tabla principal de leads del CRM solo cuando el mapeo sea seguro.
- Implementar plantillas aprobadas de WhatsApp para leads con ventana de 24 horas vencida; por ahora solo se marca `requiere_template`.
- Revisar que mensajes automaticos de WhatsApp mantengan emojis reales y no queden con signos `??` por problemas de encoding.
- Validar en produccion los flujos:
  - Crear lead OPC.
  - Verlo en CB cuando aplique.
  - Asignarlo a TMK.
  - Cambiar estado de llamada.
  - Agendar cita.
  - Registrar ingreso comercial.
  - Ver manifiesto.
  - Ver comision generada.
  - Recibir lead WhatsApp nuevo.
  - Completar nombre y correo por WhatsApp.
  - Enviar confirmacion e imagen.
  - Programar y procesar felicitacion.
  - Ver respuesta del usuario en `/leads/whatsapp`.
  - Responder manualmente desde el CRM.
