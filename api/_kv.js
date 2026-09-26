// Upstash Redis（Vercel 市场开通，2026-09-26）：用 REST 接口，零依赖
// 环境变量由 Vercel 自动注入：KV_REST_API_URL / KV_REST_API_TOKEN
export async function kv(...commands) {
  const url = process.env.KV_REST_API_URL, token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) throw new Error("KV 未配置");
  const r = await fetch(url + "/pipeline", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(commands) });
  if (!r.ok) throw new Error("KV " + r.status);
  return (await r.json()).map((x) => x.result);
}

// 飞书运维群（与 feedback.js 同一个机器人）
export async function feishu(text) {
  const { FEISHU_APP_ID, FEISHU_APP_SECRET, FEISHU_TO_CHAT_ID } = process.env;
  if (!FEISHU_APP_ID) return;
  const tk = await (await fetch("https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ app_id: FEISHU_APP_ID, app_secret: FEISHU_APP_SECRET }) })).json();
  await fetch("https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=chat_id", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + tk.tenant_access_token }, body: JSON.stringify({ receive_id: FEISHU_TO_CHAT_ID, msg_type: "text", content: JSON.stringify({ text }) }) });
}
