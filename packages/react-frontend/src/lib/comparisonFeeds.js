// Source requests are independent. Report/advertisement feeds are reused when
// quantities or SKU selections change; retailer searches are keyed by queries.
export async function runComparisonFeed(
  request,
  { loadOpen, loadKroger, signal, update = () => {} }
) {
  let entries = {};
  let completed = 0;
  let total =
    request.kind === "weekly"
      ? request.providers.length
      : request.kind === "community"
        ? request.storeIds.length
        : 0;
  let dietaryLimited = false;
  const warnings = [];
  const publish = (extra = {}) => {
    if (!signal.aborted)
      update({
        entries: { ...entries },
        completed,
        total,
        dietaryLimited,
        warnings: [...warnings],
        ...extra
      });
  };
  const check = () => {
    if (signal.aborted)
      throw new DOMException("Aborted", "AbortError");
  };
  const chunks = (rows, size) =>
    Array.from(
      { length: Math.ceil(rows.length / size) },
      (_, index) => rows.slice(index * size, (index + 1) * size)
    );
  publish();
  if (request.kind === "weekly") {
    for (const provider of request.providers) {
      check();
      try {
        entries = {
          ...entries,
          [provider]: await loadOpen(
            { action: "weeklyAds", provider },
            signal
          )
        };
      } catch (error) {
        check();
        entries = {
          ...entries,
          [provider]: { offers: [], error: error.message }
        };
      }
      completed++;
      publish();
    }
  } else if (request.kind === "community") {
    for (const storeIds of chunks(request.storeIds, 4)) {
      check();
      try {
        const result = await loadOpen(
          {
            action: "comparisonReports",
            storeIds,
            dietary: request.dietary
          },
          signal
        );
        dietaryLimited ||= result.dietaryLimited;
        for (const id of storeIds) {
          const store = result.stores?.find(
            (store) => store.storeId === id
          );
          entries = {
            ...entries,
            [id]: store || {
              offers: [],
              error:
                "This store's report feed returned no response. Retry to check prices."
            }
          };
        }
      } catch (error) {
        check();
        for (const id of storeIds)
          entries = {
            ...entries,
            [id]: { offers: [], error: error.message }
          };
      }
      completed += storeIds.length;
      publish();
    }
  } else if (request.kind === "kroger") {
    const queryGroups = chunks(request.queries, 20);
    const firstStores = new Set();
    total = queryGroups.length;
    const merge = (result, queries, expectedId) => {
      dietaryLimited ||= result.dietaryLimited;
      if (
        result.limitedStores &&
        !warnings.includes(
          "The initial retailer search returned a limited group; other discovered branches are checked individually."
        )
      )
        warnings.push(
          "The initial retailer search returned a limited group; other discovered branches are checked individually."
        );
      const returned = expectedId
        ? result.stores.filter(
            (store) => store.id === expectedId
          )
        : result.stores;
      for (const store of returned) {
        if (!expectedId) firstStores.add(store.id);
        const previous = entries[store.id];
        const results = new Map(
          (previous?.results || []).map((row) => [
            row.query,
            row
          ])
        );
        for (const query of queries)
          results.set(
            query,
            store.results?.find(
              (row) => row.query === query
            ) || {
              query,
              products: [],
              error:
                "This item search did not return a response."
            }
          );
        entries = {
          ...entries,
          [store.id]: {
            ...previous,
            ...store,
            source: "kroger",
            results: [...results.values()]
          }
        };
      }
      if (expectedId && !returned.length)
        entries = {
          ...entries,
          [expectedId]: {
            ...entries[expectedId],
            id: expectedId,
            source: "kroger",
            feedError:
              "This retailer location could not be checked."
          }
        };
    };
    try {
      // Reuse the existing nearest-store search first, then explicitly check
      // the remaining discovered branches rather than silently stopping at 5.
      for (const queries of queryGroups) {
        check();
        const result = await loadKroger(
          {
            location: request.location,
            radiusMi: request.radiusMi,
            dietary: request.dietary,
            queries
          },
          signal
        );
        merge(result, queries);
        completed++;
        publish();
      }
      const remaining = request.storeIds.filter(
        (id) => !firstStores.has(id)
      );
      total = completed + remaining.length * queryGroups.length;
      publish();
      for (const storeId of remaining)
        for (const queries of queryGroups) {
          check();
          const result = await loadKroger(
            {
              location: request.location,
              radiusMi: request.radiusMi,
              storeId,
              dietary: request.dietary,
              queries
            },
            signal
          );
          merge(result, queries, storeId);
          completed++;
          publish();
        }
    } catch (error) {
      check();
      publish({ error: error.message });
      return;
    }
  }
  publish();
}
