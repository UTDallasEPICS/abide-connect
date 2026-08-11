# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Abide Connect is a Nuxt 4 PWA for Abide Women's Health Services: volunteer/donor engagement, event management, mobile clinic locator, and an admin dashboard. Package manager is **pnpm** (required — `.npmrc`/`pnpm-workspace.yaml` assume it; don't use npm/yarn).

## Commands

```bash
pnpm install              # install deps (runs `nuxt prepare` via postinstall)
pnpm dev                  # dev server at http://localhost:3000
pnpm build                # production build
pnpm generate             # static generation
pnpm preview              # preview a production build
pnpm lint                 # eslint .
pnpm lint:fix              # eslint . --fix
pnpm db:generate          # prisma generate (regenerate client after schema changes)
```

There is no test suite configured in this repo currently.

### Database (Prisma + SQLite)

Schema lives across multiple files under `prisma/schema/` (not a single `schema.prisma`), configured via `prisma.config.ts`. The generated client is emitted to `server/utils/generated/prisma` (not `node_modules`), imported in `server/utils/prisma.ts` via a `PrismaClient` + `@prisma/adapter-better-sqlite3` singleton.

```bash
pnpm prisma generate           # regenerate client after editing prisma/schema/*.prisma
pnpm prisma migrate dev        # create/apply a migration
pnpm prisma db seed            # seed from prisma/seed/*.json via server/utils/seed.ts
pnpm prisma migrate reset      # reset DB, then re-seed
```

After changing any file in `prisma/schema/`, always run `pnpm prisma generate` (and a migration if the change is structural) — the app imports types directly from the generated output.

### Environment

Copy `.env.example` to `.env` before running anything. Required vars: `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `DATABASE_URL`, `IMAGE_STORAGE_PATH`/`IMAGE_URL_PATH` (local image storage), `EMAIL_HOST`/`EMAIL_PORT`/`EMAIL_USER`/`EMAIL_PASS`/`EMAIL_FROM` (SMTP via nodemailer, used for OTP emails). Google OAuth uses `OAUTH_CLIENT_ID`/`OAUTH_CLIENT_SECRET` (see `server/utils/auth.ts`). `GOOGLE_CALENDAR_ID` is the shared calendar events are synced to (see below).

### Google Calendar sync

When an event is created/updated/deleted, `server/utils/googleCalendar.ts` mirrors it to a single shared Google Calendar (`GOOGLE_CALENDAR_ID`). Writes use the acting volunteer's Google OAuth token — obtained via `auth.api.getAccessToken({ body: { providerId: 'google', userId } })`, which refreshes using the stored refresh token — so the Google provider requests the `calendar.events` scope with `accessType: 'offline'` + `prompt: 'consent'` (in `auth.ts`). The Google event id is stored on `Event.calendarEventId` (and its link on `Event.calendarURL`) for later update/delete. Sync is **best-effort**: if the acting volunteer signed in with email OTP (no Google token) or the Calendar API fails, the DB operation still succeeds and the calendar is simply not updated.

### Web Push notifications

Push is plain Web Push (VAPID) through the PWA's own service worker — no APNs certificate or FCM project. `pnpm push:keys` generates the `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` pair; the same pair must persist across restarts or every stored subscription is invalidated. With the keys unset, `pushConfigured` is false, sending is a no-op, and the settings toggle reports push as unavailable instead of erroring.

- `server/utils/push.ts` — `sendPushToUsers(userIds, 'GENERAL' | 'VOLUNTEER', payload)` is the entry point feature code should call. It honours each user's `pushEnabled`/`pushScope`, fans out across all their devices, and prunes subscriptions the push service reports as gone (404/410). Best-effort: it never throws.
- `public/push-sw.js` holds the `push`/`notificationclick` handlers, pulled into the generated Workbox service worker via `pwa.workbox.importScripts` in `nuxt.config.ts`. It's plain JS in `public/` because it runs in the service worker scope with no bundler pass.
- `app/composables/usePushNotifications.ts` is the client half (permission prompt, subscribe/unsubscribe, iOS "add to Home Screen" detection).
- `web-push` and its ASN.1 deps are CommonJS and must stay in `nitro.externals.inline` — left external, Nitro's dev server fails to load them and **every** server route 500s.

### Transactional email

All outgoing mail goes through the one nodemailer `transporter` in `server/utils/auth.ts` and shares a single look, so a new email should be assembled from the kit rather than hand-written:

- `server/utils/email-theme.ts` — the branded shell (`renderEmailShell`) plus block helpers (`paragraph`, `detailCard`, `primaryButton`, `secondaryButton`, `escapeHtml`). Mail clients strip stylesheets and modern layout, so everything is nested `<table>`s with inline styles. Content from the database is escaped by the *caller*, except where a helper documents otherwise.
- `server/utils/otp-email.ts` — sign-in code. `server/utils/event-email.ts` — the sign-up confirmation and the 24-hour reminder, which deliberately share a shape.
- `server/utils/eventMailer.ts` — the delivery side: `eventEmailSelect`/`eventEmailDetails` turn an `Event` row into the fields the templates want, and `sendSignupConfirmation` is what a sign-up path calls. Every send is best-effort and swallows its own errors, like push and calendar sync.
- Every email carries a plain-text twin. Keep it in sync with the HTML — clients in text mode need it and spam filters look for it.

**Cancel links.** Confirmation and reminder emails carry a one-click "cancel my spot" link, which for a guest is the only handle they have on their sign-up. `server/utils/rsvpCancelToken.ts` signs a stateless HMAC token (`BETTER_AUTH_SECRET`) naming one RSVP — no extra table, and the token dies with the row. The link opens the `app/pages/rsvp/cancel.vue` page, which only posts to `server/api/rsvp/cancel.post.ts` after a real click: mail clients and security scanners fetch every URL in a message, so cancelling on GET would drop people from events they meant to attend.

## Architecture

This is a Nuxt 4 app, so the app source root is `app/` (pages, components, layouts, middleware, lib, types), while `server/` holds Nitro server routes/middleware/utils and is a separate root — cross-referencing it from `app/` code goes through the `#server` path alias (e.g. `import { auth } from '#server/utils/auth'`), not a relative path.

### Auth (better-auth)

- `server/utils/auth.ts` configures `better-auth` with the Prisma adapter against the `User` model (via `user: { modelName: 'User', fields: { image: 'imageURL' } }`). So `session.user.id` is a `User.id`, and a volunteer record is reached with `prisma.volunteer.findUnique({ where: { userId: session.user.id } })` — `Volunteer` hangs off `User`, it is not the authenticated principal itself.
- Two auth methods are wired: Google OAuth (`socialProviders.google`) and email OTP (`emailOTP` plugin, `disableSignUp: true` — sign-up must happen through the app's own sign-up flow, not automatically on first OTP request). OTP emails are sent via a nodemailer SMTP transport.
- `server/api/auth/[...all].ts` mounts the better-auth handler for all `/api/auth/*` routes.
- `server/middleware/authenticated.ts` is now an intentional **no-op**. It used to be the global server-side gate, but role enforcement moved to client middleware plus per-handler `requireRole()`. The practical consequence: a new route under `server/api/` is public until it calls `requireRole` (or `getEventViewer` for visibility-filtered reads) — that call is a required step, not a nicety, and several existing handlers are missing it.
- `app/middleware/auth.ts` is an **opt-in** (non-global) route guard: it calls `/api/auth/get-session` and redirects to `/auth/login` unless the route is in its `publicRoutes` allowlist. Pages that need a session must declare `middleware: 'auth'` in `definePageMeta` (see `settings.vue`, `inbox.vue`) — it does not apply automatically.
- `app/middleware/auth.global.ts` runs on every route and enforces the role requirements in its `routeRoles` map (`/admin`, `/events/manage`, `/volunteer`, `/volunteer-application`). It only guards those prefixes; everything else is unauthenticated unless the page opts into `auth`.
- `server/utils/auth-client.ts` exports the `better-auth/vue` client (`authClient`) for use in components/pages.

### Data model (`prisma/schema/*.prisma`)

Split by domain: `user.prisma` (RSVP-only guest `User`), `volunteer.prisma` (the authenticated `Volunteer` plus availability/certification/hour-log/language join tables), `event.prisma` (`Event`, `Event_Asset`, `RSVP`, `GuestRSVP`), `donation.prisma`, `location.prisma`, `mobileClinic.prisma`, `notification.prisma`. `schema.prisma` itself only defines the generator/datasource plus better-auth's own `Session`/`Account`/`Verification` models. `Session` and `Account` FK to `User` (the authenticated principal), not `Volunteer`; `Verification` has no FK at all, since sign-up issues an OTP before the account exists.

Note the two distinct "attendee" concepts: `User` (guest, RSVP-capable, no login) vs `Volunteer` (authenticated, can log hours/certifications). A `Volunteer` can optionally link to a `User` record (`Volunteer.userId`).

### Server API (`server/api/`)

File-based Nitro routes, one file per HTTP method (e.g. `events/index.get.ts` + `events/index.post.ts`, `events/[id]/index.patch.ts`). Admin-only routes live under `server/api/admin/`; there's no separate role-middleware yet, so authorization checks happen inline per-handler where present — check `event.context.session` for the current principal. Server code imports Prisma via `#server/utils/prisma` (default export).

### Frontend structure (`app/`)

- `pages/` mirrors routes directly (Nuxt file-based routing): `auth/`, `admin/`, `events/`, `volunteer/`, plus top-level pages like `settings.vue`, `inbox.vue`, `mobileClinic.vue`.
- `components/` grouped by feature (`event/`, `map/`, `nav/`), not by type.
- `map/Interactive.client.vue`'s `.client.vue` suffix means it's client-only (maplibre-gl doesn't SSR) — follow this pattern for any other browser-only integrations.
- `lib/relativeFetch.ts` strips the origin off absolute URLs before calling Nuxt's `useFetch`, to avoid SSR/CSR host mismatches — prefer it over raw `useFetch`/`$fetch` when a URL might be absolute.
- UI kit is `@nuxt/ui` (v4) with Tailwind v4; custom theme colors (`brand1`–`brand8` plus standard semantic colors) are declared in `nuxt.config.ts` under `ui.theme.colors` and expected to be defined in `app/assets/css/main.css`.
- PWA config (icons, manifest, workbox) lives in `nuxt.config.ts` under the `pwa` key — `navigateFallbackAllowlist` deliberately excludes `/api` so API calls aren't intercepted by the service worker.

## Deployment

`main` and `stage` branches each have a GitHub Actions workflow (`.github/workflows/main.yml` / `stage.yml`) that builds a Docker image (arm64), pushes to ECR, and force-redeploys the corresponding ECS service — `main` → prod, `stage` → stage. There's no CI test/lint gate in these workflows currently, so run `pnpm lint` and `pnpm build` locally before merging.
