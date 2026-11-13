import { useKrogerSearch } from "../hooks/useKrogerSearch.js";
import { rankKrogerStores } from "../lib/recommendations.js";
import { dietaryStatus } from "../lib/search.js";
import { miles } from "../lib/format.js";
import { useAppState } from "../state/useAppState.js";
import LiveProductCard from "./LiveProductCard.jsx";

export default function LiveProductSearch({ query: rawQuery }) {
  const query = rawQuery.trim();
  const state = useAppState();
  const valid = query.trim().length > 0 && query.length <= 120;
  const { current, pending, error, refresh, receivedAt } =
    useKrogerSearch({
      location: state.location,
      radiusMi: state.radiusMi,
      queries: valid ? [query] : []
    });
  const rows = rankKrogerStores({
    stores: current?.stores || [],
    items: [{ id: "search", query, quantity: 1 }],
    products: [],
    now: Math.max(state.now, receivedAt || 0)
  });
  return (
    <section className="stack" aria-busy={pending}>
      <div className="section-title">
        <h2>Live Kroger products</h2>
        <button
          className="text-link"
          type="button"
          disabled={pending || !valid}
          onClick={refresh}>
          Refresh prices
        </button>
      </div>
      <p className="muted">
        Current store-specific results within {state.radiusMi}{" "}
        miles. Select a product to save its store choice to your
        list.
      </p>
      {!valid ? <p>Search using 1–120 characters.</p> : null}
      {pending ? (
        <p role="status">Searching Kroger stores...</p>
      ) : null}
      {error ? (
        <p role="alert" className="error">
          {error}
        </p>
      ) : null}
      {current && !rows.length ? (
        <p>No nearby Kroger stores in this radius.</p>
      ) : null}
      {rows.map(({ store, lines }) => {
        const line = lines[0];
        return (
          <div className="stack" key={store.id}>
            <h3>
              {store.name} · {miles(store.distance_mi)}
            </h3>
            <p className="muted">{store.address}</p>
            {line.error ? (
              <p role="alert">{line.error}</p>
            ) : !line.options.length ? (
              <p>No matching products at this store.</p>
            ) : null}
            {line.truncated ? (
              <p className="fine">
                Results limited. Include a brand or size to
                narrow your search.
              </p>
            ) : null}
            <div className="cards-grid stack">
              {line.options
                .filter(
                  (product) =>
                    dietaryStatus(product, state.dietary).ok
                )
                .map((product) => {
                  const fresh =
                    line.status !==
                      "Refresh prices to check availability" &&
                    !line.error;
                  return (
                    <LiveProductCard
                      key={product.id}
                      product={product}
                      storeId={store.id}
                      query={query}
                      fresh={fresh}
                    />
                  );
                })}
            </div>
          </div>
        );
      })}
    </section>
  );
}
