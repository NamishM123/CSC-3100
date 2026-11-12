import {
  exactTerm,
  oneTypoApart,
  searchTerms
} from "./searchTerms.js";

// Retrieval must tolerate the same common spelling mistakes as local matching.
// Only correct unambiguous words; percentages and explicit variants stay exact.
const VOCABULARY = searchTerms(
  "milk banana egg spinach peanut butter bread wheat oat almond organic " +
    "cheese cream yogurt apple orange tomato potato chicken beef rice pasta " +
    "coffee tea sugar flour broccoli carrot strawberry chickpea scallion"
);

export function krogerSearchQueries(query) {
  const terms = searchTerms(query).map((term) => {
    if (exactTerm(term) || VOCABULARY.includes(term))
      return term;
    const corrections = VOCABULARY.filter((word) =>
      oneTypoApart(term, word)
    );
    return corrections.length === 1 ? corrections[0] : term;
  });
  const canonical = terms
    .map((term) => term.replace(/pct$/, "%"))
    .join(" ");
  const aliases = [
    ["chickpea", "garbanzo beans"],
    ["scallion", "green onions"],
    ["nonfat", "fat free"],
    ["glutenfree", "gluten free"],
    ["lactosefree", "lactose free"]
  ];
  const alternate = aliases.reduce(
    (value, [from, to]) =>
      value.replace(new RegExp(`\\b${from}\\b`, "g"), to),
    canonical
  );
  return [...new Set([canonical, alternate])].filter(Boolean);
}
