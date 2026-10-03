import { readHealth } from "./_health.js";
let cache = null;
let inFlight = null;

// Public, read-only status. Reuse the same check for one minute per warm instance.
export default async function handler(req, res) {
  res.setHeader("Allow", "GET");
  res.setHeader("Cache-Control", "public, max-age=30, s-maxage=60");
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "method" });
  if (!cache || Date.now() - cache.at >= 60000) {
    if (!inFlight) inFlight = readHealth().then((value) => { cache = { at: Date.now(), value }; return value; }).finally(() => { inFlight = null; });
    await inFlight;
  }
  const value = cache.value;
  return res.status(value.status === "error" ? 503 : 200).json({ ok: value.status === "ok", ...value });
}
