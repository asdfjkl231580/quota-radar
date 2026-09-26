// 网站回测：先机器把线上站能测的全测一遍，再生成本地回测页 docs/qa/网站回测.html
// 人工项在页面上逐项点「通过 / 有问题」写备注，最后一键复制结果发给 Claude
// 用法：node scripts/qa.mjs [--base https://airesetclock.com] [--no-open]
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { ROOT, readJson, fxTweet } from "./lib.mjs";

const args = process.argv.slice(2);
const BASE = (args.includes("--base") ? args[args.indexOf("--base") + 1] : "https://airesetclock.com").replace(/\/$/, "");
const HOST = new URL(BASE).host;
const results = []; // { group, name, status: pass|fail|warn, detail }
const add = (group, name, status, detail = "") => results.push({ group, name, status, detail });
const get = async (u, opt = {}) => { const r = await fetch(u.startsWith("http") ? u : BASE + u, { redirect: "manual", headers: { "User-Agent": "Mozilla/5.0 (qa-airesetclock)" }, ...opt }); return { status: r.status, loc: r.headers.get("location"), type: r.headers.get("content-type") || "", text: r.status < 300 ? await r.text() : "" }; };
const visible = (h) => h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/g, " ").replace(/\s+/g, " ");
const bjDate = (iso) => new Date(new Date(iso).getTime() + 8 * 3600000).toISOString().slice(0, 16).replace("T", " ");

const local = readJson("events.json", { events: [] }).events;
const watch = readJson("watch.json", { accounts: [] }).accounts.map((a) => a.screen_name.toLowerCase());

// ① 每个页面都能打开
const sm = await get("/sitemap.xml");
const urls = [...sm.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace("https://airesetclock.com", BASE));
add("页面能打开", "sitemap.xml 可读", urls.length ? "pass" : "fail", `列了 ${urls.length} 个页面`);
const pages = {};
const pageFails = [];
for (const u of urls) {
  const r = await get(u);
  pages[u] = r.text;
  const title = (r.text.match(/<title>([^<]*)<\/title>/) || [])[1] || "";
  const vis = visible(r.text);
  const probs = [];
  if (r.status !== 200) probs.push("状态 " + r.status);
  if (!title.trim()) probs.push("没有标题");
  if (/\bundefined\b|\bNaN\b|\[object Object\]|\$\{/.test(vis)) probs.push("页面出现 undefined/NaN 等残留");
  if (!/rel="canonical"/.test(r.text)) probs.push("缺 canonical");
  if (!/name="description"/.test(r.text)) probs.push("缺描述");
  if (/\/en(\/|$)/.test(new URL(u).pathname)) { const zh = (vis.match(/[一-龥]/g) || []).length; if (zh > 30) probs.push(`英文页夹了 ${zh} 个汉字`); }
  if (probs.length) pageFails.push(`${new URL(u).pathname}：${probs.join("、")}`);
}
add("页面能打开", `全部 ${urls.length} 个页面 200、有标题、无乱码残留、英文页无中文`, pageFails.length ? "fail" : "pass", pageFails.join("\n") || "全部正常");

// ② 跳转与 404
const checks302 = [
  ["www 跳主域", `https://www.${HOST}/timeline`, (r) => [301, 308].includes(r.status) && r.loc && r.loc.includes(`//${HOST}/timeline`)],
  [".html 后缀跳无后缀", "/timeline.html", (r) => [301, 308].includes(r.status) && /\/timeline$/.test(r.loc || "")],
  ["http 跳 https", `http://${HOST}/`, (r) => [301, 308].includes(r.status) && (r.loc || "").startsWith("https://")],
];
for (const [n, u, ok] of checks302) { try { const r = await get(u); add("跳转与 404", n, ok(r) ? "pass" : "fail", `状态 ${r.status} → ${r.loc || "无"}`); } catch (e) { add("跳转与 404", n, "fail", e.message); } }
{ const r = await fetch(BASE + "/qa-not-exist-" + Date.now()); const t = await r.text(); add("跳转与 404", "不存在的地址返回 404 页", r.status === 404 && /404/.test(t) ? "pass" : "fail", "状态 " + r.status); }
{ const r = await get("/baidu_verify_codeva-eFGMpxlaRO.html"); add("跳转与 404", "百度验证文件不被跳走", r.status === 200 ? "pass" : "fail", "状态 " + r.status); }

// ③ 数据和原帖一致
const live = JSON.parse((await get("/api/events.json")).text || "{}");
const liveEv = live.events || live;
add("数据准确", "线上 JSON 条数 = 仓库条数", Array.isArray(liveEv) && liveEv.length === local.length ? "pass" : "fail", `线上 ${liveEv.length ?? "读不到"} / 仓库 ${local.length}`);
const tl = pages[BASE + "/timeline"] || "";
const ids = new Set([...tl.matchAll(/id="e(\d+)"/g)].map((m) => m[1]));
const miss = local.filter((e) => !ids.has(e.id));
add("数据准确", "时间线页每条记录都在", miss.length ? "fail" : "pass", miss.length ? "缺：" + miss.map((e) => e.id).join(", ") : `${ids.size} 条都在`);
const home = pages[BASE + "/"] || "";
for (const p of ["codex", "claude"]) {   // 首页卡片三态：有预告时间→倒计时；已宣布没时间→已宣布多久；否则→距上次
  const at = (e) => e.effectiveAt || e.announcedAt;
  const last = local.filter((e) => e.provider === p && e.kind !== "teaser").sort((a, b) => at(b).localeCompare(at(a)))[0];
  const pend = local.find((e) => e.provider === p && e.pendingReset && e.announcedAt > last.announcedAt);
  const want = pend ? (pend.expectedAt ? `data-until="${pend.expectedAt}"` : `data-since="${pend.announcedAt}"`) : `data-since="${at(last)}"`;
  const mode = pend ? (pend.expectedAt ? `倒计时到官方预告时间 ${bjDate(pend.expectedAt)} 北京` : `已宣布、生效时间未公布（公告 ${bjDate(pend.announcedAt)} 北京）`) : `距上次 ${bjDate(at(last))} 北京 · ${last.kind}`;
  add("数据准确", `首页 ${p === "codex" ? "Codex" : "Claude"} 卡片状态正确`, home.includes(want) ? "pass" : "fail", `应为：${mode}`);
}
{
  const pend = local.filter((e) => e.pendingReset);
  const due = (e) => new Date(e.expectedAt).getTime() + (e.expectedPrecision === "day" ? 86400000 : 0);
  const stale = pend.filter((e) => e.expectedAt && Date.now() - due(e) > 30 * 60000);   // 没给时间的预告不自动转正，不算过期
  const old = pend.filter((e) => !e.expectedAt && Date.now() - new Date(e.announcedAt) > 86400000);
  if (old.length) add("数据准确", "已宣布超过 24 小时、官方仍未给时间也未确认的预告（要人工判断）", "warn", old.map((e) => `${bjDate(e.announcedAt)} ${e.account}：${e.zh}`).join("\n"));
  add("数据准确", "有预告时间的预告都按时转正了", stale.length ? "fail" : "pass", stale.length ? stale.map((e) => e.id).join(", ") : `挂着的预告 ${pend.length} 条`);
  const contra = local.filter((e) => e.kind !== "teaser" && /尚未确认|生效时间未公布|即将/.test(e.zh || ""));
  add("数据准确", "已记重置的条目，中文不再写「尚未确认 / 即将」", contra.length ? "fail" : "pass", contra.map((e) => `${e.id}：${e.zh}`).join("\n") || "无矛盾");
  const miss2 = local.filter((e) => !e.sourceUrl || !e.scope || !e.verifiedAt || !e.zh);
  add("数据准确", "每条都有原帖链接、适用范围、核验日期、中文", miss2.length ? "fail" : "pass", miss2.map((e) => e.id).join(", ") || "全部齐全");
  const auto = local.filter((e) => e.confidence === "auto");
  add("数据准确", "没有「待整理」（机器自动上、还没补中文）的条目", auto.length ? "warn" : "pass", auto.map((e) => `${e.id}：${e.textEn.slice(0, 60)}`).join("\n") || "无");
  const low = local.filter((e) => e.confidence === "low");
  add("数据准确", "低可信条目（页面标「待补证」）", low.length ? "warn" : "pass", low.map((e) => `${bjDate(e.announcedAt)} ${e.account}：${e.zh}`).join("\n"));
}
{ // 逐条对原帖
  const bad = [];
  for (const x of local) {
    const h = x.account.replace(/^@/, "");
    try {
      const t = await fxTweet(h, x.id);
      const probs = [];
      if (!watch.includes(h.toLowerCase())) probs.push("账号不在白名单");
      if ((t.author || "").toLowerCase() !== h.toLowerCase()) probs.push("作者不符 " + t.author);
      if (t.createdAt && Math.abs(new Date(t.createdAt) - new Date(x.announcedAt)) > 120000) probs.push("时间差超 2 分钟");
      const n = (s) => (s || "").replace(/[’‘]/g, "'").trim().slice(0, 60);
      if (x.textEn && n(x.textEn) !== n(t.text)) probs.push("原文不一致");
      if (probs.length) bad.push(`${x.id}：${probs.join("、")}`);
    } catch (e) { bad.push(`${x.id}：原帖取不到（${e.message}）`); }
    await new Promise((r) => setTimeout(r, 250));
  }
  add("数据准确", `全部 ${local.length} 条逐条回 X 原帖核对（作者 / 时间 / 原文）`, bad.length ? "fail" : "pass", bad.join("\n") || "全部一致");
}
{ // 文案与事实
  const faq = pages[BASE + "/faq"] || home;
  if (/每条都人工核对原帖后才上线|by a human before it goes live/.test(faq + (pages[BASE + "/en/faq"] || ""))) add("文案与事实", "FAQ「每条都人工核对后才上线」与现在的自动上线不符", "warn", "哨兵会先自动上线再补中文，这句需要改成实际流程");
  const n90 = (p) => local.filter((e) => e.provider === p && e.kind !== "teaser" && Date.now() - new Date(e.announcedAt) < 90 * 86400000).length;
  const m = visible(faq).match(/Codex 近 90 天记录了 (\d+) 次，Claude 近 90 天 (\d+) 次/);
  add("文案与事实", "FAQ「近 90 天次数」与数据一致", m && +m[1] === n90("codex") && +m[2] === n90("claude") ? "pass" : "fail", m ? `页面 ${m[1]}/${m[2]}，数据 ${n90("codex")}/${n90("claude")}` : "没找到这句");
}

// ③b 定时器：哨兵最近一次成功运行离现在多久（Vercel 每 10 分钟触发）
{
  const j = await (await fetch("https://api.github.com/repos/asdfjkl231580/quota-radar/actions/workflows/sentinel.yml/runs?per_page=10", { headers: { "User-Agent": "qa" } })).json();
  const ok = (j.workflow_runs || []).filter((r) => r.conclusion === "success");
  const last = ok[0]; const age = last ? (Date.now() - new Date(last.created_at)) / 60000 : Infinity;
  add("自动运行", "哨兵最近 20 分钟内成功跑过（电脑关机也照跑）", age <= 20 ? "pass" : "fail", last ? `上次 ${bjDate(last.created_at)} 北京，${Math.round(age)} 分钟前，触发方式 ${last.event === "workflow_dispatch" ? "Vercel 定时器/手动" : "GitHub 兜底定时"}` : "查不到运行记录");
  const r = await fetch(BASE + "/api/cron");
  add("自动运行", "Vercel 定时器接口在线且拒绝外人调用", r.status === 401 ? "pass" : "fail", "状态 " + r.status + (r.status === 500 ? "（缺 GH_DISPATCH_TOKEN）" : ""));
}

// ④ 资源和接口
{
  const srcs = new Set();
  for (const h of [home, pages[BASE + "/en"] || "", tl]) for (const m of h.matchAll(/(?:src|srcset|href)="(\/[^"#?]+\.(?:png|webp|jpg|svg|woff2|js|css|xml|json))"/g)) srcs.add(m[1]);
  const bad = [];
  for (const s of srcs) { const r = await fetch(BASE + s, { method: "HEAD" }); if (r.status !== 200) bad.push(`${s} → ${r.status}`); }
  add("资源和接口", `首页/英文页/时间线引用的 ${srcs.size} 个图片字体脚本都能加载`, bad.length ? "fail" : "pass", bad.join("\n") || "全部 200");
}
{ const r = await get("/rss.xml"); add("资源和接口", "RSS 可读", r.status === 200 && /<rss|<feed/.test(r.text) ? "pass" : "fail", "状态 " + r.status); }
{ const r = await fetch(BASE + "/api/feedback"); add("资源和接口", "留言接口在线（只测 GET=405，不真发）", r.status === 405 ? "pass" : "fail", "状态 " + r.status); }
{ const og = (home.match(/property="og:image" content="([^"]+)"/) || [])[1]; const r = og ? await fetch(og, { method: "HEAD" }) : null; add("资源和接口", "分享卡片图（og:image）能加载", r && r.status === 200 ? "pass" : "fail", og ? `${og} → ${r.status}` : "没有 og:image"); }
{ const t = Date.now(); await fetch(BASE + "/"); const ms = Date.now() - t; add("资源和接口", "首页响应时间（从这台 Mac 测）", ms < 1500 ? "pass" : "warn", ms + " 毫秒；国内手机要你实测"); }

// ⑤ 人工项：机器看不了的
const manual = [
  ["手机观感", "手机打开首页", "用手机流量（关 WiFi 和代理）打开 airesetclock.com", "3 秒内出来；标题、吉祥物、两张卡片不挤不溢出；没有横向滚动"],
  ["手机观感", "微信里打开", "把 airesetclock.com 发给自己的微信，在微信里点开", "能打开，不提示「非微信官方网页」拦截；样式和浏览器一致"],
  ["手机观感", "手机菜单", "手机首页点右上角汉堡菜单，逐个点 Codex / Claude / 常见问题 / EN", "菜单能开能关，每个都跳对页面"],
  ["首页", "天时分在走", "首页停 1 分钟以上", "两张卡片的「分」会加 1；数字不是 -- 或负数"],
  ["首页", "卡片状态对", "看两张卡片的大标题一行和数字，点「原帖 ↗」对照", "官方说了具体时间→「距官方预告的重置还有」倒计时；官方说要重置但没给时间→「官方已宣布重置，公告发出已过去」；都没有→「距上次送额度已过去」。时间和原帖一致"],
  ["首页", "时区切换", "点卡片里时间后面带下划线的「北京 ▾」，选「纽约」；再刷新页面", "底部弹出「已切换到 纽约」，时间闪一下变成纽约时间（天时分大数字不变，这是正常的：过去多久跟时区无关）；刷新后仍是纽约；改回北京"],
  ["首页", "最近记录", "看最近记录第一条，再点它", "第一条就是最新的官方动态（包括还没生效的「预告」）；点了跳到时间线页那一条"],
  ["首页", "常见问题折叠", "点首页每个常见问题", "能展开收起；「单独打开 ↗」能打开对应问题页"],
  ["时间线", "逐条看最近 10 条", "打开 /timeline，看最上面 10 条", "每条有类型标签、中文说明、适用范围、原帖卡片（头像能显示）；预告/待补证有标注"],
  ["时间线", "原帖卡片点得通", "随便点 3 条的原帖卡片", "打开 X 对应帖子（国内要翻墙才能看，链接对就算过）"],
  ["分享", "复制链接", "点右下「分享」→ 复制链接，粘贴到备忘录", "粘出来是 airesetclock.com 的地址"],
  ["分享", "生成快照图", "分享 → 生成图片（两种尺寸各试一次）→ 保存", "图片上有两张卡片的当前天数、数据截至时间、二维码；手机扫二维码能打开网站"],
  ["留言", "留言到飞书", "点「留言」，写「回测留言」+ 联系方式，发送", "页面提示发送成功；飞书运维群 1 分钟内收到这条"],
  ["英文版", "英文首页", "点顶栏 EN 打开 /en", "全英文、吉祥物是英文牌子；卡片数字和中文版一致"],
  ["英文版", "英文时间线与问题页", "在英文版点 Timeline 和任意一个 FAQ", "没有中文夹杂；时间按你电脑本地时区"],
  ["其他", "404 页", "打开 airesetclock.com/abc", "显示站内风格的 404 页，有回首页的链接"],
  ["其他", "关于页", "打开 /about", "内容对，没有错字和过时说法"],
  ["其他", "字体", "电脑和手机都看首页大标题和数字", "标题是斜黑体，数字是粗黑体，没有变回系统字体"],
];

// 生成 HTML
const now = new Date();
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const cnt = (s) => results.filter((r) => r.status === s).length;
const groups = [...new Set(results.map((r) => r.group))];
const mgroups = [...new Set(manual.map((m) => m[0]))];
const LBL = { pass: "通过", fail: "有问题", warn: "要注意" };
const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>airesetclock 网站回测</title>
<style>
:root{--bg:#F7F8FA;--paper:#fff;--ink:#111;--sub:#727272;--line:#E7E7E7;--blue:#1467F5;--yellow:#FFEA00;--ok:#12823B;--okbg:#E7F6EC;--bad:#C62828;--badbg:#FDECEC;--warn:#A85D00;--warnbg:#FFF4E0}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.6 -apple-system,"PingFang SC","Microsoft YaHei",sans-serif}
.wrap{max-width:980px;margin:0 auto;padding:28px 16px 80px;display:flex;flex-direction:column;gap:26px}
h1{margin:0;font-size:28px;font-weight:900}h1 mark{background:linear-gradient(transparent 58%,var(--yellow) 58%);color:inherit}
.meta{color:var(--sub);font-size:13px;margin-top:4px}
.sum{display:flex;flex-wrap:wrap;gap:10px}.sum div{flex:1 1 150px;background:var(--paper);border:1px solid var(--line);border-radius:10px;padding:10px 14px}
.sum b{display:block;font-size:26px;font-variant-numeric:tabular-nums}.sum span{font-size:12px;color:var(--sub)}
.p{color:var(--ok)}.f{color:var(--bad)}.w{color:var(--warn)}.b{color:var(--blue)}
h2{margin:0 0 4px;font-size:19px;font-weight:900}.hint{color:var(--sub);font-size:13px;margin:0 0 10px}
h3{margin:14px 0 6px;font-size:14px;color:var(--blue)}
table{width:100%;border-collapse:collapse;background:var(--paper);border:1px solid var(--line);border-radius:10px;overflow:hidden}
td,th{padding:10px 12px;border-top:1px solid var(--line);vertical-align:top;text-align:left;font-size:14px}th{background:#FAFBFC;font-size:12px;color:var(--sub);font-weight:600;border-top:0}
.chip{display:inline-block;font-size:12px;font-weight:700;padding:2px 9px;border-radius:999px;white-space:nowrap}
.chip.pass{background:var(--okbg);color:var(--ok)}.chip.fail{background:var(--badbg);color:var(--bad)}.chip.warn{background:var(--warnbg);color:var(--warn)}.chip.todo{background:#EEF1F5;color:var(--sub)}
pre{margin:4px 0 0;white-space:pre-wrap;font:12px/1.5 ui-monospace,Menlo,monospace;color:var(--sub);max-height:180px;overflow:auto}
tr.fail td:first-child{box-shadow:inset 3px 0 var(--bad)}tr.warn td:first-child{box-shadow:inset 3px 0 var(--warn)}
.steps{color:var(--sub);font-size:13px}.expect{font-size:13px}
.act{display:flex;gap:6px;flex-wrap:wrap}.act button{font:inherit;font-size:13px;padding:5px 12px;border-radius:8px;border:1.5px solid var(--ink);background:var(--paper);cursor:pointer}
.act button[aria-pressed=true].ok{background:var(--ok);border-color:var(--ok);color:#fff}.act button[aria-pressed=true].no{background:var(--bad);border-color:var(--bad);color:#fff}
textarea{width:100%;margin-top:6px;min-height:34px;font:inherit;font-size:13px;border:1px solid var(--line);border-radius:8px;padding:6px 8px;resize:vertical}
.bar{position:sticky;bottom:12px;display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap;background:var(--ink);color:#fff;border-radius:12px;padding:12px 16px}
.bar button{font:inherit;font-weight:800;background:var(--yellow);color:#111;border:0;border-radius:8px;padding:8px 16px;cursor:pointer}
.bar small{color:#bbb}
.scroll{overflow-x:auto}
a{color:var(--blue)}
button:focus-visible,textarea:focus-visible{outline:3px solid var(--blue);outline-offset:2px}
@media (max-width:640px){td,th{padding:8px}.hide-s{display:none}}
</style></head><body><div class="wrap">
<header><h1>airesetclock <mark>网站回测</mark></h1>
<div class="meta">机器检查时间 ${esc(bjDate(now.toISOString()))}（北京）· 测的是 ${esc(BASE)} · 重跑：<code>node scripts/qa.mjs</code></div></header>

<div class="sum">
<div><b class="p">${cnt("pass")}</b><span>机器检查通过</span></div>
<div><b class="f">${cnt("fail")}</b><span>机器检查有问题</span></div>
<div><b class="w">${cnt("warn")}</b><span>要注意</span></div>
<div><b class="b" id="mdone">0 / ${manual.length}</b><span>你已回测</span></div>
</div>

<section><h2>一、机器已经测完的</h2><p class="hint">红色和橙色是要修的，展开看细节。绿色不用你再测。</p>
${groups.map((g) => `<h3>${esc(g)}</h3><div class="scroll"><table><tr><th style="width:90px">结果</th><th>检查项</th></tr>${results.filter((r) => r.group === g).map((r) => `<tr class="${r.status}"><td><span class="chip ${r.status}">${LBL[r.status]}</span></td><td>${esc(r.name)}${r.detail ? `<pre>${esc(r.detail)}</pre>` : ""}</td></tr>`).join("")}</table></div>`).join("")}
</section>

<section><h2>二、要你亲手回测的</h2><p class="hint">机器看不了手机观感、微信、真点击。每项照「怎么测」做一遍，对照「应该看到」，点通过或有问题；有问题就写一句看到了什么。</p>
${mgroups.map((g) => `<h3>${esc(g)}</h3><div class="scroll"><table><tr><th style="width:36%">项目 / 怎么测</th><th>应该看到</th><th style="width:150px">结果</th></tr>${manual.map((m, i) => [m, i]).filter(([m]) => m[0] === g).map(([m, i]) => `<tr data-i="${i}"><td><b>${esc(m[1])}</b><div class="steps" style="margin-top:4px">怎么测：${esc(m[2])}</div></td><td class="expect">${esc(m[3])}<textarea id="n${i}" placeholder="有问题写这里：看到了什么"></textarea></td><td><div class="act"><button type="button" class="ok" aria-pressed="false">通过</button><button type="button" class="no" aria-pressed="false">有问题</button></div></td></tr>`).join("")}</table></div>`).join("")}
</section>

<div class="bar"><span>测完点右边按钮，把结果粘贴给 Claude <small id="copied"></small></span><button type="button" id="copy">复制回测结果</button></div>
</div>
<script>
const AUTO=${JSON.stringify(results.filter((r) => r.status !== "pass").map((r) => `[机器·${LBL[r.status]}] ${r.name}`))};
const M=${JSON.stringify(manual.map((m) => m[1]))};
const KEY="qr_qa_${now.getTime()}";
let st={};try{st=JSON.parse(localStorage.getItem(KEY)||"{}")}catch(e){}
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(st))}catch(e){}};
function paint(){let n=0;document.querySelectorAll("tr[data-i]").forEach(tr=>{const i=tr.dataset.i,v=(st[i]||{}).r;tr.querySelector(".ok").setAttribute("aria-pressed",v==="ok");tr.querySelector(".no").setAttribute("aria-pressed",v==="no");if(v)n++});document.getElementById("mdone").textContent=n+" / "+M.length}
document.querySelectorAll("tr[data-i]").forEach(tr=>{const i=tr.dataset.i,ta=tr.querySelector("textarea");st[i]=st[i]||{};ta.value=st[i].note||"";
tr.querySelector(".ok").onclick=()=>{st[i].r=st[i].r==="ok"?"":"ok";save();paint()};
tr.querySelector(".no").onclick=()=>{st[i].r=st[i].r==="no"?"":"no";save();paint();ta.focus()};
ta.oninput=()=>{st[i].note=ta.value;save()}});
document.getElementById("copy").onclick=async()=>{const L=["airesetclock 回测结果"].concat(AUTO);M.forEach((m,i)=>{const s=st[i]||{};L.push("["+(s.r==="ok"?"通过":s.r==="no"?"有问题":"未测")+"] "+m+(s.note?"：" + s.note:""))});const t=L.join("\\n");
try{await navigator.clipboard.writeText(t);document.getElementById("copied").textContent="已复制"}catch(e){prompt("手动复制：",t)}};
paint();
</script></body></html>`;

const out = path.join(ROOT, "docs/qa/网站回测.html");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log(`机器检查：通过 ${cnt("pass")} · 有问题 ${cnt("fail")} · 要注意 ${cnt("warn")}`);
for (const r of results.filter((r) => r.status !== "pass")) console.log(`[${LBL[r.status]}] ${r.name}\n   ${r.detail.replace(/\n/g, "\n   ")}`);
console.log("回测页：" + out);
if (!args.includes("--no-open")) try { execFileSync("open", [out]); } catch {}
