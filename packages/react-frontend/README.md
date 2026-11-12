# Price Pantry frontend

Mobile-first React app for the Price Pantry prototype. On a wide
screen it sits in a centered phone-width column.

Screens follow the Team ANNA storyboard: Supabase sign-in and
signup, location or ZIP, home search, results, product detail,
shopping list, cheapest total, nearby stores, and store detail.

## Scripts

From this folder, or from the repo root with
`-w react-frontend`:

```bash
npm run dev
npm run build
npm run lint
```

The root `npm run dev` and `npm run build` scripts call this
package. See the repository README for Supabase Auth setup,
Google provider configuration, env vars, and Vercel settings.

## Item search

Search results and store search share the matcher in
`src/lib/search.js`. It works with the sample catalog now and
with loaded product rows later; it does not need a scraper or an
external AI service.

- Word order, punctuation, accents, and plurals are normalized.
- `2% mil`, `milk of 2%`, and `two percent milk` find
  `Milk, 2%`.
- Short prefixes and one-letter typos, including swapped
  letters, can match directly. Equally ranked uncertain matches
  use the existing **Did you mean** confirmation.
- Common aliases include chickpeas/garbanzo beans,
  scallions/green onions, and skim/nonfat milk.
- Every meaningful query term must match. Percentages,
  quantities, and explicit variant terms stay exact so `2%` does
  not match `1%` or `12%`.

Products need only a `name` and `id`. Optional `short_name`,
`keywords`, and `size_label` improve matching. For example, add
a retailer-specific alternate name to that product's `keywords`.
Shared phrase aliases live in `src/lib/searchTerms.js`. Store
search also matches `category`.

This is a conservative text matcher, so an unknown synonym or an
unavailable item can still return no match. It does not invent
products or prices, or merge distinct retailer product IDs. Run
the search examples without a database using:

```bash
node --test src/lib/search.test.js
```
