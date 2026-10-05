import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Screen from "../components/Screen.jsx";
import Sheet from "../components/Sheet.jsx";
import StoreCard from "../components/StoreCard.jsx";
import {
  countNoun,
  firstName,
  joinNames
} from "../lib/format.js";
import { useAppState } from "../state/useAppState.js";

const RADIUS_OPTIONS = [1, 2, 5, 10, 15];

export default function Home() {
  const {
    user,
    location,
    radiusMi,
    setRadius,
    recentSearches,
    rememberSearch,
    lists,
    items,
    setActiveList,
    catalog
  } = useAppState();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [radiusOpen, setRadiusOpen] = useState(false);
  const nearby = [...catalog.stores].sort(
    (a, b) => a.distance_mi - b.distance_mi
  );

  function runSearch(term) {
    const clean = term.trim();
    if (!clean) return;
    rememberSearch(clean);
    navigate(`/search?q=${encodeURIComponent(clean)}`);
  }

  return (
    <Screen title="Home" chrome={false}>
      <h1 className="hello">Hi {firstName(user?.name)}</h1>
      <p className="hello-sub">
        {location?.city} {location?.zip}
        {" | "}
        <button
          type="button"
          className="inline-btn"
          onClick={() => setRadiusOpen(true)}>
          within {radiusMi} mi
        </button>
      </p>
      {location?.demoNote ? (
        <p className="fine">
          Demo store prices are for San Luis Obispo.
        </p>
      ) : null}
      <form
        className="search"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          runSearch(query);
        }}>
        <SearchIcon />
        <label className="sr-only" htmlFor="home-search">
          Search an item
        </label>
        <input
          id="home-search"
          value={query}
          placeholder="Search an item, e.g. banana"
          onChange={(event) => setQuery(event.target.value)}
        />
      </form>

      <div className="section-title">
        <h2>Recent searches</h2>
      </div>
      {recentSearches.length ? (
        <div className="chips">
          {recentSearches.map((term) => (
            <button
              key={term}
              type="button"
              className="chip"
              onClick={() => runSearch(term)}>
              {term}
            </button>
          ))}
        </div>
      ) : (
        <p className="muted">Search history is empty.</p>
      )}

      <div className="section-title">
        <h2>Nearby stores</h2>
        <Link to="/stores">See all</Link>
      </div>
      <div className="stack">
        {nearby.slice(0, 3).map((store) => (
          <StoreCard
            key={store.id}
            store={store}
            variant="drive"
            to={`/stores/${store.id}`}
          />
        ))}
      </div>

      <div className="section-title">
        <h2>Your lists</h2>
      </div>
      <div className="stack">
        {lists.map((list) => {
          const count = items.filter(
            (item) => item.list_id === list.id
          ).length;
          const shared = list.shared_with?.length
            ? ` | shared with ${joinNames(list.shared_with)}`
            : "";
          return (
            <Link
              key={list.id}
              className="card tint list-card"
              to="/list"
              onClick={() => setActiveList(list.id)}>
              <div>
                <strong>{list.name}</strong>
                <p className="muted">
                  {countNoun(count, "item")}
                  {shared}
                </p>
              </div>
              <span className="open-link">Open &gt;</span>
            </Link>
          );
        })}
      </div>

      {radiusOpen ? (
        <Sheet
          title="Search radius"
          onClose={() => setRadiusOpen(false)}>
          <div className="stack">
            {RADIUS_OPTIONS.map((miles) => (
              <button
                key={miles}
                type="button"
                className={
                  miles === radiusMi ? "choice on" : "choice"
                }
                onClick={() => {
                  setRadius(miles);
                  setRadiusOpen(false);
                }}>
                {miles} miles
              </button>
            ))}
          </div>
        </Sheet>
      ) : null}
    </Screen>
  );
}

function SearchIcon() {
  return (
    <svg
      className="search-icon"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      aria-hidden="true">
      <circle
        cx="10.5"
        cy="10.5"
        r="6.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M15.5 15.5 L20 20"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
