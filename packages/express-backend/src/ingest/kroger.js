// Thin client for the Kroger public API (https://developer.kroger.com).
//
// Two endpoints are used:
//   POST /connect/oauth2/token  -> client_credentials access token
//   GET  /locations             -> nearby stores for a zip
//   GET  /products              -> products WITH per-location price
//
// Price fields only appear on /products when a locationId is passed,
// which is why we fetch locations first and then query products per
// store. The token is cached until shortly before it expires.

export class KrogerClient {
  constructor(config, { fetchImpl = fetch } = {}) {
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.scope = config.scope;
    this.fetch = fetchImpl;
    this._token = null;
    this._tokenExpiresAt = 0;
  }

  async _accessToken() {
    const now = Date.now();
    if (this._token && now < this._tokenExpiresAt) {
      return this._token;
    }
    const basic = Buffer.from(
      `${this.clientId}:${this.clientSecret}`
    ).toString("base64");
    const body = new URLSearchParams({
      grant_type: "client_credentials",
      scope: this.scope
    });
    const res = await this.fetch(
      `${this.baseUrl}/connect/oauth2/token`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${basic}`,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body
      }
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `Kroger auth failed (${res.status}). ${text}`.trim()
      );
    }
    const json = await res.json();
    this._token = json.access_token;
    // Refresh 60s early to avoid races near expiry.
    this._tokenExpiresAt =
      now + Math.max(0, (json.expires_in || 1800) - 60) * 1000;
    return this._token;
  }

  async _get(path, params) {
    const token = await this._accessToken();
    const url = new URL(`${this.baseUrl}${path}`);
    for (const [key, value] of Object.entries(params || {})) {
      if (value != null) url.searchParams.set(key, String(value));
    }
    const res = await this.fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json"
      }
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `Kroger GET ${path} failed (${res.status}). ${text}`.trim()
      );
    }
    return res.json();
  }

  // Stores near a zip, closest first (Kroger returns them ranked).
  async locations({ zip, radiusMiles, limit }) {
    const json = await this._get("/locations", {
      "filter.zipCode.near": zip,
      "filter.radiusInMiles": radiusMiles,
      "filter.limit": limit
    });
    return json.data || [];
  }

  // Products matching a term at one store, with price attached.
  async products({ term, locationId, limit }) {
    const json = await this._get("/products", {
      "filter.term": term,
      "filter.locationId": locationId,
      "filter.limit": limit
    });
    return json.data || [];
  }
}
