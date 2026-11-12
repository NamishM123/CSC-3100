const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "of",
  "with",
  "and",
  "for",
  "please"
]);

// Keep aliases conservative: related foods are not always interchangeable.
// Add retailer-specific names to a product's existing keywords array.
const PHRASE_ALIASES = [
  [/\b(?:garbanzo bean|garbanzo)\b/g, "chickpea"],
  [/\b(?:green onion|spring onion|scallion)\b/g, "scallion"],
  [/\b(?:bell pepper|sweet pepper)\b/g, "bellpepper"],
  [/\b(?:fat free|non fat|skimmed|skim)\b/g, "nonfat"],
  [/\b(?:gluten free|glutenfree)\b/g, "glutenfree"],
  [/\b(?:lactose free|lactosefree)\b/g, "lactosefree"],
  [/\bwholewheat\b/g, "whole wheat"],
  [/\bpeanutbutter\b/g, "peanut butter"],
  [/\bpb\b/g, "peanut butter"],
  [/\b(oat|almond|soy)milk\b/g, "$1 milk"],
  [/\b(?:aubergine|eggplant)\b/g, "eggplant"],
  [/\b(?:courgette|zucchini)\b/g, "zucchini"],
  [/\b(?:yoghurt|yogurt)\b/g, "yogurt"],
  [/\b(?:ounce|oz)\b/g, "oz"],
  [/\b(?:pound|lb|lbs)\b/g, "lb"],
  [/\b(?:gallon|gal)\b/g, "gal"],
  [/\b(?:liter|litre)\b/g, "liter"]
];

function singular(word) {
  if (/(?:berr|cherr)ies$/.test(word)) {
    return `${word.slice(0, -3)}y`;
  }
  if (/(?:tomat|potat)oes$/.test(word)) {
    return word.slice(0, -2);
  }
  if (/(?:ch|sh|x)es$/.test(word)) return word.slice(0, -2);
  if (
    word.length > 3 &&
    word.endsWith("s") &&
    !/(?:ss|us|is)$/.test(word)
  ) {
    return word.slice(0, -1);
  }
  return word;
}

export function searchTerms(value) {
  let text = String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(
      /\b(zero|one|two|three|four)\s*(?=%|percent\b)/g,
      (word) =>
        ({ zero: 0, one: 1, two: 2, three: 3, four: 4 })[
          word.trim()
        ]
    )
    .replace(
      /(\d+(?:\.\d+)?)\s*(?:%|percent\b|pct\b)/g,
      " $1pct "
    )
    .replace(/(\d)([a-z])/g, "$1 $2")
    .replace(/(\d)\s+pct\b/g, "$1pct");
  // Preserve decimal quantities and percentages as exact terms.
  text = (text.match(/[a-z]+|\d+(?:\.\d+)?(?:pct)?/g) || [])
    .map(singular)
    .join(" ");
  for (const [pattern, replacement] of PHRASE_ALIASES) {
    text = text.replace(pattern, replacement);
  }
  return [
    ...new Set(
      text
        .split(" ")
        .filter((word) => word && !STOP_WORDS.has(word))
    )
  ];
}

const EXACT_TERMS = new Set([
  "organic",
  "nonfat",
  "glutenfree",
  "lactosefree",
  "whole",
  "white",
  "wheat",
  "unsweetened",
  "sweetened",
  "salted",
  "unsalted",
  "almond",
  "goat"
]);

// Never fuzzy-match quantities or words that distinguish common variants.
export function exactTerm(term) {
  return /\d/.test(term) || EXACT_TERMS.has(term);
}

// Bounded Damerau-Levenshtein: one missing, extra, replaced, or swapped letter.
export function oneTypoApart(a, b) {
  if (Math.abs(a.length - b.length) > 1) return false;
  if (a.length > b.length) return oneTypoApart(b, a);
  let index = 0;
  while (index < a.length && a[index] === b[index]) index += 1;
  if (a.length !== b.length) {
    return a.slice(index) === b.slice(index + 1);
  }
  return (
    a.slice(index + 1) === b.slice(index + 1) ||
    (a[index] === b[index + 1] &&
      a[index + 1] === b[index] &&
      a.slice(index + 2) === b.slice(index + 2))
  );
}
