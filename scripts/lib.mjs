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
export function sendFeishu(message) {
  // 云端（GitHub Actions）没有 Hermes，直接走飞书开放平台 API
  if (!fs.existsSync(HERMES_PY) && process.env.FEISHU_APP_ID) return sendFeishuApi(message);
  const noProxy = [process.env.NO_PROXY, "open.feishu.cn", "msg-frontier.feishu.cn", ".feishu.cn"].filter(Boolean).join(",");
  const env = { ...process.env, NO_PROXY: noProxy, no_proxy: noProxy };
  for (const k of Object.keys(env)) if (/^(FEISHU_|LARK_)/.test(k) || ["HERMES_HOME", "HERMES_PROFILE"].includes(k)) delete env[k];
  return execFileSync(HERMES_PY, ["-m", "hermes_cli.main", "--profile", process.env.XIAOYUAN_OPS_HERMES_PROFILE || "ops-watch-agent",
    "send", "--to", FEISHU_TARGET, "--json", "--file", "-"], { input: message, encoding: "utf8", timeout: 30000, env });
}

export async function fxTweet(screenName, id) {
  const r = await fetch(`https://api.fxtwitter.com/${screenName}/status/${id}`, { headers: { "User-Agent": "quota-radar" } });
  if (!r.ok) throw new Error("fxtwitter " + r.status);
  const j = await r.json();
  const t = j.tweet || {};
  return { text: t.text || "", createdAt: t.created_at ? new Date(t.created_at).toISOString() : null, author: t.author?.screen_name, url: t.url };
}

async function _feishuApi(message) {
  const { FEISHU_APP_ID, FEISHU_APP_SECRET, FEISHU_TO_CHAT_ID } = process.env;
  const tk = await (await fetch("https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ app_id: FEISHU_APP_ID, app_secret: FEISHU_APP_SECRET }) })).json();
  const r = await (await fetch("https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=chat_id", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + tk.tenant_access_token }, body: JSON.stringify({ receive_id: FEISHU_TO_CHAT_ID, msg_type: "text", content: JSON.stringify({ text: message }) }) })).json();
  if (r.code !== 0) throw new Error("feishu " + r.code + " " + r.msg);
  return JSON.stringify(r.data);
}
export function sendFeishuApi(message) { return _feishuApi(message); }

// 从「将要重置」的公告里读出官方给的时间：返回 { expectedAt, expectedPrecision: "time"|"day" } 或 null
// 只认明确说法：in 2 hours / within the hour / at 10am PT / tomorrow / on Tuesday / later today；读不出就返回 null（页面显示「生效时间未公布」）
const PT = "America/Los_Angeles";
function ptOffsetMin(d) { // 该时刻太平洋时间相对 UTC 的分钟差（夏令时 -420，冬令时 -480）
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: PT, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(d).map((x) => [x.type, x.value]));
  return (Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute) - d.getTime()) / 60000;
}
function ptDate(d) { const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: PT, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" }).formatToParts(d).map((x) => [x.type, x.value])); return { y: +p.year, m: +p.month, d: +p.day, wd: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday) }; }
function ptAt(y, m, d, h = 0, mi = 0) { const guess = new Date(Date.UTC(y, m - 1, d, h, mi)); return new Date(guess.getTime() - ptOffsetMin(guess) * 60000); }
export function parseExpected(text, announcedAt) {
  const t = text.toLowerCase().replace(/[’‘]/g, "'");
  const a = new Date(announcedAt);
  const NUM = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, few: 3, couple: 2 };
  let m = t.match(/\b(?:in|within)(?: the next)? (\d+|an?|one|two|three|four|five|six|a few|a couple of) (min|minute|hour|hr)s?\b/);
  if (m) { const n = NUM[m[1].replace(/^a (few|couple of)$/, "$1").replace(" of", "")] ?? +m[1]; return { expectedAt: new Date(a.getTime() + n * (m[2].startsWith("min") ? 60000 : 3600000)).toISOString(), expectedPrecision: "time" }; }
  if (/within the (next )?hour/.test(t)) return { expectedAt: new Date(a.getTime() + 3600000).toISOString(), expectedPrecision: "time" };
  const base = ptDate(a);
  let day = null;
  if (/\btomorrow\b/.test(t)) day = 1;
  else if (/later today|tonight|today/.test(t)) day = 0;
  else { const wd = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"].findIndex((w) => new RegExp(`\\b(on |this |next )?${w}\\b`).test(t)); if (wd >= 0) day = ((wd - base.wd + 7) % 7) || 7; }
  const tm = t.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*(pt|pst|pdt|pacific)\b/);
  if (day === null && !tm) return null;
  const d0 = new Date(Date.UTC(base.y, base.m - 1, base.d + (day || 0)));
  if (tm) { let h = +tm[1] % 12 + (tm[3] === "pm" ? 12 : 0); return { expectedAt: ptAt(d0.getUTCFullYear(), d0.getUTCMonth() + 1, d0.getUTCDate(), h, +(tm[2] || 0)).toISOString(), expectedPrecision: "time" }; }
  if (day === 0) return null; // 「今天晚些」没给钟点，不装精确
  return { expectedAt: ptAt(d0.getUTCFullYear(), d0.getUTCMonth() + 1, d0.getUTCDate()).toISOString(), expectedPrecision: "day" };
}
