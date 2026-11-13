import assert from "node:assert/strict";
import test from "node:test";
import {
  allowedAdUrl,
  createWeeklyAdClient,
  discoverFlyers
} from "./weeklyAds.js";
import {
  parseCaliforniaFresh,
  parseCoopFreshDeals,
  saleWindows,
  windowStatus
} from "./weeklyAdParsers.js";
import { createOpenDataHandler } from "./openData.js";
import { extractPdf } from "./weeklyAdPdf.js";

const now = Date.parse("2026-11-13T12:00:00Z");
const dates =
  "These special prices are good Wednesday, November 11, through Tuesday, November 17, 2026.";
const html = (heading = "Example Avocados 2 For $4") =>
  `<html><body><p>${dates}</p><div class="elementor-widget elementor-widget-heading"><h2>${heading}</h2></div><div class="elementor-widget elementor-widget-text-editor"><p>Selected varieties. 16 oz. Limit 2.</p></div></body></html>`;
const response = (
  body,
  type = "text/html",
  status = 200,
  extra = {}
) =>
  new Response(body, {
    status,
    headers: { "Content-Type": type, ...extra }
  });
const window = {
  starts_on: "2026-11-11",
  ends_on: "2026-11-17"
};
const pdfUrl =
  "https://img1.wsimg.com/blobby/go/123abc/Spencers111126_Low1.pdf";
const item = (text, x, y, w = 150, h = 20) => ({
  text,
  x,
  y,
  w,
  h
});
const coopPage = {
  page: 1,
  width: 612,
  height: 792,
  items: [
    item(
      "VALID SALES DATES: 11/11-11/16, 2026",
      20,
      760,
      160,
      9
    ),
    item("$2.99 lb", 25, 540, 130, 34),
    item("Organic Example", 25, 510),
    item("Apples", 25, 486),
    item("WA", 25, 462),
    item("$3.99 lb", 440, 540, 130, 34),
    item("Organic Other", 440, 510),
    item("Pears", 500, 486, 70),
    item("CA", 550, 462, 25)
  ]
};

test("published sale windows require valid explicit dates and preserve Pacific end dates", () => {
  assert.deepEqual(saleWindows(dates), [window]);
  assert.deepEqual(
    saleWindows("november 11, 2026 - november 17, 2026"),
    [window]
  );
  assert.deepEqual(saleWindows("11/11-11/16 2026"), [
    { starts_on: "2026-11-11", ends_on: "2026-11-16" }
  ]);
  assert.deepEqual(
    saleWindows("December 30 through January 5, 2027"),
    [{ starts_on: "2026-12-30", ends_on: "2027-01-05" }]
  );
  assert.deepEqual(
    saleWindows("February 30 through March 3, 2026"),
    []
  );
  assert.deepEqual(
    saleWindows("November 11 through November 17"),
    []
  );
  assert.equal(windowStatus(window, "2026-11-17"), "current");
  assert.equal(windowStatus(window, "2026-11-18"), "expired");
  assert.equal(windowStatus(window, "2026-11-10"), "upcoming");
});

test("HTML parser preserves bundles, deposits, sizes and conditions, deduplicates responsive content, and rejects nameless/ambiguous prices", () => {
  const input =
    html() +
    html() +
    html("Example Water $5.48+crv") +
    html("Example Roast $3.98/Lb.") +
    html("$9.99/Ea.");
  const parsed = parseCaliforniaFresh(
    input,
    "https://www.californiafresh.market/"
  );
  assert.equal(parsed.offers.length, 3);
  assert.equal(parsed.offers[0].price, 4);
  assert.equal(parsed.offers[0].price_quantity, 2);
  assert.match(parsed.offers[0].description, /16 oz.*Limit 2/);
  assert.equal(parsed.offers[0].availability, "unknown");
  assert.equal(parsed.offers[1].deposit_extra, true);
  assert.equal(parsed.offers[2].unit, "lb");
  assert.equal(parsed.skipped, 1);
  assert.equal(
    parseCaliforniaFresh(html().replace(dates, ""), "x").offers
      .length,
    0
  );
  assert.equal(
    parseCaliforniaFresh(
      html() + "<p>November 18 through November 24, 2026</p>",
      "x"
    ).offers.length,
    0
  );
});

test("Co-op parser separates columns, removes origins, and declines unrecognized or undated layouts", () => {
  const parsed = parseCoopFreshDeals(
    [coopPage],
    "https://www.slofood.coop/s/test.pdf"
  );
  assert.deepEqual(
    parsed.offers.map((o) => [o.name, o.price]),
    [
      ["Organic Example Apples", 2.99],
      ["Organic Other Pears", 3.99]
    ]
  );
  assert.equal(
    parsed.offers[0].source_url,
    "https://www.slofood.coop/s/test.pdf#page=1"
  );
  assert.equal(parsed.offers[0].ends_on, "2026-11-16");
  assert.equal(
    parseCoopFreshDeals(
      [{ ...coopPage, items: coopPage.items.slice(1) }],
      "x"
    ).offers.length,
    0
  );
  assert.equal(
    parseCoopFreshDeals(
      [
        {
          ...coopPage,
          items: [...coopPage.items, item("$2?", 400, 300)]
        }
      ],
      "x"
    ).offers.length,
    0
  );
  assert.equal(
    parseCoopFreshDeals(
      [
        {
          ...coopPage,
          items: coopPage.items.map((i) =>
            i.text === "Organic Example" ? { ...i, y: 300 } : i
          )
        }
      ],
      "x"
    ).offers.length,
    1
  );
});

test("discovered PDF links and redirects are restricted to known publisher paths", () => {
  for (const url of [
    "http://img1.wsimg.com/blobby/go/abc/Spencers1.pdf",
    "https://evil.example/ad.pdf",
    "https://www.slofood.coop.evil.example/s/test.pdf",
    "https://user@www.slofood.coop/s/test.pdf",
    "https://www.slofood.coop:8443/s/test.pdf",
    "https://www.slofood.coop/s/../../private.pdf",
    "https://www.slofood.coop/s/test.pdf?redirect=https://evil.example/"
  ])
    assert.throws(() => allowedAdUrl(url, "slo-food-coop"));
  assert.equal(
    allowedAdUrl(
      "/s/test.pdf",
      "slo-food-coop",
      "https://www.slofood.coop/specials"
    ),
    "https://www.slofood.coop/s/test.pdf"
  );
  assert.deepEqual(
    discoverFlyers(
      "spencers",
      `<a href="${pdfUrl}">a</a><a href="${pdfUrl}">b</a><a href="https://evil.example/Spencers1.pdf">c</a>`,
      "https://spencersfreshmarkets.com/"
    ),
    [pdfUrl]
  );
});

test("collector collapses concurrent calls, caches success, validates provider, and filters inactive offers", async () => {
  let calls = 0;
  let clock = now;
  const client = createWeeklyAdClient({
    now: () => clock,
    fetchImpl: async () => {
      calls++;
      return response(html());
    }
  });
  const [a, b] = await Promise.all([
    client.collect("california-fresh"),
    client.collect("california-fresh")
  ]);
  assert.deepEqual(a, b);
  assert.equal(calls, 1);
  assert.equal(a.offers.length, 1);
  assert.equal(a.today, "2026-11-13");
  await client.collect("california-fresh");
  assert.equal(calls, 1);
  await assert.rejects(
    client.collect("https://evil.example/"),
    { status: 400 }
  );
  clock = Date.parse("2026-11-18T08:00:00Z");
  const expired = await client.collect("california-fresh");
  assert.equal(expired.offers.length, 0);
  assert.equal(expired.status, "expired");
  const pacific = createWeeklyAdClient({
    now: () => Date.parse("2026-11-18T07:59:00Z"),
    fetchImpl: async () => response(html())
  });
  assert.equal(
    (await pacific.collect("california-fresh")).offers.length,
    1
  );
});

test("publisher failures cool down; unsafe redirects, MIME mismatches and oversized responses never parse", async () => {
  let calls = 0;
  const client = createWeeklyAdClient({
    now: () => now,
    fetchImpl: async () => {
      calls++;
      return response("busy", "text/html", 429);
    }
  });
  await assert.rejects(client.collect("california-fresh"), {
    status: 429
  });
  await assert.rejects(client.collect("california-fresh"), {
    status: 429
  });
  assert.equal(calls, 1);
  for (const upstream of [
    response("", "text/html", 302, {
      Location: "https://127.0.0.1/private"
    }),
    response("{}", "application/json"),
    response("big", "text/html", 200, {
      "Content-Length": "999999999"
    })
  ]) {
    const bounded = createWeeklyAdClient({
      fetchImpl: async () => upstream
    });
    await assert.rejects(bounded.collect("california-fresh"), {
      status: 502
    });
  }
});

test("an hourly cache cannot keep yesterday's offers after Pacific midnight", async () => {
  let clock = Date.parse("2026-11-18T07:59:00Z");
  let calls = 0;
  const client = createWeeklyAdClient({
    now: () => clock,
    fetchImpl: async () => {
      calls++;
      return response(html());
    }
  });
  assert.equal(
    (await client.collect("california-fresh")).offers.length,
    1
  );
  clock += 60000;
  const result = await client.collect("california-fresh");
  assert.equal(result.offers.length, 0);
  assert.equal(result.today, "2026-11-18");
  assert.equal(calls, 2);
});

test("a collection budget preserves the remaining flyer links without more downloads", async () => {
  let clock = now;
  let calls = 0;
  const client = createWeeklyAdClient({
    now: () => clock,
    sleep: async () => {},
    fetchImpl: async (url) => {
      calls++;
      return url.endsWith(".pdf")
        ? response("%PDF-1.4", "application/pdf")
        : response(
            `<h2>november 11, 2026 - november 17, 2026</h2><a href="${pdfUrl}">one</a><a href="${pdfUrl.replace("Low1", "Low2")}">two</a>`
          );
    },
    pdfExtractor: async () => {
      clock += 46000;
      return {
        pages: [
          {
            page: 1,
            extraction: "image_only",
            items: [],
            text: ""
          }
        ],
        page_count: 1
      };
    }
  });
  const result = await client.collect("spencers");
  assert.equal(result.documents.length, 2);
  assert.equal(result.documents[1].extraction, "unavailable");
  assert.equal(result.incomplete, true);
  assert.equal(calls, 2);
});

test("image-only flyers remain usable links without invented prices; a bad PDF leaves a visible partial result", async () => {
  let pdfCalls = 0;
  const client = createWeeklyAdClient({
    now: () => now,
    sleep: async () => {},
    fetchImpl: async (url) =>
      url.endsWith(".pdf")
        ? response("%PDF-1.4", "application/pdf")
        : response(
            `<h2>november 11, 2026 - november 17, 2026</h2><a href="${pdfUrl}">flyer</a><a href="${pdfUrl.replace("Low1", "Low2")}">flyer</a>`
          ),
    pdfExtractor: async () => {
      if (pdfCalls++) throw new Error("broken PDF");
      return {
        page_count: 1,
        pages: [
          {
            page: 1,
            items: [],
            text: "",
            extraction: "image_only"
          }
        ]
      };
    }
  });
  const result = await client.collect("spencers");
  assert.equal(result.offers.length, 0);
  assert.equal(result.documents.length, 2);
  assert.equal(result.documents[0].extraction, "image_only");
  assert.equal(result.documents[0].status, "current");
  assert.equal(result.documents[1].extraction, "unavailable");
  assert.equal(result.incomplete, true);
});

test("Co-op discovery reads only the newest post and keeps dated PDF offers", async () => {
  const requests = [];
  const client = createWeeklyAdClient({
    now: () => now,
    sleep: async () => {},
    fetchImpl: async (url) => {
      requests.push(url);
      return url.endsWith(".pdf")
        ? response("%PDF-1.4", "application/pdf")
        : response(
            url.endsWith("/specials")
              ? '<a href="/specials/newest">new</a><a href="/specials/old">old</a>'
              : '<a href="/s/current.pdf">current</a>'
          );
    },
    pdfExtractor: async () => ({
      pages: [
        { ...coopPage, extraction: "pdf_text", text: "" }
      ],
      page_count: 1
    })
  });
  const result = await client.collect("slo-food-coop");
  assert.equal(requests.length, 3);
  assert.equal(
    requests.some((url) => url.endsWith("/old")),
    false
  );
  assert.equal(result.offers.length, 2);
  assert.equal(result.offers[0].availability, "unknown");
});

test("existing authenticated open-data handler exposes weekly ads and rejects invalid providers", async () => {
  const handler = createOpenDataHandler(
    {},
    {
      collect: async (provider) => {
        if (provider !== "california-fresh")
          throw Object.assign(new Error("Unsupported source"), {
            status: 400
          });
        return { offers: [], documents: [] };
      }
    }
  );
  const res = {
    setHeader() {},
    status(code) {
      this.code = code;
      return this;
    },
    json(value) {
      this.value = value;
      return this;
    }
  };
  await handler(
    {
      method: "POST",
      body: {
        action: "weeklyAds",
        provider: "california-fresh"
      }
    },
    res
  );
  assert.deepEqual(res.value, { offers: [], documents: [] });
  await handler(
    {
      method: "POST",
      body: { action: "weeklyAds", provider: "bad" }
    },
    res
  );
  assert.equal(res.code, 400);
});

test("branch inventory resolves a trusted provider, shares the publisher cache, and rejects unknown store IDs", async () => {
  let calls = 0;
  const ads = createWeeklyAdClient({
    now: () => now,
    fetchImpl: async () => {
      calls++;
      return response(html());
    }
  });
  const handler = createOpenDataHandler({}, ads);
  const res = {
    setHeader() {},
    status(code) {
      this.code = code;
      return this;
    },
    json(value) {
      this.value = value;
      return this;
    }
  };
  await handler(
    {
      method: "POST",
      body: {
        action: "weeklyAds",
        storeId: "weekly-california-fresh-slo",
        provider: "spencers"
      }
    },
    res
  );
  assert.equal(res.value.store.city, "San Luis Obispo");
  assert.equal(res.value.source.id, "california-fresh");
  assert.equal(res.value.offers.length, 1);
  assert.equal(res.value.offers[0].availability, "unknown");
  await handler(
    {
      method: "POST",
      body: {
        action: "weeklyAds",
        storeId: "weekly-california-fresh-pismo"
      }
    },
    res
  );
  assert.equal(res.value.store.city, "Pismo Beach");
  assert.equal(calls, 1);
  await handler(
    {
      method: "POST",
      body: {
        action: "weeklyAds",
        storeId: "https://evil.example/"
      }
    },
    res
  );
  assert.equal(res.code, 400);
  assert.equal(calls, 1);
});

test("PDF worker rejects invalid PDFs instead of blocking indefinitely", async () => {
  await assert.rejects(extractPdf(Buffer.from("%PDF-invalid")));
});

test("PDF worker extracts positioned text from a real PDF without requiring external fixtures", async () => {
  const stream =
    "BT /F1 20 Tf 25 500 Td (Organic Example Apples) Tj ET";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets
    .slice(1)
    .map(
      (offset) =>
        `${String(offset).padStart(10, "0")} 00000 n \n`
    )
    .join(
      ""
    )}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  const parsed = await extractPdf(Buffer.from(pdf));
  assert.equal(parsed.page_count, 1);
  assert.equal(
    parsed.pages[0].items[0].text,
    "Organic Example Apples"
  );
  assert.equal(parsed.pages[0].items[0].x, 25);
  assert.equal(parsed.pages[0].items[0].y, 500);
});
