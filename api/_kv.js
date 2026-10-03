import { createHash, randomUUID } from "node:crypto";

// Bound network failures and never echo upstream bodies or credentials to clients.
export async function fetchJson(url, options = {}, label = "upstream") {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(6000) });
  if (!response.ok) throw new Error(`${label}_http_${response.status}`);
  try { return await response.json(); } catch { throw new Error(`${label}_invalid_json`); }
}

export async function kv(...commands) {
  const url = process.env.KV_REST_API_URL, token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) throw new Error("kv_not_configured");
  const result = await fetchJson(url.replace(/\/$/, "") + "/pipeline", {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(commands)
  }, "kv");
  if (!Array.isArray(result) || result.length !== commands.length) throw new Error("kv_invalid_response");
  return result.map((item) => {
    if (!item || typeof item !== "object" || item.error || !Object.hasOwn(item, "result")) throw new Error("kv_command_failed");
    return item.result;
  });
}

export function clientKey(req) {
  const forwarded = req.headers["x-forwarded-for"];
  const ip = String(Array.isArray(forwarded) ? forwarded[0] : forwarded || req.socket?.remoteAddress || "unknown").split(",")[0].trim();
  return createHash("sha256").update(ip).digest("hex").slice(0, 32);
}

const RATE_SCRIPT = `-- quota-radar:rate-v1
local current = tonumber(redis.call('GET', KEYS[1]) or '0')
if not current or current < 0 or current % 1 ~= 0 then return redis.error_reply('invalid counter') end
if current >= tonumber(ARGV[1]) then return 0 end
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[2]) end
return 1`;

// A fixed window shared by all serverless instances, with no in-memory allowance.
export async function rateLimit(scope, client, maximum, seconds, now = Date.now()) {
  const bucket = Math.floor(now / (seconds * 1000));
  const [allowed] = await kv(["EVAL", RATE_SCRIPT, 1, `rate:${scope}:${client}:${bucket}`, maximum, seconds + 60]);
  if (allowed !== 0 && allowed !== 1) throw new Error("kv_invalid_rate_result");
  return allowed === 1;
}

// Both HTTP status and Feishu business status/receipt must confirm delivery.
export async function feishu(text, uuid = randomUUID()) {
  const { FEISHU_APP_ID, FEISHU_APP_SECRET, FEISHU_TO_CHAT_ID } = process.env;
  if (!FEISHU_APP_ID || !FEISHU_APP_SECRET || !FEISHU_TO_CHAT_ID) throw new Error("feishu_not_configured");
  const token = await fetchJson("https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ app_id: FEISHU_APP_ID, app_secret: FEISHU_APP_SECRET })
  }, "feishu_token");
  if (token?.code !== 0 || typeof token.tenant_access_token !== "string" || !token.tenant_access_token) throw new Error("feishu_token_rejected");
  const sent = await fetchJson("https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=chat_id", {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token.tenant_access_token },
    body: JSON.stringify({ receive_id: FEISHU_TO_CHAT_ID, msg_type: "text", content: JSON.stringify({ text }), uuid })
  }, "feishu_message");
  if (sent?.code !== 0 || typeof sent.data?.message_id !== "string" || !sent.data.message_id) throw new Error("feishu_message_rejected");
  return { messageId: sent.data.message_id };
}

const UNLOCK_SCRIPT = `-- quota-radar:unlock-v1
if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end
return 0`;

export async function notifyOnce(name, text) {
  const key = `alert:${name}`, lockKey = `${key}:sending`, lockId = randomUUID();
  const [sent] = await kv(["GET", key]);
  if (sent) return { delivered: true, deduped: true };
  const [locked] = await kv(["SET", lockKey, lockId, "NX", "EX", 60]);
  if (locked === null) return { delivered: false, pending: true };
  if (locked !== "OK") throw new Error("alert_lock_failed");
  try {
    const [delivered] = await kv(["GET", key]);
    if (delivered) return { delivered: true, deduped: true };
    // Stable within the dedupe hour if a successful send's acknowledgement is lost.
    const uuid = createHash("sha256").update(`${name}:${Math.floor(Date.now() / 3600000)}`).digest("hex").slice(0, 32);
    const receipt = await feishu(text, uuid);
    const [saved] = await kv(["SET", key, receipt.messageId, "EX", 3600]);
    if (saved !== "OK") throw new Error("alert_receipt_not_saved");
    return { delivered: true, deduped: false };
  } finally {
    await kv(["EVAL", UNLOCK_SCRIPT, 1, lockKey, lockId]);
  }
}
