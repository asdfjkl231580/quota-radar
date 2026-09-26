// 准时定时器（Vercel Pro 定时任务，每 10 分钟）：触发 GitHub 上的哨兵工作流
// 原因：GitHub 自带定时只是「尽量跑」，9/26 实测说好 10 分钟一次，5 小时只跑了 2 次
// 环境变量：CRON_SECRET（Vercel 调用时自动带上）、GH_DISPATCH_TOKEN（只授权 quota-radar 仓库 Actions 读写的专用钥匙）
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) return res.status(401).json({ ok: false });
  const token = process.env.GH_DISPATCH_TOKEN;
  if (!token) return res.status(500).json({ ok: false, error: "GH_DISPATCH_TOKEN 未配置" });
  const r = await fetch("https://api.github.com/repos/asdfjkl231580/quota-radar/actions/workflows/sentinel.yml/dispatches", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "User-Agent": "airesetclock-cron", "X-GitHub-Api-Version": "2022-11-28" },
    body: JSON.stringify({ ref: "main", inputs: { tikhub: "false" } }),
  });
  if (r.status !== 204) return res.status(502).json({ ok: false, status: r.status, error: (await r.text()).slice(0, 200) });
  return res.status(200).json({ ok: true, at: new Date().toISOString() });
}
