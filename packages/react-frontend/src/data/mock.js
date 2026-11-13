// Demo catalog shaped like the Supabase tables Price Pantry
// will use once the API integration writes real rows.
//
// store_chains, stores, products, prices, shopping_lists,
// and shopping_list_items are the core tables.
// price_history feeds the 30 day chart.
// product_swaps is local until a substitutes table exists.
//
// distance_mi and drive_minutes are stored on each store
// for the demo. A later query can compute them from
// latitude and longitude instead.
//
// Prices are stamped against DEMO_NOW (9:41am Pacific on
// 5 Oct 2026, the time drawn on the prototype) so labels
// such as "2 hr ago" stay stable.

export const DEMO_NOW = "2026-10-05T16:41:00.000Z";

const UPDATED = {
  "store-tj": "2026-10-05T14:41:00.000Z",
  "store-sw": "2026-10-05T14:41:00.000Z",
  "store-go": "2026-10-05T13:41:00.000Z",
  "store-v": "2026-10-05T11:41:00.000Z",
  "store-fm": "2026-09-26T16:41:00.000Z"
};

const KNOWN_ZIPS = {
  93401: "San Luis Obispo",
  93402: "San Luis Obispo",
  93405: "San Luis Obispo",
  93407: "San Luis Obispo",
  93410: "San Luis Obispo"
};

export const DIETARY_FILTERS = [
  "Vegan",
  "Gluten free",
  "Dairy free",
  "Nut free"
];

export function cityForZip(zip) {
  return KNOWN_ZIPS[zip] || null;
}

export const store_chains = [
  { id: "chain-tj", name: "Trader Joe's", code: "TJ" },
  { id: "chain-sw", name: "Safeway", code: "SW" },
  { id: "chain-go", name: "Grocery Outlet", code: "GO" },
  { id: "chain-v", name: "Vons", code: "V" },
  { id: "chain-fm", name: "FoodMaxx", code: "FM" }
];

export const stores = [
  {
    id: "store-tj",
    chain_id: "chain-tj",
    name: "Trader Joe's",
    address: "100 Higuera St",
    city: "San Luis Obispo",
    state: "CA",
    zip: "93401",
    latitude: 35.2701,
    longitude: -120.6596,
    distance_mi: 0.8,
    drive_minutes: 4,
    hours_label: "Open until 9 PM"
  },
  {
    id: "store-sw",
    chain_id: "chain-sw",
    name: "Safeway",
    address: "200 Broad St",
    city: "San Luis Obispo",
    state: "CA",
    zip: "93401",
    latitude: 35.2754,
    longitude: -120.6632,
    distance_mi: 1.2,
    drive_minutes: 5,
    hours_label: "Open 24 hours"
  },
  {
    id: "store-go",
    chain_id: "chain-go",
    name: "Grocery Outlet",
    address: "300 Los Osos Valley Rd",
    city: "San Luis Obispo",
    state: "CA",
    zip: "93405",
    latitude: 35.2472,
    longitude: -120.6814,
    distance_mi: 1.9,
    drive_minutes: 7,
    hours_label: "Open until 10 PM"
  },
  {
    id: "store-v",
    chain_id: "chain-v",
    name: "Vons",
    address: "400 Madonna Rd",
    city: "San Luis Obispo",
    state: "CA",
    zip: "93405",
    latitude: 35.2598,
    longitude: -120.6741,
    distance_mi: 2.4,
    drive_minutes: 8,
    hours_label: "Open until 11 PM"
  },
  {
    id: "store-fm",
    chain_id: "chain-fm",
    name: "FoodMaxx",
    address: "500 Tank Farm Rd",
    city: "San Luis Obispo",
    state: "CA",
    zip: "93401",
    latitude: 35.2411,
    longitude: -120.6522,
    distance_mi: 3.1,
    drive_minutes: 10,
    hours_label: "Open until 10 PM"
  }
];

export const products = [
  {
    id: "prod-bananas",
    name: "Bananas",
    short_name: "Bananas",
    list_unit: "each",
    category: "Produce",
    size_label: "about 0.33 lb each",
    unit_amount: 0.33,
    unit: "lb",
    image_url: "/images/products/bananas.jpeg",
    dietary: ["Vegan", "Gluten free"],
    dietary_conflicts: [],
    dietary_verified: true,
    also_try: ["prod-organic-bananas", "prod-banana-bread"],
    keywords: ["banana", "bananas"]
  },
  {
    id: "prod-organic-bananas",
    name: "Organic bananas",
    short_name: "Organic bananas",
    list_unit: "each",
    category: "Produce",
    size_label: "about 0.33 lb each",
    unit_amount: 0.33,
    unit: "lb",
    image_url: "/images/products/organic-bananas.jpeg",
    dietary: ["Vegan", "Gluten free"],
    dietary_conflicts: [],
    dietary_verified: true,
    also_try: ["prod-bananas"],
    keywords: ["organic", "banana"]
  },
  {
    id: "prod-banana-bread",
    name: "Banana bread",
    short_name: "Banana bread",
    list_unit: "loaf",
    category: "Bakery",
    size_label: "1 loaf",
    unit_amount: null,
    unit: null,
    image_url: "/images/products/organic-bananas.jpeg",
    dietary: ["Vegetarian"],
    dietary_conflicts: ["Vegan", "Gluten free"],
    dietary_verified: true,
    also_try: ["prod-bananas"],
    keywords: ["banana", "bread"]
  },
  {
    id: "prod-milk",
    name: "Milk, 2%",
    short_name: "Milk 2%",
    list_unit: "1 gal",
    category: "Dairy",
    size_label: "1 gal",
    unit_amount: 1,
    unit: "gal",
    image_url: "/images/products/milk-2-percent.jpeg",
    dietary: ["Vegetarian"],
    dietary_conflicts: ["Vegan", "Dairy free"],
    dietary_verified: true,
    also_try: ["prod-oat-milk"],
    keywords: ["milk"]
  },
  {
    id: "prod-eggs",
    name: "Eggs, large",
    short_name: "Eggs",
    list_unit: "dozen",
    category: "Dairy",
    size_label: "dozen",
    unit_amount: 12,
    unit: "egg",
    image_url: "/images/products/eggs.jpeg",
    dietary: ["Vegetarian", "Gluten free"],
    dietary_conflicts: ["Vegan"],
    dietary_verified: true,
    also_try: [],
    keywords: ["eggs", "egg"]
  },
  {
    id: "prod-bread",
    name: "Bread, whole wheat",
    short_name: "Bread whole wheat",
    list_unit: "24 oz",
    category: "Bakery",
    size_label: "24 oz",
    unit_amount: 24,
    unit: "oz",
    image_url: "/images/products/whole-wheat-bread.png",
    dietary: ["Vegetarian"],
    dietary_conflicts: [],
    dietary_verified: false,
    also_try: [],
    keywords: ["bread"]
  },
  {
    id: "prod-pb",
    name: "Peanut butter",
    short_name: "Peanut butter",
    list_unit: "16 oz",
    category: "Pantry",
    size_label: "16 oz",
    unit_amount: 16,
    unit: "oz",
    image_url: "/images/products/peanut-butter.jpeg",
    dietary: ["Vegan", "Gluten free"],
    dietary_conflicts: ["Nut free"],
    dietary_verified: true,
    also_try: [],
    keywords: ["peanut", "pb"]
  },
  {
    id: "prod-spinach",
    name: "Spinach",
    short_name: "Spinach",
    list_unit: "5 oz",
    category: "Produce",
    size_label: "5 oz",
    unit_amount: 5,
    unit: "oz",
    image_url: "/images/products/spinach.jpeg",
    dietary: ["Vegan", "Gluten free"],
    dietary_conflicts: [],
    dietary_verified: true,
    also_try: [],
    keywords: ["spinach"]
  },
  {
    id: "prod-oat-milk",
    name: "Oat milk",
    short_name: "Oat milk",
    list_unit: "64 oz",
    category: "Dairy alternative",
    size_label: "64 oz",
    unit_amount: 64,
    unit: "oz",
    image_url: "/images/products/milk-2-percent.jpeg",
    dietary: ["Vegan", "Dairy free"],
    dietary_conflicts: [],
    dietary_verified: true,
    also_try: ["prod-milk"],
    keywords: ["oat", "milk"]
  },
  {
    id: "prod-apples",
    name: "Apples, Gala",
    short_name: "Gala apples",
    list_unit: "3 lb bag",
    category: "Produce",
    size_label: "3 lb bag",
    unit_amount: 3,
    unit: "lb",
    image_url: null,
    dietary: ["Vegan", "Gluten free"],
    dietary_conflicts: [],
    dietary_verified: true,
    also_try: [],
    keywords: ["apple", "apples", "gala"]
  },
  {
    id: "prod-avocado",
    name: "Avocados, Hass",
    short_name: "Avocados",
    list_unit: "each",
    category: "Produce",
    size_label: "each",
    unit_amount: 1,
    unit: "each",
    image_url: null,
    dietary: ["Vegan", "Gluten free"],
    dietary_conflicts: [],
    dietary_verified: true,
    also_try: [],
    keywords: ["avocado", "avocados", "hass"]
  },
  {
    id: "prod-tomatoes",
    name: "Tomatoes, Roma",
    short_name: "Roma tomatoes",
    list_unit: "lb",
    category: "Produce",
    size_label: "per lb",
    unit_amount: 1,
    unit: "lb",
    image_url: null,
    dietary: ["Vegan", "Gluten free"],
    dietary_conflicts: [],
    dietary_verified: true,
    also_try: [],
    keywords: ["tomato", "tomatoes", "roma"]
  },
  {
    id: "prod-carrots",
    name: "Carrots",
    short_name: "Carrots",
    list_unit: "2 lb bag",
    category: "Produce",
    size_label: "2 lb bag",
    unit_amount: 2,
    unit: "lb",
    image_url: null,
    dietary: ["Vegan", "Gluten free"],
    dietary_conflicts: [],
    dietary_verified: true,
    also_try: [],
    keywords: ["carrot", "carrots"]
  },
  {
    id: "prod-yogurt",
    name: "Greek yogurt, plain",
    short_name: "Greek yogurt",
    list_unit: "32 oz",
    category: "Dairy",
    size_label: "32 oz",
    unit_amount: 32,
    unit: "oz",
    image_url: null,
    dietary: ["Vegetarian", "Gluten free"],
    dietary_conflicts: ["Vegan", "Dairy free"],
    dietary_verified: true,
    also_try: [],
    keywords: ["yogurt", "greek", "yoghurt"]
  },
  {
    id: "prod-butter",
    name: "Butter, unsalted",
    short_name: "Butter",
    list_unit: "16 oz",
    category: "Dairy",
    size_label: "16 oz (4 sticks)",
    unit_amount: 16,
    unit: "oz",
    image_url: null,
    dietary: ["Vegetarian", "Gluten free"],
    dietary_conflicts: ["Vegan", "Dairy free"],
    dietary_verified: true,
    also_try: [],
    keywords: ["butter"]
  },
  {
    id: "prod-cheddar",
    name: "Cheddar cheese",
    short_name: "Cheddar",
    list_unit: "8 oz",
    category: "Dairy",
    size_label: "8 oz block",
    unit_amount: 8,
    unit: "oz",
    image_url: null,
    dietary: ["Vegetarian", "Gluten free"],
    dietary_conflicts: ["Vegan", "Dairy free"],
    dietary_verified: true,
    also_try: [],
    keywords: ["cheddar", "cheese"]
  },
  {
    id: "prod-chicken",
    name: "Chicken breast, boneless",
    short_name: "Chicken breast",
    list_unit: "lb",
    category: "Meat & seafood",
    size_label: "per lb",
    unit_amount: 1,
    unit: "lb",
    image_url: null,
    dietary: ["Gluten free", "Dairy free"],
    dietary_conflicts: ["Vegan", "Vegetarian"],
    dietary_verified: true,
    also_try: [],
    keywords: ["chicken", "breast", "poultry"]
  },
  {
    id: "prod-ground-beef",
    name: "Ground beef, 80/20",
    short_name: "Ground beef",
    list_unit: "lb",
    category: "Meat & seafood",
    size_label: "per lb",
    unit_amount: 1,
    unit: "lb",
    image_url: null,
    dietary: ["Gluten free", "Dairy free"],
    dietary_conflicts: ["Vegan", "Vegetarian"],
    dietary_verified: true,
    also_try: ["prod-chicken"],
    keywords: ["beef", "ground", "hamburger"]
  },
  {
    id: "prod-rice",
    name: "Rice, long grain white",
    short_name: "White rice",
    list_unit: "5 lb",
    category: "Pantry",
    size_label: "5 lb bag",
    unit_amount: 5,
    unit: "lb",
    image_url: null,
    dietary: ["Vegan", "Gluten free"],
    dietary_conflicts: [],
    dietary_verified: true,
    also_try: [],
    keywords: ["rice", "white rice"]
  },
  {
    id: "prod-pasta",
    name: "Spaghetti",
    short_name: "Spaghetti",
    list_unit: "16 oz",
    category: "Pantry",
    size_label: "16 oz",
    unit_amount: 16,
    unit: "oz",
    image_url: null,
    dietary: ["Vegan"],
    dietary_conflicts: ["Gluten free"],
    dietary_verified: true,
    also_try: [],
    keywords: ["pasta", "spaghetti", "noodles"]
  },
  {
    id: "prod-olive-oil",
    name: "Olive oil, extra virgin",
    short_name: "Olive oil",
    list_unit: "16.9 oz",
    category: "Pantry",
    size_label: "16.9 oz (500 mL)",
    unit_amount: 16.9,
    unit: "oz",
    image_url: null,
    dietary: ["Vegan", "Gluten free"],
    dietary_conflicts: [],
    dietary_verified: true,
    also_try: [],
    keywords: ["olive", "oil", "evoo"]
  },
  {
    id: "prod-cereal",
    name: "Toasted oat cereal",
    short_name: "Oat cereal",
    list_unit: "18 oz",
    category: "Pantry",
    size_label: "18 oz",
    unit_amount: 18,
    unit: "oz",
    image_url: null,
    dietary: ["Vegetarian", "Dairy free"],
    dietary_conflicts: ["Vegan"],
    dietary_verified: false,
    also_try: [],
    keywords: ["cereal", "oats", "breakfast"]
  },
  {
    id: "prod-coffee",
    name: "Ground coffee, medium roast",
    short_name: "Ground coffee",
    list_unit: "12 oz",
    category: "Beverages",
    size_label: "12 oz",
    unit_amount: 12,
    unit: "oz",
    image_url: null,
    dietary: ["Vegan", "Gluten free"],
    dietary_conflicts: [],
    dietary_verified: true,
    also_try: [],
    keywords: ["coffee", "ground", "medium roast"]
  },
  {
    id: "prod-orange-juice",
    name: "Orange juice, no pulp",
    short_name: "Orange juice",
    list_unit: "52 oz",
    category: "Beverages",
    size_label: "52 oz",
    unit_amount: 52,
    unit: "oz",
    image_url: null,
    dietary: ["Vegan", "Gluten free"],
    dietary_conflicts: [],
    dietary_verified: true,
    also_try: [],
    keywords: ["orange", "juice", "oj"]
  },
  {
    id: "prod-bagels",
    name: "Bagels, plain",
    short_name: "Plain bagels",
    list_unit: "6 ct",
    category: "Bakery",
    size_label: "6 count",
    unit_amount: 6,
    unit: "each",
    image_url: null,
    dietary: ["Vegan"],
    dietary_conflicts: ["Gluten free"],
    dietary_verified: false,
    also_try: ["prod-bread"],
    keywords: ["bagel", "bagels"]
  }
];

function row(storeId, productId, price, extra = {}) {
  return {
    id: `price-${storeId}-${productId}`,
    store_id: storeId,
    product_id: productId,
    price,
    regular_price:
      extra.regular_price == null ? price : extra.regular_price,
    unit_price: extra.unit_price ?? null,
    unit: extra.unit ?? null,
    is_member_price: Boolean(extra.member),
    is_sale: Boolean(extra.sale),
    in_stock: extra.in_stock !== false,
    updated_at: UPDATED[storeId],
    source: "demo"
  };
}

// Banana prices match the prototype, cheapest first:
// Trader Joe's $0.19, Grocery Outlet $0.22, FoodMaxx $0.24
// (9 days old), Safeway $0.25 member sale, Vons $0.29.
// List prices are chosen so Weekly groceries totals
// $17.62 split across Trader Joe's and Grocery Outlet,
// or $21.47 for every item at Trader Joe's.
export const prices = [
  row("store-tj", "prod-bananas", 0.19, {
    unit_price: 0.58,
    unit: "lb"
  }),
  row("store-go", "prod-bananas", 0.22, {
    unit_price: 0.67,
    unit: "lb"
  }),
  row("store-fm", "prod-bananas", 0.24, {
    unit_price: 0.73,
    unit: "lb"
  }),
  row("store-sw", "prod-bananas", 0.25, {
    regular_price: 0.39,
    member: true,
    sale: true
  }),
  row("store-v", "prod-bananas", 0.29, {
    unit_price: 0.88,
    unit: "lb"
  }),

  row("store-go", "prod-milk", 3.99, {
    unit_price: 3.99,
    unit: "gal"
  }),
  row("store-v", "prod-milk", 5.29, {
    unit_price: 5.29,
    unit: "gal"
  }),
  row("store-sw", "prod-milk", 5.49, {
    unit_price: 5.49,
    unit: "gal"
  }),
  row("store-tj", "prod-milk", 6.49, {
    unit_price: 6.49,
    unit: "gal"
  }),
  row("store-fm", "prod-milk", 3.79, {
    unit_price: 3.79,
    unit: "gal"
  }),

  row("store-tj", "prod-eggs", 3.49),
  row("store-v", "prod-eggs", 4.79),
  row("store-sw", "prod-eggs", 4.99),
  row("store-fm", "prod-eggs", 3.29),

  row("store-go", "prod-bread", 3.25),
  row("store-v", "prod-bread", 4.49),
  row("store-tj", "prod-bread", 4.6),
  row("store-sw", "prod-bread", 4.79),
  row("store-fm", "prod-bread", 3.19),

  row("store-tj", "prod-pb", 2.99),
  row("store-sw", "prod-pb", 4.29),
  row("store-v", "prod-pb", 4.49),
  row("store-fm", "prod-pb", 2.79),

  row("store-tj", "prod-spinach", 2.76),
  row("store-v", "prod-spinach", 3.49),
  row("store-sw", "prod-spinach", 3.99),
  row("store-fm", "prod-spinach", 2.49),

  row("store-go", "prod-oat-milk", 3.29),
  row("store-tj", "prod-oat-milk", 3.49),
  row("store-sw", "prod-oat-milk", 4.29),
  row("store-v", "prod-oat-milk", 4.59),

  row("store-tj", "prod-organic-bananas", 0.29, { unit: "lb" }),
  row("store-go", "prod-organic-bananas", 0.31, { unit: "lb" }),
  row("store-sw", "prod-organic-bananas", 0.34, { unit: "lb" }),
  row("store-v", "prod-organic-bananas", 0.39, { unit: "lb" }),
  row("store-fm", "prod-organic-bananas", 0.27, { unit: "lb" }),

  row("store-go", "prod-banana-bread", 4.49),
  row("store-tj", "prod-banana-bread", 4.99),
  row("store-v", "prod-banana-bread", 5.29),
  row("store-sw", "prod-banana-bread", 5.49),

  row("store-fm", "prod-apples", 2.97, {
    unit_price: 0.99,
    unit: "lb"
  }),
  row("store-go", "prod-apples", 3.29),
  row("store-sw", "prod-apples", 3.99, {
    regular_price: 4.99,
    member: true,
    sale: true
  }),
  row("store-tj", "prod-apples", 3.49),
  row("store-v", "prod-apples", 4.49),

  row("store-tj", "prod-avocado", 0.79),
  row("store-fm", "prod-avocado", 0.89),
  row("store-go", "prod-avocado", 0.99),
  row("store-sw", "prod-avocado", 1.25),
  row("store-v", "prod-avocado", 1.49),

  row("store-fm", "prod-tomatoes", 1.49, { unit: "lb" }),
  row("store-go", "prod-tomatoes", 1.69, { unit: "lb" }),
  row("store-tj", "prod-tomatoes", 1.99, { unit: "lb" }),
  row("store-v", "prod-tomatoes", 1.99, { unit: "lb" }),
  row("store-sw", "prod-tomatoes", 2.49, { unit: "lb" }),

  row("store-tj", "prod-carrots", 1.49),
  row("store-fm", "prod-carrots", 1.69),
  row("store-go", "prod-carrots", 1.79),
  row("store-sw", "prod-carrots", 2.29),
  row("store-v", "prod-carrots", 2.49),

  row("store-go", "prod-yogurt", 3.99),
  row("store-fm", "prod-yogurt", 4.29),
  row("store-tj", "prod-yogurt", 4.49),
  row("store-sw", "prod-yogurt", 4.99, {
    regular_price: 5.99,
    member: true,
    sale: true
  }),
  row("store-v", "prod-yogurt", 5.79),

  row("store-go", "prod-butter", 3.29),
  row("store-fm", "prod-butter", 3.49),
  row("store-tj", "prod-butter", 3.69),
  row("store-v", "prod-butter", 4.79),
  row("store-sw", "prod-butter", 4.99),

  row("store-tj", "prod-cheddar", 2.49),
  row("store-fm", "prod-cheddar", 2.69),
  row("store-go", "prod-cheddar", 2.79),
  row("store-sw", "prod-cheddar", 2.99, {
    regular_price: 3.99,
    member: true,
    sale: true
  }),
  row("store-v", "prod-cheddar", 3.49),

  row("store-fm", "prod-chicken", 2.99, {
    unit_price: 2.99,
    unit: "lb"
  }),
  row("store-go", "prod-chicken", 3.49, {
    unit_price: 3.49,
    unit: "lb"
  }),
  row("store-sw", "prod-chicken", 3.99, {
    unit_price: 3.99,
    unit: "lb"
  }),
  row("store-v", "prod-chicken", 4.49, {
    unit_price: 4.49,
    unit: "lb"
  }),
  row("store-tj", "prod-chicken", 4.99, {
    unit_price: 4.99,
    unit: "lb"
  }),

  row("store-fm", "prod-ground-beef", 3.99, {
    unit_price: 3.99,
    unit: "lb"
  }),
  row("store-go", "prod-ground-beef", 4.29, {
    unit_price: 4.29,
    unit: "lb"
  }),
  row("store-sw", "prod-ground-beef", 4.99, {
    unit_price: 4.99,
    unit: "lb"
  }),
  row("store-v", "prod-ground-beef", 5.49, {
    unit_price: 5.49,
    unit: "lb"
  }),
  row("store-tj", "prod-ground-beef", 5.99, {
    unit_price: 5.99,
    unit: "lb"
  }),

  row("store-fm", "prod-rice", 4.49),
  row("store-go", "prod-rice", 4.99),
  row("store-tj", "prod-rice", 5.49),
  row("store-v", "prod-rice", 6.29),
  row("store-sw", "prod-rice", 6.49),

  row("store-fm", "prod-pasta", 0.99),
  row("store-go", "prod-pasta", 1.09),
  row("store-tj", "prod-pasta", 1.29),
  row("store-v", "prod-pasta", 1.69),
  row("store-sw", "prod-pasta", 1.79),

  row("store-tj", "prod-olive-oil", 5.99),
  row("store-go", "prod-olive-oil", 6.29),
  row("store-fm", "prod-olive-oil", 6.49),
  row("store-v", "prod-olive-oil", 8.49),
  row("store-sw", "prod-olive-oil", 8.99),

  row("store-go", "prod-cereal", 2.99),
  row("store-fm", "prod-cereal", 3.29),
  row("store-tj", "prod-cereal", 3.49),
  row("store-sw", "prod-cereal", 4.49, {
    regular_price: 4.99,
    member: true,
    sale: true
  }),
  row("store-v", "prod-cereal", 4.79, { in_stock: false }),

  row("store-go", "prod-coffee", 4.99),
  row("store-fm", "prod-coffee", 5.49),
  row("store-tj", "prod-coffee", 5.99),
  row("store-sw", "prod-coffee", 7.49),
  row("store-v", "prod-coffee", 7.99),

  row("store-fm", "prod-orange-juice", 2.99),
  row("store-go", "prod-orange-juice", 3.29),
  row("store-tj", "prod-orange-juice", 3.99),
  row("store-v", "prod-orange-juice", 4.29),
  row("store-sw", "prod-orange-juice", 4.49),

  row("store-tj", "prod-bagels", 1.99),
  row("store-go", "prod-bagels", 2.29),
  row("store-fm", "prod-bagels", 2.49),
  row("store-v", "prod-bagels", 3.29),
  row("store-sw", "prod-bagels", 3.49)
];

export const shopping_lists = [
  {
    id: "list-weekly",
    name: "Weekly groceries",
    owner_name: "Namish",
    shared_with: [
      { name: "Noah", initial: "N" },
      { name: "Andrew", initial: "A" }
    ]
  }
];

export const shopping_list_items = [
  {
    id: "item-bananas",
    list_id: "list-weekly",
    product_id: "prod-bananas",
    quantity: 6,
    checked: false
  },
  {
    id: "item-milk",
    list_id: "list-weekly",
    product_id: "prod-milk",
    quantity: 1,
    checked: false
  },
  {
    id: "item-eggs",
    list_id: "list-weekly",
    product_id: "prod-eggs",
    quantity: 1,
    checked: false
  },
  {
    id: "item-bread",
    list_id: "list-weekly",
    product_id: "prod-bread",
    quantity: 1,
    checked: false
  },
  {
    id: "item-pb",
    list_id: "list-weekly",
    product_id: "prod-pb",
    quantity: 1,
    checked: false
  },
  {
    id: "item-spinach",
    list_id: "list-weekly",
    product_id: "prod-spinach",
    quantity: 1,
    checked: false
  }
];

export const search_history = [
  { id: "search-1", term: "banana" },
  { id: "search-2", term: "peanut butter" },
  { id: "search-3", term: "oat milk" },
  { id: "search-4", term: "eggs" }
];

export const product_swaps = [
  {
    id: "swap-pb-tj",
    product_id: "prod-pb",
    store_id: "store-tj",
    name: "Store brand peanut butter",
    size_label: "16 oz",
    price: 2.19
  }
];

const BANANA_TJ = [
  0.23, 0.231, 0.233, 0.235, 0.236, 0.234, 0.231, 0.228, 0.226,
  0.224, 0.225, 0.223, 0.222, 0.224, 0.221, 0.219, 0.218, 0.216,
  0.215, 0.214, 0.213, 0.211, 0.21, 0.209, 0.208, 0.206, 0.204,
  0.2, 0.196, 0.19
];

function roundMoney(value) {
  return Math.round(value * 1000) / 1000;
}

function wave(from, to, count) {
  const series = [];
  for (let index = 0; index < count; index += 1) {
    const t = index / (count - 1);
    const hump =
      Math.sin(t * Math.PI * 2.15) * 0.008 * (1 - t * 0.4);
    series.push(roundMoney(from + (to - from) * t + hump));
  }
  series[0] = roundMoney(from);
  series[count - 1] = roundMoney(to);
  return series;
}

function historyDate(index, count) {
  const start = Date.parse("2026-09-01T00:00:00Z");
  const end = Date.parse("2026-10-05T00:00:00Z");
  const t = index / (count - 1);
  return new Date(start + (end - start) * t)
    .toISOString()
    .slice(0, 10);
}

function buildPriceHistory() {
  const rows = [];
  prices.forEach((priceRow) => {
    const crafted =
      priceRow.product_id === "prod-bananas" &&
      priceRow.store_id === "store-tj";
    const series = crafted
      ? BANANA_TJ
      : wave(
          roundMoney(priceRow.price + 0.04),
          priceRow.price,
          30
        );
    series.forEach((value, index) => {
      rows.push({
        id: `hist-${priceRow.id}-${index}`,
        product_id: priceRow.product_id,
        store_id: priceRow.store_id,
        recorded_on: historyDate(index, series.length),
        price: value
      });
    });
  });
  return rows;
}

export const price_history = buildPriceHistory();
