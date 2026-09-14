# Contributing

This is a monorepo shared by the CSC-3100 team. Follow these
tools and workflows so we avoid style fights and merge
conflicts.

## Repo layout

- `packages/react-frontend` — React (Vite) frontend
- `packages/express-backend` — Express backend

## Git rhythm (shared `main`)

1. Pull before you start: `git pull origin main`
2. Make your changes on a branch when possible:
   `git checkout -b your-feature`
3. Push your branch and open a PR, or coordinate in lab if
   working directly on `main` for early setup.
4. After someone pushes, **everyone else should pull** and
   confirm they see the new files.

One person pushes; others pull. Get used to that loop early.

## Prettier (repo root)

Prettier is installed at the **root** as a dev dependency.
Config lives in `.prettierrc`.

### Agreed options

| Feature                | Prettier option             | Our value |
| ---------------------- | --------------------------- | --------- |
| Indentation size       | `tabWidth`                  | `2`       |
| Tabs vs spaces         | `useTabs`                   | `false`   |
| Semicolons             | `semi`                      | `true`    |
| Line length            | `printWidth`                | `64`      |
| Single quotes          | `singleQuote`               | `false`   |
| Trailing commas        | `trailingComma`             | `none`    |
| Space in object braces | `bracketSpacing`            | `true`    |
| Arrow parens           | `arrowParens`               | `always`  |
| Bracket same line      | `bracketSameLine`           | `true`    |
| HTML whitespace        | `htmlWhitespaceSensitivity` | `ignore`  |
| Prose wrap             | `proseWrap`                 | `always`  |

### Format command

From the repo root:

```bash
npm run format
```

Once everyone uses Prettier (editor + this config), you should
rarely need to run this. Running format late on a busy branch
can create merge conflicts — that is why we set it up early.

Tip: enable the Prettier extension in your editor and set it as
the default formatter for JS/JSX/JSON/CSS/Markdown.

## ESLint

ESLint is configured **per package** (frontend and backend
differ).

### Frontend (`packages/react-frontend`)

- Config: `packages/react-frontend/eslint.config.js`
- Plugins: React, React Hooks, React Refresh
- Run:

```bash
cd packages/react-frontend
npm run lint
```

### Backend (`packages/express-backend`)

- Config: `packages/express-backend/eslint.config.js`
- Run:

```bash
cd packages/express-backend
npm run lint
```

ESLint reports problems; it does not rewrite files like
Prettier. We can turn rules on/off later without mass
reformatting.

## First-time setup

```bash
git clone https://github.com/NamishM123/CSC-3100.git
cd CSC-3100
npm install
```

Then pull often, format with the shared Prettier config, and
lint in the package you are editing.
