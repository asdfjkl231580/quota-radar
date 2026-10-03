// Counts are clicks, not people. A batch ID is deduplicated for 24 hours.
import { clientKey, fetchJson, kv } from "./_kv.js";
const ORIGIN = "https://airesetclock.com";
let cache = { at: 0, events: null };
const key = (p, c) => `${c.mode}:${p}:${c.id}`;

export function eventCycles(events, now = Date.now()) {
  const out = {};
  for (const p of ["codex", "claude"]) {
    const last = events.filter((e) => e.provider === p && ["reset", "banked", "boost"].includes(e.kind) && !e.pendingReset)
      .map((e) => ({ e, at: Date.parse(e.effectiveAt || e.announcedAt) }))
      .filter(({ at }) => Number.isFinite(at) && at <= now)
      .sort((a, b) => b.at - a.at)[0];
    out[p] = { id: last?.e.id || "none", since: last ? new Date(last.at).toISOString() : null, mode: last && now - last.at < 86400000 ? "thanks" : "beg" };
  }
  return out;
}

async function cycles() {
  if (cache.events && Date.now() - cache.at < 60000) return eventCycles(cache.events);
  const data = await fetchJson(`${ORIGIN}/api/events.json?cycle=${Math.floor(Date.now() / 60000)}`, { cache: "no-store", headers: { "Cache-Control": "no-cache" } }, "events");
  const events = data?.events;
  if (!Array.isArray(events)) throw new Error("events_invalid");
  const out = eventCycles(events);
  cache = { at: Date.now(), events };
  return out;
}

export const BATCH_SCRIPT = `-- quota-radar:beg-v1
local amount = tonumber(ARGV[1])
local prior = redis.call('GET', KEYS[1])
local count = tonumber(redis.call('GET', KEYS[3]) or '0')
local used = tonumber(redis.call('GET', KEYS[2]) or '0')
if not count or count < 0 or count % 1 ~= 0 or count + amount > 9007199254740991 or not used or used < 0 or used % 1 ~= 0 then return redis.error_reply('invalid counter') end
if prior then
  if tonumber(prior) ~= amount then return {-2, count} end
  return {1, count}
end
if used + amount > 120 then return {-1, count} end
local nextUsed = redis.call('INCRBY', KEYS[2], amount)
if nextUsed == amount then redis.call('EXPIRE', KEYS[2], 120) end
local nextCount = redis.call('INCRBY', KEYS[3], amount)
redis.call('SET', KEYS[1], amount, 'EX', 86400)
return {0, nextCount}`;

function countValue(value) {
  if (value === null) return 0;
  const n = Number(value);
  if ((typeof value !== "number" && typeof value !== "string") || String(value).trim() === "" || !Number.isSafeInteger(n) || n < 0) throw new Error("counter_invalid");
  return n;
}

async function snapshot(cy) {
  const counts = await kv(["GET", key("codex", cy.codex)], ["GET", key("claude", cy.claude)]);
  return { codex: { ...cy.codex, count: countValue(counts[0]) }, claude: { ...cy.claude, count: countValue(counts[1]) } };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Allow", "GET, POST");
  if (!["GET", "POST"].includes(req.method)) return res.status(405).json({ ok: false, error: "method" });
  try {
    let body, p;
    if (req.method === "POST") {
      body = req.body;
      if (typeof body === "string") { try { body = JSON.parse(body); } catch { return res.status(400).json({ ok: false, error: "invalid_json" }); } }
      p = body?.provider ?? body?.p;
      if (!["codex", "claude"].includes(p) || !["beg", "thanks"].includes(body?.mode) || !Number.isInteger(body?.n) || body.n < 1 || body.n > 10 || typeof body?.id !== "string" || !body.id || body.id.length > 128 || typeof body?.batchId !== "string" || !/^[A-Za-z0-9_-]{16,80}$/.test(body?.batchId || "")) return res.status(400).json({ ok: false, error: "invalid_batch" });
    }
    const cy = await cycles();
    let duplicate = false;
    if (body) {
      if (body.id !== cy[p].id || body.mode !== cy[p].mode) return res.status(409).json({ ok: false, error: "stale_cycle", ...await snapshot(cy) });
      const bucket = Math.floor(Date.now() / 60000);
      const [result] = await kv(["EVAL", BATCH_SCRIPT, 3, `batch:${key(p, cy[p])}:${body.batchId}`, `rate:beg:${clientKey(req)}:${bucket}`, key(p, cy[p]), body.n]);
      if (!Array.isArray(result) || result.length !== 2 || ![-2, -1, 0, 1].includes(result[0])) throw new Error("batch_invalid_result");
      countValue(result[1]);
      if (result[0] === -1) { res.setHeader("Retry-After", "60"); return res.status(429).json({ ok: false, error: "too_many" }); }
      if (result[0] === -2) return res.status(409).json({ ok: false, error: "batch_conflict" });
      duplicate = result[0] === 1;
    }
    const state = await snapshot(cy);
    return res.status(200).json({ ok: true, ...state, ...(body ? { provider: p, ...state[p], duplicate } : {}) });
  } catch {
    return res.status(503).json({ ok: false, error: "counter_unavailable" });
  }
}
