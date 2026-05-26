# Scheduler externo para WhatsApp

El proyecto esta en Vercel Hobby, por lo que no se usa Vercel Cron para el flujo de felicitaciones de WhatsApp.

El endpoint sigue activo y protegido:

```txt
POST /api/whatsapp/process-scheduled
```

Debe llamarse desde un scheduler externo cada 10 o 15 minutos, solo entre 8:00 a. m. y 4:00 p. m. hora Colombia (`America/Bogota`).

La llamada debe incluir el secreto configurado en Vercel:

```http
Authorization: Bearer <CRON_SECRET>
```

Tambien se acepta:

```http
x-cron-secret: <CRON_SECRET>
```

El endpoint valida de nuevo el horario habil, la ventana de 24 horas de WhatsApp y evita duplicados si la felicitacion ya fue enviada.
