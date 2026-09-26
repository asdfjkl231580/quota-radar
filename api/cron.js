// 准时定时器（Vercel Pro 定时任务，每 10 分钟）：①看门狗 ②触发 GitHub 上的哨兵工作流
// 原因：GitHub 自带定时只是「尽量跑」，9/26 实测说好 10 分钟一次，5 小时只跑了 2 次
// 环境变量：CRON_SECRET（Vercel 调用时自动带上）、GH_DISPATCH_TOKEN（只授权 quota-radar 仓库 Actions 读写的专用钥匙）
import { kv, feishu } from "./_kv.js";
const REPO = "https://api.github.com/repos/asdfjkl231580/quota-radar";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) return res.status(401).json({ ok: false });
  const token = process.env.GH_DISPATCH_TOKEN;
  if (!token) return res.status(500).json({ ok: false, error: "GH_DISPATCH_TOKEN 未配置" });
  const gh = { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "User-Agent": "airesetclock-cron", "X-GitHub-Api-Version": "2022-11-28" };

  // ① 看门狗：哨兵上次成功超过 40 分钟 → 飞书告警（一小时最多一次）
  let lastOkMin = null;
  try {
    const j = await (await fetch(`${REPO}/actions/workflows/sentinel.yml/runs?status=success&per_page=1`, { headers: gh })).json();
    const last = j.workflow_runs?.[0];
    lastOkMin = last ? Math.round((Date.now() - new Date(last.created_at)) / 60000) : null;
    if (lastOkMin === null || lastOkMin > 40) {
      const [already] = await kv(["GET", "alert:sentinel"]);
      if (!already) {
        await kv(["SET", "alert:sentinel", "1", "EX", "3600"]);
        await feishu(`【额度雷达·告警】哨兵已 ${lastOkMin ?? "很久"} 分钟没有成功运行，网站数据可能停更。\n查看：https://github.com/asdfjkl231580/quota-radar/actions`);
      }
    }
  } catch (e) { /* 看门狗失败不影响触发 */ }

  // ② 触发哨兵
  const r = await fetch(`${REPO}/actions/workflows/sentinel.yml/dispatches`, { method: "POST", headers: gh, body: JSON.stringify({ ref: "main", inputs: { tikhub: "false" } }) });
  if (r.status !== 204) {
    try { const [already] = await kv(["GET", "alert:dispatch"]); if (!already) { await kv(["SET", "alert:dispatch", "1", "EX", "3600"]); await feishu(`【额度雷达·告警】定时器触发哨兵失败（GitHub 返回 ${r.status}）。常见原因：GH_DISPATCH_TOKEN 过期（有效期 1 年，2027-09 到期）。`); } } catch (e) {}
    return res.status(502).json({ ok: false, status: r.status, error: (await r.text()).slice(0, 200) });
  }
  return res.status(200).json({ ok: true, at: new Date().toISOString(), lastOkMin });
}
