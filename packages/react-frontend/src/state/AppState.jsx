import { useEffect, useState } from "react";
import { loadRemoteCatalog } from "../data/api.js";
import { AppStateContext } from "./useAppState.js";
import {
  price_history,
  prices,
  product_swaps,
  products,
  search_history,
  shopping_list_items,
  shopping_lists,
  store_chains,
  stores
} from "../data/mock.js";

const STORAGE_KEY = "price-pantry-demo";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function mockCatalog() {
  return {
    store_chains: clone(store_chains),
    stores: clone(stores),
    products: clone(products),
    prices: clone(prices),
    price_history: clone(price_history),
    product_swaps: clone(product_swaps)
  };
}

function demoLists() {
  return {
    lists: clone(shopping_lists),
    items: clone(shopping_list_items),
    activeListId: shopping_lists[0].id,
    justAddedProductId: "prod-bananas",
    recentSearches: search_history.map((entry) => entry.term),
    listsDirty: false,
    includeMember: true,
    suggestSwaps: false,
    acceptedSwapIds: [],
    saleNotifications: false,
    dietary: [],
    alerts: [],
    routePlan: "split",
    radiusMi: 5
  };
}

function freshState() {
  return {
    user: null,
    location: null,
    catalog: mockCatalog(),
    ...demoLists()
  };
}

function loadInitial() {
  const base = freshState();
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return base;
    const saved = JSON.parse(raw);
    return {
      ...base,
      ...saved,
      catalog: base.catalog
    };
  } catch {
    return base;
  }
}

function applyRemote(current, remote) {
  const catalog = { ...current.catalog };
  if (remote.store_chains?.length) {
    catalog.store_chains = remote.store_chains;
  }
  if (remote.stores?.length) catalog.stores = remote.stores;
  if (remote.products?.length)
    catalog.products = remote.products;
  if (remote.prices?.length) catalog.prices = remote.prices;
  if (remote.price_history?.length) {
    catalog.price_history = remote.price_history;
  }
  const next = { ...current, catalog };
  if (!current.listsDirty && remote.shopping_lists?.length) {
    next.lists = remote.shopping_lists;
    if (
      !next.lists.some((list) => list.id === next.activeListId)
    ) {
      next.activeListId = next.lists[0].id;
    }
    if (remote.shopping_list_items?.length) {
      next.items = remote.shopping_list_items;
    }
  }
  return next;
}

function persistable(state) {
  const copy = { ...state };
  delete copy.catalog;
  return copy;
}

export function AppStateProvider({ children }) {
  const [state, setState] = useState(loadInitial);

  useEffect(() => {
    try {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(persistable(state))
      );
    } catch {
      // Private mode or a full disk should not break the demo.
    }
  }, [state]);

  useEffect(() => {
    let cancelled = false;
    loadRemoteCatalog().then((remote) => {
      if (cancelled || !remote) return;
      setState((current) => applyRemote(current, remote));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const api = {
    ...state,
    signIn(account) {
      const email = account.email.trim();
      const fallback = email.split("@")[0] || "Shopper";
      const name = (account.name || fallback).trim();
      setState((current) => ({
        ...current,
        user: { name, email }
      }));
    },
    signOut() {
      setState((current) => ({ ...current, user: null }));
    },
    setLocation(location) {
      setState((current) => ({ ...current, location }));
    },
    setRadius(radiusMi) {
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
    },
    createList(name) {
      const clean = name.trim();
      if (!clean) return null;
      const id = `list-${Date.now()}`;
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
            owner_name: current.user?.name || "You",
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
        const items = current.items.map((item) => ({
          ...item
        }));
        const existing = items.find(
          (item) =>
            item.list_id === listId &&
            item.product_id === productId
        );
        if (existing) {
          existing.quantity = quantity;
          existing.checked = false;
        } else {
          items.push({
            id: `item-${Date.now()}`,
            list_id: listId,
            product_id: productId,
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
    setSaleNotifications(saleNotifications) {
      setState((current) => ({
        ...current,
        saleNotifications
      }));
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
    setRoutePlan(routePlan) {
      setState((current) => ({ ...current, routePlan }));
    },
    resetDemo() {
      setState((current) => ({
        ...current,
        ...demoLists(),
        catalog: mockCatalog()
      }));
    }
  };

  return (
    <AppStateContext.Provider value={api}>
      {children}
    </AppStateContext.Provider>
  );
}
