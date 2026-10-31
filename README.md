# CSC-3100 Team Project

Monorepo for the CSC-3100 team project.

## Packages

- `packages/react-frontend` — React (Vite) frontend
- `packages/express-backend` — Express backend

See [CONTRIBUTING.md](./CONTRIBUTING.md) for Prettier/ESLint
setup and collaboration workflow.

## Price Pantry frontend

The grocery comparison UI lives in `packages/react-frontend`. It
is a mobile-first React app. On a wide screen the app sits in a
centered phone-width column. Prices come from
`packages/react-frontend/src/data/mock.js` unless Supabase env
vars are set.

### Run it locally

From the repository root:

```bash
npm install
npm run dev
```

Open http://localhost:5173

For the app plus the local background notification server, use
`npm run dev:local` instead. This starts both servers; leave
that terminal open. Use Node.js 24 LTS (minimum 22.13 for the
backend's built-in SQLite support).

Create an account with your email and password, confirm the
email if requested, then sign in. Authentication uses Supabase;
there are no preset demo credentials. Then allow location, or
enter ZIP `93405`.

Other scripts:

```bash
npm run build
npm run lint
npm test
npm run dev -w express-backend
```

`npm run build` builds the React app. `npm run lint` lints the
frontend and the Express package. The Express server is local
only. `GET /health` on port 8000 returns `{ "status": "ok" }`.
The local server also serves the authenticated session and
notification APIs; Vite proxies `/api` to it on port 8000.

### Local sale and price notifications — no Vercel required

Notifications support two delivery modes in **Profile → Sale
notifications**. Both require browser permission and a signed-in
account. An account with 2FA must finish verification first.

**While the app is open** works with `npm run dev` alone. Choose
that mode, turn notifications on, and allow permission. The tab
checks your outstanding list items and saved price targets on
enable, catalog/watch changes, focus, and every minute. Leaving
the tab open is required; browsers can suspend background tabs.
**Send test notification** checks display without waiting for a
matching sale. **Check saved items now** runs a check
immediately.

**Background via local server** keeps checking after the tab
closes. To use it:

1. Keep your existing public Supabase frontend configuration in
   `packages/react-frontend/.env.local`. During local
   development, the backend automatically reads that file's
   public project URL and publishable/anon key. No service-role
   key or notification database migration is needed for this
   local implementation.
2. Run `npm install` once after updating the code, then run
   `npm run dev:local` from the repository root. Open
   **http://localhost:5173** consistently; `127.0.0.1` is a
   different browser origin with separate
   permissions/subscriptions.
3. Sign in and choose your location. In Profile, turn
   notifications off if already enabled, select **Background via
   local server**, then turn them on and grant permission.
4. Select **Send test notification**. This sends a real Web Push
   request from Express through your browser's push provider.
   Check the operating system's notification center; browser/OS
   notification settings and Focus/Do Not Disturb still apply.
5. Select **Check saved items now** to evaluate current watches,
   then close the app tab. Leave the terminal, local backend,
   network, and computer running. Express checks up to 100 saved
   devices per pass, every 60 seconds by default. Alerts can be
   delivered without an open app tab. A fully stopped browser or
   sleeping computer can defer delivery. Keep Vite running too
   so clicking an alert can open its product page.
6. To run a one-off server check manually, use another terminal:

   ```bash
   npm run notifications:check -w express-backend
   ```

This command reads saved watches even with no open app page. It
reports counts of processed devices, sent alerts, and failed
devices. It does not require a cron service or Vercel. You can
also run the two servers separately with `npm run dev` and
`npm run dev -w express-backend`. Restart the backend after
editing backend code when using the combined command.

Background watches contain product IDs for unchecked,
positive-quantity items in existing lists, price targets for the
selected ZIP, selected coordinates, radius, membership
preference, and whether the catalog is demo data. The app syncs
them while open; changes made while the app/server cannot
communicate reach the backend on the next successful sync. The
server does not receive passwords or store access/refresh tokens
with the watch.

The backend generates its VAPID key pair automatically and
stores keys, SQLite watches, claims, and delivery history in
`packages/express-backend/.local/notifications/`. This directory
is ignored by Git. Keep it private and preserve it across
restarts; deleting it loses server subscriptions/history and
rotates keys. If keys change, turn background notifications off
and on again. `npm run notifications:setup -w express-backend`
can create/check the keys in advance without printing them.

Optional settings belong in
`packages/express-backend/.env.local` (see `.env.example`).
Explicit `SUPABASE_URL` and
`SUPABASE_PUBLISHABLE_KEY`/`SUPABASE_ANON_KEY` override the
local frontend fallback; keep them on the same project. Other
settings are `PUSH_DATA_DIR`, `PUSH_CHECK_INTERVAL_SECONDS`
(15–86400), `VAPID_SUBJECT` (a real contact URI before
sharing/deployment), and an optional existing
`VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` pair. Supply both keys or
neither. The default contact URI is a development placeholder.
Keep the default backend `PORT=8000` unless also updating Vite's
proxy. It binds to `127.0.0.1` by default; do not expose a
development server publicly.

Notification matching requires a confirmed in-stock, positive
price within the selected radius. Member prices respect the
membership setting. Prices seven days old or older, future
observations, and expired/future/invalid sale periods are
excluded. Date-only sale end dates include the entire UTC day.
Price targets notify strictly below the saved amount. Matching
sales and targets for the same offer produce one alert. Backend
live catalog reads are bounded to 5,000 rows per table per
check.

The built-in sample catalog uses its fixed demo clock. Alerts
from those rows say **Demo**. No live retailer feed has been
added: real alerts require an updating prototype `prices`
catalog containing sale/stock metadata. The newer
`price_results` schema does not supply that metadata and is not
treated as a sale feed. New real offers are detected when your
existing data source updates the catalog.

Recent delivered offers appear in Profile. Clearing history does
not resend them. Browser mode deduplicates per account on this
browser; background mode uses durable SQLite delivery records
and atomic claims, including across process restarts. Transient
failures retry; expired push endpoints are deleted. As with most
push systems, a crash between sending and recording success can
cause a retry; stable notification tags reduce duplicate
displays. Newly matching alerts are limited to 20 per device per
pass; later passes continue with unsent matches.

Turning notifications off removes this device's background watch
and unsubscribes it. Signing out also attempts that cleanup;
local unsubscribe is attempted even if the backend is down, and
an unavailable notification service does not prevent Auth
sign-out. Global sign-out also requests deletion of all server
watches for the account when the backend is reachable. If
browser/provider cleanup fails while offline, block that site's
notification permission to stop device delivery immediately.
Other devices' already displayed notifications are not recalled.

Notification permission and delivery are browser/platform
features. Use a supported desktop browser on **localhost** or
HTTPS. On iPhone/iPad, use an installed Home Screen app on an
HTTPS origin; a phone's `localhost` refers to the phone, and a
computer's plain HTTP LAN address is not a secure origin. A
manifest is supplied, but the app does not cache pages for
offline use. See
[Web Push](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
and
[notification display](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/showNotification).

For future hosting, use a persistent Node server or adapt the
store/scheduler to a hosted database and job runner. SQLite in
an ephemeral function filesystem is not a durable production
store. Vercel is not involved in the local notification flow.

### Authentication

Set `VITE_SUPABASE_URL` and either
`VITE_SUPABASE_PUBLISHABLE_KEY` or `VITE_SUPABASE_ANON_KEY` in
`packages/react-frontend/.env.local`. Restart Vite after
changing these values. Email/password sign-in and signup use
Supabase Auth. Signup stores the name as user metadata and waits
for email confirmation when the project requires it. Sessions
persist across reloads; sign-out clears the current browser
session.

For Google login, enable Google in Supabase Authentication's
provider settings and enter a Google OAuth web client ID and
secret. In Google Cloud, authorize the callback URL shown by
Supabase: `https://<project-ref>.supabase.co/auth/v1/callback`.
Under Supabase Authentication URL Configuration, allow
`http://localhost:5173/**` for development and the deployed
`/sign-in` callback URL for production. Both Google and
confirmation emails return to `/sign-in`, which restores the
requested app page. See
[Google provider setup](https://supabase.com/docs/guides/auth/social-login/auth-google)
and
[redirect configuration](https://supabase.com/docs/guides/auth/redirect-urls).

Catalog and shopping-list data still use the prototype data
layer; Supabase Auth integration does not migrate that data to
the lookup model.

### Activate two-factor authentication and security

The application supports optional authenticator-app (TOTP) 2FA.
Once an account enables it, both password and Google sign-in
must pass the authenticator step before the app exposes that
account's data. No SMS subscription or additional 2FA service is
needed. The code in this repository does not change your hosted
Supabase settings automatically.

#### 1. Configure the correct Supabase project

1. Open the Supabase project used by this application's existing
   email/password accounts. Do not create a second project just
   for 2FA.
2. In **Authentication → Multi-Factor Authentication**, enable
   both **TOTP enrollment** and **TOTP verification**. Keep both
   enabled after rollout; disabling verification locks enrolled
   users out. The dashboard labels can change; look for the
   authenticator/TOTP enrollment and verification switches. See
   [Supabase MFA setup](https://supabase.com/docs/guides/auth/auth-mfa).
3. In **Authentication → Sign In / Providers → Email**, keep
   email/password login and email confirmation enabled. Set the
   minimum password length to **15**, matching this app's signup
   rule. Enable leaked-password protection if your plan offers
   it. Password policy must be configured in Supabase as well:
   browser validation can be bypassed. Existing passwords can
   still be used to sign in; this app does not force a password
   reset.
4. Under **Authentication → URL Configuration**, set the Site
   URL to your HTTPS production origin. Add the exact production
   callback `https://YOUR-SITE/sign-in` and development callback
   `http://localhost:5173/sign-in`. Allow preview callbacks only
   for previews you control. Avoid a broad wildcard covering
   other people's sites.
5. If using Google, keep its provider enabled and configure its
   client ID/secret in Supabase, with the Supabase OAuth
   callback registered in Google Cloud as described above.
   Google login returns to the same app-level 2FA screen.
6. Review **Authentication → Rate Limits** for password/token,
   signup/email, and verification requests. Keep Supabase's
   abuse limits enabled. These checks run at the Auth service; a
   disabled button in the browser is not a rate limiter. See
   [Supabase rate limits](https://supabase.com/docs/guides/auth/rate-limits).

#### 2. Set public frontend credentials

Copy `packages/react-frontend/.env.example` to
`packages/react-frontend/.env.local` and replace its values:

```dotenv
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_PUBLIC_KEY
```

A legacy anon JWT can instead be supplied as
`VITE_SUPABASE_ANON_KEY`. Use the same public credentials in
your deployment environment, then rebuild/redeploy: Vite embeds
them at build time. Restart Vite after local changes. The build
rejects secret/service-role keys in either supported key
variable and rejects insecure remote HTTP Auth URLs. Local
Supabase HTTP on localhost is allowed during development. Serve
the deployed app over HTTPS; login is unavailable in an insecure
browser context.

Every `VITE_` value is public frontend configuration. Never put
service-role keys, database credentials, OAuth secrets,
passwords, password hashes, or TOTP setup secrets there. If a
private key has already been deployed or committed, rotate it in
Supabase and replace/rebuild affected deployments; removing it
from the current file does not revoke an exposed key.

#### 3. Apply the database enforcement migration

1. Back up your database or test on a development project first.
2. Open **SQL Editor → New query** in the same Supabase project.
3. Paste and run the entire contents of
   [202610290002_mfa_access.sql](./supabase/migrations/202610290002_mfa_access.sql).
   If using Supabase CLI migrations, apply this migration
   through your normal migration workflow instead.
4. This migration is independent of the catalog and push
   features. It works with the current lookup schema, an older
   prototype schema, or an Auth-only project. Missing
   application tables are skipped. It can be run again safely,
   including after adding a protected table listed in the
   migration.
5. Confirm installation in SQL Editor:

   ```sql
   select to_regprocedure('public.mfa_access_allowed()');

   select tablename, policyname, permissive, roles
   from pg_policies
   where schemaname = 'public'
     and policyname in (
       'Require enrolled MFA',
       'Require list ownership implementation'
     )
   order by tablename, policyname;
   ```

   The function must exist. Existing protected tables must show
   `Require enrolled MFA` as **RESTRICTIVE**. This restriction
   blocks anonymous callers and password-only sessions when the
   account has a verified factor; an unfinished setup does not
   lock the user out. It grants no new data access. Stores,
   products, and public price catalog reads remain available.

The prototype `shopping_lists` and `shopping_list_items` tables
lack enforceable ownership. The migration closes both tables to
browser clients even after 2FA. The app continues using
sample/local lists scoped to the signed-in account; existing
database rows are preserved. Before enabling real database list
sync, implement owner/member IDs tied to `auth.users`, test
owner/member RLS, and deliberately replace the
`Require list ownership implementation` deny policy. A person's
display name or a `shared_with` label is not proof of ownership.

The live-lookup users/searches/jobs/results tables stay closed
unless a separate permission policy grants access. Service-role
workers bypass RLS; every user-facing worker/API must validate
the caller, require enrolled MFA, and check row ownership.

#### 4. Deploy and enable 2FA for an account

1. Run `npm test`, `npm run lint`, and `npm run build`.
2. Deploy the frontend with this repository's `vercel.json` (or
   the frontend folder's config if deploying that folder). Both
   contain the security response headers. The current Vercel
   deployment is a static frontend; it does not deploy the
   Express server automatically.
3. Sign in, choose a location if prompted, then open **Profile →
   Two-factor authentication → Set up two-factor
   authentication**.
4. Scan the QR code in an authenticator app. If scanning is not
   possible, expand **Can't scan the code?** and enter its setup
   key in the authenticator. Treat the QR/setup key like a
   password: anyone with it can generate the same codes.
5. Securely back up your authenticator, enter its current
   six-digit code, and select **Enable two-factor
   authentication**. The setting reports **On** only after
   successful verification. The app keeps setup secrets in
   memory only while setting up; it does not persist them in app
   storage or logs.
6. Optionally choose **Add another authenticator** for a
   separate backup device. Cancel removes the unfinished factor.
   Reloaded or abandoned unfinished factors are cleaned up the
   next time setup starts; verified authenticators are
   preserved.
7. Sign out and sign back in. Enter the authenticator code to
   finish signing in. A reload or direct URL to a protected app
   page must still require verification. Returning from the
   authenticator app must preserve an unfinished QR setup.
8. To remove an authenticator, choose **Remove** and confirm its
   current code. Removing the last authenticator disables 2FA.

The login code screen includes a help QR above the code field,
plus an **Open authenticator help** link for users on the same
phone. Both open Google's public authenticator guide. Scan this
help QR with the phone's camera. It contains only the public
guide URL; the account's private setup QR is shown only during
enrollment. Login codes still come from the authenticator that
was already enrolled for the account.

#### 5. Verify API and database enforcement

For the optional local Express server, copy
`packages/express-backend/.env.example` to `.env.local` in that
same folder. Fill `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`
(or `SUPABASE_ANON_KEY`) using the same project. Run
`npm run dev -w express-backend`.

`GET http://localhost:8000/health` stays public.
`GET http://localhost:8000/api/session` requires
`Authorization: Bearer YOUR_ACCESS_TOKEN`. It validates that
exact token with Supabase Auth before interpreting its MFA
claim. Missing/expired/forged tokens receive **401**;
password-only tokens for enrolled accounts receive **403**;
verified sessions receive **200**; unavailable Auth fails closed
with **503**. Responses are not cached. The endpoint returns
only the caller's ID, email, and assurance level. Do not paste
real tokens into source files, screenshots, issue trackers, or
logs. Future Express private routes should use `requireAuth()`
from `src/auth.js` and add their own resource ownership checks.

Before production rollout, use a test account and verify:

| Check                                          | Expected result                                  |
| ---------------------------------------------- | ------------------------------------------------ |
| Password sign-in without enrolled 2FA          | Normal access                                    |
| Incorrect/expired setup or login code          | Rejected; app stays locked during login          |
| Password sign-in with enrolled 2FA             | Code required; correct code restores destination |
| Google sign-in with enrolled 2FA               | Same app-level code requirement                  |
| Reload/direct protected URL before code        | Still locked                                     |
| Auth/factor lookup unavailable                 | No protected app access; retry/sign-out shown    |
| API called with enrolled user's `aal1` token   | HTTP 403                                         |
| API called with verified `aal2` token          | HTTP 200                                         |
| Public catalog as signed-out user              | Catalog remains readable                         |
| Prototype list tables through browser Data API | No rows accessible, including after 2FA          |
| Account A signs out, Account B signs in        | A's local lists/location/searches do not appear  |

To check the policy helper itself, replace `TEST_USER_UUID` with
the Auth ID of your enrolled test account and run this SQL. Do
not use a user's email as the ID:

```sql
begin;
select set_config('request.jwt.claims',
  '{"sub":"TEST_USER_UUID","role":"authenticated","aal":"aal1"}', true);
select public.mfa_access_allowed(); -- false with a verified factor
select set_config('request.jwt.claims',
  '{"sub":"TEST_USER_UUID","role":"authenticated","aal":"aal2"}', true);
select public.mfa_access_allowed(); -- true (ownership policies still apply)
rollback;
```

The SQL Editor normally runs as an administrator and bypasses
table RLS, so helper results are not proof of table access
control. Also test the Data API with the public key and a real
test user's token. Never test enforcement with a service-role
key.

#### Password hashing, browser security, and recovery

Manual email/password login uses Supabase Auth, which stores
salted **bcrypt password hashes**, not plaintext passwords. This
already protects existing accounts; there is no password column
to add to `public.users`. Passwords travel directly to Supabase
over HTTPS. The app does not store or log passwords, and clears
password inputs after an authentication attempt. It does not
create an extra client-side hash, which would become a reusable
login credential. See
[Supabase password storage](https://supabase.com/docs/guides/auth/password-security).

New signup passwords require at least 15 characters and at most
72 UTF-8 bytes to respect bcrypt's input limit. Multibyte
characters may take more than one byte. The stricter signup rule
does not reject existing shorter passwords at sign-in. See
[bcrypt's byte limit](https://github.com/kelektiv/node.bcrypt.js#security-issues-and-concerns).

Vercel responses enforce a Content Security Policy, HTTPS/HSTS,
anti-framing, MIME sniffing prevention, a restrictive referrer
policy, and disabled camera/microphone permissions. Inline
styles remain allowed for React/Leaflet positioning; inline
scripts and eval are blocked. The policy allows the standard
Supabase project domains, ZIP lookup, and OpenStreetMap tiles.
If using a custom Supabase domain, add its exact HTTPS/WSS
origins to `connect-src` and its storage image origin to
`img-src` in **both** Vercel configs before deploying. Add only
required origins, then check the browser console for CSP
violations. The development Vite server does not apply this
production CSP.

Supabase session tokens persist through its SDK storage. App
list/location/search caches are separate per account and per
tab, are not loaded until authentication including 2FA passes,
and are cleared from the current tab on sign-out. Old unscoped
demo caches are no longer read. Browser storage is not encrypted
and this SPA does not claim HttpOnly-cookie protection; avoid
shared browser profiles for sensitive data. **Sign out all
devices** revokes refresh sessions. Previously issued access
JWTs may remain valid until expiry; it is not instant revocation
of every token. Review the project's token lifetime and session
settings in
[Supabase sessions](https://supabase.com/docs/guides/auth/sessions).

This app does not issue recovery codes. If all authenticators
are lost, a trusted project administrator must verify the
person's identity independently, find their Auth user ID, list
their MFA factors with the admin API, and delete only the
confirmed lost factors. Use Supabase's server-side
`auth.admin.mfa.listFactors({ userId })` and
`auth.admin.mfa.deleteFactor({ userId, id })` from a trusted
admin environment; never add a public reset endpoint or ship an
admin key to the browser. Deleting a verified factor signs out
active sessions. Then have the person sign in and enroll a new
authenticator. See
[admin factor removal](https://supabase.com/docs/reference/javascript/auth-admin-deletefactor).
Password reset or Google login does not skip an existing factor.

### Store map and location

The Stores screen uses Leaflet with OpenStreetMap street tiles.
Drag or use the directional buttons/arrow keys to pan; use the
zoom buttons, mouse wheel, or pinch gesture to zoom. The center
button returns to the selected location, and Show stores fits
the nearby markers. No map API key is required.

Allow location saves the browser's actual GPS coordinates. ZIP
entry uses [Zippopotam.us](https://www.zippopotam.us/) to
resolve a US ZIP code to an approximate area center. Failed
lookups and denied GPS requests do not substitute a demo
location.

The store map and list filter the available catalog by the
selected radius and calculate straight-line distances from the
selected location. Built-in store pins remain sample data in San
Luis Obispo; the real basemap does not provide live retailer
discovery. OpenStreetMap attribution remains visible. Tiles
require an internet connection and follow the
[OpenStreetMap tile usage policy](https://operations.osmfoundation.org/policies/tiles/).

### Mock data and Supabase

`packages/react-frontend/src/data/mock.js` holds the demo rows.
The collections match the tables we expect later:
`store_chains`, `stores`, `products`, `prices`,
`shopping_lists`, and `shopping_list_items`. `price_history`
feeds the 30 day chart.

`src/data/api.js` reads those tables when both of these are set:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

If they are missing, or a query fails, the screen keeps the mock
rows. To connect a Supabase project locally:

1. Create a Supabase project and open its SQL Editor.
2. Run [`supabase/schema.sql`](./supabase/schema.sql). It
   creates the tables, indexes, and read-only demo policies
   expected by the app.
3. Copy `packages/react-frontend/.env.example` to
   `packages/react-frontend/.env.local` and replace both
   placeholders with the Project URL and publishable (or legacy
   anon) key from the Supabase **Connect** dialog.
4. Add catalog rows in the Supabase Table Editor or import rows
   based on `packages/react-frontend/src/data/mock.js`.
5. Restart `npm run dev` after changing environment variables.

Do not commit `.env.local`, and never put a Supabase
`service_role` key in a Vite frontend. The supplied policies are
deliberately read-only and are appropriate only for the public
course-demo data. Use Supabase Auth and user-specific RLS
policies before storing real users' shopping lists.

An empty Supabase table does not wipe the demo. A table replaces
mock data after it has at least one row.

### Deploy on Vercel

Import this GitHub repository in the Vercel dashboard. Use these
settings if the form does not already match the root
`vercel.json`:

| Setting          | Value                             |
| ---------------- | --------------------------------- |
| Root Directory   | `.` (repository root)             |
| Framework Preset | Vite                              |
| Install Command  | `npm install`                     |
| Build Command    | `npm run build -w react-frontend` |
| Output Directory | `packages/react-frontend/dist`    |

Optional environment variables, same names as `.env.example`:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Leave them empty to ship the mock catalog. Add them for
Production, Preview, and Development if you want Supabase.

The root `vercel.json` rewrites deep links such as `/list` and
`/product/prod-bananas` to `index.html`, so the React router can
open them.

You can instead set the Root Directory to
`packages/react-frontend`, Framework Preset to Vite, Build
Command to `npm run build`, and Output Directory to `dist`. That
folder has its own `vercel.json` rewrite. If install fails
because of npm workspaces, set the Install Command to
`cd ../.. && npm install`.

### Express on Vercel later

This deploy builds the React app only. The Express package keeps
running locally with `app.listen` and should stay that way for
class development.

When we want the API on Vercel, add route files under
`packages/react-frontend/api/` (or a root `api/` folder if the
Vercel root stays the repository root). Each file should export
a function instead of calling `app.listen`. Vercel serves those
as serverless functions at `/api/...`. Move one Express route at
a time, starting with `/health`, and keep the Express package
working locally until the move is done.
