import { useMemo, useState } from "react";
import {
  Link,
  useParams,
  useSearchParams
} from "react-router-dom";
import Screen from "../components/Screen.jsx";
import AddItemToList from "../components/AddItemToList.jsx";
import ProductHeader from "../components/product-detail/ProductHeader.jsx";
import StorePrices from "../components/product-detail/StorePrices.jsx";
import PriceHistory from "../components/product-detail/PriceHistory.jsx";
import {
  PriceAlertSheet,
  StalePriceSheet
} from "../components/product-detail/ProductSheets.jsx";
import { priceClock } from "../lib/catalog.js";
import { isStale } from "../lib/format.js";
import { lowestQuote } from "../lib/compare.js";
import { useProductPrices } from "../hooks/useProductPrices.js";
import { useAppState } from "../state/useAppState.js";

export default function ProductDetail() {
  const { productId } = useParams();
  const [params, setParams] = useSearchParams();
  const {
    catalog,
    now,
    location,
    radiusMi,
    includeMember,
    acceptedSwapIds,
    alerts,
    addAlert
  } = useAppState();
  const product = catalog.products.find(
    (entry) => entry.id === productId
  );
  const rows = useProductPrices(catalog, product);
  const [hideStale, setHideStale] = useState(false);
  const [pickedStale, setPickedStale] = useState(null);
  const [alertOpen, setAlertOpen] = useState(false);
  const [chartStoreId, setChartStoreId] = useState(null);
  const visible = hideStale
    ? rows.filter(
        (row) => !isStale(row.updated_at, priceClock(row, now))
      )
    : rows;
  const warningRow =
    pickedStale ||
    (params.get("warning") === "stale"
      ? rows.find((row) =>
          isStale(row.updated_at, priceClock(row, now))
        )
      : null);
  const chartRow =
    visible.find((row) => row.store_id === chartStoreId) ||
    visible[0] ||
    rows[0];
  const history = useMemo(
    () =>
      catalog.price_history
        .filter(
          (point) =>
            point.product_id === product?.id &&
            point.store_id === chartRow?.store_id
        )
        .sort((a, b) =>
          a.recorded_on.localeCompare(b.recorded_on)
        ),
    [catalog.price_history, chartRow?.store_id, product?.id]
  );
  const quote =
    product &&
    lowestQuote({
      productId: product.id,
      prices: catalog.prices,
      stores: catalog.stores,
      radiusMi,
      includeMember,
      now,
      swaps: catalog.product_swaps,
      acceptedSwapIds
    });
  const alertSaved = alerts.some(
    (alert) => alert.product_id === productId
  );

  if (!product)
    return (
      <Screen title="Item" backTo="/">
        <div className="empty">
          <h2>Item not found</h2>
          <Link className="btn primary" to="/">
            Back home
          </Link>
        </div>
      </Screen>
    );

  const closeWarning = () => {
    setPickedStale(null);
    if (params.get("warning")) {
      const next = new URLSearchParams(params);
      next.delete("warning");
      setParams(next, { replace: true });
    }
  };

  return (
    <Screen
      title={product.name}
      backTo={`/search?q=${encodeURIComponent(product.name)}`}
      dock={
        <div className="btn-row">
          <AddItemToList product={product} />
          <button
            type="button"
            className="btn ghost"
            onClick={() => setAlertOpen(true)}>
            {alertSaved ? "Alert saved" : "Price alert"}
          </button>
        </div>
      }>
      <div className="product-layout">
        <ProductHeader
          product={product}
          title={
            product.list_unit === "each"
              ? `${product.name}, each`
              : product.name
          }
        />
        <StorePrices
          product={product}
          rows={rows}
          hideStale={hideStale}
          radiusMi={radiusMi}
          onShowOlder={() => setHideStale(false)}
          onSelect={(row, stale) =>
            stale
              ? setPickedStale(row)
              : setChartStoreId(row.store_id)
          }
        />
        <PriceHistory
          history={history}
          store={chartRow?.store}
        />
      </div>
      <StalePriceSheet
        row={warningRow}
        product={product}
        onClose={closeWarning}
        onShowFresh={() => {
          setHideStale(true);
          setChartStoreId(null);
          closeWarning();
        }}
      />
      <PriceAlertSheet
        open={alertOpen}
        product={product}
        location={location}
        quote={quote}
        fallbackPrice={rows[0]?.price}
        saved={alertSaved}
        onClose={() => setAlertOpen(false)}
        onSave={(below) => {
          addAlert({
            product_id: product.id,
            name: product.name,
            zip: location?.zip,
            below
          });
          setAlertOpen(false);
        }}
      />
    </Screen>
  );
}
