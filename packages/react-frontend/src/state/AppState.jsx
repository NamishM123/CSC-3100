import {
  useCallback,
  useEffect,
  useMemo,
  useState
} from "react";
import { loadRemoteCatalog } from "../data/api.js";
import NotificationState from "./NotificationState.jsx";
import { useAuthSession } from "./useAuthSession.js";
import { useSavedLists } from "../hooks/useSavedLists.js";
import { listDocument } from "../lib/savedLists.js";
import {
  mergeCatalog,
  catalogForLocation
} from "../lib/catalog.js";
import { useMapLocation } from "../hooks/useMapLocation.js";
import { useKrogerLocations } from "../hooks/useKrogerLocations.js";
import { useOpenData } from "../hooks/useOpenData.js";
import {
  loadAccountState,
  saveAccountState,
  clearAccountState
} from "../lib/accountStorage.js";
import {
  price_history,
  prices,
  product_swaps,
  products,
  search_history,
  store_chains,
  stores
} from "../data/mock.js";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function mockCatalog() {
  return {
    storesAreDemo: true,
    pricesAreDemo: true,
    store_chains: clone(store_chains),
    stores: clone(stores),
    products: clone(products),
    prices: clone(prices),
    price_history: clone(price_history),
    product_swaps: clone(product_swaps)
  };
}

function defaultAccountState() {
  return {
    lists: [],
    items: [],
    activeListId: null,
    justAddedProductId: null,
    recentSearches: search_history.map((entry) => entry.term),
    listsDirty: false,
    includeMember: true,
    suggestSwaps: false,
    acceptedSwapIds: [],
    dietary: [],
    alerts: [],
    routePlan: "split",
    radiusMi: 5,
    krogerPriceWeight: 0.7
  };
}

function freshState() {
  return {
    location: null,
    catalog: mockCatalog(),
    ...defaultAccountState()
  };
}

function loadInitial(userId) {
  const base = freshState();
  try {
    const saved = loadAccountState(sessionStorage, userId);
    return {
      ...base,
      ...saved,
      ...listDocument(saved),
      radiusMi: Number.isFinite(saved.radiusMi)
        ? Math.max(1, Math.min(100, saved.radiusMi))
        : base.radiusMi,
      catalog: base.catalog
    };
  } catch {
    return base;
  }
}

function applyRemote(current, remote) {
  return {
    ...current,
    catalog: mergeCatalog(current.catalog, remote)
  };
}

export function AppStateProvider({ children }) {
  const auth = useAuthSession();
  return (
    <AccountStateProvider
      key={auth.user?.id || "signed-out"}
      auth={auth}>
      {children}
    </AccountStateProvider>
  );
}

function AccountStateProvider({ auth, children }) {
  const userId = auth.user?.id;
  const [state, setState] = useState(() => loadInitial(userId));
  const mapLocation = useMapLocation(state.location);
  const { place } = mapLocation;
  const discoveryPlace =
    userId && !auth.mfaRequired ? place : null;
  const kroger = useKrogerLocations(
    discoveryPlace,
    state.radiusMi
  );
  const community = useOpenData(
    discoveryPlace
      ? {
          action: "stores",
          location: discoveryPlace,
          radiusMi: Math.max(1, state.radiusMi)
        }
      : null
  );
  const catalog = useMemo(
    () =>
      catalogForLocation(state.catalog, place, [
        ...kroger.stores,
        ...(community.data?.stores || [])
      ]),
    [state.catalog, place, kroger.stores, community.data]
  );
  const [now, setNow] = useState(Date.now);
  const listSync = useSavedLists(userId, state, setState);
  const refreshCatalog = useCallback(async () => {
    const remote = await loadRemoteCatalog();
    if (remote)
      setState((current) => applyRemote(current, remote));
  }, []);

  useEffect(() => {
    try {
      saveAccountState(sessionStorage, userId, state);
    } catch {
      // Private mode or a full disk should not break the demo.
    }
  }, [state, userId]);

  useEffect(() => {
    let cancelled = false;
    loadRemoteCatalog().then((remote) => {
      if (cancelled || !remote) return;
      setState((current) => applyRemote(current, remote));
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    const refresh = () => {
      setNow(Date.now());
      void refreshCatalog();
    };
    window.addEventListener("focus", refresh);
    const timer = setInterval(refresh, 60000);
    const clock = setInterval(() => setNow(Date.now()), 30000);
    return () => {
      window.removeEventListener("focus", refresh);
      clearInterval(timer);
      clearInterval(clock);
    };
  }, [refreshCatalog]);

  const api = {
    ...state,
    ...auth,
    catalog,
    storeDirectory: { mapLocation, kroger, community },
    location: place || state.location,
    refreshCatalog,
    listSync,
    now,
    addRequestedItem(listId, query, details = {}) {
      const clean = query.trim();
      if (!clean || clean.length > 120) return;
      setState((current) => {
        if (!current.lists.some((list) => list.id === listId))
          return current;
        const existing = current.items.find(
          (item) =>
            item.list_id === listId &&
            item.query?.toLowerCase() === clean.toLowerCase() &&
            item.name === details.name
        );
        return {
          ...current,
          listsDirty: true,
          items: existing
            ? current.items.map((item) =>
                item.id === existing.id
                  ? {
                      ...item,
                      storeSelections: {
                        ...item.storeSelections,
                        ...details.storeSelections
                      },
                      quantity: Math.min(
                        99,
                        item.quantity + (details.quantity || 1)
                      ),
                      checked: false
                    }
                  : item
              )
            : [
                ...current.items,
                {
                  id: `item-${crypto.randomUUID()}`,
                  list_id: listId,
                  product_id: `request-${crypto.randomUUID()}`,
                  query: clean,
                  name: details.name,
                  image_url: details.image_url,
                  size_label: details.size_label,
                  storeSelections: details.storeSelections,
                  quantity: details.quantity || 1,
                  checked: false
                }
              ]
        };
      });
    },
    setStoreProduct(itemId, storeId, productId) {
      setState((current) => ({
        ...current,
        items: current.items.map((item) =>
          item.id === itemId
            ? {
                ...item,
                storeSelections: {
                  ...item.storeSelections,
                  [storeId]: productId
                }
              }
            : item
        )
      }));
    },
    setKrogerPriceWeight(krogerPriceWeight) {
      setState((current) => ({
        ...current,
        krogerPriceWeight
      }));
    },
    async signOut() {
      if (listSync.ready) await listSync.flush();
      await auth.signOut();
      clearAccountState(sessionStorage, userId);
    },
    async signOutEverywhere() {
      if (listSync.ready) await listSync.flush();
      await auth.signOutEverywhere();
      clearAccountState(sessionStorage, userId);
    },
    setLocation(location) {
      setState((current) => ({ ...current, location }));
    },
    setRadius(radiusMi) {
      if (
        !Number.isFinite(radiusMi) ||
        radiusMi < 1 ||
        radiusMi > 100
      )
        return;
      setState((current) => ({ ...current, radiusMi }));
    },
    rememberSearch(term) {
      const clean = term.trim();
      if (!clean) return;
      setState((current) => ({
        ...current,
        recentSearches: [
          clean,
          ...current.recentSearches.filter(
            (entry) =>
              entry.toLowerCase() !== clean.toLowerCase()
          )
        ].slice(0, 8)
      }));
    },
    removeSearch(term) {
      setState((current) => ({
        ...current,
        recentSearches: current.recentSearches.filter(
          (entry) => entry !== term
        )
      }));
    },
    clearSearches() {
      setState((current) => ({
        ...current,
        recentSearches: []
      }));
    },
    setActiveList(activeListId) {
      setState((current) => ({ ...current, activeListId }));
      void refreshCatalog();
    },
    createList(name) {
      const clean = name.trim();
      if (!clean) return null;
      const id = `list-${crypto.randomUUID()}`;
      setState((current) => ({
        ...current,
        listsDirty: true,
        activeListId: id,
        justAddedProductId: null,
        lists: [
          ...current.lists,
          {
            id,
            name: clean,
            owner_name: auth.user?.name || "You",
            shared_with: []
          }
        ]
      }));
      return id;
    },
    deleteList(listId) {
      setState((current) => {
        const lists = current.lists.filter(
          (list) => list.id !== listId
        );
        const items = current.items.filter(
          (item) => item.list_id !== listId
        );
        return {
          ...current,
          lists,
          items,
          listsDirty: true,
          activeListId: lists[0]?.id || null
        };
      });
    },
    addOrUpdateItem(listId, productId, quantity) {
      setState((current) => {
        if (!current.lists.some((list) => list.id === listId))
          return current;
        const product = current.catalog.products.find(
          (entry) => entry.id === productId
        );
        const details = {
          name: product?.name,
          image_url: product?.image_url,
          size_label: product?.size_label
        };
        const items = current.items.map((item) => ({
          ...item
        }));
        const existing = items.find(
          (item) =>
            item.list_id === listId &&
            item.product_id === productId
        );
        if (existing) {
          Object.assign(existing, details);
          existing.quantity = quantity;
          existing.checked = false;
        } else {
          items.push({
            id: `item-${crypto.randomUUID()}`,
            list_id: listId,
            product_id: productId,
            ...details,
            quantity,
            checked: false
          });
        }
        return {
          ...current,
          items,
          listsDirty: true,
          activeListId: listId,
          justAddedProductId: productId
        };
      });
    },
    toggleChecked(itemId) {
      setState((current) => ({
        ...current,
        listsDirty: true,
        items: current.items.map((item) =>
          item.id === itemId
            ? { ...item, checked: !item.checked }
            : item
        )
      }));
    },
    setItemQuantity(itemId, quantity) {
      setState((current) => ({
        ...current,
        listsDirty: true,
        items: current.items.map((item) =>
          item.id === itemId ? { ...item, quantity } : item
        )
      }));
    },
    removeItem(itemId) {
      setState((current) => {
        const target = current.items.find(
          (item) => item.id === itemId
        );
        return {
          ...current,
          listsDirty: true,
          items: current.items.filter(
            (item) => item.id !== itemId
          ),
          justAddedProductId:
            target &&
            target.product_id === current.justAddedProductId
              ? null
              : current.justAddedProductId
        };
      });
    },
    setIncludeMember(includeMember) {
      setState((current) => ({ ...current, includeMember }));
    },
    setSuggestSwaps(suggestSwaps) {
      setState((current) => ({ ...current, suggestSwaps }));
    },
    toggleSwap(swapId) {
      setState((current) => {
        const has = current.acceptedSwapIds.includes(swapId);
        return {
          ...current,
          acceptedSwapIds: has
            ? current.acceptedSwapIds.filter(
                (id) => id !== swapId
              )
            : [...current.acceptedSwapIds, swapId]
        };
      });
    },
    toggleDietary(filter) {
      setState((current) => {
        const has = current.dietary.includes(filter);
        return {
          ...current,
          dietary: has
            ? current.dietary.filter(
                (entry) => entry !== filter
              )
            : [...current.dietary, filter]
        };
      });
    },
    clearDietary() {
      setState((current) => ({ ...current, dietary: [] }));
    },
    addAlert(alert) {
      setState((current) => {
        const rest = current.alerts.filter(
          (entry) => entry.product_id !== alert.product_id
        );
        return { ...current, alerts: [alert, ...rest] };
      });
    },
    removeAlert(productId) {
      setState((current) => ({
        ...current,
        alerts: current.alerts.filter(
          (alert) => alert.product_id !== productId
        )
      }));
    },
    setRoutePlan(routePlan) {
      setState((current) => ({ ...current, routePlan }));
    }
  };

  return (
    <NotificationState appState={api}>
      {children}
    </NotificationState>
  );
}
