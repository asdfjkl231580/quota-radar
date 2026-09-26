// 「求重置」计数（2026-09-26）：每家一个计数，挂在「最近一次送额度」上；新的送额度到账后自动换新一轮从 0 开始
// 最近一次送额度在 24 小时内 → 按钮变「谢谢重置」，计数另记
// 数字是点击次数，不是人数（页面上写「次」）
// GET  /api/beg            → { codex:{mode,count,since}, claude:{...} }
// POST /api/beg {p,n}      → 给 p（codex|claude）加 n 次（n≤10，前端把连点攒成一批）
import { kv } from "./_kv.js";

let cache = { at: 0, cycles: null };
async function cycles(host) {
  if (cache.cycles && Date.now() - cache.at < 60000) return cache.cycles;
  const j = await (await fetch(`https://${host}/api/events.json`)).json();
  const at = (e) => e.effectiveAt || e.announcedAt;
  const out = {};
  for (const p of ["codex", "claude"]) {
    const last = (j.events || j).filter((e) => e.provider === p && e.kind !== "teaser").sort((a, b) => at(b).localeCompare(at(a)))[0];
    const thanks = last && Date.now() - new Date(at(last)) < 86400000;
    out[p] = { id: last?.id || "none", since: last ? at(last) : null, mode: thanks ? "thanks" : "beg" };
  }
  cache = { at: Date.now(), cycles: out };
  return out;
}
const key = (p, c) => `${c.mode}:${p}:${c.id}`;

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    const cy = await cycles(req.headers.host || "airesetclock.com");
    if (req.method === "POST") {
      let body = req.body; if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
      const p = body?.p === "claude" ? "claude" : "codex";
      const n = Math.max(1, Math.min(10, parseInt(body?.n, 10) || 1));
      const ip = (req.headers["x-forwarded-for"] || "").split(",")[0] || "?";
      const [used] = await kv(["INCRBY", `rl:${ip}`, n], ["EXPIRE", `rl:${ip}`, 60]);
      if (used > 120) return res.status(429).json({ ok: false, error: "too_many" });   // 同一 IP 每分钟最多 120 次
      await kv(["INCRBY", key(p, cy[p]), n]);
    }
    const [a, b] = await kv(["GET", key("codex", cy.codex)], ["GET", key("claude", cy.claude)]);
    return res.status(200).json({ ok: true, codex: { ...cy.codex, count: +a || 0 }, claude: { ...cy.claude, count: +b || 0 } });
  } catch (e) {
    return res.status(503).json({ ok: false, error: String(e.message).slice(0, 80) });
  }
}
