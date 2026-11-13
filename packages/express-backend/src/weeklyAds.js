import { load } from "cheerio";
import { setTimeout as pause } from "node:timers/promises";
import { weeklyAdSources } from "../../react-frontend/src/lib/weeklyAdSources.js";
import {
  cleanText,
  parseCaliforniaFresh,
  parseCoopFreshDeals,
  saleWindows,
  windowStatus
} from "./weeklyAdParsers.js";
import { extractPdf } from "./weeklyAdPdf.js";

const fail = (status, message) =>
  Object.assign(new Error(message), { status });
const pacificDay = (time) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(time));
const sourceFor = (id) => {
  const source = weeklyAdSources.find((s) => s.id === id);
  if (!source)
    throw fail(400, "Choose a supported weekly-ad source.");
  return source;
};

// Discovered links and every redirect are checked; requests cannot select an
// arbitrary host, port, protocol, credentials, or path.
export function allowedAdUrl(value, provider, base) {
  const url = new URL(value, base);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    url.search
  )
    throw fail(
      502,
      "The publisher returned an unsupported flyer link."
    );
  const host = url.hostname;
  const path = decodeURIComponent(url.pathname);
  const allowed =
    provider === "california-fresh"
      ? host === "www.californiafresh.market" && path === "/"
      : provider === "spencers"
        ? (host === "spencersfreshmarkets.com" &&
            path === "/") ||
          (host === "img1.wsimg.com" &&
            /^\/blobby\/go\/[\w-]+\/Spencers[\w-]+\.pdf$/i.test(
              path
            ))
        : provider === "slo-food-coop" &&
          ((host === "www.slofood.coop" &&
            /^\/(?:specials(?:\/[\w-]+)?\/?|s\/[\w .()-]+\.pdf)$/.test(
              path
            )) ||
            ([
              "static1.squarespace.com",
              "static.squarespace.com"
            ].includes(host) &&
              /^\/static\/5d473e20fd11510001bbde2a\/[\w/+ .()-]+\.pdf$/i.test(
                path
              )));
  if (!allowed)
    throw fail(
      502,
      "The publisher returned an unsupported flyer link."
    );
  url.hash = "";
  return url.href;
}

export function discoverFlyers(provider, html, base) {
  const $ = load(html);
  const links = [];
  $("a[href]").each((_, element) => {
    const href = $(element).attr("href");
    if (!/\.pdf(?:$|[?#])/i.test(href)) return;
    try {
      links.push(allowedAdUrl(href, provider, base));
    } catch {
      /* Ignore links outside this publisher's flyer paths. */
    }
  });
  return [...new Set(links)].slice(
    0,
    provider === "spencers" ? 4 : 1
  );
}

export function createWeeklyAdClient({
  fetchImpl = fetch,
  now = Date.now,
  sleep = pause,
  pdfExtractor = extractPdf,
  userAgent = process.env.OPEN_DATA_USER_AGENT ||
    "PricePantry/1.0",
  ocr = false
} = {}) {
  const cache = new Map();
  const inFlight = new Map();
  const hostQueues = new Map();
  const lastRequest = new Map();

  async function request(
    value,
    provider,
    pdf = false,
    deadline = now() + 45000
  ) {
    let url = allowedAdUrl(value, provider);
    const requestDeadline = Math.min(deadline, now() + 10000);
    for (let redirects = 0; redirects <= 3; redirects++) {
      const host = new URL(url).hostname;
      const previous =
        hostQueues.get(host) || Promise.resolve();
      const task = previous
        .catch(() => {})
        .then(async () => {
          const spacing =
            host === "www.californiafresh.market" ? 10000 : 750;
          const delay =
            (lastRequest.get(host) || 0) + spacing - now();
          if (now() + Math.max(delay, 0) >= requestDeadline)
            throw fail(
              502,
              "The collection time limit was reached. Use the original flyer."
            );
          if (delay > 0) await sleep(delay);
          lastRequest.set(host, now());
          const signal = AbortSignal.timeout(
            Math.max(1, Math.min(8000, requestDeadline - now()))
          );
          const response = await fetchImpl(url, {
            headers: {
              "User-Agent": userAgent,
              Accept: pdf ? "application/pdf" : "text/html"
            },
            redirect: "manual",
            signal
          });
          if (
            [301, 302, 303, 307, 308].includes(response.status)
          ) {
            const location = response.headers.get("Location");
            await response.body?.cancel();
            if (!location)
              throw fail(
                502,
                "The flyer redirect is incomplete."
              );
            return {
              redirect: allowedAdUrl(location, provider, url)
            };
          }
          if (!response.ok) {
            await response.body?.cancel();
            throw fail(
              response.status === 429 ? 429 : 502,
              response.status === 429
                ? "The publisher is busy. Try again later."
                : "The publisher could not provide its weekly ad. Try again later."
            );
          }
          const type =
            response.headers.get("Content-Type") || "";
          if (
            !(pdf ? /application\/pdf/i : /text\/html/i).test(
              type
            )
          ) {
            await response.body?.cancel();
            throw fail(
              502,
              "The publisher returned an unexpected document type."
            );
          }
          const maxBytes = pdf ? 10000000 : 2000000;
          if (
            Number(response.headers.get("Content-Length")) >
            maxBytes
          ) {
            await response.body?.cancel();
            throw fail(
              502,
              "The flyer is too large to collect."
            );
          }
          const reader = response.body.getReader();
          const chunks = [];
          let length = 0;
          try {
            while (true) {
              const { value: chunk, done } =
                await reader.read();
              if (done) break;
              length += chunk.byteLength;
              if (length > maxBytes)
                throw fail(
                  502,
                  "The flyer is too large to collect."
                );
              chunks.push(Buffer.from(chunk));
            }
          } finally {
            await reader.cancel();
          }
          const bytes = Buffer.concat(chunks);
          if (
            pdf &&
            !bytes
              .subarray(0, 1024)
              .includes(Buffer.from("%PDF-"))
          )
            throw fail(
              502,
              "The publisher returned an invalid PDF."
            );
          return { bytes };
        });
      hostQueues.set(host, task);
      const result = await task;
      if (result.redirect) url = result.redirect;
      else
        return pdf
          ? result.bytes
          : result.bytes.toString("utf8");
    }
    throw fail(502, "The flyer redirected too many times.");
  }

  async function scrape(provider) {
    const source = sourceFor(provider);
    const deadline = now() + (ocr ? 15 * 60000 : 45000);
    let today = pacificDay(now());
    const html = await request(
      source.source_url,
      provider,
      false,
      deadline
    );
    const documents = [];
    const warnings = [];
    let candidates = [];
    let window = null;
    let incomplete = false;
    if (provider === "california-fresh") {
      const parsed = parseCaliforniaFresh(
        html,
        source.source_url
      );
      candidates = parsed.offers;
      window = parsed.window;
      if (parsed.skipped)
        warnings.push(
          `${parsed.skipped} price headings were omitted because the product or sale dates were unclear.`
        );
      if (!candidates.length)
        warnings.push(
          "No dated product prices could be extracted. View the publisher's ad."
        );
      incomplete = !candidates.length;
    } else {
      let pageHtml = html;
      let base = source.source_url;
      if (provider === "slo-food-coop") {
        const $ = load(html);
        const href = $("a[href^='/specials/']")
          .first()
          .attr("href");
        if (!href)
          throw fail(
            502,
            "The Co-op's latest flyer could not be found."
          );
        base = allowedAdUrl(href, provider, base);
        pageHtml = await request(
          base,
          provider,
          false,
          deadline
        );
      } else {
        const $ = load(html);
        $("script,style").remove();
        const windows = saleWindows(
          $("h1,h2,h3,h4,h5,h6")
            .map((_, element) => cleanText($(element).text()))
            .get()
            .join(" ")
        );
        window = windows.length === 1 ? windows[0] : null;
      }
      const flyers = discoverFlyers(provider, pageHtml, base);
      if (!flyers.length)
        throw fail(
          502,
          "The publisher's flyer links could not be found."
        );
      // Sequential extraction bounds memory and CPU; a failed page preserves
      // successful documents while surfacing the partial result.
      for (const [index, url] of flyers.entries()) {
        const document = {
          id: `${provider}-${index + 1}`,
          title: `Flyer ${index + 1}`,
          source_url: url,
          ...(window || {})
        };
        try {
          const bytes = await request(
            url,
            provider,
            true,
            deadline
          );
          const remaining = deadline - now();
          if (remaining < 100)
            throw fail(
              502,
              "The collection time limit was reached."
            );
          const parsed = await pdfExtractor(bytes, {
            ocr,
            timeoutMs: Math.min(ocr ? 180000 : 12000, remaining)
          });
          const extracted =
            provider === "slo-food-coop"
              ? parseCoopFreshDeals(parsed.pages, url)
              : { offers: [], window };
          if (extracted.window) {
            Object.assign(document, extracted.window);
            window = extracted.window;
          }
          candidates.push(...extracted.offers);
          document.page_count = parsed.page_count;
          document.extraction = parsed.pages.some(
            (p) => p.extraction === "ocr_review"
          )
            ? "ocr_review"
            : parsed.pages.every(
                  (p) => p.extraction === "image_only"
                )
              ? "image_only"
              : "pdf_text";
          document.status = windowStatus(
            document.starts_on ? document : null,
            today
          );
          document.pages = parsed.pages.map(
            ({
              page,
              text,
              review_text,
              extraction,
              ocr_confidence
            }) => ({
              page,
              text,
              review_text,
              extraction,
              ocr_confidence
            })
          );
          if (parsed.truncated)
            warnings.push(
              `Flyer ${index + 1}: only the first ${parsed.pages.length} pages were read.`
            );
          if (
            provider === "spencers" ||
            !extracted.offers.length
          )
            warnings.push(
              `Flyer ${index + 1}: view the original flyer for product prices; automatic product-to-price matching is unavailable.`
            );
        } catch (error) {
          incomplete = true;
          document.extraction = "unavailable";
          document.status = windowStatus(window, today);
          warnings.push(
            `Flyer ${index + 1} could not be extracted. The original link is available.`
          );
          // Publisher throttling is handled by the outer cooldown, not retried.
          if (error.status === 429) throw error;
        }
        documents.push(document);
      }
    }
    today = pacificDay(now());
    for (const document of documents)
      document.status = windowStatus(
        document.starts_on ? document : null,
        today
      );
    const offers = candidates.filter(
      (offer) => windowStatus(offer, today) === "current"
    );
    const inactiveCount = candidates.length - offers.length;
    if (inactiveCount)
      warnings.push(
        `${inactiveCount} expired or upcoming offers are excluded.`
      );
    return {
      source,
      fetched_at: new Date(now()).toISOString(),
      today,
      timezone: "America/Los_Angeles",
      status: windowStatus(window, today),
      ...(window || {}),
      offers,
      documents,
      warnings,
      incomplete,
      scope_notice:
        "Publisher-advertised deals. Confirm the participating branch, package size, and purchase conditions. Stock is unconfirmed."
    };
  }

  async function collect(provider) {
    sourceFor(provider);
    const entry = cache.get(provider);
    if (
      entry?.until > now() &&
      (entry.error || entry.value.today === pacificDay(now()))
    ) {
      if (entry.error) throw entry.error;
      return entry.value;
    }
    if (inFlight.has(provider)) return inFlight.get(provider);
    const task = scrape(provider)
      .then((value) => {
        cache.set(provider, {
          value,
          until: now() + (value.incomplete ? 300000 : 3600000)
        });
        return value;
      })
      .catch((error) => {
        const safe = error.status
          ? error
          : fail(
              502,
              "Weekly ads could not load. Try again later."
            );
        cache.set(provider, {
          error: safe,
          until: now() + 300000
        });
        throw safe;
      })
      .finally(() => inFlight.delete(provider));
    inFlight.set(provider, task);
    return task;
  }
  return { collect };
}

export const weeklyAdClient = createWeeklyAdClient();
