export const DIETARY_FILTERS = [
  "Vegan",
  "Gluten free",
  "Dairy free",
  "Nut free"
];

// Positive matches need a supplied claim or ingredient analysis. Missing
// allergens are never evidence that an item is allergen-free.
export function dietaryStatus(product, filters = []) {
  const selected = filters || [];
  if (!selected.length) {
    return {
      ok: true,
      unverified: false,
      conflicts: [],
      missing: []
    };
  }
  const supported = new Set(product?.dietary || []);
  const conflicts = new Set(product?.dietary_conflicts || []);
  const facts = product?.dietary_facts || {};
  const labels = new Set(facts.labels || []);
  const analysis = new Set(facts.analysis || []);
  const allergens = new Set([
    ...(facts.allergens || []),
    ...(facts.traces || [])
  ]);
  const name = String(product?.name || "").toLowerCase();

  const claims = {
    Vegan: /\bvegan\b/,
    "Gluten free": /\bgluten[ -]?free\b|\bfree from gluten\b/,
    "Dairy free":
      /\b(?:dairy|milk)[ -]?free\b|\bfree from (?:dairy|milk)\b/,
    "Nut free": /\bnut[ -]?free\b|\bfree from nuts\b/
  };
  const tagFor = {
    Vegan: "en:vegan",
    "Gluten free": "en:gluten-free",
    "Dairy free": "en:dairy-free",
    "Nut free": "en:nut-free"
  };
  for (const filter of DIETARY_FILTERS) {
    const negated =
      filter === "Vegan" &&
      /\b(?:non|not)[ -]vegan\b/.test(name);
    const treeNutsOnly =
      filter === "Nut free" &&
      /\btree[ -]nut[ -]?free\b/.test(name) &&
      !/\bpeanut[ -]?free\b/.test(name);
    if (
      labels.has(tagFor[filter]) ||
      (claims[filter].test(name) && !negated && !treeNutsOnly)
    )
      supported.add(filter);
  }
  if (analysis.has("en:vegan")) supported.add("Vegan");
  if (
    analysis.has("en:non-vegan") ||
    /\b(?:non|not)[ -]vegan\b/.test(name)
  ) {
    conflicts.add("Vegan");
  }
  if (supported.has("Vegan")) supported.add("Dairy free");

  // A short allowlist covers plain, unprocessed produce, not prepared foods
  // whose names happen to contain a fruit or vegetable.
  if (
    /^(?:organic |fresh )?(?:bananas?|apples?|oranges?|carrots?|spinach|broccoli|potatoes|tomatoes|lemons?|limes?|avocados?|strawberries|blueberries|onions?)$/.test(
      name.trim()
    )
  ) {
    ["Vegan", "Gluten free", "Dairy free"].forEach((filter) =>
      supported.add(filter)
    );
  }
  if (allergens.has("en:milk")) {
    conflicts.add("Dairy free");
    conflicts.add("Vegan");
  }
  if (
    [
      "en:eggs",
      "en:fish",
      "en:crustaceans",
      "en:molluscs"
    ].some((tag) => allergens.has(tag))
  )
    conflicts.add("Vegan");
  if (
    ["en:gluten", "en:wheat", "en:barley", "en:rye"].some(
      (tag) => allergens.has(tag)
    )
  )
    conflicts.add("Gluten free");
  if (
    [
      "en:nuts",
      "en:peanuts",
      "en:almonds",
      "en:hazelnuts",
      "en:walnuts",
      "en:cashew-nuts",
      "en:pecan-nuts",
      "en:pistachio-nuts",
      "en:brazil-nuts",
      "en:macadamia-nuts"
    ].some((tag) => allergens.has(tag))
  )
    conflicts.add("Nut free");

  // Names can disqualify an obvious conflict, but absence of these words
  // cannot establish safety. Explicit alternatives avoid false conflicts.
  if (
    !supported.has("Vegan") &&
    /\b(?:beef|pork|chicken|turkey|salmon|tuna|shrimp|eggs?|honey|gelatin)\b/.test(
      name
    )
  )
    conflicts.add("Vegan");
  const alternative =
    /\b(?:oat|almond|soy|soya|coconut|rice|cashew|plant)[ -]?(?:based)?\b/.test(
      name
    );
  if (
    !supported.has("Dairy free") &&
    !alternative &&
    /\b(?:milk|cheese|yogurt|yoghurt|whey|buttermilk)\b/.test(
      name
    )
  ) {
    conflicts.add("Dairy free");
    conflicts.add("Vegan");
  }
  if (
    !supported.has("Gluten free") &&
    /\b(?:wheat|barley|rye|semolina|bulgur)\b/.test(name)
  )
    conflicts.add("Gluten free");
  if (
    !supported.has("Nut free") &&
    /\b(?:peanuts?|almonds?|cashews?|walnuts?|pecans?|hazelnuts?|pistachios?|macadamias?)\b/.test(
      name
    )
  )
    conflicts.add("Nut free");

  const blocked = selected.filter((filter) =>
    conflicts.has(filter)
  );
  const missing = selected.filter(
    (filter) => !supported.has(filter) && !conflicts.has(filter)
  );
  return {
    ok: Boolean(product) && !blocked.length && !missing.length,
    unverified: missing.length > 0,
    conflicts: blocked,
    missing
  };
}
