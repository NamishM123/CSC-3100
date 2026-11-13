// Illustrative catalog offers, assigned to specific sample stores.
const entries = [
  [
    "apples",
    "Apples, Gala",
    "Produce",
    "1 lb",
    1,
    "lb",
    ["apple", "gala"],
    [
      ["store-tj", 1.99],
      ["store-sw", 2.49],
      ["store-go", 1.79]
    ]
  ],
  [
    "avocados",
    "Avocados",
    "Produce",
    "each",
    null,
    null,
    ["avocado"],
    [
      ["store-tj", 1.29],
      ["store-v", 1.79],
      ["store-go", 0.99]
    ]
  ],
  [
    "strawberries",
    "Strawberries",
    "Produce",
    "16 oz",
    16,
    "oz",
    ["strawberry", "berries"],
    [
      ["store-sw", 3.99],
      ["store-v", 4.49],
      ["store-go", 2.99]
    ]
  ],
  [
    "broccoli",
    "Broccoli florets",
    "Produce",
    "12 oz",
    12,
    "oz",
    ["broccoli"],
    [
      ["store-tj", 2.49],
      ["store-sw", 2.99],
      ["store-fm", 1.99]
    ]
  ],
  [
    "carrots",
    "Carrots",
    "Produce",
    "1 lb",
    1,
    "lb",
    ["carrot"],
    [
      ["store-tj", 0.99],
      ["store-v", 1.49],
      ["store-go", 0.89]
    ]
  ],
  [
    "tomatoes",
    "Tomatoes, Roma",
    "Produce",
    "1 lb",
    1,
    "lb",
    ["tomato", "roma"],
    [
      ["store-sw", 1.99],
      ["store-v", 2.29],
      ["store-go", 1.49]
    ]
  ],
  [
    "potatoes",
    "Potatoes, russet",
    "Produce",
    "5 lb",
    5,
    "lb",
    ["potato", "russet"],
    [
      ["store-tj", 3.49],
      ["store-sw", 3.99],
      ["store-fm", 2.99]
    ]
  ],
  [
    "oranges",
    "Oranges, navel",
    "Produce",
    "1 lb",
    1,
    "lb",
    ["orange", "navel", "citrus"],
    [
      ["store-tj", 1.49],
      ["store-v", 1.99],
      ["store-go", 1.29]
    ]
  ],
  [
    "rice",
    "Rice, long grain white",
    "Pantry",
    "2 lb",
    2,
    "lb",
    ["rice", "white rice"],
    [
      ["store-tj", 2.99],
      ["store-sw", 3.49],
      ["store-fm", 2.49]
    ]
  ],
  [
    "pasta",
    "Pasta, spaghetti",
    "Pantry",
    "16 oz",
    16,
    "oz",
    ["pasta", "spaghetti", "noodles"],
    [
      ["store-tj", 1.29],
      ["store-v", 1.79],
      ["store-go", 0.99]
    ]
  ],
  [
    "cheddar",
    "Cheddar cheese",
    "Dairy",
    "8 oz",
    8,
    "oz",
    ["cheddar", "cheese"],
    [
      ["store-tj", 2.49],
      ["store-sw", 2.99],
      ["store-go", 1.99]
    ]
  ],
  [
    "yogurt",
    "Greek yogurt, plain",
    "Dairy",
    "32 oz",
    32,
    "oz",
    ["greek", "yogurt", "plain yogurt"],
    [
      ["store-tj", 4.49],
      ["store-v", 5.49],
      ["store-sw", 4.99]
    ]
  ]
];

export const builtInProducts = entries.map(
  ([slug, name, category, size, amount, unit, keywords]) => ({
    id: `prod-${slug}`,
    name,
    short_name: name,
    category,
    list_unit: size,
    size_label: size,
    unit_amount: amount,
    unit,
    image_url: `/images/products/${slug}.svg`,
    keywords,
    dietary: [],
    dietary_conflicts:
      category === "Dairy" ? ["Vegan", "Dairy free"] : [],
    dietary_verified: false,
    also_try: []
  })
);

export function builtInPrices(row) {
  return entries.flatMap(([slug, , , , , , , offers]) =>
    offers.map(([storeId, price]) =>
      row(storeId, `prod-${slug}`, price)
    )
  );
}
