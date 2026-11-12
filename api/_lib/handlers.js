// Request handlers shared by the Vercel serverless functions
// (api/kroger/*) and the Express backend. The (req, res) contract
// used here — req.query, res.status(code).json(body), res.setHeader —
// is satisfied by both runtimes, so one implementation serves both.

import {
  KrogerError,
  fetchLocations,
  fetchProducts,
  krogerConfigured,
  normalizeCatalog,
  normalizeLocation
} from "./kroger.js";

// Default staple terms so a bare /catalog?zip= call returns something
// recognizable. Callers can override with ?terms=milk,eggs,bread.
const DEFAULT_TERMS = ["milk", "eggs", "bread", "bananas"];

function setCommonHeaders(res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
}

function fail(res, error) {
  const status =
    error instanceof KrogerError ? error.status : 500;
  const message =
    error instanceof KrogerError
      ? error.message
      : "Request failed. Please try again.";
  res.status(status).json({ error: message });
}

function parseTerms(raw) {
  if (!raw) return DEFAULT_TERMS;
  const terms = String(raw)
    .split(",")
    .map((term) => term.trim())
    .filter(Boolean)
    .slice(0, 8);
  return terms.length ? terms : DEFAULT_TERMS;
}

// GET /api/kroger/locations?zip=93401&radius=10&limit=5
export async function locationsHandler(req, res) {
  setCommonHeaders(res);
  if (req.method && req.method !== "GET")
    return res
      .status(405)
      .json({ error: "Method not allowed." });
  if (!krogerConfigured())
    return res
      .status(503)
      .json({ error: "Kroger API is not configured." });

  const { zip, radius, limit } = req.query || {};
  try {
    const locations = await fetchLocations({
      zip,
      radiusMiles: radius,
      limit
    });
    res
      .status(200)
      .json({ stores: locations.map(normalizeLocation) });
  } catch (error) {
    fail(res, error);
  }
}

// GET /api/kroger/catalog?zip=93401&terms=milk,eggs&radius=10&stores=3&perTerm=8
// Returns a normalized { store_chains, stores, products, prices } catalog
// ready to pass straight into applyRemote on the client.
export async function catalogHandler(req, res) {
  setCommonHeaders(res);
  if (req.method && req.method !== "GET")
    return res
      .status(405)
      .json({ error: "Method not allowed." });
  if (!krogerConfigured())
    return res
      .status(503)
      .json({ error: "Kroger API is not configured." });

  const query = req.query || {};
  const terms = parseTerms(query.terms);
  try {
    const locations = await fetchLocations({
      zip: query.zip,
      radiusMiles: query.radius,
      limit: Math.min(Number(query.stores) || 3, 5)
    });
    if (!locations.length)
      return res
        .status(200)
        .json({
          store_chains: [],
          stores: [],
          products: [],
          prices: []
        });

    const perTerm = Math.min(Number(query.perTerm) || 6, 20);

    // Fetch each term at each location. Kroger has no bulk endpoint, so
    // these run in parallel and tolerate individual failures (a term with
    // no results at one store should not blank the whole response).
    const jobs = [];
    for (const location of locations) {
      for (const term of terms) {
        jobs.push(
          fetchProducts({
            term,
            locationId: location.locationId,
            limit: perTerm
          })
            .then((products) => ({
              locationId: location.locationId,
              products
            }))
            .catch(() => ({
              locationId: location.locationId,
              products: []
            }))
        );
      }
    }
    const productGroups = await Promise.all(jobs);
    const catalog = normalizeCatalog({
      locations,
      productGroups
    });
    res.status(200).json(catalog);
  } catch (error) {
    fail(res, error);
  }
}
