/**
 * fetch.mjs — 拉新线索
 * 1. TikHub 拉 data/watch.json 里每个官方账号的最新推文（计费，约 $0.01/账号）
 * 2. 两个同类站的公开接口当免费线索
 * 3. 关键词过滤 + fxtwitter 免费核原帖 → 写入 data/pending.json → 飞书通知
 * 用法：node scripts/fetch.mjs [--no-feishu] [--dry] [--no-tikhub] [--draft]
 */
import fs from "node:fs";
import path from "node:path";
import { DATA, readJson, writeJson, tikhubKey, adminToken, sendFeishu, fxTweet, bj } from "./lib.mjs";

const args = new Set(process.argv.slice(2));
const watch = readJson("watch.json");
const events = readJson("events.json", { events: [] }).events;
const pendingFile = readJson("pending.json", { pending: [] });
const rejected = readJson("rejected.json", { rejected: [] }).rejected;
const known = new Set([...events.map((e) => e.id), ...pendingFile.pending.map((p) => p.id), ...rejected.map((r) => r.id)]);
const kw = new RegExp(watch.keywords, "i");
const found = new Map(); // id -> {screen_name, provider, via}

// 1. TikHub 官方账号时间线
if (!args.has("--no-tikhub")) {
  const key = tikhubKey();
  if (!key) console.error("⚠️ 没有 TikHub 密钥，跳过账号抓取");
  else for (const a of watch.accounts) {
    try {
      const r = await fetch(`https://api.tikhub.io/api/v1/twitter/web/fetch_user_post_tweet?screen_name=${a.screen_name}`, { headers: { Authorization: "Bearer " + key } });
      const j = await r.json();
      const list = j?.data?.timeline || [];
      let hit = 0;
      for (const t of list) {
        const id = String(t.tweet_id || "");
        if (!id || known.has(id) || found.has(id)) continue;
        if (!kw.test(t.text || "")) continue;
        found.set(id, { screen_name: a.screen_name, provider: a.provider, via: "tikhub" });
        hit++;
      }
      console.log(`TikHub @${a.screen_name}: ${list.length} 条，命中关键词且未知 ${hit} 条`);
    } catch (e) { console.error(`TikHub @${a.screen_name} 失败:`, e.message); }
  }
}

// 2. 同类站线索（免费）
for (const src of watch.leadSources || []) {
  try {
    const j = await (await fetch(src.url, { headers: { "User-Agent": "quota-radar" } })).json();
    const list = j.events || j.data || [];
    let hit = 0;
    for (const e of list) {
      const url = e.sourceUrl || e.source?.url || "";
      const m = url.match(/x\.com\/([^/]+)\/status\/(\d+)/);
      if (!m) continue;
      const id = m[2];
      if (known.has(id) || found.has(id)) continue;
      found.set(id, { screen_name: m[1], provider: e.provider || src.provider, via: src.name });
      hit++;
    }
    console.log(`${src.name}(${src.provider}): ${list.length} 条，新线索 ${hit} 条`);
  } catch (e) { console.error(`${src.name} 失败:`, e.message); }
}

// 3. 核原帖 + 入 pending
const added = [];
for (const [id, meta] of found) {
  try {
    const t = await fxTweet(meta.screen_name, id);
    if (!t.text) throw new Error("原帖为空");
    added.push({ id, provider: meta.provider, account: "@" + (t.author || meta.screen_name), sourceUrl: t.url || `https://x.com/${meta.screen_name}/status/${id}`,
      announcedAt: t.createdAt, textEn: t.text, via: meta.via, foundAt: new Date().toISOString(), zhDraft: "" });
  } catch (e) { console.error(`核验 ${id} 失败:`, e.message); }
}
// 起草并行跑，单条最多等 60 秒，失败不影响入库
if (args.has("--draft") && added.length) {
  await Promise.all(added.map(async (a) => { a.zhDraft = await draftZh(a.textEn).catch((e) => "(起草失败: " + e.message + ")"); }));
}

// 用自建智能体起草中文（铁律：AI 输出只走自建智能体），人工必改
async function draftZh(text) {
  const token = adminToken();
  if (!token) throw new Error("无 ADMIN_TOKEN");
  const prompt = `把下面这条英文推文翻成一句中文公告（30 字内），只说：谁获得了什么（全员重置／重置卡／提额），不要评论，不要人设，不要开场白，只输出那一句：\n\n${text}`;
  const r = await fetch(`https://yuaneightlife.com/api/chat?token=${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(60000),
    body: JSON.stringify({ messages: [{ role: "user", content: prompt }], stream: false }) });
  const j = await r.json();
  return (j.content || j.message || j.answer || j.text || "").toString().trim();
}

console.log(`新线索 ${added.length} 条`);
for (const a of added) console.log(` · ${a.id} ${a.account} ${bj(a.announcedAt)} | ${a.textEn.slice(0, 80).replace(/\n/g, " ")}`);
fs.appendFileSync(path.join(DATA, "fetch-log.jsonl"), JSON.stringify({ at: new Date().toISOString(), found: found.size, added: added.length, ids: added.map((a) => a.id) }) + "\n");

if (args.has("--dry")) process.exit(0);
if (added.length) {
  pendingFile.pending.push(...added);
  writeJson("pending.json", pendingFile);
  if (!args.has("--no-feishu")) {
    const lines = added.map((a) => `· ${a.account} ${bj(a.announcedAt, "md")}：${(a.zhDraft || a.textEn).slice(0, 90).replace(/\n/g, " ")}`);
    const msg = `【额度雷达】${added.length} 条新线索待确认\n${lines.join("\n")}\n\n处理：cd ~/Documents/GitHub/quota-radar && node scripts/review.mjs list`;
    try { await sendFeishu(msg); console.log("飞书已通知"); } catch (e) { console.error("飞书通知失败:", e.message); }
  }
}
