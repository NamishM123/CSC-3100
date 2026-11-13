import { createHash } from "node:crypto";
import { load } from "cheerio";

export const cleanText = (value) =>
  String(value || "")
    .normalize("NFKC")
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/\s+/g, " ")
    .trim();

const months = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december"
];
const monthPattern = months.join("|");
const weekday =
  "(?:(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday),?\\s*)?";
const dateString = (year, month, day) => {
  const value = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
    ? value
    : null;
};

// Require a year published by the source. A fetch timestamp is not a sale date.
export function saleWindows(text) {
  const value = cleanText(text);
  const windows = [];
  const add = (year1, month1, day1, year2, month2, day2) => {
    const starts_on = dateString(year1, month1, day1);
    const ends_on = dateString(year2, month2, day2);
    if (!starts_on || !ends_on || ends_on < starts_on) return;
    if (
      (Date.parse(ends_on) - Date.parse(starts_on)) / 86400000 >
      35
    )
      return;
    if (
      !windows.some(
        (w) =>
          w.starts_on === starts_on && w.ends_on === ends_on
      )
    )
      windows.push({ starts_on, ends_on });
  };
  const named = new RegExp(
    `\\b(${monthPattern})\\s+(\\d{1,2}),?\\s*(20\\d{2})?\\s*,?\\s*(?:through|thru|to|-)\\s*${weekday}(${monthPattern})\\s+(\\d{1,2}),?\\s+(20\\d{2})\\b`,
    "gi"
  );
  for (const m of value.matchAll(named)) {
    const month1 = months.indexOf(m[1].toLowerCase()) + 1;
    const month2 = months.indexOf(m[4].toLowerCase()) + 1;
    const year2 = Number(m[6]);
    add(
      Number(m[3] || year2 - (month1 > month2 ? 1 : 0)),
      month1,
      Number(m[2]),
      year2,
      month2,
      Number(m[5])
    );
  }
  for (const m of value.matchAll(
    /\b(\d{1,2})\/(\d{1,2})\s*-\s*(\d{1,2})\/(\d{1,2}),?\s+(20\d{2})\b/g
  )) {
    const endYear = Number(m[5]);
    add(
      endYear - (Number(m[1]) > Number(m[3]) ? 1 : 0),
      Number(m[1]),
      Number(m[2]),
      endYear,
      Number(m[3]),
      Number(m[4])
    );
  }
  return windows;
}

export function windowStatus(window, today) {
  if (!window) return "undated";
  return today < window.starts_on
    ? "upcoming"
    : today > window.ends_on
      ? "expired"
      : "current";
}

export function makeOffer(provider, value) {
  const identity = JSON.stringify([
    provider,
    value.name,
    value.price,
    value.price_quantity,
    value.unit,
    value.package_size,
    value.starts_on,
    value.ends_on
  ]);
  return {
    id: `${provider}-${createHash("sha256").update(identity).digest("hex").slice(0, 20)}`,
    currency: "USD",
    availability: "unknown",
    kind: "advertised",
    ...value
  };
}

export function parseCaliforniaFresh(html, sourceUrl) {
  const $ = load(html);
  $("script,style,nav").remove();
  const windows = saleWindows($("body").text());
  const window = windows.length === 1 ? windows[0] : null;
  const found = new Map();
  let skipped = 0;
  $("h1,h2,h3,h4,h5,h6").each((_, element) => {
    const text = cleanText($(element).text());
    if (!text.includes("$")) return;
    const match =
      /^(.+?)\s+(?:(\d+)\s+for\s+)?\$\s*(\d+(?:\.\d{1,2})?)(?:\s*\/\s*(lb\.?|ea\.?))?(\s*\+\s*crv)?$/i.exec(
        text
      );
    if (!match || !window) {
      skipped++;
      return;
    }
    const price = Number(match[3]);
    const quantity = Number(match[2] || 1);
    if (
      price <= 0 ||
      price > 1000 ||
      quantity < 1 ||
      quantity > 100
    ) {
      skipped++;
      return;
    }
    const widget = $(element).closest(".elementor-widget");
    // Only adjacent descriptive widgets belong to this product. Do not read an
    // entire shared column, which may contain a different product or condition.
    const description = cleanText(
      widget
        .nextUntil(".elementor-widget-heading")
        .filter(".elementor-widget-text-editor")
        .text()
    ).slice(0, 1500);
    const packageSize =
      description
        .match(
          /\b\d+(?:\.\d+)?(?:\s*-\s*\d+(?:\.\d+)?)?\s*(?:fl\.?\s*oz\.?|oz\.?|lbs?\.?|gallons?|quarts?|pints?|counts?|ct\.?|packs?)\b/gi
        )
        ?.join(", ") || null;
    const unit = /^lb/i.test(match[4] || "")
      ? "lb"
      : /^ea/i.test(match[4] || "")
        ? "each"
        : "package";
    const offer = makeOffer("california-fresh", {
      name: match[1],
      price,
      price_quantity: quantity,
      unit,
      advertised_price:
        quantity > 1
          ? `${quantity} for $${price.toFixed(2)}`
          : `$${price.toFixed(2)}${unit === "lb" ? "/lb" : unit === "each" ? " each" : ""}`,
      description,
      package_size: packageSize,
      deposit_extra: Boolean(match[5]),
      ...window,
      source_url: sourceUrl,
      extraction: "html"
    });
    const previous = found.get(offer.id);
    if (
      !previous ||
      description.length > previous.description.length
    )
      found.set(offer.id, offer);
  });
  return { offers: [...found.values()], window, skipped };
}

// A deliberately narrow parser for the Co-op's two-column Fresh Deals layout.
// It accepts complete price tokens and labels immediately below them in the
// same column. Other PDF layouts are collected as flyers, never guessed prices.
export function parseCoopFreshDeals(pages, sourceUrl) {
  const windows = saleWindows(
    pages.flatMap((p) => p.items.map((i) => i.text)).join(" ")
  );
  const commonWindow = windows.length === 1 ? windows[0] : null;
  const offers = [];
  for (const page of pages) {
    if (
      Math.abs(page.width - 612) > 2 ||
      Math.abs(page.height - 792) > 2
    )
      continue;
    const pageWindows = saleWindows(
      page.items.map((i) => i.text).join(" ")
    );
    const window =
      pageWindows.length === 1 ? pageWindows[0] : commonWindow;
    if (!window) continue;
    const prices = page.items.filter((i) =>
      /^\$\d+\.\d{2}\s+(?:lb|ea)$/i.test(cleanText(i.text))
    );
    const otherPrices = page.items.filter(
      (i) => i.text.includes("$") && !prices.includes(i)
    );
    if (
      otherPrices.length ||
      prices.length > 6 ||
      prices.some((a, i) =>
        prices.some(
          (b, j) =>
            i !== j &&
            a.x + a.w / 2 < page.width / 2 ===
              b.x + b.w / 2 < page.width / 2 &&
            Math.abs(a.y - b.y) < 150
        )
      )
    )
      continue;
    for (const price of prices) {
      const left = price.x + price.w / 2 < page.width / 2;
      const inColumn = (item) =>
        item.x + item.w / 2 < page.width / 2 === left;
      const nextPrice = prices
        .filter((p) => inColumn(p) && p.y < price.y)
        .sort((a, b) => b.y - a.y)[0];
      const labels = page.items
        .filter(
          (i) =>
            inColumn(i) &&
            i.y < price.y - 4 &&
            i.y >
              Math.max(
                price.y - 125,
                (nextPrice?.y || -1000) + 8
              ) &&
            i.h >= 14 &&
            i.h <= 23 &&
            !/\$|sales dates/i.test(i.text)
        )
        .sort((a, b) => b.y - a.y || a.x - b.x);
      if (
        !labels.length ||
        price.y - labels[0].y > 45 ||
        !/^Organic\b/.test(labels[0].text)
      )
        continue;
      const nameParts = [];
      let priorY = labels[0].y;
      for (const label of labels) {
        if (
          priorY - label.y > 30 ||
          /^(?:[A-Z]{2}|.*[,\s](?:CA|WA|OR))$/.test(
            label.text
          ) ||
          (nameParts.length > 0 && /,\s*[A-Z]/.test(label.text))
        )
          break;
        nameParts.push(cleanText(label.text));
        priorY = label.y;
      }
      const name = cleanText(nameParts.join(" "));
      if (name.length < 8 || nameParts.length > 4) continue;
      const m = /^\$(\d+\.\d{2})\s+(lb|ea)$/i.exec(
        cleanText(price.text)
      );
      if (Number(m[1]) <= 0 || Number(m[1]) > 1000) continue;
      offers.push(
        makeOffer("slo-food-coop", {
          name,
          price: Number(m[1]),
          price_quantity: 1,
          unit: m[2].toLowerCase() === "lb" ? "lb" : "each",
          advertised_price: cleanText(price.text),
          description: "",
          ...window,
          source_url: `${sourceUrl}#page=${page.page}`,
          extraction: "pdf_text",
          page: page.page
        })
      );
    }
  }
  return {
    offers: [...new Map(offers.map((o) => [o.id, o])).values()],
    window: commonWindow
  };
}
