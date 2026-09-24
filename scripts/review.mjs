/**
 * review.mjs — 人工确认线索
 *   list                              列出待确认
 *   show <id>                         看原文
 *   approve <id> --kind reset|banked|boost --zh "一句话" [--detail ""] [--scope "套餐范围"] [--provider codex|claude] [--links "url1,url2"] [--merge id1,id2]
 *      --merge 把同线程的其他 pending 一并移除（当作已合并）
 *   reject <id> [--why ""]
 *   edit <id> --zh ".." [--detail ".."] [--scope ".."] [--kind ..]   改已发布事件
 */
import { readJson, writeJson, KINDS, bj } from "./lib.mjs";

const [cmd, id, ...rest] = process.argv.slice(2);
const opt = {};
for (let i = 0; i < rest.length; i++) if (rest[i].startsWith("--")) { opt[rest[i].slice(2)] = rest[i + 1] && !rest[i + 1].startsWith("--") ? rest[++i] : true; }

const pf = readJson("pending.json", { pending: [] });
const ef = readJson("events.json", { events: [] });
const rf = readJson("rejected.json", { rejected: [] });
const today = new Date().toISOString().slice(0, 10);

if (!cmd || cmd === "list") {
  if (!pf.pending.length) { console.log("没有待确认线索"); process.exit(0); }
  for (const p of pf.pending) {
    console.log(`\n[${p.id}] ${p.provider} ${p.account} ${bj(p.announcedAt)} (来源:${p.via})`);
    console.log("  原文: " + p.textEn.replace(/\n+/g, " ").slice(0, 300));
    if (p.zhDraft) console.log("  草稿: " + p.zhDraft);
  }
  console.log(`\n共 ${pf.pending.length} 条。确认：node scripts/review.mjs approve <id> --kind reset --zh "..." --scope "..."`);
} else if (cmd === "show") {
  const p = pf.pending.find((x) => x.id === id) || ef.events.find((x) => x.id === id);
  console.log(JSON.stringify(p, null, 2));
} else if (cmd === "approve") {
  const i = pf.pending.findIndex((x) => x.id === id);
  if (i < 0) throw new Error("pending 里没有 " + id);
  if (!KINDS[opt.kind]) throw new Error("--kind 必须是 " + Object.keys(KINDS).join("|"));
  if (!opt.zh) throw new Error("--zh 必填（一句中文）");
  const p = pf.pending[i];
  const ev = { id: p.id, provider: opt.provider || p.provider, kind: opt.kind, announcedAt: p.announcedAt, account: p.account, sourceUrl: p.sourceUrl, extraLinks: opt.links ? String(opt.links).split(",").map((x) => x.trim()).filter(Boolean) : [],
    zh: opt.zh, detail: opt.detail || "", scope: opt.scope || "未明确", textEn: p.textEn, verified: true, verifiedBy: "人工核实 + 原帖", verifiedAt: today, confidence: "high" };
  ef.events.push(ev);
  ef.events.sort((a, b) => (a.announcedAt < b.announcedAt ? 1 : -1));
  ef.updatedAt = new Date().toISOString();
  pf.pending.splice(i, 1);
  if (opt.merge) for (const mid of String(opt.merge).split(",")) { const j = pf.pending.findIndex((x) => x.id === mid.trim()); if (j >= 0) { rf.rejected.push({ id: mid.trim(), why: "并入 " + id, at: today }); pf.pending.splice(j, 1); } }
  writeJson("events.json", ef); writeJson("pending.json", pf); writeJson("rejected.json", rf);
  console.log(`已收录 ${id}：${ev.zh}\n下一步：node scripts/build.mjs && vercel --prod`);
} else if (cmd === "reject") {
  const i = pf.pending.findIndex((x) => x.id === id);
  if (i < 0) throw new Error("pending 里没有 " + id);
  rf.rejected.push({ id, why: opt.why || "", at: today });
  pf.pending.splice(i, 1);
  writeJson("rejected.json", rf); writeJson("pending.json", pf);
  console.log("已忽略 " + id);
} else if (cmd === "edit") {
  const e = ef.events.find((x) => x.id === id);
  if (!e) throw new Error("events 里没有 " + id);
  for (const k of ["zh", "detail", "scope", "kind", "provider", "confidence"]) if (opt[k]) e[k] = opt[k];
  e.verifiedAt = today; ef.updatedAt = new Date().toISOString();
  writeJson("events.json", ef);
  console.log("已更新 " + id);
} else { console.log("未知命令，见文件头注释"); }
