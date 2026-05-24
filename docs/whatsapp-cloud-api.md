# WhatsApp Cloud API MVP - Prevital

Modulo nuevo para recibir mensajes de WhatsApp Cloud API en:

```text
/api/whatsapp/webhook
```

Campania actual:

```text
Empresa: Prevital
Campaign code: PV_DETOX
Origen: WhatsApp SaleADS
```

## Variables de entorno

Agregar en `.env.local` para pruebas locales y en Vercel para produccion:

```env
WHATSAPP_VERIFY_TOKEN=prevital_detox_2026
WHATSAPP_ACCESS_TOKEN=token_temporal_o_permanente_de_meta
WHATSAPP_PHONE_NUMBER_ID=phone_number_id_de_meta
WHATSAPP_API_VERSION=v25.0
```

No usar prefijo `NEXT_PUBLIC_` para estas variables. Son secretos de servidor.

## Crear tablas en Supabase

La migracion esta en:

```text
supabase/migrations/20260524090001_create_whatsapp_mvp_tables.sql
```

Aplicar con el flujo normal del proyecto:

```powershell
npx supabase db push
```

La migracion crea:

- `public.whatsapp_leads`
- `public.whatsapp_messages`

Ambas tablas tienen RLS habilitado y no exponen politicas publicas. El webhook usa `SUPABASE_SERVICE_ROLE_KEY` desde servidor para escribir.

## Probar verificacion local

Levantar Next.js:

```powershell
npm run dev
```

Probar el GET del webhook:

```powershell
Invoke-WebRequest "http://localhost:3000/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=prevital_detox_2026&hub.challenge=12345"
```

Debe responder `12345` con status 200.

Con token incorrecto debe responder 403.

## Probar POST local

Se puede enviar un payload similar al de Meta:

```powershell
$body = @{
  entry = @(
    @{
      changes = @(
        @{
          value = @{
            metadata = @{
              phone_number_id = "test_phone_number_id"
            }
            contacts = @(
              @{
                wa_id = "573001112233"
                profile = @{
                  name = "Cliente Prueba"
                }
              }
            )
            messages = @(
              @{
                from = "573001112233"
                id = "wamid.test.1"
                timestamp = "1716500000"
                type = "text"
                text = @{
                  body = "Hola"
                }
              }
            )
          }
        }
      )
    }
  )
} | ConvertTo-Json -Depth 12

Invoke-WebRequest `
  -Uri "http://localhost:3000/api/whatsapp/webhook" `
  -Method POST `
  -ContentType "application/json" `
  -Body $body
```

El endpoint debe responder `{ "ok": true }`.

## Desplegar en Vercel

1. Agregar las variables de entorno en el proyecto de Vercel.
2. Desplegar `main`.
3. Confirmar que la URL publica responda:

```text
https://TU_DOMINIO/api/whatsapp/webhook
```

## Configurar callback URL en Meta

En WhatsApp Cloud API / Webhooks:

```text
Callback URL:
https://TU_DOMINIO/api/whatsapp/webhook

Verify token:
prevital_detox_2026
```

Suscribir eventos de mensajes entrantes (`messages`).

## Flujo MVP

1. Primer mensaje: crea `whatsapp_leads` con estado `collecting_name` y pide nombre.
2. Estado `collecting_name`: guarda `full_name`, pasa a `collecting_email` y pide correo.
3. Estado `collecting_email`: valida correo basico.
4. Correo valido: guarda `email`, pasa a `registered` y confirma inscripcion.
5. Estado `registered`: informa que ya esta registrado.
6. Si el usuario escribe `actualizar datos`: vuelve a `collecting_name`.

## Integracion pendiente con leads principales

El webhook incluye `createCrmLeadFromWhatsapp()` como punto preparado para mapear hacia la tabla principal `leads`.

Por seguridad, el MVP no inserta en `leads` todavia porque esa tabla tiene reglas operativas de ownership, grupos, estados y fuentes que deben confirmarse antes de crear registros automaticos.
