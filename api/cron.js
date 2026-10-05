// Authenticated scheduler: check collection/release/production, then dispatch the next run.
import { timingSafeEqual } from "node:crypto";
import { fetchJson, notifyOnce } from "./_kv.js";
import { githubHeaders, readHealth, REPO, COLLECTION_MAX_AGE_MINUTES } from "./_health.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Allow", "GET");
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "method" });
  const secret = process.env.CRON_SECRET;
  if (!secret) return res.status(503).json({ ok: false, error: "cron_not_configured" });
  const given = Buffer.from(String(req.headers.authorization || "")), expected = Buffer.from(`Bearer ${secret}`);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return res.status(401).json({ ok: false, error: "unauthorized" });
  if (!process.env.GH_DISPATCH_TOKEN) return res.status(503).json({ ok: false, error: "dispatch_not_configured" });

  const gh = githubHeaders();
  let health, lastOkMin = null;
  const problems = [];
  const checks = await Promise.allSettled([
    readHealth(), fetchJson(`${REPO}/actions/workflows/sentinel.yml/runs?status=success&per_page=1`, { headers: gh }, "github_runs")
  ]);
  if (checks[0].status === "fulfilled") { health = checks[0].value; problems.push(...health.reasons); }
  else problems.push("health_unavailable");
  if (checks[1].status === "fulfilled") {
    const last = checks[1].value?.workflow_runs?.[0];
    const timestamp = Date.parse(last?.updated_at || last?.created_at);
    if (Number.isFinite(timestamp)) lastOkMin = Math.floor((Date.now() - timestamp) / 60000);
    if (lastOkMin === null || lastOkMin > COLLECTION_MAX_AGE_MINUTES || lastOkMin < -1) problems.push("workflow_stale");
  } else problems.push("workflow_unavailable");

  // A broken watchdog must not prevent recovery dispatch, but must never return healthy.
  let dispatched = false;
  try {
    const response = await fetch(`${REPO}/actions/workflows/sentinel.yml/dispatches`, {
      method: "POST", headers: { ...gh, "Content-Type": "application/json" },
      body: JSON.stringify({ ref: "main", inputs: { tikhub: "true" } }), signal: AbortSignal.timeout(6000)
    });
    dispatched = response.status === 204;
    if (!dispatched) problems.push("dispatch_failed");
  } catch { problems.push("dispatch_unavailable"); }

  let notification = null;
  if (problems.length) {
    try {
      notification = await notifyOnce("pipeline:" + [...new Set(problems)].sort().join(":"), `【额度雷达·告警】检测到：${[...new Set(problems)].join("、")}。\n采集上次成功：${health?.collector.lastSuccessAt || "未知"}\n生产版本匹配：${health?.release.status === "ok" ? "是" : "否"}\n定时触发：${dispatched ? "成功" : "失败"}\n查看：https://airesetclock.com/status\n运行记录：https://github.com/asdfjkl231580/quota-radar/actions`);
      if (!notification.delivered) problems.push("notification_pending");
    } catch { notification = { delivered: false }; problems.push("notification_failed"); }
  }
  const ok = problems.length === 0;
  return res.status(ok ? 200 : 503).json({ ok, dispatched, at: new Date().toISOString(), lastOkMin, problems: [...new Set(problems)], notification, health });
}
