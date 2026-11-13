import { useState } from "react";
import { useOpenData } from "../hooks/useOpenData.js";
import { weeklyAdSources } from "../lib/weeklyAdSources.js";
import {
  dietaryStatus,
  productMatchesQuery
} from "../lib/search.js";
import { useAppState } from "../state/useAppState.js";
import Screen from "./Screen.jsx";
import DietaryNotice from "./DietaryNotice.jsx";
import AddItemToList from "./AddItemToList.jsx";

export default function WeeklyAdDetail({ provider }) {
  const { dietary } = useAppState();
  const [query, setQuery] = useState("");
  const source = weeklyAdSources.find(
    (entry) => entry.id === provider
  );
  const { data, loading, error, retry } = useOpenData(
    source ? { action: "weeklyAds", provider } : null
  );
  const offers = (data?.offers || []).filter(
    (offer) =>
      productMatchesQuery(offer, query) &&
      dietaryStatus(offer, dietary).ok
  );
  return (
    <Screen
      title={
        source
          ? `${source.name} weekly ad`
          : "Weekly ad not found"
      }
      backTo="/stores">
      {source ? (
        <>
          <p>{source.area}</p>
          <p className="muted">
            Advertised deals for this publisher&apos;s
            locations. Confirm your branch, package size, and
            purchase conditions. Stock is unconfirmed; these
            offers do not enter confirmed basket totals.
          </p>
          <div className="section-title">
            <a
              className="text-link"
              href={source.source_url}
              target="_blank"
              rel="noreferrer">
              View publisher&apos;s ad
            </a>
            <button
              className="text-link"
              type="button"
              disabled={loading}
              onClick={retry}>
              Refresh
            </button>
          </div>
          {loading ? (
            <p role="status">
              Collecting the latest weekly ad...
            </p>
          ) : null}
          {error ? (
            <div className="card" role="alert">
              <p>{error}</p>
              <button
                className="text-link"
                type="button"
                onClick={retry}>
                Try again
              </button>
            </div>
          ) : null}
          {data ? (
            <>
              {data.starts_on ? (
                <p className="meta">
                  Advertised dates:{" "}
                  <time dateTime={data.starts_on}>
                    {data.starts_on}
                  </time>{" "}
                  through{" "}
                  <time dateTime={data.ends_on}>
                    {data.ends_on}
                  </time>{" "}
                  ({data.status}). Sale dates use Pacific time.
                </p>
              ) : (
                <p className="muted">
                  Sale dates could not be verified. Check the
                  original flyer before shopping.
                </p>
              )}
              <p className="fine">
                Last collected{" "}
                <time dateTime={data.fetched_at}>
                  {new Date(data.fetched_at).toLocaleString()}
                </time>
                . Sources refresh at most once an hour.
              </p>
              <DietaryNotice />
              {data.offers.length ? (
                <form
                  className="search"
                  role="search"
                  onSubmit={(event) => event.preventDefault()}>
                  <label
                    className="sr-only"
                    htmlFor="weekly-ad-search">
                    Search advertised products
                  </label>
                  <input
                    id="weekly-ad-search"
                    placeholder="Search advertised products"
                    value={query}
                    onChange={(event) =>
                      setQuery(event.target.value)
                    }
                  />
                </form>
              ) : null}
              <div className="stack cards-grid">
                {offers.map((offer) => (
                  <article
                    className="card stack"
                    key={offer.id}>
                    <div className="price-row">
                      <strong>{offer.name}</strong>
                      <strong>
                        {offer.advertised_price}
                        {offer.deposit_extra ? " + CRV" : ""}
                      </strong>
                    </div>
                    {offer.description ? (
                      <p>{offer.description}</p>
                    ) : null}
                    <p className="fine">
                      Advertised through {offer.ends_on} · Stock
                      unconfirmed
                    </p>
                    <a
                      className="text-link"
                      href={offer.source_url}
                      target="_blank"
                      rel="noreferrer">
                      View advertised offer
                    </a>
                    <AddItemToList
                      request={{
                        query:
                          `${offer.name} ${offer.package_size || ""}`
                            .trim()
                            .slice(0, 120),
                        name: `${offer.name} ${offer.package_size || ""}`.trim()
                      }}
                    />
                  </article>
                ))}
              </div>
              {!offers.length ? (
                <p className="muted">
                  {data.offers.length
                    ? "No advertised products match your search and dietary filters."
                    : "No current advertised prices are available here. Check the publisher's original ad."}
                </p>
              ) : null}
              {data.documents.length ? (
                <section
                  className="stack"
                  aria-label="Original flyers">
                  <h2>Original flyers</h2>
                  {data.documents.map((document) => (
                    <article className="card" key={document.id}>
                      <a
                        className="text-link"
                        href={document.source_url}
                        target="_blank"
                        rel="noreferrer">
                        Open {document.title.toLowerCase()}{" "}
                        (PDF)
                      </a>
                      <p className="fine">
                        {document.status}
                        {document.extraction === "image_only"
                          ? " · Prices are in the flyer image; view the PDF for details."
                          : document.extraction ===
                              "unavailable"
                            ? " · Automatic reading unavailable."
                            : ""}
                      </p>
                    </article>
                  ))}
                </section>
              ) : null}
              {data.warnings.length ? (
                <div className="fine" role="status">
                  {data.warnings.map((warning) => (
                    <p key={warning}>{warning}</p>
                  ))}
                </div>
              ) : null}
            </>
          ) : null}
        </>
      ) : (
        <p>Choose a weekly-ad source from Stores.</p>
      )}
    </Screen>
  );
}
