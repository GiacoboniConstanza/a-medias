# A Medias

PWA mobile-first para las finanzas de dos personas que conviven. El sueldo base de cada una define el porcentaje de los gastos compartidos. Los extras, los fondos y los gastos privados los ve solo quien los cargó: eso lo exige Postgres con RLS, no solo la pantalla.

El trabajo de la app vive en la rama `develop`.

## Qué incluye

- Inicio con frasco (vista amigable) o resumen (vista contable). La preferencia queda en el perfil.
- Carga de un gasto con teclado grande. Con el monto y la categoría alcanza: compartido y “pagué yo” ya vienen elegidos.
- ¿En qué se me fue?, bolsa de extras, meta compartida, compartidos con saldo y CSV, recordatorios de vencimiento.
- Auth por correo, hogar de dos personas con código de invitación.
- Estructura de push web (tabla y textos), sin enviarla todavía.

## Requisitos

- Node.js 22 o más nuevo
- Una cuenta de [Supabase](https://supabase.com) en el plan gratis
- Una cuenta de [Vercel](https://vercel.com) en el plan gratis
- [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started) y Docker, si vas a probar la base en tu máquina

## 1. Supabase

1. Creá un proyecto nuevo.
2. En Authentication → Providers, dejá habilitado el correo.
3. Para este prototipo, en Authentication → Sign In / Providers → Email, desactivá **Confirm email**. Si lo dejás activo, la persona tiene que abrir el correo antes de entrar y la app se lo avisa.
4. En Project Settings → API copiá la URL del proyecto y la clave **publishable** (la anon key sigue sirviendo si el proyecto todavía la muestra). No uses la clave `service_role` en el cliente.

Enlazá el proyecto y aplicá la migración:

```bash
npx supabase login
npx supabase link --project-ref TU_PROJECT_REF
npx supabase db push
```

`supabase/migrations` crea las tablas, las funciones del hogar y las políticas RLS. `supabase db push` no carga el seed.

### Datos de ejemplo

En local:

```bash
npx supabase start
npx supabase db reset
```

Eso aplica las migraciones y `supabase/seed.sql`. Podés entrar como:

| Persona | Correo | Contraseña |
| --- | --- | --- |
| Coty | coty@example.com | amedias-demo |
| Maru | maru@example.com | amedias-demo |

Octubre 2026 queda con sueldos 900.000 y 600.000 (60/40). Los compartidos suman 352.000 y Maru le debe 84.000 a Coty. La bolsa de Coty avisa que le quedan 18.000 de gustos.

En un proyecto remoto de prueba, y solo ahí:

```bash
npx supabase db push --include-seed
```

No corras el seed en una base que ya tenga gente de verdad.

La URL y la anon key locales salen al final de `supabase start`.

## 2. App

```bash
cp .env.example .env
```

Completá:

```bash
VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=tu-clave-publishable
```

```bash
npm install
npm run dev
```

Abrí la URL que imprime Vite. En el celular, Chrome → menú → Agregar a la pantalla principal.

Flujo sin seed: crear cuenta, crear el hogar, pasarle el código a la otra persona, cargar el sueldo base del mes y anotar un gasto.

## 3. Vercel

1. Importá el repositorio. Framework: Vite. Rama de este prototipo: `develop`.
2. Agregá `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
3. Deploy. `vercel.json` reescribe las rutas de la SPA.
4. En Supabase → Authentication → URL Configuration, sumá la URL de Vercel en Site URL y en Redirect URLs.

## Cómo se reparte

El porcentaje sale solo del sueldo base del mes. Si alguna no lo cargó, el mes se parte 50/50 y la vista contable lo avisa. Lo que cada una pagó de los gastos compartidos se compara con lo que le tocaba. El saldo dice “X te debe $ Y” o “le debés $ Y a Z”. **Saldar mes** guarda ese saldo; se puede deshacer.

Los gastos privados y las categorías con dueña no los devuelve la API a la otra persona. Los fondos y los extras tampoco. Las dos ven los aportes a la meta compartida.

La bolsa reparte cada extra entre fondos y gustos. Los gastos privados consumen gustos. Si queda un cuarto o menos, avisa. Si el gasto privado supera los gustos, avisa que ya está usando los fondos.

## Push (preparado, no activo)

No se pide permiso de notificaciones y el service worker no escucha `push`.

Ya está definido:

- La tabla `push_subscriptions` (endpoint, p256dh, auth, avisos diarios y de vencimientos), con RLS para que cada persona vea solo las suyas.
- Los textos y horarios en `src/lib/push/plan.ts`: todos los días a las 21:30 “¿Gastaste algo hoy?” y un aviso dos días antes de cada vencimiento.
- En Recordatorios, la tarjeta de “¿Gastaste algo hoy?” y el silencio de tres días salen de los gastos reales, dentro de la app.

Para activarlo más adelante: claves VAPID, `PushManager.subscribe`, guardar la suscripción en esa tabla y un cron que lea vencimientos y suscripciones. Hasta entonces no hace falta ninguna clave de push.

## Scripts

```bash
npm run dev
npm test
npm run build
```
