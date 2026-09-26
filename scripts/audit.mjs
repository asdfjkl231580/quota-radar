// 全量复核：events.json 每条逐一回 X 原帖核对 作者 / 发帖时间 / 原文，并查账号是否在白名单
// 用法：node scripts/audit.mjs [--no-feishu]   （云端每周一跑一次，结果推飞书）
import { readJson, sendFeishu, fxTweet } from "./lib.mjs";

const args = new Set(process.argv.slice(2));
const { events } = readJson("events.json", { events: [] });
const watch = new Set(readJson("watch.json", { accounts: [] }).accounts.map((a) => a.screen_name.toLowerCase()));
const norm = (s) => (s || "").replace(/[’‘]/g, "'").replace(/[“”]/g, '"').trim().slice(0, 60);
const bad = [];

for (const x of events) {
  const h = x.account.replace(/^@/, "");
  const issues = [];
  if (!watch.has(h.toLowerCase())) issues.push("账号不在白名单");
  if (!x.sourceUrl || !x.scope || !x.verifiedAt) issues.push("缺 sourceUrl/scope/verifiedAt");
  if (x.pendingReset && Date.now() - new Date(x.announcedAt) > 3 * 3600000) issues.push("预告超 3 小时未转正");
  if (/尚未确认/.test(x.zh || "") && x.kind !== "teaser") issues.push("已记重置但文案说未确认");
  try {
    const t = await fxTweet(h, x.id);
    if ((t.author || "").toLowerCase() !== h.toLowerCase()) issues.push("作者不符：" + t.author);
    if (t.createdAt && Math.abs(new Date(t.createdAt) - new Date(x.announcedAt)) > 120000) issues.push("发帖时间差超 2 分钟");
    if (x.textEn && norm(x.textEn) !== norm(t.text)) issues.push("原文不一致");
  } catch (e) { issues.push("原帖取不到（" + e.message + "）"); }
  if (issues.length) bad.push(`· ${x.announcedAt.slice(0, 10)} ${x.account} ${x.id}：${issues.join("；")}`);
  await new Promise((r) => setTimeout(r, 300));
}

const msg = bad.length
  ? `【额度雷达】周复核：${events.length} 条中 ${bad.length} 条有问题\n${bad.join("\n")}`
  : `【额度雷达】周复核：${events.length} 条全部与原帖一致（作者/时间/原文），无异常`;
console.log(msg);
if (!args.has("--no-feishu") && process.env.FEISHU_APP_ID) await sendFeishu(msg).catch((e) => console.log("飞书失败 " + e.message));
process.exitCode = bad.length ? 1 : 0;
