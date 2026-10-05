export function cents(value) {
  return Math.round(value * 100) / 100;
}

export function money(value) {
  if (value == null || Number.isNaN(Number(value))) {
    return "Price unavailable";
  }
  return Number(value).toLocaleString("en-US", {
    style: "currency",
    currency: "USD"
  });
}

export function miles(value) {
  return `${Number(value).toFixed(1)} mi`;
}

export function countNoun(count, noun) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

export function ageLabel(iso, nowIso) {
  const ms =
    new Date(nowIso).getTime() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return "update time unavailable";
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) {
    return `${Math.max(1, minutes)} min ago`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "1 day ago" : `${days} days ago`;
}

export function ageOld(iso, nowIso) {
  return ageLabel(iso, nowIso).replace(" ago", " old");
}

export function isStale(iso, nowIso) {
  const ms =
    new Date(nowIso).getTime() - new Date(iso).getTime();
  return ms >= 7 * 24 * 60 * 60 * 1000;
}

export function shortDate(isoDate) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(
    Date.UTC(year, month - 1, day)
  ).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC"
  });
}

export function joinNames(people) {
  const names = (people || []).map((person) => person.name);
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

export function itemSummary(product, quantity) {
  const name = product.short_name || product.name;
  if (quantity > 1) return `${name} x${quantity}`;
  return name;
}

export function unitCaption(priceRow, product) {
  if (priceRow.is_member_price) return "member price";
  if (priceRow.unit_price != null && priceRow.unit) {
    return `${money(priceRow.unit_price)} / ${priceRow.unit}`;
  }
  if (
    product?.unit_amount &&
    product?.unit &&
    priceRow.price != null
  ) {
    return `${money(priceRow.price / product.unit_amount)} / ${product.unit}`;
  }
  return "Unit price unavailable";
}

export function firstName(name) {
  const part = (name || "there").trim().split(/\s+/)[0];
  return part || "there";
}

export function safeDest(value) {
  if (typeof value !== "string" || !value.startsWith("/"))
    return null;
  if (value.startsWith("/sign-in")) return null;
  if (value.startsWith("/sign-up")) return null;
  if (value.startsWith("/location")) return null;
  return value;
}
