# Avisos push (infra genérica)

## Cómo funciona

1. La PWA pide permiso (`src/lib/push/permissions.ts`) y guarda una fila en `push_subscriptions` (endpoint + claves del browser + `user_agent`). Los flags `daily_enabled` / `dues_enabled` son **solo interruptores de Finanzas** en la UI; el despachador genérico **no** los usa para filtrar.
2. Cualquier módulo inserta filas en `scheduled_reminders` (ver modos abajo).
3. Cada minuto, `pg_cron` llama por `pg_net` a la Edge Function `dispatch-push-reminders` (URL y Bearer salen de Vault).
4. La función ejecuta `claim_due_reminders()` (marca `last_sent_at` para no duplicar; en avisos de una vez también pone `active = false`), manda Web Push con VAPID a **todas** las suscripciones del usuario y borra las que respondan 404/410.
5. El service worker (`public/push-handler.js`) muestra la notificación y, al tocar, navega/enfoca la app en la `url` del payload (fallback `/recordatorios`).

Horas y días se interpretan siempre en `timezone` de la fila (default `America/Argentina/Buenos_Aires`), nunca como UTC “pelado”.

Medicamentos sincroniza solo: al crear/editar horarios o el tratamiento, un trigger mantiene los `scheduled_reminders` del módulo `medicamentos` (modo recurrente) y los desactiva al terminar.

## Modos de `scheduled_reminders`

Check `scheduled_reminders_schedule_mode`: **uno u otro**, no ambos.

### Recurrente (hora local ± días)

`local_time` obligatorio; `fire_at` null. `days_of_week` null = todos los días; `0` = lunes … `6` = domingo. `starts_on` / `ends_on` opcionales.

```sql
insert into public.scheduled_reminders (
  user_id, module, title, body,
  local_time, timezone, days_of_week,
  starts_on, ends_on, active
) values (
  auth.uid(),
  'finanzas',
  '¿Gastaste algo hoy?',
  'Anotalo en dos toques.',
  '21:30',
  'America/Argentina/Buenos_Aires',
  null,               -- o '{0,1,2,3,4}' (lun–vie)
  null, null, true
);
```

### Una sola vez (`fire_at`) — avisos que dependen de datos

Para vencimientos, “hace N días sin gastos”, etc.: encolá un instante exacto. `fire_at` obligatorio; `local_time`, `days_of_week`, `starts_on` y `ends_on` deben ir null. Se envía **una vez** (queda `last_sent_at` y `active = false`).

Armá el instante en zona Argentina (o la `timezone` de la fila), no en UTC suelto:

```sql
-- Ejemplo: avisar el 2026-11-15 a las 09:00 en Buenos Aires
insert into public.scheduled_reminders (
  user_id, module, title, body,
  fire_at, timezone, active,
  ref_table, ref_id
) values (
  auth.uid(),
  'finanzas',
  'Vence Alquiler',
  'Marcalo como pagado cuando lo abones.',
  timestamp '2026-11-15 09:00:00' at time zone 'America/Argentina/Buenos_Aires',
  'America/Argentina/Buenos_Aires',
  true,
  'fixed_expenses',
  '<uuid-del-fijo>'
);
```

Desde el cliente (autenticada): `supabase.from('scheduled_reminders').insert(...)`.

## Pasos en producción (Coty)

No pegues valores reales en el repo. En la máquina de Coty / dashboard:

1. Generar claves VAPID (una sola vez), por ejemplo:
   `npx web-push generate-vapid-keys`
2. Secretos de la función (proyecto Supabase correcto, no un draft viejo):
   `npx supabase secrets set PUSH_DISPATCH_SECRET=... VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:tu@correo`
   (`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` ya los inyecta el runtime de Functions.)
3. Vault (SQL editor del proyecto), crear secretos:
   - `push_dispatch_url` → URL de la función, ej. `https://<ref>.supabase.co/functions/v1/dispatch-push-reminders`
   - `push_dispatch_secret` → el mismo Bearer que `PUSH_DISPATCH_SECRET`
4. Aplicar migraciones `20261113130000_push_reminders` y `20261113130100_medications` (si el cron no quedó programado porque Vault estaba vacío, volver a correr el bloque de `cron.schedule` de la primera migración o `select cron.schedule(...)` a mano).
5. Deploy:
   `npx supabase functions deploy dispatch-push-reminders`
6. En Vercel, variable de entorno del front:
   `VITE_VAPID_PUBLIC_KEY` = la clave **pública** VAPID (la privada solo en secrets de Supabase).
7. Redeploy del front para que la PWA tome la clave y el `push-handler.js` actualizado.

Comprobar: suscribirse desde un dispositivo, insertar un `scheduled_reminders` que toque en el minuto siguiente, y ver la notificación con la app cerrada.
