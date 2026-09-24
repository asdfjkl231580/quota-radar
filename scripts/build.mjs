/**
 * build.mjs — 由 data/events.json 生成静态站到 dist/
 * 页面：/ /codex /claude /faq /q/<slug> /api/events.json /rss.xml /sitemap.xml /robots.txt
 */
import fs from "node:fs";
import path from "node:path";
import { ROOT, readJson, KINDS, PROVIDERS, bj, relative, daysAgo } from "./lib.mjs";

const DIST = path.join(ROOT, "dist");
const site = readJson("site.json");
const { events, updatedAt } = readJson("events.json");
const NOW = Date.now();
const BUILT = new Date().toISOString();
const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });
const out = (rel, content) => { const f = path.join(DIST, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, content); };

// ───────── 常见问题（唯一内容源，同时生成 /faq 与 /q/<slug>）─────────
const FAQ = [
  { slug: "codex-shenme-shihou-chongzhi", q: "Codex 什么时候重置？", a: `
<p>分两件事，别混在一起：</p>
<p><b>你自己的额度窗口。</b>官方按 5 小时窗口给用量估计，周限额也可能适用。每个账户的恢复时间都不一样，没有「每天几点」「每周一」这种统一时钟。看你自己的：打开 <a href="https://chatgpt.com/codex/settings/usage" target="_blank" rel="noopener">Codex 官方用量页</a>，或在 Codex CLI 里输入 <code>/status</code>。</p>
<p><b>官方送的额度。</b>OpenAI 不定期给所有付费用户「全员重置」或发「重置卡」，只在 X 上宣布，事先不预告。本站时间线记录每一次，「下次」永远写「尚未公布」，因为官方确实没公布过。</p>` },
  { slug: "claude-edu-shenme-shihou-huifu", q: "Claude 额度什么时候恢复？", a: `
<p>Claude 订阅（含 Claude Code）有 5 小时会话窗和周限额两个桶，各自计数。5 小时窗从你开始用起滚动，周限额到你账户自己的周窗口时间恢复。</p>
<p>看自己的：在 Claude Code 里输入 <code>/usage</code>，或到 claude.ai 设置里的用量页。</p>
<p>官方偶尔会给所有人重置 5 小时窗和周限额，一般绑着新模型发布或事故修复，只在 X 的 @ClaudeDevs 宣布。本站 <a href="/claude">Claude 页</a> 有完整记录。</p>` },
  { slug: "chongzhi-ka-shi-shenme", q: "「重置卡」和「直接重置」有什么区别？", a: `
<p><b>直接重置（全员重置）</b>：官方按下按钮，你的额度立刻回到 100%，不用做任何事。</p>
<p><b>重置卡（banked reset）</b>：官方往你账户里存一张卡，不会自动生效。你在 Codex 桌面端、网页或手机端自己点「使用重置」，什么时候快用完了什么时候点。Claude 侧叫「a reset to use anytime」，是同一个意思。</p>
<p>这就是两个英文同类站「距上次重置」能差十天的原因：一家把发卡算进去，一家不算。本站分开标，绿色是直接重置，橙色是重置卡。</p>
<p>卡的有效期以当次公告为准。OpenAI 2026 年 6 月的邀请活动写明 30 天，别的活动没写就别假设。</p>` },
  { slug: "5-xiaoshi-chuang-he-zhou-edu", q: "5 小时窗和周额度是什么关系？", a: `
<p>两个独立的桶。5 小时窗管短时间内用多猛，周额度管一周总量。碰到任一个上限都要等。</p>
<p>官方送的「全员重置」通常两个桶一起清：Claude 公告一般写「5-hour and weekly」，Codex 公告写「100% weekly and 100% hourly」。「重置卡」用掉时恢复的是周额度。</p>
<p>每条消息消耗多少，跟模型、任务大小、上下文长度、工具调用都有关，官方文档明确说不能按条数反推百分比。</p>` },
  { slug: "zenme-kan-shengyu-edu", q: "怎么看自己还剩多少额度？", a: `
<p><b>Codex</b>：<a href="https://chatgpt.com/codex/settings/usage" target="_blank" rel="noopener">官方用量页</a>，或 CLI 里 <code>/status</code>。</p>
<p><b>Claude</b>：Claude Code 里 <code>/usage</code>，或 claude.ai 设置里的用量页。</p>
<p>本站读不到你的账户，任何网页都读不到。要是有网站说「登录就能看你的额度」，要么让你交 API Key，要么在猜。</p>` },
  { slug: "shuju-cong-nali-lai", q: "这个站的数据从哪来？靠谱吗？", a: `
<p>只收录官方账号在 X 上的原帖：OpenAI Codex 负责人 @thsottiaux、@OpenAIDevs、@ClaudeDevs、@lydiahallie。每条都人工核对原帖后才上线，标注了适用套餐和核验日期，每条都能点回原帖。</p>
<p>X 在国内打不开，官方又只在那里发，所以做了这个中文转播。本站不做「下次重置概率」，历史间隔不能预测运营决定。</p>
<p>数据也开放：<a href="/api/events.json">JSON</a>、<a href="/rss.xml">RSS</a>。</p>` },
];

// ───────── 样式（零件字典：5 字号 / 3 圆角 / 8 网格）─────────
const CSS = `
:root{--bg:#F6F5F2;--card:#FFFFFF;--ink:#17171A;--muted:#6B6E76;--line:#E6E4DE;--codex:#2563EB;--claude:#D97757;
--reset:#15803D;--reset-bg:#E7F5EC;--banked:#B45309;--banked-bg:#FDF1E0;--boost:#1D4ED8;--boost-bg:#E8EEFC;
--fs-xs:12px;--fs-s:14px;--fs-m:16px;--fs-l:20px;--fs-xl:30px;--r-s:6px;--r-m:10px;--r-l:16px;--g:8px}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;overflow-x:hidden;overflow-wrap:anywhere;background:var(--bg);color:var(--ink);font:var(--fs-m)/1.6 -apple-system,BlinkMacSystemFont,"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif}
a{color:inherit}code{font:0.92em ui-monospace,Menlo,monospace;background:#EFEDE8;padding:1px 5px;border-radius:var(--r-s)}
.wrap{max-width:760px;margin:0 auto;padding:0 16px;min-width:0}
header.top{padding:calc(var(--g)*3) 0 calc(var(--g)*2)}
.brand{display:flex;align-items:baseline;gap:var(--g);flex-wrap:wrap}
.brand h1{margin:0;font-size:var(--fs-l);letter-spacing:.02em}.brand h1 a{text-decoration:none}
.brand .tag{color:var(--muted);font-size:var(--fs-s)}
nav.main{display:flex;gap:calc(var(--g)*2);margin-top:calc(var(--g)*2);font-size:var(--fs-s);overflow-x:auto}
nav.main a{text-decoration:none;color:var(--muted);padding:4px 0;border-bottom:2px solid transparent;white-space:nowrap}
nav.main a.on{color:var(--ink);border-color:var(--ink)}
h2{font-size:var(--fs-l);margin:calc(var(--g)*4) 0 calc(var(--g)*2)}
.cards{display:grid;grid-template-columns:minmax(0,1fr);gap:calc(var(--g)*2)}
@media(min-width:640px){.cards{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}}
.card{min-width:0;background:var(--card);border:1px solid var(--line);border-radius:var(--r-l);padding:calc(var(--g)*2.5);position:relative;overflow:hidden}
.card::before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--pc)}
.card .who{display:flex;justify-content:space-between;align-items:center;font-size:var(--fs-s);color:var(--muted)}
.card .who b{color:var(--pc);font-size:var(--fs-m)}
.card .big{font-size:var(--fs-xl);font-weight:700;line-height:1.2;margin:var(--g) 0 2px;letter-spacing:-.01em}
.card .when{font-size:var(--fs-s);color:var(--muted)}
.card .what{margin:calc(var(--g)*1.5) 0 var(--g);font-size:var(--fs-m)}
.card .meta{font-size:var(--fs-s);color:var(--muted);display:flex;gap:var(--g);flex-wrap:wrap}
.card .next{margin-top:calc(var(--g)*1.5);padding-top:var(--g);border-top:1px dashed var(--line);font-size:var(--fs-s);color:var(--muted)}
.badge{display:inline-block;font-size:var(--fs-xs);font-weight:600;padding:2px 8px;border-radius:999px;line-height:1.6;vertical-align:middle}
.badge.reset{color:var(--reset);background:var(--reset-bg)}.badge.banked{color:var(--banked);background:var(--banked-bg)}.badge.boost{color:var(--boost);background:var(--boost-bg)}
.badge.low{color:var(--muted);background:#EFEDE8;font-weight:500}
.filters{display:flex;gap:var(--g);margin:0 0 calc(var(--g)*2);font-size:var(--fs-s)}
.filters button{border:1px solid var(--line);background:var(--card);border-radius:999px;padding:4px 12px;font:inherit;font-size:var(--fs-s);cursor:pointer;color:var(--muted)}
.filters button.on{background:var(--ink);color:#fff;border-color:var(--ink)}
.tl{list-style:none;margin:0;padding:0;border-left:2px solid var(--line);margin-left:6px}
.tl li{min-width:0;position:relative;padding:0 0 calc(var(--g)*2.5) calc(var(--g)*2.5)}
.tl li::before{content:"";position:absolute;left:-7px;top:9px;width:12px;height:12px;border-radius:50%;background:var(--pc);border:2px solid var(--bg)}
.tl .d{font-size:var(--fs-s);color:var(--muted);display:flex;gap:var(--g);flex-wrap:wrap;align-items:center}
.tl .d .p{color:var(--pc);font-weight:600}
.tl .t{margin:2px 0;font-size:var(--fs-m);font-weight:600}
.tl .s{font-size:var(--fs-s);color:var(--muted)}
.tl details{margin-top:4px;font-size:var(--fs-s)}.tl summary{cursor:pointer;color:var(--muted)}
.tl blockquote{margin:var(--g) 0 0;padding:var(--g) calc(var(--g)*1.5);background:#F1EFEA;border-radius:var(--r-m);white-space:pre-wrap;color:#3C3C43;font-size:var(--fs-s)}
.tl li.hid{display:none}
.more{width:100%;margin:var(--g) 0;padding:calc(var(--g)*1.5);border:1px dashed var(--line);background:transparent;border-radius:var(--r-m);font:inherit;font-size:var(--fs-s);color:var(--muted);cursor:pointer}
.faq details{background:var(--card);border:1px solid var(--line);border-radius:var(--r-m);padding:calc(var(--g)*1.5) calc(var(--g)*2);margin-bottom:var(--g)}
.faq summary{font-weight:600;cursor:pointer}.faq details p{margin:var(--g) 0;font-size:var(--fs-s)}
.faq .perma{font-size:var(--fs-xs)}
article.q{background:var(--card);border:1px solid var(--line);border-radius:var(--r-l);padding:calc(var(--g)*3)}
article.q h1{font-size:var(--fs-l);margin:0 0 var(--g)}article.q p{font-size:var(--fs-m)}
.follow{background:var(--ink);color:#fff;border-radius:var(--r-l);padding:calc(var(--g)*3);margin-top:calc(var(--g)*4);display:flex;gap:calc(var(--g)*2);align-items:center;flex-wrap:wrap}
.follow img{width:112px;height:112px;border-radius:var(--r-m);background:#fff}
.follow b{font-size:var(--fs-l);display:block}.follow p{margin:4px 0 0;color:#C9C9CF;font-size:var(--fs-s)}
.follow a{color:#fff}
.note{font-size:var(--fs-s);color:var(--muted);background:var(--card);border:1px solid var(--line);border-radius:var(--r-m);padding:calc(var(--g)*1.5) calc(var(--g)*2)}
footer{margin:calc(var(--g)*6) 0 calc(var(--g)*4);font-size:var(--fs-xs);color:var(--muted);line-height:1.8}
footer a{color:var(--muted)}
.rel{display:inline-block;min-width:1px}
`;

const JS = `
document.querySelectorAll('.filters button').forEach(b=>b.addEventListener('click',()=>{
  document.querySelectorAll('.filters button').forEach(x=>x.classList.remove('on'));b.classList.add('on');
  const f=b.dataset.f;document.querySelectorAll('.tl li').forEach(li=>{li.style.display=(f==='all'||li.dataset.p===f)?'':'none'});
}));
document.querySelectorAll('.more').forEach(b=>b.addEventListener('click',()=>{b.parentElement.querySelectorAll('li.hid').forEach(li=>li.classList.remove('hid'));b.remove();}));
`;

// ───────── 组件 ─────────
const badge = (e) => `<span class="badge ${e.kind}">${KINDS[e.kind].zh}</span>${e.confidence === "low" ? ' <span class="badge low">待补证</span>' : ""}`;
const pStyle = (p) => `style="--pc:${PROVIDERS[p].accent}"`;

function statusCard(p) {
  const list = events.filter((e) => e.provider === p);
  const last = list[0];
  const n30 = list.filter((e) => daysAgo(e.announcedAt, NOW) <= 30).length;
  const n90 = list.filter((e) => daysAgo(e.announcedAt, NOW) <= 90).length;
  const lastReset = list.find((e) => e.kind === "reset");
  return `<section class="card" ${pStyle(p)}>
  <div class="who"><b>${PROVIDERS[p].zh}</b><span>${esc(PROVIDERS[p].full)}</span></div>
  <div class="big">${relative(last.announcedAt, NOW)}</div>
  <div class="when">上次送额度 · ${bj(last.announcedAt)} 北京时间</div>
  <div class="what">${badge(last)} ${esc(last.zh)}</div>
  <div class="meta"><span>适用：${esc(last.scope)}</span><a href="${esc(last.sourceUrl)}" target="_blank" rel="noopener">原帖 ↗</a></div>
  <div class="next">官方下次：尚未公布 · 近 30 天 ${n30} 次，近 90 天 ${n90} 次${lastReset && lastReset !== last ? ` · 上次直接重置 ${bj(lastReset.announcedAt, "md")}` : ""}</div>
</section>`;
}

function timeline(list, { filters = false, initial = 30 } = {}) {
  const items = list.map((e, i) => `<li data-p="${e.provider}" class="${i >= initial ? "hid" : ""}" ${pStyle(e.provider)}>
  <div class="d"><span class="p">${PROVIDERS[e.provider].zh}</span><span>${bj(e.announcedAt)}</span>${badge(e)}</div>
  <div class="t">${esc(e.zh)}</div>
  <div class="s">适用：${esc(e.scope)}${e.detail ? " · " + esc(e.detail) : ""} · ${esc(e.account)} · <a href="${esc(e.sourceUrl)}" target="_blank" rel="noopener">原帖 ↗</a>${(e.extraLinks || []).map((u, k) => ` <a href="${esc(u)}" target="_blank" rel="noopener">原帖${k + 2} ↗</a>`).join("")}</div>
  <details><summary>英文原文</summary><blockquote>${esc(e.textEn)}</blockquote></details>
</li>`).join("\n");
  const f = filters ? `<div class="filters"><button class="on" data-f="all">全部</button><button data-f="codex">Codex</button><button data-f="claude">Claude</button></div>` : "";
  const more = list.length > initial ? `<button class="more">展开更早的 ${list.length - initial} 条</button>` : "";
  return `${f}<div><ul class="tl">${items}</ul>${more}</div>`;
}

function followBlock() {
  const f = site.follow;
  if (!f.enabled) return "";
  return `<section class="follow">${f.imagePath ? `<img src="${esc(f.imagePath)}" alt="">` : ""}<div><b>${esc(f.title)}</b><p>${esc(f.desc)}</p>${f.link ? `<p><a href="${esc(f.link)}">${esc(f.linkText || f.link)}</a></p>` : ""}</div></section>`;
}

function page({ title, desc, path: p, active, body, jsonld }) {
  const url = site.url.replace(/\/$/, "") + p;
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(url)}">
<link rel="alternate" type="application/rss+xml" title="${esc(site.name)}" href="/rss.xml">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${esc(url)}"><meta property="og:type" content="website">
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="14" fill="#17171A"/><circle cx="16" cy="16" r="5" fill="#15803D"/></svg>')}">
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>` : ""}
<style>${CSS}</style>
</head>
<body>
<div class="wrap">
<header class="top">
  <div class="brand"><h1><a href="/">${esc(site.name)}</a></h1><span class="tag">${esc(site.tagline)}</span></div>
  <nav class="main">${[["/", "首页"], ["/codex", "Codex"], ["/claude", "Claude"], ["/faq", "常见问题"]].map(([h, t]) => `<a href="${h}" class="${active === h ? "on" : ""}">${t}</a>`).join("")}</nav>
</header>
<main>
${body}
</main>
${followBlock()}
<footer>
只收录官方账号在 X 的原帖，逐条人工核对，标注适用套餐与核验日期。不预测下次重置。<br>
数据更新：${bj(updatedAt || BUILT)} 北京时间 · <a href="/api/events.json">JSON</a> · <a href="/rss.xml">RSS</a> · <a href="/faq#shuju-cong-nali-lai">数据说明</a>
</footer>
</div>
<script>${JS}</script>
</body>
</html>`;
}

// ───────── 页面 ─────────
const homeBody = `
<h2 style="margin-top:8px">现在的状态</h2>
<div class="cards">${statusCard("codex")}${statusCard("claude")}</div>
<h2>官方送额度记录</h2>
${timeline(events, { filters: true, initial: 30 })}
<h2>常见问题</h2>
<div class="faq">${FAQ.map((f) => `<details id="${f.slug}"><summary>${esc(f.q)}</summary>${f.a}<p class="perma"><a href="/q/${f.slug}">单独打开 ↗</a></p></details>`).join("")}</div>`;

out("index.html", page({ title: `Codex 什么时候重置？Claude 额度什么时候恢复？| ${site.name}`, desc: "中文转播 OpenAI Codex 与 Claude 官方在 X 上的送额度、全员重置、重置卡公告。每条附原帖、适用套餐、北京时间。不预测，只记录。", path: "/", active: "/", body: homeBody,
  jsonld: { "@context": "https://schema.org", "@type": "WebSite", name: site.name, url: site.url, inLanguage: "zh-CN", description: site.tagline } }));

for (const p of ["codex", "claude"]) {
  const list = events.filter((e) => e.provider === p);
  const body = `
<h2 style="margin-top:8px">${PROVIDERS[p].zh} 现在的状态</h2>
<div class="cards">${statusCard(p)}</div>
<p class="note" style="margin-top:16px">${p === "codex"
    ? "Codex 的送额度公告几乎全部来自 OpenAI Codex 负责人 @thsottiaux 的个人 X 账号。他不预告，通常绑着新模型发布、用户里程碑或事故修复。"
    : "Claude 的公告来自 @ClaudeDevs 官方账号，偶尔来自 Anthropic 员工。一般写明「5-hour and weekly」两个桶一起重置。"}</p>
<h2>${PROVIDERS[p].zh} 全部记录（${list.length} 条）</h2>
${timeline(list, { initial: 40 })}
<h2>相关问题</h2>
<div class="faq">${FAQ.filter((f) => f.slug.includes(p) || f.slug.startsWith("chongzhi") || f.slug.startsWith("zenme")).map((f) => `<details><summary>${esc(f.q)}</summary>${f.a}</details>`).join("")}</div>`;
  out(`${p}.html`, page({ title: p === "codex" ? `Codex 什么时候重置？官方送额度记录 | ${site.name}` : `Claude 额度什么时候恢复？官方重置记录 | ${site.name}`,
    desc: `${PROVIDERS[p].full} 官方全员重置、重置卡、提额公告的中文记录，附原帖与适用套餐。`, path: `/${p}`, active: `/${p}`, body }));
}

const faqLd = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a.replace(/<[^>]+>/g, "").trim() } })) };
out("faq.html", page({ title: `Codex / Claude 额度常见问题 | ${site.name}`, desc: "重置卡和直接重置的区别、5 小时窗和周额度、怎么看剩余额度。", path: "/faq", active: "/faq",
  body: `<h2 style="margin-top:8px">常见问题</h2><div class="faq">${FAQ.map((f) => `<details id="${f.slug}" open><summary>${esc(f.q)}</summary>${f.a}<p class="perma"><a href="/q/${f.slug}">单独打开 ↗</a></p></details>`).join("")}</div>`, jsonld: faqLd }));

for (const f of FAQ) {
  out(`q/${f.slug}.html`, page({ title: `${f.q} | ${site.name}`, desc: f.a.replace(/<[^>]+>/g, "").trim().slice(0, 120), path: `/q/${f.slug}`, active: "/faq",
    body: `<article class="q"><h1>${esc(f.q)}</h1>${f.a}</article><h2>最近的官方动态</h2>${timeline(events.slice(0, 5), { initial: 5 })}`,
    jsonld: { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: [{ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a.replace(/<[^>]+>/g, "").trim() } }] } }));
}

// ───────── 机器可读 ─────────
out("api/events.json", JSON.stringify({ site: site.name, url: site.url, updatedAt: updatedAt || BUILT, kinds: Object.fromEntries(Object.entries(KINDS).map(([k, v]) => [k, v.zh])),
  events: events.map(({ textEn, ...e }) => e) }, null, 1));
const base = site.url.replace(/\/$/, "");
out("rss.xml", `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${esc(site.name)}</title><link>${base}</link><description>${esc(site.tagline)}</description><language>zh-CN</language>
${events.slice(0, 50).map((e) => `<item><title>${esc(`[${PROVIDERS[e.provider].zh}·${KINDS[e.kind].zh}] ${e.zh}`)}</title><link>${esc(e.sourceUrl)}</link><guid isPermaLink="false">${e.id}</guid><pubDate>${new Date(e.announcedAt).toUTCString()}</pubDate><description>${esc(`适用：${e.scope}。${e.detail || ""} 原文：${e.textEn}`)}</description></item>`).join("\n")}
</channel></rss>`);
const urls = ["/", "/codex", "/claude", "/faq", ...FAQ.map((f) => `/q/${f.slug}`)];
out("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((u) => `<url><loc>${base}${u}</loc><lastmod>${BUILT.slice(0, 10)}</lastmod></url>`).join("")}</urlset>`);
out("robots.txt", `User-agent: *\nAllow: /\nSitemap: ${base}/sitemap.xml\n`);
if (fs.existsSync(path.join(ROOT, "site/assets"))) fs.cpSync(path.join(ROOT, "site/assets"), path.join(DIST, "assets"), { recursive: true });

console.log(`构建完成：${events.length} 条事件，${urls.length} 个页面 → dist/`);
