# Nuxt Native Migration Plan: Abide Connect

This document is a living plan for migrating Abide Connect from a Nuxt 4 web PWA to a true native mobile app using [Nuxt Native](https://github.com/vastx-tech/nuxt-native) (NativeScript runtime, no WebView).

**Target branch:** `native-test`  
**Status:** In progress (Plan document created, synced with `stage`)

## 1. Executive Summary

Abide Connect is a feature-rich Nuxt 4 PWA (Prisma + SQLite, Better Auth, Nuxt UI v4, event management, volunteer hours, reports, Google Calendar sync, web push). Nuxt Native renders Vue components as native views via NativeScript.

**Key finding:** The backend (server/, shared/, prisma/) can remain largely unchanged. The entire frontend presentation layer (app/) must be rewritten from HTML/DOM-based to NativeScript native components.

**Critical blockers to validate first:** Clinic Locator maps (MapLibre web → native), push notifications (VAPID web push → APNs/FCM), and charts (SVG reports). Backend URL configuration is straightforward but required.

## 2. Architecture Comparison

| Aspect | Current (Web PWA) | Nuxt Native (Native) | Impact |
|---|---|---|---|
| Rendering | DOM via Nuxt/Vite | Native views via NativeScript + nativescript-vue | **Critical** - rewrite all UI |
| Routing | vue-router (browser history) | `useNativeRouter()` (NativeScript Frame backstack) | High - API changes |
| Styling | CSS/Tailwind v4 | Constrained Tailwind v3 (allowlisted) or style helpers | High - no grid/position/overflow; gap disabled on Android |
| Layout | HTML containers | StackLayout, FlexboxLayout, GridLayout, AbsoluteLayout | High |
| Navigation | Top/Bottom nav in DOM | ActionBar, BottomNavigation/TabStrip, native navigation | High |
| Auth | better-auth with cookies (same-origin) | better-auth API-based; needs base URL + mobile cookie handling | Medium |
| API calls | Relative URLs (`/api/*`) from browser origin | Need full backend URL (configured via env) | Medium |
| Push | VAPID web push + service worker | APNs (iOS) + FCM (Android) - different implementation | **High** |
| Maps | MapLibre GL (web) | MapLibre Native or native maps plugin | **Critical** |
| Images | `@nuxt/image` + IPX cache | `<NetworkImage>`, `<CachedImage>` from Nuxt Native | Medium |
| PWA | @vite-pwa/nuxt, workbox, manifest | Native app (APK/IPA) - remove PWA modules | Medium |

## 3. Backend Integration (Same Backend, Config Required)

### 3.1 API Base URL

Current code uses relative paths everywhere:
- `$fetch('/api/...')` (52 occurrences)
- `useFetch('/api/...')` (in pages/components)
- `useLazyFetch('/api/...')`
- `authClient` from better-auth/vue with no baseURL (defaults to origin)

**In native app:** Relative paths don't resolve - must point to hosted backend.

**Required changes:**
1. Add runtime config in `nuxt.config.ts`:
```ts
runtimeConfig: {
  public: {
    apiBaseUrl: process.env.NUXT_PUBLIC_API_BASE_URL || ''
  }
}
```

2. Configure `authClient` with base URL for native context:
```ts
// app/composables/auth-client.ts (or adapt server/utils/auth-client.ts)
import { createAuthClient } from 'better-auth/vue'
export const authClient = createAuthClient({
  baseURL: useRuntimeConfig().public.apiBaseUrl
})
```

3. Option A: Global `$fetch` baseURL configuration in app bootstrap
4. Option B: Create `useApiFetch` wrapper and migrate calls (safer, explicit)
5. Option C: Patch relative URLs at runtime

**Recommendation:** Create `app/composables/useApi.ts` with helpers that prepend `apiBaseUrl` for `/api/*` paths. This minimizes changes to existing call sites.

### 3.2 CORS & Cookies

- **CORS:** Less restrictive on native apps than browsers, but backend may have CORS rules. If backend checks `Origin` header, need to ensure it allows the API host or is configured permissively for the mobile client.
- **Cookies:** better-auth uses session cookies. Native `fetch` needs proper cookie handling. The better-auth vue client should work, but may need `credentials` consideration. Test OAuth flow (Google) on device as it involves redirects.
- **HTTPS:** Backend must be HTTPS in production (iOS/Android requirements).

### 3.3 Auth Flow (Google OAuth)

Google OAuth with mobile apps requires careful handling of redirects/deep links. The existing flow (server-side OAuth) should work if:
- `BETTER_AUTH_URL` is set correctly on backend
- Mobile app can handle redirects properly
- Deep linking configured if needed (Nuxt Native supports this via app URL schemes)

### 3.4 Email Links (Cancel RSVP, etc.)

Links in emails use `BETTER_AUTH_URL` (see `server/utils/eventLinks.ts`). These open in browser or app? For cancel links and other email links, users will open in browser by default - but if app is installed and deep linked, could intercept. May need to consider universal links (iOS) / app links (Android). Out of scope for initial migration but worth noting.

## 4. Nuxt Native Project Setup

### 4.1 Dependencies & Package.json Changes

**Add:**
- `nuxt-native` (from github:vastx-tech/nuxt-native or local dev)
- `@nativescript/core@^9.x`
- `nativescript-vue@^3.x`

**Remove/replace:**
- `@vite-pwa/nuxt` - replaced by native app
- `@nuxt/ui` v4 - web UI kit, incompatible; use Nuxt Native UI kit + custom components
- `@nuxt/image` - use `<NetworkImage>`/`<CachedImage>`
- `vue3-carousel` - need native alternative
- `nuxt-maplibre` + `maplibre-gl` - need native maps solution
- Tailwind v4 packages - downgrade to v3 if using Tailwind (Nuxt Native requires Tailwind v3)

**Note on Tailwind:** Current uses Tailwind v4. Nuxt Native requires Tailwind v3 with `corePlugins` allowlist. Significant config change. Consider using Nuxt Native's style helpers (`padding()`, `flex()`, etc.) instead for faster migration, or keep constrained Tailwind v3.

### 4.2 nuxt.config.ts Changes

**Remove:**
- PWA config (`pwa: {...}`)
- MapLibre config if present
- Nuxt UI config specifics that don't apply

**Add:**
```ts
export default defineNuxtConfig({
  modules: [
    './modules/ipx-cache', // may need review
    '@nuxt/eslint',
    '@nuxt/fonts',
    // '@nuxt/image', // replace with native
    'nuxt-cron',
    'nuxt-native', // ADD
  ],
  native: {
    appId: 'org.abidewomen.connect',
    appName: 'Abide Connect'
  },
  runtimeConfig: {
    public: {
      vapidPublicKey: process.env.VAPID_PUBLIC_KEY ?? '',
      apiBaseUrl: process.env.NUXT_PUBLIC_API_BASE_URL ?? ''
    }
  },
  // ... rest
})
```

**Compatibility date, fonts, etc. can stay.**

### 4.3 New Files

- `nativescript.config.ts` (generated by `nuxt-native init` or create)
- Platform files via `ns platform add` (ios/android) - added by CLI
- App resources (splash, icons) - branded

### 4.4 CLI Usage

```bash
npx nuxt-native init ios android  # add native platform scaffolding
npx nuxt-native dev android      # dev on device/emulator
npx nuxt-native dev ios          # dev on iOS
npx nuxt-native build android --release
```

## 5. UI Migration Plan (app/ directory)

All `.vue` files using HTML elements need rewrite. Focus on semantic equivalents.

### 5.1 Layouts (`app/layouts/`)

**`default.vue`:**
- HTML structure (header, main, nav) → NativeScript layout
- NavTop, NavBottom components contain HTML - must rewrite
- PageContainer wrapper - may need native equivalent

**`secondary.vue`:** Similar changes

### 5.2 Navigation Components (`app/components/nav/`)

- `Top.vue` - ActionBar replacement
- `Bottom.vue` - BottomNavigation/TabStrip
- `Actions.vue`, `BackButton.vue`, etc. - native button equivalents
- `NotificationMenu.vue` - needs native modal/dropdown alternative

**Nuxt Native:** Use `<NActionBar>`, `<NTabs>` patterns. Or build custom with BottomNavigation.

### 5.3 Core UI Components to Rewrite

Priority order for reuse:
1. **Buttons** - many instances; create native button wrapper
2. **Cards** (`EventCard`, `SecondaryEventCard`) - use `<NCard>` or custom
3. **Forms/Inputs** - `NInput`, custom text fields
4. **Modals** - `useModal()`, `useBottomSheet()`
5. **Images** - replace `<NuxtImg>` with `<NetworkImage>`/`<CachedImage>`
6. **Lists** - use `<ListView>` for performance (critical for long lists)

### 5.4 Pages Migration

Key pages:
- `index.vue` (homepage) - carousel, events, hero - carousel blocker
- `auth/login.vue`, `auth/sign-up*.vue` - forms
- `events/*.vue` - listings, details, manage
- `volunteer/*.vue`, `volunteer-application/*.vue`
- `admin/*.vue` - complex, includes reports
- `settings.vue`
- `mobileClinic.vue` - **map blocker**

### 5.5 Specific Blockers in UI

**Carousel (`vue3-carousel`)** - Used on homepage. No direct equivalent in Nuxt Native. Options:
- NativeScript Pager component
- Swipeable StackLayout with gestures
- Horizontal ListView
- Remove/reimagine carousel

**MapLibre (Clinic Locator)** - `app/components/map/Interactive.client.vue` uses `maplibre-gl`. Cannot use web GL in native. Options:
- [MapLibre Native](https://maplibre.org/maplibre-native/) bindings for NativeScript (may need custom plugin)
- Use Google Maps SDK via nativescript-google-maps-sdk
- Use Apple Maps on iOS, Google Maps on Android
- Simplify to address list + directions

**Charts/Reports** - SVG-based charts in `app/components/reports/*` and `app/lib/chart.ts`. NativeScript has limited SVG support. Options:
- Find native charting library for NativeScript (nativescript-ui-chart, or others)
- Generate images server-side and display
- Reimplement simple charts natively (difficult)
- Simplify reports for mobile view

**DOM measurements** - `useElementWidth.ts` uses DOM APIs (`ResizeObserver`, `getBoundingClientRect`). Not applicable to native. Rewrite or remove.

## 6. Styling Migration

### 6.1 Tailwind

- Downgrade from v4 to v3 (if keeping Tailwind)
- Constrained `corePlugins` allowlist (only props NativeScript supports)
- No CSS Grid utilities
- `gap-*` disabled on Android (must use margins on children)
- No `position`, `overflow` CSS properties (use layout containers)
- Transform utilities via CSS vars don't work - use native transform props

**Alternative:** Use Nuxt Native's typed style helpers (`padding()`, `margin()`, `flex()`, `textStyle()`, `box()`, etc.) - auto-imported, type-safe, no CSS parsing issues.

**Recommendation:** Hybrid approach - use style helpers for layout/complex styles, minimal constrained Tailwind for simple utilities where they work.

### 6.2 CSS

- `app/assets/css/main.css` uses Tailwind v4 syntax - rewrite for v3 or replace
- Carousel theme CSS (`carousel-theme.css`) - for web carousel only, remove after replacing carousel

## 7. Composables & Utils

Check each:
- `useEventImageProvider.ts` - may use browser APIs
- `usePushNotifications.ts` - **must rewrite completely** for native push
- `useNavActions.ts` - navigation logic
- `useUserRoles.ts` - pure logic, likely fine
- `useReportFilter.ts` - pure logic, fine

**Push notifications rewrite:**
- Remove web push service worker integration
- Use NativeScript push plugin (e.g., `@nativescript/push-notifications` or Firebase)
- Handle APNs tokens (iOS) and FCM tokens (Android)
- Update server to send to APNs/FCM instead of VAPID web push? Server currently uses `web-push` library - need to extend or replace for native tokens.

## 8. Server-Side Changes

**Minimal expected:**
1. Push notification sending - extend to support native device tokens (APNs/FCM). Current stores subscriptions differently (web push subscriptions). May need new schema/table or extend existing.
2. CORS config if needed for API access from mobile
3. Deep link handling for OAuth redirects? Maybe not necessary if backend redirects to app scheme
4. Email links - consider app links, but optional

**Database schema:** Check push subscriptions - `PushSubscription` model exists. Web push has different format than FCM/APNs. May need new fields or separate table.

But server changes are likely smaller than frontend. Can keep most as-is initially.

## 9. Migration Strategy (Phased)

### Phase 1: POC & Blocker Validation (Critical)
- [ ] Create fresh Nuxt Native scaffold in test env or worktree
- [ ] Configure API base URL, test auth flow with hosted backend
- [ ] POC: Login, fetch user data, basic navigation
- [ ] **Validate maps** - test native mapping approach
- [ ] **Validate push** - test native push setup
- [ ] **Validate charts** - assess rendering feasibility
- [ ] Document findings on blockers

### Phase 2: Setup Native Project Structure (Parallel with POC)
- [ ] On `native-test` branch, add `nuxt-native` module to config
- [ ] Add `nativescript.config.ts`
- [ ] Update package.json (add native deps, handle Tailwind)
- [ ] Configure runtime config for API base URL
- [ ] Create API base URL composable/helpers

### Phase 3: App Shell & Navigation
- [ ] Migrate `app/layouts/default.vue` and `secondary.vue`
- [ ] Migrate nav components (Top, Bottom)
- [ ] Set up `useNativeRouter()` usage
- [ ] Auth middleware adaptation
- [ ] Basic page structure

### Phase 4: Core Features (Iterative)
Migrate in order:
1. Auth (login/signup) - high value, forms
2. Homepage
3. Events list/detail/RSVP
4. Volunteer features
5. Settings
6. Admin pages (reports last - charts)

### Phase 5: Platform Polish
- [ ] Native push notifications
- [ ] Maps integration (if viable)
- [ ] Charts (if viable)
- [ ] Platform-specific styling
- [ ] Icons/splash screens
- [ ] Testing on device (Android first, then iOS)

## 10. File Inventory (Key Areas)

**High churn files (>many HTML elements):**
- `app/layouts/*.vue` - 2 files
- `app/components/nav/*.vue` - 6 files
- `app/components/event/*.vue` - 12 files (cards, forms, modals)
- `app/components/homepage/*.vue` - 2 files
- `app/pages/**/*.vue` - ~30 files
- `app/components/reports/*.vue` - 11 files (charts - high complexity)

**Can stay mostly as-is:**
- `server/**/*` - API routes, utils, auth (mostly)
- `shared/**/*` - types, utils (pure logic)
- `prisma/**/*` - schema, migrations
- `tests/**/*` - unit tests for pure logic still valid

## 11. Questions for Clarification

Before implementation, please clarify:

1. **Backend deployment**: Is the backend staying at the same hosted URL? If so, what is the production API base URL? Do we need staging vs prod config?

2. **Map priority**: Is the Clinic Locator (mobileClinic/map) a must-have for v1 of native app? Or can it be simplified/replaced?

3. **Push notifications**: Is native push required from day 1? Or can web push be deferred? Note server schema changes may be needed.

4. **Charts/reports**: Are admin reports critical on mobile? Many chart-heavy pages may not be ideal UX on small screens anyway - could we offer simplified views?

5. **Target platforms**: iOS and Android both? Any preference to start with one?

6. **Tailwind preference**: Keep Tailwind (constrained v3) or migrate to Nuxt Native style helpers? Style helpers are more "native-idiomatic" but different DX.

7. **Carousel**: Homepage carousel - keep, replace with pager, or remove?

8. **Deep linking**: Need app URL scheme for OAuth/cancel links? (e.g., `abideconnect://`)

9. **Monorepo vs single repo**: Keep native code in same repo (`native-test` branch) or separate? Current plan is same repo, new branch.

10. **Testing scope**: Do you want feature parity with web app for first native release, or MVP subset?


## Clarifications (From Discussion)

1. **Backend**: Use base URL `https://abide-connect-stage.npts.tech`. **Delay API base URL configuration until late** - there have been issues getting it to work locally before. Focus on scaffolding and core migration first, add base URL wiring in later phases.

2. **Push notifications**: Keep schemas the same if possible; extract/overload fields for MVP if needed. Not a hard requirement. Can be handled flexibly.

3. **Maps/Push/Charts/Tailwind/Carousel/Deep Linking/Repo/Testing scope**: All as discussed - defer where noted, start with Android, prefer style helpers, evaluate deep linking lightly, MVP subset.

4. **Overall approach**: Same repo (`native-test` branch), Android-first, MVP subset initially, style helpers preferred, simplified reports on mobile acceptable.

## 12. Next Steps

1. **Review this plan** - confirm/adjust based on answers to questions above
2. **POC blockers** - create minimal Nuxt Native test that connects to hosted backend
3. **Begin Phase 1** - scaffold and validate
4. **Iterate** - update this living document as we learn more

---

*This plan will evolve as implementation proceeds. All major design decisions should be confirmed before large-scale rewrites.*

## Build Environment Setup (Android)

The native build needs three things on `PATH`/env. They are **not** persisted, so
export them per shell (or source a local env file):

```sh
export JAVA_HOME=/home/vikachubro21/.local/share/jvm/jdk-17.0.20.1+1
export ANDROID_HOME=/home/vikachubro21/Android/Sdk
export PATH=$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/build-tools/36.0.0:$PATH
```

- **JDK 17 is required.** The system JDK (`/usr/lib/jvm/java-25-openjdk`, javac 25)
  is **too new**: Gradle 8.14.3 fails configuring with
  `Unsupported class file major version 69` (Java 25). A portable Temurin
  JDK 17.0.20.1+1 was installed under `~/.local/share/jvm/` (no sudo needed).
  Gradle 8.14.3 supports up to Java 24; NativeScript/AGP target `jvmTarget 17`.
- **Android SDK**: `/home/vikachubro21/Android/Sdk`, platform `android-37.0`
  (API 37), build-tools `36.0.0`. No `cmdline-tools`/`sdkmanager`, so no other
  platform can be installed without downloading cmdline-tools.
- **Package manager**: NativeScript CLI is set to **pnpm**
  (`npx nativescript package-manager set pnpm`) so all installs go through pnpm.

### Android version support

| Setting | Value | Source |
| --- | --- | --- |
| Oldest supported (runtime floor) | **API 21 (Android 5.0 Lollipop)** | `@nativescript/android@9.1.1` `version_info.minSdk` and `NS_DEFAULT_MIN_SDK_VERSION=21` |
| App `minSdkVersion` (chosen) | 24 (Android 7.0) | hello-world template default; can be lowered to 21 |
| `compileSdkVersion` / `targetSdkVersion` | 37 | Matches the only installed platform `android-37.0` |
| `buildToolsVersion` | `36.0.0` | Matches installed build-tools |

## Progress Log

- **Phase 0 (Setup)**: Nuxt Native scaffolding complete. Dependencies added via
  pnpm, config files generated (`nativescript.config.ts`, `webpack.config.cjs`),
  compatibility fixes applied (removed `type:module`, updated tsconfig), and
  `"main": ".nuxt-native/app.js"` added to `package.json` (needed by
  `@nativescript/webpack`'s `getEntryPath()`).
- **Generated dirs are gitignored**: `platforms/` (scaffolded per-machine) and
  `.nuxt-native/` (regenerated by `init|dev|build`; contains absolute
  machine-specific import paths) were added to `.gitignore`; `.nuxt-native/` was
  removed from tracking.
- **Build environment validated**:
  - `npx nuxt-native doctor` → **13/13 project checks passed**.
  - `ns info` now reports `@nativescript/android has 9.1.1 version and is up to
    date` (installed via pnpm). `@nativescript/ios` intentionally not installed
    (Android-first).
  - `ns platform add android` succeeds → `Platform android successfully added. v9.1.1`.
- **App identity**: `appId` set to `org.abidewomen.connect` in
  `nativescript.config.ts`, `nuxt.config.ts` (`native.appId`), used for the
  Gradle `namespace`/`applicationId` (via the generated
  `assets/app/package.json`).
- **App_Resources scaffolded**: NativeScript's `ns platform add` does **not**
  scaffold `App_Resources` for an existing project (contrary to nuxt-native's
  inline comment), so the full tree was copied from
  `@nativescript/template-hello-world-ts@9.1.1`. `app.gradle` adjusted to the
  installed SDK (`compileSdk 37` / `targetSdk 37` / `buildTools "36.0.0"`).
  `nuxt-native init` then applied splash branding, Gradle memory tuning, OkHttp
  (WebSocket) and a debug cleartext exception.
- **Build attempt (`npx nuxt-native build android`)**: the toolchain runs —
  webpack compiles NativeScript core + `nativescript-vue` and reaches the app
  source. It then fails on **unmigrated app code** (51 TS errors): Nuxt/Vite
  aliases (`~`, `#shared`, `#server`), `@nuxt/ui`, and generated
  `#server/utils/generated/prisma/enums` are not resolvable in the
  NativeScript webpack pipeline. This is the expected Phase 3+ work, not a
  toolchain problem.
- **Current status**: Build toolchain ready (SDK + JDK 17 + pnpm + doctor).
  Next: configure the native webpack aliases and migrate the initial
  page/route so a first APK can compile, then continue App Shell & Navigation.

**Phase 2 (App Shell)**: Migrated layouts (default.vue, secondary.vue) to NativeScript GridLayout structure. Migrated nav components (Top, Bottom, BackButton, Actions, NotificationMenu) to NativeScript primitives - simplified NotificationMenu for MVP.
