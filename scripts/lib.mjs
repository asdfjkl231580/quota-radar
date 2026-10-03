// 公共工具：读写数据、北京时间、事件分类、飞书通知
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const DATA = path.join(ROOT, "data");
export const HOME = process.env.HOME || "/Users/kenyuanlin";

export const KINDS = {
  reset: { zh: "全员重置", short: "重置", desc: "额度直接恢复，不用操作" },
  banked: { zh: "重置卡", short: "卡", desc: "存进账户，自己选时候点一下用" },
  boost: { zh: "提额", short: "提额", desc: "限额上调、送额外额度或消耗变慢，不是重置" },
  teaser: { zh: "预告", short: "预告", desc: "官方提前放话，尚未发生" },
};
export const PROVIDERS = {
  codex: { zh: "Codex", full: "OpenAI Codex / ChatGPT", accent: "#2563EB" },
  claude: { zh: "Claude", full: "Anthropic Claude / Claude Code", accent: "#D97757" },
};

export function readJson(name, fallback) {
  const p = path.join(DATA, name);
  if (!fs.existsSync(p)) return fallback;
  return JSON.parse(fs.readFileSync(p, "utf8"));
}
export function writeJson(name, obj) {
  const p = path.join(DATA, name);
  const tmp = p + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 1) + "\n");
  fs.renameSync(tmp, p);
}

// 北京时间格式化
export function bj(iso, mode = "full") {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai", year: "numeric", month: "numeric", day: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(d);
  const g = (t) => parts.find((x) => x.type === t)?.value;
  if (mode === "date") return `${g("year")}年${g("month")}月${g("day")}日`;
  if (mode === "md") return `${g("month")}月${g("day")}日`;
  return `${g("year")}年${g("month")}月${g("day")}日 ${g("hour")}:${g("minute")}`;
}
export function daysAgo(iso, now = Date.now()) {
  return (now - new Date(iso).getTime()) / 86400000;
}
export function relative(iso, now = Date.now()) {
  const d = daysAgo(iso, now);
  if (d < 1 / 24) return "刚刚";
  if (d < 1) return `${Math.round(d * 24)} 小时前`;
  if (d < 2) return "昨天";
  if (d < 30) return `${Math.floor(d)} 天前`;
  if (d < 365) return `${Math.floor(d / 30)} 个月前`;
  return `${(d / 365).toFixed(1)} 年前`;
}

export function tikhubKey() {
  try {
    return execFileSync("security", ["find-generic-password", "-s", "TikHub-API", "-w"], { encoding: "utf8" }).trim();
  } catch { return process.env.TIKHUB_API_KEY || ""; }
}
export function adminToken() {
  if (process.env.ADMIN_TOKEN) return process.env.ADMIN_TOKEN;
  const env = path.join(HOME, "Documents/GitHub/-/.env.local");
  if (!fs.existsSync(env)) return "";
  const m = fs.readFileSync(env, "utf8").match(/^ADMIN_TOKEN=(.+)$/m);
  return m ? m[1].trim().replace(/^"|"$/g, "") : "";
}

// 飞书通知：复用 Hermes 的 send（与主仓 sync-broadcast.mjs 同一套路）
const HERMES_PY = path.join(HOME, ".hermes/hermes-agent/venv/bin/python");
const FEISHU_TARGET = process.env.XIAOYUAN_OPS_FEISHU_TARGET || "feishu:oc_92d89026626496bedc112c5d3f04f9f0";
export async function sendFeishu(message, options = {}) {
  // Cloud and local transports share the same confirmed-receipt contract.
  const exists = options.exists || fs.existsSync;
  const execute = options.execute || execFileSync;
  if (!exists(HERMES_PY)) return sendFeishuApi(message);
  const noProxy = [process.env.NO_PROXY, "open.feishu.cn", "msg-frontier.feishu.cn", ".feishu.cn"].filter(Boolean).join(",");
  const env = { ...process.env, NO_PROXY: noProxy, no_proxy: noProxy };
  for (const k of Object.keys(env)) if (/^(FEISHU_|LARK_)/.test(k) || ["HERMES_HOME", "HERMES_PROFILE"].includes(k)) delete env[k];
  const raw = execute(HERMES_PY, ["-m", "hermes_cli.main", "--profile", process.env.XIAOYUAN_OPS_HERMES_PROFILE || "ops-watch-agent",
    "send", "--to", FEISHU_TARGET, "--json", "--file", "-"], { input: message, encoding: "utf8", timeout: 30000, env });
  let receipt;
  try { receipt = JSON.parse(raw); } catch { throw new Error("hermes_invalid_receipt"); }
  if (receipt?.success !== true || typeof receipt.message_id !== "string" || !receipt.message_id.trim() || receipt.skipped || receipt.error) throw new Error("hermes_message_unconfirmed");
  return { messageId: receipt.message_id };
}

export async function fxTweet(screenName, id) {
  const r = await fetch(`https://api.fxtwitter.com/${screenName}/status/${id}`, { headers: { "User-Agent": "quota-radar" }, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error("fxtwitter " + r.status);
  const j = await r.json();
  const t = j.tweet || {};
  return { text: t.text || "", createdAt: t.created_at ? new Date(t.created_at).toISOString() : null, author: t.author?.screen_name, url: t.url, id: String(t.id || id), replyToId: t.replying_to_status || t.in_reply_to_status_id || t.in_reply_to_status_id_str, conversationId: t.conversation_id, quotedTweetId: t.quote?.id };
}

// Reuse the API helper: bounded HTTP calls, business code and message_id validation.
export async function sendFeishuApi(message) {
  const { feishu } = await import("../api/_kv.js");
  return feishu(message);
}

export { parseExpected } from "./pipeline.mjs";
