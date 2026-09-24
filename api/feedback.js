// 留言反馈：表单 POST → 飞书机器人私信站长（无数据库，飞书就是收件箱）
// 环境变量：FEISHU_APP_ID / FEISHU_APP_SECRET（Hermes ops-watch-agent 同一个机器人）/ FEISHU_TO_CHAT_ID（运维群）
export const config = { runtime: "nodejs" };
const limit = new Map(); // 简单限流：同一 IP 每 10 分钟 5 条
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method" });
  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0] || "?";
  const now = Date.now(); const arr = (limit.get(ip) || []).filter((t) => now - t < 600000);
  if (arr.length >= 5) return res.status(429).json({ ok: false, error: "too_many" });
  arr.push(now); limit.set(ip, arr);
  let body = req.body; if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  const { message = "", contact = "", page = "", lang = "zh", honey = "" } = body || {};
  if (honey) return res.status(200).json({ ok: true });                     // 蜜罐：机器人填了隐藏字段
  const msg = String(message).trim().slice(0, 2000);
  if (msg.length < 2) return res.status(400).json({ ok: false, error: "empty" });
  const { FEISHU_APP_ID, FEISHU_APP_SECRET, FEISHU_TO_CHAT_ID } = process.env;
  if (!FEISHU_APP_ID) return res.status(500).json({ ok: false, error: "not_configured" });
  try {
    const tk = await (await fetch("https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ app_id: FEISHU_APP_ID, app_secret: FEISHU_APP_SECRET }) })).json();
    const text = `【额度雷达 留言】\n${msg}\n\n联系：${String(contact).slice(0, 200) || "未留"}\n页面：${String(page).slice(0, 200)}\n语言：${lang} · IP：${ip} · UA：${String(req.headers["user-agent"] || "").slice(0, 80)}`;
    const r = await (await fetch("https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=chat_id", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + tk.tenant_access_token }, body: JSON.stringify({ receive_id: FEISHU_TO_CHAT_ID, msg_type: "text", content: JSON.stringify({ text }) }) })).json();
    if (r.code !== 0) throw new Error("feishu " + r.code + " " + r.msg);
    return res.status(200).json({ ok: true });
  } catch (e) { return res.status(502).json({ ok: false, error: String(e.message).slice(0, 120) }); }
}
