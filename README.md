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

Sign in is filled in for the demo account `namish@calpoly.edu`.
The password `password` signs you in. Use **Demo branch: sign in
with wrong password** to see the error state. Then allow
location, or enter ZIP `93405`.

Other scripts:

```bash
npm run build
npm run lint
npm run dev -w express-backend
```

`npm run build` builds the React app. `npm run lint` lints the
frontend and the Express package. The Express server is local
only. `GET /health` on port 8000 returns `{ "status": "ok" }`.

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
2. Run [`supabase/schema.sql`](./supabase/schema.sql). It creates the
   tables, indexes, and read-only demo policies expected by the app.
3. Copy `packages/react-frontend/.env.example` to
   `packages/react-frontend/.env.local` and replace both placeholders
   with the Project URL and publishable (or legacy anon) key from the
   Supabase **Connect** dialog.
4. Add catalog rows in the Supabase Table Editor or import rows based on
   `packages/react-frontend/src/data/mock.js`.
5. Restart `npm run dev` after changing environment variables.

Do not commit `.env.local`, and never put a Supabase `service_role`
key in a Vite frontend. The supplied policies are deliberately
read-only and are appropriate only for the public course-demo data.
Use Supabase Auth and user-specific RLS policies before storing real
users' shopping lists.

An empty Supabase table does not wipe the demo. A table replaces
mock data after it has at least one row.

### Live price ingestion (Kroger API)

`packages/express-backend` fills the `prices`, `products`, `stores`,
and `store_chains` tables with real, per-store prices from the
[Kroger public API](https://developer.kroger.com). The frontend reads
those rows through Supabase, so `compare.js` ranks stores on live data
with no UI change.

Prices arrive as structured JSON from Kroger's API rather than from
parsing store webpages: it is ToS-compliant, does not get bot-blocked,
and does not break when a site's markup changes. It covers
Kroger-family stores only; chains with no public prices (for example
Trader Joe's) cannot be sourced this way.

To run it:

1. Create a free app at <https://developer.kroger.com> and copy its
   client id and secret.
2. Copy `packages/express-backend/.env.example` to
   `packages/express-backend/.env` and fill in `KROGER_CLIENT_ID`,
   `KROGER_CLIENT_SECRET`, `SUPABASE_URL`, and
   `SUPABASE_SERVICE_ROLE_KEY` (the service role key writes rows and
   must stay server-side — never in the Vite frontend).
3. Preview without writing: `npm run ingest:dry -w express-backend`
   fetches and normalizes, then prints the cheapest sample.
4. Write to Supabase: `npm run ingest -w express-backend`, or with the
   server running, `POST /ingest` (add `?dryRun=1` to preview).
   `GET /ingest/status` reports the last run.

Set `INGEST_ZIP` and `INGEST_TERMS` in `.env` to control which stores
and items are fetched. Re-running upserts on deterministic ids, so
prices refresh in place instead of duplicating. Schedule
`npm run ingest` (for example with cron) to keep prices current.

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
