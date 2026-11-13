# Avisos push (infra genérica)

## Cómo funciona

1. La PWA pide permiso y guarda una fila en `push_subscriptions` (endpoint + claves del browser + `user_agent`).
2. Cualquier módulo inserta filas en `scheduled_reminders` (hora local, zona, días opcionales, fechas, `module`, título/cuerpo, `ref_table`/`ref_id`).
3. Cada minuto, `pg_cron` llama por `pg_net` a la Edge Function `dispatch-push-reminders` (URL y Bearer salen de Vault).
4. La función ejecuta `claim_due_reminders()` (marca `last_sent_at` para no duplicar), manda Web Push con VAPID y borra suscripciones que respondan 404/410.
5. El service worker (`public/push-handler.js`) muestra la notificación y, al tocar, abre/enfoca la app en la `url` del payload.

Medicamentos sincroniza solo: al crear/editar horarios o el tratamiento, un trigger mantiene los `scheduled_reminders` del módulo `medicamentos` (y los desactiva al terminar).

## Cómo otro módulo crea recordatorios (ej. Finanzas)

Sin migrar Finanzas todavía. Cuando quieran avisos genéricos:

```sql
insert into public.scheduled_reminders (
  user_id, module, title, body,
  local_time, timezone, days_of_week,
  starts_on, ends_on, active,
  ref_table, ref_id
) values (
  auth.uid(),
  'finanzas',
  '¿Gastaste algo hoy?',
  'Anotalo en dos toques.',
  '21:30',
  'America/Argentina/Buenos_Aires',
  null,               -- todos los días; o '{0,1,2,3,4}' (lun–vie)
  null, null, true,
  'reminder_preferences',  -- opcional
  null                     -- o un uuid de la entidad
);
```

`days_of_week`: `null` = todos; `0` = lunes … `6` = domingo (igual que hábitos).  
Para “solo ciertos días a hora fija” alcanza con `local_time` + `days_of_week`.

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
