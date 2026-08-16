// Polite HTTP for supplier APIs: identifiable User-Agent, a per-host gap
// between requests, and retries only where a retry can help (network, 5xx,
// 429). A 4xx other than 429 is a bug in the caller — fail loudly.
import { RATE_LIMIT_MS, USER_AGENT } from "./config";

const lastRequestAt = new Map<string, number>();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function politeGap(host: string) {
  const last = lastRequestAt.get(host);
  if (last !== undefined) {
    const wait = last + RATE_LIMIT_MS - Date.now();
    if (wait > 0) await sleep(wait);
  }
  lastRequestAt.set(host, Date.now());
}

export async function politeFetch(
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  const host = new URL(url).host;
  const headers = { "User-Agent": USER_AGENT, ...init.headers };

  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    await politeGap(host);
    try {
      const res = await fetch(url, { ...init, headers });
      if (res.ok) return res;
      if (res.status === 429 || res.status >= 500) {
        lastError = new Error(`HTTP ${res.status} on ${url}`);
        await sleep(1500 * attempt);
        continue;
      }
      throw new Error(`HTTP ${res.status} on ${url}`);
    } catch (e) {
      if (e instanceof Error && /^HTTP 4/.test(e.message)) throw e;
      lastError = e;
      await sleep(1500 * attempt);
    }
  }
  throw new Error(
    `Gave up after 3 attempts: ${url} — ${lastError instanceof Error ? lastError.message : String(lastError)}`,
  );
}

export async function fetchJson<T>(url: string): Promise<T> {
  const res = await politeFetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  });
  return (await res.json()) as T;
}

/** Response headers + parsed JSON, for endpoints that paginate via headers
 * (Woo Store API: x-wp-total / x-wp-totalpages). */
export async function fetchJsonWithHeaders<T>(
  url: string,
): Promise<{ data: T; headers: Headers }> {
  const res = await politeFetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  });
  return { data: (await res.json()) as T, headers: res.headers };
}

export async function fetchBytes(
  url: string,
): Promise<{ buffer: Buffer; contentType: string }> {
  const res = await politeFetch(url);
  const contentType = res.headers.get("content-type") ?? "image/jpeg";
  return { buffer: Buffer.from(await res.arrayBuffer()), contentType };
}
