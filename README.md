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

Create an account with your email and password, confirm the
email if requested, then sign in. Authentication uses Supabase;
there are no preset demo credentials. Then allow location, or
enter ZIP `93405`.

Other scripts:

```bash
npm run build
npm run lint
npm run dev -w express-backend
```

`npm run build` builds the React app. `npm run lint` lints the
frontend and the Express package. The Express server is local
only. `GET /health` on port 8000 returns `{ "status": "ok" }`.

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
