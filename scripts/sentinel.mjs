/**
 * sentinel.mjs — 哨兵：每 10 分钟跑一次，官方一发帖 10 分钟内自动上线
 *
 * 线索三层：① 两个参考站接口（免费）② --tikhub 主账号直查（计费）③ --tikhub-all 全部账号
 * 每条新线索都必须过 fxtwitter 原帖核验（存在 + 作者是官方账号）才算数。
 *
 * 分类规则（能自动就自动上线，标 confidence:auto「待整理」）：
 *   banked  原文含 banked
 *   reset   原文含 reset/resetting/reset limits 且是「已做/正在做」语气
 *   boost   原文含 increase limits / more usage / credit / goes further
 *   teaser  预告语气（promised / tomorrow / later today / coming / soon）→ 只进待办
 *   其他命中关键词但分不清 → 待办
 *
 * 用法：node scripts/sentinel.mjs [--tikhub] [--tikhub-all] [--dry] [--no-deploy] [--no-feishu]
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { ROOT, DATA, readJson, writeJson, tikhubKey, sendFeishu, fxTweet, bj, parseExpected } from "./lib.mjs";

const args = new Set(process.argv.slice(2));
const log = (...a) => { const line = `[${new Date().toISOString()}] ${a.join(" ")}`; console.log(line); fs.appendFileSync(path.join(DATA, "sentinel.log"), line + "\n"); };

const watch = readJson("watch.json");
const OFFICIAL = new Set(watch.accounts.map((a) => a.screen_name.toLowerCase()));
const providerOf = (h) => (watch.accounts.find((a) => a.screen_name.toLowerCase() === h.toLowerCase()) || {}).provider;
const ef = readJson("events.json", { events: [] });
const pf = readJson("pending.json", { pending: [] });
const rf = readJson("rejected.json", { rejected: [] });
const known = new Set([...ef.events.map((e) => e.id), ...pf.pending.map((p) => p.id), ...rf.rejected.map((r) => r.id)]);
const kw = new RegExp(watch.keywords, "i");
const found = new Map();
const add = (id, screen_name, via) => { if (id && !known.has(id) && !found.has(id)) found.set(id, { screen_name, via }); };

// ① 参考站线索
for (const src of watch.leadSources || []) {
  try {
    const j = await (await fetch(src.url, { headers: { "User-Agent": "quota-radar-sentinel" }, signal: AbortSignal.timeout(20000) })).json();
    const list = j.events || j.data || [];
    let n = 0;
    for (const e of list) { const m = (e.sourceUrl || e.source?.url || "").match(/x\.com\/([^/]+)\/status\/(\d+)/); if (m && !known.has(m[2])) { add(m[2], m[1], src.name); n++; } }
    log(`${src.name}/${src.provider}: ${list.length} 条，新 ${n}`);
  } catch (e) { log(`${src.name} 失败: ${e.message}`); }
}
// ② ③ TikHub
if (args.has("--tikhub") || args.has("--tikhub-all")) {
  const key = tikhubKey();
  const accounts = args.has("--tikhub-all") ? watch.accounts : watch.accounts.filter((a) => ["thsottiaux", "ClaudeDevs"].includes(a.screen_name));
  for (const a of accounts) {
    try {
      const j = await (await fetch(`https://api.tikhub.io/api/v1/twitter/web/fetch_user_post_tweet?screen_name=${a.screen_name}`, { headers: { Authorization: "Bearer " + key }, signal: AbortSignal.timeout(30000) })).json();
      const list = j?.data?.timeline || [];
      let n = 0;
      for (const t of list) { const id = String(t.tweet_id || ""); if (id && !known.has(id) && kw.test(t.text || "")) { add(id, a.screen_name, "tikhub"); n++; } }
      log(`TikHub @${a.screen_name}: ${list.length} 条，命中新 ${n}`);
    } catch (e) { log(`TikHub @${a.screen_name} 失败: ${e.message}`); }
  }
}

// 分类
function classify(text) {
  const t = text.toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, " ");
  if (/^@/.test(t)) return "unclear";                                   // 回复帖不自动上线
  if (/(no|not|won't|don't|didn't|never) (be |a |any )?reset/.test(t)) return "unclear";
  const teaser = /promis|tomorrow|next week|later this week|coming (soon|up)|stay tuned|start your engines|will (be )?reset(ting)? (on|next|tomorrow)/.test(t);
  // 将来时：宣布「将要」重置但尚未生效 → 预告，等确认或 3 小时后按公告时间计
  const future = /(we'?ll|we will|will|going to|about to) (fully )?reset|lands? (in|within|by|around|at|end of|over)|propagat(ing|e) (over|in|to)|within the (next )?(hour|\d+)|(in|over) the next (\d+ )?(min|hour)|should (be )?(showing|land|see)|later (today|tonight)/.test(t);
  const confirmed = /propagated|it is done|has landed|have landed|all reset for|is done|reset button pressed|are now reset|has been reset|have been reset|now reset|back to 100%/.test(t);
  const banked = /banked|into (your|the) (reset )?bank|reset (credit|to use (anytime|at your|whenever))|(a|one) reset (you can|to) use/.test(t);
  const reset = /\breset(ting|s|ed)?\b|reseting/.test(t);
  const boost = /(limits? (increase|up|raised)|increase[sd]? (the )?(usage|limits|rate limits)|more usage|free credits?|one-time credit|goes? \d+% further|(\d+)x more usage|(lifting|lift) (the )?usage limits|2x the usual)/.test(t);
  const done = /(have|has|we've|i've|been|just|now|done|propagated|landed|enjoy|is back)/.test(t);
  const doneStrong = /(have|has|we've|i've|i have|we have) (now |just |also |again )?(reset|reseted|been reset)|(are|is) (now )?reset\b|reset(ed)? (all|for everyone|usage limits|rate limits|the usage limits|the rate limit) (has|is)|has been reset|have been reset|enjoy (a |the )?(nice |full |sweet )?reset|reset button pressed|we did a .*reset|giving .* a usage reset/.test(t);
  const immediate = /(full|fully|hard|double|sneaky) reset|reset everyone's|will be fully reset/.test(t);
  if (banked && !immediate) return teaser && !reset ? "teaser" : "banked";   // 同帖既立即重置又发卡，按重置记
  if (reset) { if (confirmed || doneStrong) return "reset"; if (future) return "teaser"; if (teaser && !done) return "teaser"; return "reset"; }
  if (boost) return "boost";
  return teaser ? "teaser" : "unclear";
}
const ZH_AUTO = { reset: "官方宣布全员重置（原文待整理）", banked: "官方发放重置卡（原文待整理）", boost: "官方提额或送额度（原文待整理）", teaser: "官方宣布即将重置（生效时间未公布）" };

// 预告转正（2026-09-26 用户拍板）：
//   公告里给了具体钟点 → 到点即按预告时间记为重置（effectiveAt=预告时间）
//   只给了哪一天 → 那天过完仍无确认，按那天记
//   什么时间都没给 → 首页显示「已宣布，生效时间未公布」，24 小时仍无确认才按公告时间记
let promoted = 0;
for (const x of ef.events) {
  if (!x.pendingReset) continue;
  const exp = x.expectedAt ? new Date(x.expectedAt).getTime() : null;
  const due = exp ? (x.expectedPrecision === "day" ? exp + 86400000 : exp) : new Date(x.announcedAt).getTime() + 86400000;
  if (Date.now() < due) continue;
  x.pendingReset = false; x.kind = "reset"; x.promotedAt = new Date().toISOString();
  x.effectiveAt = exp ? x.expectedAt : x.announcedAt;
  x.detail = (x.detail ? x.detail + " " : "") + (exp ? "官方未另发确认，按预告时间计。" : "官方未公布生效时间，24 小时后按公告时间计。");
  if (/尚未确认生效|生效时间未公布/.test(x.zh)) x.zh = x.zh.replace("官方宣布即将重置，尚未确认生效", "官方宣布全员重置").replace(/[，,（(]?\s*(尚未确认生效|生效时间未公布)\s*[）)]?/, exp ? "（按预告时间计）" : "（按公告时间计）");
  promoted++;
}
if (promoted) { ef.updatedAt = new Date().toISOString(); log(`预告超时转正 ${promoted} 条`); }

// 核验 + 入库
const auto = [], pend = [];
for (const [id, meta] of found) {
  try {
    const t = await fxTweet(meta.screen_name, id);
    if (!t.text) throw new Error("原帖为空");
    const author = (t.author || meta.screen_name);
    if (!OFFICIAL.has(author.toLowerCase())) { log(`跳过 ${id}：作者 @${author} 不在官方名单`); rf.rejected.push({ id, why: "作者非官方账号 @" + author, at: new Date().toISOString().slice(0, 10) }); continue; }
    const kind = classify(t.text);
    const base = { id, provider: providerOf(author) || meta.provider, account: "@" + author, sourceUrl: t.url || `https://x.com/${author}/status/${id}`, announcedAt: t.createdAt, textEn: t.text };
    if (["reset", "banked", "boost", "teaser"].includes(kind)) {
      const ev = { ...base, kind, extraLinks: [], zh: ZH_AUTO[kind], detail: "", scope: "待核实", verified: true, verifiedBy: `自动：${meta.via} 线索 + 原帖核验`, verifiedAt: new Date().toISOString().slice(0, 10), confidence: "auto" };
      if (kind === "teaser" && /reset/.test(t.text.toLowerCase())) { ev.pendingReset = true; Object.assign(ev, parseExpected(t.text, t.createdAt) || {}); }   // 读得出时间就倒计时，读不出显示「生效时间未公布」
      if (kind === "reset") { const pend = ef.events.find((x) => x.provider === ev.provider && x.pendingReset && Date.now() - new Date(x.announcedAt) < 86400000); if (pend) { pend.pendingReset = false; pend.fulfilledBy = ev.id; pend.kind = "teaser"; ev.detail = "官方确认生效；预告见 " + new Date(pend.announcedAt).toISOString().slice(0, 16) + "Z"; } }
      auto.push(ev);
    } else {
      pend.push({ ...base, via: meta.via, foundAt: new Date().toISOString(), zhDraft: "", guess: kind });
    }
  } catch (e) { log(`核验 ${id} 失败: ${e.message}`); }
}
log(`新线索 ${found.size}，自动上线 ${auto.length}，待办 ${pend.length}`);
for (const a of auto) log(` AUTO ${a.kind} ${a.account} ${bj(a.announcedAt)} | ${a.textEn.slice(0, 80).replace(/\n/g, " ")}`);
for (const p of pend) log(` PEND ${p.guess} ${p.account} ${bj(p.announcedAt)} | ${p.textEn.slice(0, 80).replace(/\n/g, " ")}`);
if (args.has("--dry")) process.exit(0);

if (auto.length || promoted) { ef.events.push(...auto); ef.events.sort((a, b) => (a.announcedAt < b.announcedAt ? 1 : -1)); ef.updatedAt = new Date().toISOString(); writeJson("events.json", ef); }
if (pend.length) { pf.pending.push(...pend); writeJson("pending.json", pf); }
writeJson("rejected.json", rf);

if ((auto.length || promoted) && !args.has("--no-deploy")) {
  try { execFileSync("node", ["scripts/deploy.mjs"], { cwd: ROOT, stdio: "inherit", timeout: 360000, env: { ...process.env, PATH: (process.env.PATH || "") + ":/Users/kenyuanlin/.npm-global/bin:/opt/homebrew/bin:/usr/local/bin" } }); log("已自动发布生产（含 IndexNow）"); }
  catch (e) { log("自动发布失败: " + e.message.slice(0, 200)); }
}
if ((auto.length || pend.length || promoted) && !args.has("--no-feishu")) {
  const lines = [...auto.map((a) => `· 已上线 [${a.kind}] ${a.account} ${bj(a.announcedAt, "md")}：${a.textEn.slice(0, 70).replace(/\n/g, " ")}${a.pendingReset ? (a.expectedAt ? `｜读出预告时间 ${bj(a.expectedAt)}${a.expectedPrecision === "day" ? "（只知哪天）" : ""}，首页已倒计时` : "｜没读出时间，首页显示「生效时间未公布」；有时间就 review.mjs edit <id> --expect <ISO>") : ""}`), ...pend.map((p) => `· 待办 [${p.guess}] ${p.account} ${bj(p.announcedAt, "md")}：${p.textEn.slice(0, 70).replace(/\n/g, " ")}`)];
  const msg = `【额度雷达】哨兵：自动上线 ${auto.length} 条，待办 ${pend.length} 条${promoted ? `，预告超时转正 ${promoted} 条` : ""}\n${lines.join("\n")}\n\n补中文：cd ~/Documents/GitHub/quota-radar && node scripts/review.mjs edit <id> --zh "..." --scope "..."\n待办：node scripts/review.mjs list`;
  try { await sendFeishu(msg); log("飞书已通知"); } catch (e) { log("飞书失败: " + e.message.slice(0, 120)); }
}

// 云端：把 events/pending/rejected 的变化提交回仓库，作为下一次运行的状态
if (process.env.GITHUB_ACTIONS && (auto.length || pend.length || found.size || promoted)) {
  try {
    execFileSync("git", ["config", "user.name", "quota-radar-bot"], { cwd: ROOT });
    execFileSync("git", ["config", "user.email", "bot@airesetclock.com"], { cwd: ROOT });
    execFileSync("git", ["add", "data/events.json", "data/pending.json", "data/rejected.json"], { cwd: ROOT });
    const st = execFileSync("git", ["status", "--porcelain", "data"], { cwd: ROOT, encoding: "utf8" });
    if (st.trim()) { execFileSync("git", ["commit", "-m", `哨兵：自动上线 ${auto.length} 条，待办 ${pend.length} 条，转正 ${promoted} 条`], { cwd: ROOT }); execFileSync("git", ["push"], { cwd: ROOT }); log("数据已提交回仓库"); }
  } catch (e) { log("提交回仓库失败: " + e.message.slice(0, 160)); }
}
