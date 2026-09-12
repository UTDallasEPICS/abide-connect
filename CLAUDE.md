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

### Tests

```bash
pnpm test                 # vitest run
pnpm test:watch           # vitest
```

Vitest, configured in `vitest.config.ts`. Coverage is the volunteer-hours
reporting stack only; the rest of the app is untested.

- `tests/unit/` — pure logic: `shared/utils/reportRange.ts`, `server/utils/reporting.ts`, `app/lib/chart.ts`.
- `tests/integration/` — the report endpoints, run for real against a throwaway SQLite database. `tests/setup/global-setup.ts` builds it by replaying `prisma/migrations/*` (so a column that only exists in `prisma/schema/` fails here the way it would fail on deploy), and `tests/setup/h3-globals.ts` supplies the h3 helpers Nitro normally auto-imports so a route file can be imported and called directly. Only `requireRole` is stubbed.
- `test.env.TZ` is `UTC` on purpose — production runs in UTC while the org is Central, so a helper that falls back to the host timezone fails the suite.
- Expected figures in the integration tests are hand-computed literals with the arithmetic in a comment. Don't "fix" a failure by recomputing the expectation the way the handler does; that makes a wrong definition agree with itself.

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

### Volunteer hours reporting

Two admin-only pages over `Volunteer_Hour_Log`: `/admin/reports` (operational — trend, distribution, coverage, lapse risk, approval backlog, new-vs-returning, retention cohorts) and `/admin/reports/impact` (leadership/funder — year-over-year totals, in-kind value, hours by program, CSV export). Both are guarded by the `/admin` prefix in `auth.global.ts`, and each endpoint calls `requireRole(event, 'admin')`.

- **Time is Central, not UTC.** `shared/utils/reportRange.ts` owns every range, boundary and bucket key, and all of it is timezone-explicit (`REPORT_TIME_ZONE`). Production runs the server in UTC, so an hour logged on the evening of the 31st falls in the next month and a Sunday-evening shift reads as Monday unless you go through these helpers. It lives in `shared/` so the picker and the API resolve "QTD" identically. Aggregation is therefore done in JS over fetched rows rather than in SQL — SQLite's date functions only know UTC.
- **Ranges.** Presets (YTD, QTD, MTD, rolling windows, previous calendar year, all time) plus a custom `from`/`to`. Picking a preset fills the date boxes with what it resolved to; editing either box switches the selection to Custom. `parseReportQuery` 400s on an unparseable custom range rather than falling back to a default, since a report quietly covering a different period than its header gets pasted into a grant application.
- **What counts.** Approved logs only by default; `?status=all` adds pending, and the operational page labels which is on screen. The funder report is *always* approved-only regardless of the param. The approval backlog and the lapse list deliberately ignore the range — one is a statement about the queue now, the other is about people who stopped before it started.
- **Programs.** `Volunteer_Hour_Log.program` is the grant-reporting dimension and is null on everything logged before it existed. `attributeProgram` in `server/utils/reporting.ts` owns the fallback: explicit tag → the volunteer's *single* declared area → `UNASSIGNED`. Volunteers with several areas are never split across them, and the report says how many hours were attributed by inference.
- **Settings, not constants.** The volunteer hourly rate (Independent Sector republishes it annually), its cited source, and the lapse threshold live in the `AppSetting` key/value table behind `server/utils/appSettings.ts` — the only module that reads it. The funder page warns while the rate is still the built-in default.
- **Charts are hand-drawn SVG**, no charting library: `app/lib/chart.ts` (scales, ticks, paths, formatting) plus `app/components/reports/*`. Colours come from the `--viz-*` tokens at the bottom of `app/assets/css/main.css`, whose two series hues are validated for CVD separation and contrast against the actual card surfaces (white / gray-800) — re-validate before changing them. Two conventions worth keeping: never a second y-axis (headcount is its own panel under the hours plot, sharing the x-axis), and every chart ships a table view, since a tooltip is not an accessible way to read a value. Chart cards carry `min-w-0` because a grid item's default `min-width: auto` lets a fixed-width SVG stretch the card past a phone's viewport.

## Architecture

This is a Nuxt 4 app, so the app source root is `app/` (pages, components, layouts, middleware, lib, types), while `server/` holds Nitro server routes/middleware/utils and is a separate root — cross-referencing it from `app/` code goes through the `#server` path alias (e.g. `import { auth } from '#server/utils/auth'`), not a relative path.

### Auth (better-auth)

- `server/utils/auth.ts` configures `better-auth` with the Prisma adapter against the `User` model (via `user: { modelName: 'User', fields: { image: 'imageURL' } }`). So `session.user.id` is a `User.id`, and a volunteer record is reached with `prisma.volunteer.findUnique({ where: { userId: session.user.id } })` — `Volunteer` hangs off `User`, it is not the authenticated principal itself.
- Two auth methods are wired: Google OAuth (`socialProviders.google`) and email OTP (`emailOTP` plugin, `disableSignUp: true` — sign-up must happen through the app's own sign-up flow, not automatically on first OTP request). OTP emails are sent via a nodemailer SMTP transport.
- `server/api/auth/[...all].ts` mounts the better-auth handler for all `/api/auth/*` routes.
- `server/middleware/authenticated.ts` is now an intentional **no-op**. It used to be the global server-side gate, but role enforcement moved to client middleware plus per-handler `requireRole()`. The practical consequence: a new route under `server/api/` is public until it calls `requireRole` (or `getEventViewer` for visibility-filtered reads) — that call is a required step, not a nicety. Every mutating handler currently has one — keep it that way, and don't assume living under `server/api/admin/` confers anything, since the directory is a naming convention rather than a boundary.
- `app/middleware/auth.ts` is an **opt-in** (non-global) route guard: it calls `/api/auth/get-session` and redirects to `/auth/login` unless the route is in its `publicRoutes` allowlist. Pages that need a session must declare `middleware: 'auth'` in `definePageMeta` (see `settings.vue`, `inbox.vue`) — it does not apply automatically.
- `app/middleware/auth.global.ts` runs on every route and enforces the role requirements in its `routeRoles` map (`/admin`, `/events/manage`, `/volunteer`, `/volunteer-application`). It only guards those prefixes; everything else is unauthenticated unless the page opts into `auth`.
- `server/utils/auth-client.ts` exports the `better-auth/vue` client (`authClient`) for use in components/pages.
- **Session lifetime is split by role.** Ordinary sessions slide: `auth.ts` keeps better-auth's rolling window (7-day `expiresIn`, renewed on use once a day old), so a volunteer or donor who keeps returning never sees a login screen. Admin sessions get a hard ceiling from sign-in instead, enforced per-request by `enforceAdminSessionAge` in `server/utils/sessionPolicy.ts` — better-auth's own `disableSessionRefresh` is global and would have logged everyone out weekly, which is why the ceiling lives in our code rather than in the config. The cap deletes only the session that hit it, not the user's others, since each sign-in gets its own window.
- **Admin access is re-checked against Google.** `server/utils/idpRevalidation.ts` asks Google whether the acting admin's refresh token still represents a live grant, and drops every one of their sessions when it doesn't — so suspending someone in Workspace ends their admin access here within ~10 minutes instead of never. `requireRole` calls it for `admin` only. Three things to keep in mind before touching it: only `invalid_grant` counts as revocation (`invalid_client` means *our* credentials are broken and must not lock anyone out); inconclusive probes fail *open* for 30 minutes so a Google outage doesn't lock out every admin at once; and users with no Google account (email-OTP sign-ins) are deliberately unaffected, which is why the admin session cap above has to stay. `IDP_REVALIDATION=off` disables it.

### Data model (`prisma/schema/*.prisma`)

Split by domain: `user.prisma` (RSVP-only guest `User`), `volunteer.prisma` (the authenticated `Volunteer` plus availability/certification/hour-log/language join tables), `event.prisma` (`Event`, `Event_Asset`, `RSVP`, `GuestRSVP`), `donation.prisma`, `location.prisma`, `mobileClinic.prisma`, `notification.prisma`. `schema.prisma` itself only defines the generator/datasource plus better-auth's own `Session`/`Account`/`Verification` models. `Session` and `Account` FK to `User` (the authenticated principal), not `Volunteer`; `Verification` has no FK at all, since sign-up issues an OTP before the account exists.

Note the two distinct "attendee" concepts: `User` (guest, RSVP-capable, no login) vs `Volunteer` (authenticated, can log hours/certifications). A `Volunteer` can optionally link to a `User` record (`Volunteer.userId`).

### Server API (`server/api/`)

File-based Nitro routes, one file per HTTP method (e.g. `events/index.get.ts` + `events/index.post.ts`, `events/[id]/index.patch.ts`). Admin-only routes live under `server/api/admin/`; there's no separate role-middleware yet, so authorization checks happen inline per-handler where present — check `event.context.session` for the current principal. Server code imports Prisma via `#server/utils/prisma` (default export).

### Frontend structure (`app/`)

- `pages/` mirrors routes directly (Nuxt file-based routing): `auth/`, `admin/`, `events/`, `volunteer/`, plus top-level pages like `settings.vue`, `inbox.vue`, `mobileClinic.vue`.
- `components/` grouped by feature (`event/`, `map/`, `nav/`), not by type.
- **Page margins are owned by the shell, not by pages.** The `default` and `secondary` layouts both put `pt-25 pb-16` on their `<main>` — 4.75rem for the fixed `NavTop`/`NavSecondaryTop` plus breathing room, and 3rem for the fixed `NavBottom` plus breathing room — so a page starts at y=0 of the slot and never hand-rolls `mt-20` / `pt-24` / `pb-24`. `main` is a flex column filling the viewport, so a page that centres itself uses `flex-1` on its root instead of `min-h-[calc(100vh-4.75rem)]`. Horizontal gutter and content width come from `components/PageContainer.vue` (`px-4 sm:px-6 lg:px-8`, matching `UContainer`) with a named width — `full` / `wide` / `content` / `narrow` / `form` — rather than a per-page `max-w-*`. A full-bleed band goes *outside* a container as a sibling (see the rose sign-up strip in `pages/index.vue` and the backdrop in `pages/events/list.vue`). `pages/mobileClinic.vue` is the exception: its map and drawer are `fixed` against the viewport and ignore the shell's padding by design.
- `map/Interactive.client.vue`'s `.client.vue` suffix means it's client-only (maplibre-gl doesn't SSR) — follow this pattern for any other browser-only integrations.
- `lib/relativeFetch.ts` strips the origin off absolute URLs before calling Nuxt's `useFetch`, to avoid SSR/CSR host mismatches — prefer it over raw `useFetch`/`$fetch` when a URL might be absolute.
- UI kit is `@nuxt/ui` (v4) with Tailwind v4; custom theme colors (`brand1`–`brand8` plus standard semantic colors) are declared in `nuxt.config.ts` under `ui.theme.colors` and expected to be defined in `app/assets/css/main.css`.
- PWA config (icons, manifest, workbox) lives in `nuxt.config.ts` under the `pwa` key — `navigateFallbackAllowlist` deliberately excludes `/api` so API calls aren't intercepted by the service worker.

## Deployment

`main` and `stage` branches each have a GitHub Actions workflow (`.github/workflows/main.yml` / `stage.yml`) that builds a Docker image (arm64), pushes to ECR, and force-redeploys the corresponding ECS service — `main` → prod, `stage` → stage. There's no CI test/lint gate in these workflows currently, so run `pnpm lint` and `pnpm build` locally before merging.
