// Addresses/hours verified against the publishers on 2026-11-13:
// https://californiafreshmarket.com/locations/
// https://spencersfreshmarkets.com/
// https://www.slofood.coop/
// OSM coordinates retain per-branch attribution; the Co-op publishes its own.
const california =
  "https://californiafreshmarket.com/locations/";
const spencers = "https://spencersfreshmarkets.com/";

export const weeklyAdStores = [
  {
    id: "weekly-california-fresh-slo",
    provider: "california-fresh",
    name: "California Fresh Market",
    address: "771 E. Foothill Boulevard",
    city: "San Luis Obispo",
    zip: "93405",
    latitude: 35.29309,
    longitude: -120.6730028,
    source_url: california,
    coordinate_source_url:
      "https://www.openstreetmap.org/way/45599266",
    alternate_ids: ["osm-way-45599266"],
    hours_label: "Daily 6 AM–10 PM"
  },
  {
    id: "weekly-california-fresh-pismo",
    provider: "california-fresh",
    name: "California Fresh Market",
    address: "555 Five Cities Drive",
    city: "Pismo Beach",
    zip: "93449",
    latitude: 35.1350607,
    longitude: -120.623866,
    source_url: california,
    coordinate_source_url:
      "https://www.openstreetmap.org/way/312681686",
    alternate_ids: ["osm-way-312681686", "osm-way-312681684"],
    hours_label: "Daily 6 AM–10 PM"
  },
  {
    id: "weekly-el-rancho-solvang",
    provider: "california-fresh",
    name: "El Rancho Marketplace",
    aliases: ["El Rancho Market"],
    address: "2886 Mission Drive",
    city: "Solvang",
    zip: "93463",
    latitude: 34.6062824,
    longitude: -120.1016498,
    source_url: california,
    coordinate_source_url:
      "https://www.openstreetmap.org/way/1377023836",
    alternate_ids: ["osm-way-1377023836"],
    hours_label: "Daily 6 AM–10 PM"
  },
  {
    id: "weekly-spencers-morro-bay",
    provider: "spencers",
    name: "Spencer's Fresh Markets",
    address: "2650 Main Street",
    city: "Morro Bay",
    zip: "93442",
    latitude: 35.389951,
    longitude: -120.8572476,
    source_url: spencers,
    coordinate_source_url:
      "https://www.openstreetmap.org/way/166142420",
    alternate_ids: ["osm-way-166142420"],
    hours_label: "See publisher for current hours"
  },
  {
    id: "weekly-spencers-santa-maria",
    provider: "spencers",
    name: "Spencer's Fresh Markets",
    address: "3580 Orcutt Road",
    city: "Santa Maria",
    zip: "93455",
    latitude: 34.8949651,
    longitude: -120.4360903,
    source_url: spencers,
    coordinate_source_url:
      "https://www.openstreetmap.org/way/1156200268",
    alternate_ids: ["osm-way-1156200268"],
    hours_label: "See publisher for current hours"
  },
  {
    id: "weekly-spencers-lompoc",
    provider: "spencers",
    name: "Spencer's Fresh Markets",
    address: "1009 North H Street",
    city: "Lompoc",
    zip: "93436",
    latitude: 34.6541344,
    longitude: -120.4593571,
    source_url: spencers,
    coordinate_source_url:
      "https://www.openstreetmap.org/way/1515702330",
    alternate_ids: ["osm-way-1515702330"],
    hours_label: "See publisher for current hours"
  },
  {
    id: "weekly-slo-food-coop",
    provider: "slo-food-coop",
    name: "SLO Food Co-op",
    address: "2494 Victoria Avenue",
    city: "San Luis Obispo",
    zip: "93401",
    latitude: 35.267346,
    longitude: -120.6523904,
    source_url: "https://www.slofood.coop/",
    coordinate_source_url: "https://www.slofood.coop/",
    alternate_ids: [],
    hours_label: "Daily 8 AM–8 PM"
  }
].map((store) => ({
  ...store,
  chain_id: `weekly-${store.provider}`,
  state: "CA",
  source: "weekly-ads",
  location_verified_on: "2026-11-13"
}));

export function weeklyAdStore(id) {
  return (
    weeklyAdStores.find(
      (store) =>
        store.id === id || store.alternate_ids.includes(id)
    ) || null
  );
}
