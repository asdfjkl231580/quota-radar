/**
 * build.mjs — 由 data/events.json 生成静态站到 dist/
 * 皮肤：2026-09-24 选定稿「波普风」（黄 / 蓝 / 黑，吉祥物雷达小人）
 * 页面：/ /timeline /codex /claude /faq /q/<slug> /api/events.json /rss.xml /sitemap.xml /robots.txt
 */
import fs from "node:fs";
import path from "node:path";
import { ROOT, readJson, KINDS, PROVIDERS, bj, daysAgo } from "./lib.mjs";

const DIST = path.join(ROOT, "dist");
const site = readJson("site.json");
const { events, updatedAt } = readJson("events.json");
const NOW = Date.now();
const BUILT = new Date().toISOString();
const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const count = (p, days) => events.filter((e) => e.provider === p && daysAgo(e.announcedAt, NOW) <= days).length;

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });
const out = (rel, content) => { const f = path.join(DIST, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, content); };

// ───────── 常见问题（唯一内容源）─────────
const FAQ = [
  { slug: "edu-xiaoxi-laiyuan-kekao-ma", q: "额度消息来源可靠吗？", home: true, a: `
<p>只收录官方账号在 X 上的原帖：OpenAI Codex 负责人 @thsottiaux、@OpenAIDevs、@ClaudeDevs、@lydiahallie。每条都人工核对原帖后才上线，标了适用套餐和核验日期，每条都能点回原帖。</p>
<p>X 在国内打不开，官方又只在那里发，所以做了这个中文转播。本站不做「下次重置概率」，历史间隔预测不了运营决定。</p>
<p>数据开放：<a href="/api/events.json">JSON</a>、<a href="/rss.xml">RSS</a>。</p>` },
  { slug: "yiban-duojiu-zai-song-edu", q: "一般多久会再送额度？", home: true, a: `
<p>没有规律，官方也从不预告。送额度通常跟三件事绑在一起：新模型发布、用户数里程碑、事故修复后的补偿。</p>
<p>只说历史事实：Codex 近 90 天记录了 ${count("codex", 90)} 次，Claude 近 90 天 ${count("claude", 90)} 次。这是过去，不是承诺。</p>
<p>与其猜，不如新模型发布那天来看一眼。</p>` },
  { slug: "suoyou-ren-dou-hui-shoudao-ma", q: "所有人都会收到吗？", home: true, a: `
<p>不一定，看每条记录里的「适用」。常见的几种范围：</p>
<p><b>全部付费套餐</b>：Plus / Pro / Business（Codex）或 Pro / Max / Team（Claude）都有，免费用户一般不在内。</p>
<p><b>只给受影响的人</b>：比如某次 bug 只影响 3% 用户，就只给这 3% 重置。</p>
<p><b>要自己点</b>：重置卡存进账户不会自动生效，得你自己在桌面端、网页或手机端点「使用重置」。</p>` },
  { slug: "ruhe-chakan-ziji-shifou-you-edu", q: "如何查看自己是否有额度？", home: true, a: `
<p><b>Codex</b>：<a href="https://chatgpt.com/codex/settings/usage" target="_blank" rel="noopener">官方用量页</a>能看到当前用量和是否有可用的重置卡；CLI 里输入 <code>/status</code>。</p>
<p><b>Claude</b>：Claude Code 里输入 <code>/usage</code>，或 claude.ai 设置里的用量页。</p>
<p>本站读不到你的账户，任何网页都读不到。要是有网站说「登录就能看你的额度」，要么让你交 API Key，要么在猜。</p>` },
  { slug: "chongzhi-ka-shi-shenme", q: "「重置卡」和「直接重置」有什么区别？", a: `
<p><b>直接重置（全员重置）</b>：官方按下按钮，你的额度立刻回到 100%，不用做任何事。</p>
<p><b>重置卡（banked reset）</b>：官方往你账户里存一张卡，不会自动生效。你在 Codex 桌面端、网页或手机端自己点「使用重置」，什么时候快用完了什么时候点。Claude 侧叫「a reset to use anytime」，是同一个意思。</p>
<p>这就是两个英文同类站「距上次重置」能差十天的原因：一家把发卡算进去，一家不算。本站分开标。</p>
<p>卡的有效期以当次公告为准。OpenAI 2026 年 6 月的邀请活动写明 30 天，别的活动没写就别假设。</p>` },
  { slug: "codex-shenme-shihou-chongzhi", q: "Codex 什么时候重置？", a: `
<p>分两件事，别混在一起：</p>
<p><b>你自己的额度窗口。</b>官方按 5 小时窗口给用量估计，周限额也可能适用。每个账户的恢复时间都不一样，没有「每天几点」「每周一」这种统一时钟。看你自己的：打开 <a href="https://chatgpt.com/codex/settings/usage" target="_blank" rel="noopener">Codex 官方用量页</a>，或在 Codex CLI 里输入 <code>/status</code>。</p>
<p><b>官方送的额度。</b>OpenAI 不定期给所有付费用户「全员重置」或发「重置卡」，只在 X 上宣布，事先不预告。本站时间线记录每一次，「下次」永远写「尚未公布」，因为官方确实没公布过。</p>` },
  { slug: "claude-edu-shenme-shihou-huifu", q: "Claude 额度什么时候恢复？", a: `
<p>Claude 订阅（含 Claude Code）有 5 小时会话窗和周限额两个桶，各自计数。5 小时窗从你开始用起滚动，周限额到你账户自己的周窗口时间恢复。</p>
<p>看自己的：在 Claude Code 里输入 <code>/usage</code>，或到 claude.ai 设置里的用量页。</p>
<p>官方偶尔会给所有人重置 5 小时窗和周限额，一般绑着新模型发布或事故修复，只在 X 的 @ClaudeDevs 宣布。本站 <a href="/claude">Claude 页</a> 有完整记录。</p>` },
  { slug: "5-xiaoshi-chuang-he-zhou-edu", q: "5 小时窗和周额度是什么关系？", a: `
<p>两个独立的桶。5 小时窗管短时间内用多猛，周额度管一周总量。碰到任一个上限都要等。</p>
<p>官方送的「全员重置」通常两个桶一起清：Claude 公告一般写「5-hour and weekly」，Codex 公告写「100% weekly and 100% hourly」。「重置卡」用掉时恢复的是周额度。</p>
<p>每条消息消耗多少，跟模型、任务大小、上下文长度、工具调用都有关，官方文档明确说不能按条数反推百分比。</p>` },
];

// ───────── 样式：波普风零件字典 ─────────
const CSS = `
:root{--blue:#2A5BFF;--blue-d:#1F47D6;--yellow:#FFE600;--ink:#111214;--paper:#FFFFFF;--panel:#F3F4F6;--muted:#6B6F76;--line:#E4E6EA;
--fs-xs:12px;--fs-s:14px;--fs-m:16px;--fs-l:20px;--fs-xl:28px;--fs-hero:40px;--fs-num:44px;--r-s:8px;--r-m:14px;--r-l:20px;--g:8px;
--heavy:"PingFang SC","Hiragino Sans GB","Noto Sans SC","Source Han Sans SC","Microsoft YaHei",-apple-system,sans-serif}
@media(min-width:760px){:root{--fs-hero:64px;--fs-num:56px}}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;overflow-x:hidden;overflow-wrap:anywhere;background:var(--paper);color:var(--ink);font:var(--fs-m)/1.6 -apple-system,BlinkMacSystemFont,"PingFang SC","Hiragino Sans GB","Noto Sans SC","Microsoft YaHei",sans-serif}
a{color:inherit}code{font:.92em ui-monospace,Menlo,monospace;background:var(--panel);padding:1px 6px;border-radius:6px}
.wrap{max-width:1040px;margin:0 auto;padding:0 16px;min-width:0;position:relative}
/* 顶栏 */
header.top{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:20px 0 8px;flex-wrap:wrap}
.brand{min-width:0}.brand h1{margin:0;font:900 22px/1.2 var(--heavy);letter-spacing:.01em}.brand h1 a{text-decoration:none}
.brand .tag{display:block;color:var(--muted);font-size:var(--fs-xs);margin-top:2px}
nav.main{display:flex;gap:4px;font-size:var(--fs-s);font-weight:600;overflow-x:auto;max-width:100%;-webkit-overflow-scrolling:touch}
nav.main a{text-decoration:none;padding:6px 14px;border-radius:999px;white-space:nowrap}
nav.main a.on{background:var(--blue);color:#fff}
/* 英雄区 */
.hero{position:relative;display:grid;grid-template-columns:1fr;gap:8px;padding:16px 16px 8px;margin:0 -16px;align-items:center;overflow:hidden;isolation:isolate}
@media(min-width:760px){.hero{grid-template-columns:1.2fr 1fr;padding:24px 16px 8px}}
.hero>*{position:relative;z-index:1}
.hero::before{content:"";position:absolute;right:-30px;top:10px;width:200px;height:90px;background:var(--yellow);transform:skew(-28deg);z-index:0;border-radius:6px}
.hero::after{content:"";position:absolute;right:-40px;top:0;width:160px;height:20px;background:var(--ink);transform:skew(-28deg);z-index:0;display:none}
@media(min-width:760px){.hero::before{right:60px;top:10px;width:380px;height:150px}.hero::after{display:block;right:-60px;top:6px;width:260px;height:26px}}
.hero h2{margin:0;font:900 var(--fs-hero)/1.08 var(--heavy);letter-spacing:-.01em}
.hero h2 .b{color:var(--blue);position:relative;display:inline-block;padding:0 4px}
.hero h2 .b::after{content:"";position:absolute;left:0;right:0;bottom:2px;height:.22em;background:var(--yellow);z-index:-1;transform:skew(-12deg)}
.hero .sub{margin:12px 0 0;color:var(--ink);font-size:var(--fs-s)}
.hero .art{justify-self:end;width:200px;max-width:58%;margin-top:0}
@media(min-width:760px){.hero .art{width:340px;max-width:100%;justify-self:center;margin-top:0}}
.hero .art img{width:100%;height:auto;display:block}
.hero .sticker{position:absolute;right:0;bottom:2px;font:800 var(--fs-s)/1.3 var(--heavy);transform:rotate(-8deg);background:linear-gradient(transparent 60%,var(--yellow) 60%);padding:0 4px;white-space:nowrap;z-index:2}
@media(min-width:760px){.hero .sticker{font-size:var(--fs-l);right:-36px;bottom:76px}}
/* 状态卡 */
.cards{display:grid;grid-template-columns:minmax(0,1fr);gap:12px;margin-top:12px}
@media(min-width:640px){.cards{grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px}}
.card{min-width:0;border-radius:var(--r-l);padding:18px 18px 14px;display:flex;flex-direction:column;gap:6px}
.card.codex{background:var(--blue);color:#fff}.card.claude{background:var(--yellow);color:var(--ink)}
.card .head{display:flex;align-items:center;gap:10px}
.card .ic{width:36px;height:36px;border-radius:50%;background:#fff;color:var(--blue);display:grid;place-items:center;font:900 18px/1 ui-monospace,Menlo,monospace;flex:none}
.card.claude .ic{background:var(--ink);color:var(--yellow);font-size:22px}
.card .name{font:900 var(--fs-l)/1.2 var(--heavy);flex:1}
.card .badge{background:#fff;color:var(--blue)}.card.claude .badge{background:var(--ink);color:var(--yellow)}
.card .lbl{font-size:var(--fs-s);opacity:.9}
.card .counter{font:900 var(--fs-num)/1 var(--heavy);letter-spacing:-.01em;display:flex;align-items:baseline;flex-wrap:wrap;gap:2px 4px;font-variant-numeric:tabular-nums}
.card .counter i{font:700 var(--fs-s)/1 var(--heavy);font-style:normal;margin-right:8px;opacity:.9}
.card .last{font-size:var(--fs-s);font-weight:600;margin-top:2px}
.card .date{font-size:var(--fs-xs);opacity:.85}
.card .foot{display:flex;justify-content:space-between;gap:8px;margin-top:8px;padding-top:10px;border-top:1px solid rgba(255,255,255,.35);font-size:var(--fs-s);font-weight:600}
.card.claude .foot{border-top-color:rgba(0,0,0,.18)}
.card .foot a{text-decoration:none;font-weight:800}
/* 标签 */
.badge{display:inline-block;font-size:var(--fs-xs);font-weight:700;padding:2px 10px;border-radius:999px;line-height:1.6;white-space:nowrap}
.badge.banked{background:var(--blue);color:#fff}.badge.boost{background:var(--yellow);color:var(--ink)}.badge.reset{background:#E4E6EA;color:var(--ink)}
.badge.low{background:transparent;color:var(--muted);border:1px dashed var(--line);font-weight:500}
/* 面板 */
.panels{display:grid;grid-template-columns:minmax(0,1fr);gap:12px;margin-top:16px}
@media(min-width:760px){.panels{grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px}}
.panel{background:var(--panel);border-radius:var(--r-l);padding:14px}
.panel .ph{display:flex;align-items:center;gap:8px;font:800 var(--fs-m)/1.3 var(--heavy);margin-bottom:8px}
.panel .ph svg{width:18px;height:18px}.panel .ph .more{margin-left:auto;font-size:var(--fs-xs);font-weight:600;color:var(--muted);text-decoration:none}
.rows{background:#fff;border-radius:var(--r-m);overflow:hidden}
.row{display:grid;grid-template-columns:auto auto 1fr auto;gap:10px;align-items:center;padding:10px 12px;border-bottom:1px solid var(--line);font-size:var(--fs-s);text-decoration:none}
.row:last-child{border-bottom:0}
.row .d{color:var(--muted);font-variant-numeric:tabular-nums;white-space:nowrap}.row .p{font-weight:700;white-space:nowrap}
.row .z{color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.qrow{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:11px 12px;border-bottom:1px solid var(--line);font-size:var(--fs-s);text-decoration:none;font-weight:500}
.qrow:last-child{border-bottom:0}.qrow svg{width:16px;height:16px;flex:none;color:var(--muted)}
/* 章节标题 */
h2.sec{font:900 var(--fs-xl)/1.2 var(--heavy);margin:28px 0 12px}
h2.sec small{font-size:var(--fs-s);font-weight:600;color:var(--muted);margin-left:8px}
.note{font-size:var(--fs-s);color:var(--muted);background:var(--panel);border-radius:var(--r-m);padding:12px 14px;margin-top:12px}
/* 时间线 */
.filters{display:flex;gap:6px;margin:0 0 12px;font-size:var(--fs-s)}
.filters button{border:0;background:var(--panel);border-radius:999px;padding:6px 14px;font:inherit;font-size:var(--fs-s);font-weight:600;cursor:pointer;color:var(--ink)}
.filters button.on{background:var(--ink);color:#fff}
.tl{list-style:none;margin:0;padding:0;display:grid;gap:10px}
.tl li{min-width:0;background:var(--panel);border-radius:var(--r-m);padding:12px 14px}
.tl li.hid{display:none}
.tl .d{font-size:var(--fs-xs);color:var(--muted);display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.tl .d .p{font-weight:800;color:var(--ink);font-size:var(--fs-s)}.tl .d .p.codex{color:var(--blue)}.tl .d .p.claude{color:#9A7B00}
.tl .t{margin:4px 0 2px;font:700 var(--fs-m)/1.45 var(--heavy)}
.tl .s{font-size:var(--fs-xs);color:var(--muted)}.tl .s a{font-weight:700;color:var(--ink);text-decoration:none}
.tl details{margin-top:4px;font-size:var(--fs-xs)}.tl summary{cursor:pointer;color:var(--muted)}
.tl blockquote{margin:6px 0 0;padding:8px 10px;background:#fff;border-radius:var(--r-s);white-space:pre-wrap;color:#3C3C43;font-size:var(--fs-xs)}
.more-btn{width:100%;margin:10px 0;padding:12px;border:2px dashed var(--line);background:transparent;border-radius:var(--r-m);font:inherit;font-size:var(--fs-s);font-weight:600;color:var(--muted);cursor:pointer}
/* 问答 */
.faq details{background:var(--panel);border-radius:var(--r-m);padding:12px 16px;margin-bottom:8px}
.faq summary{font:700 var(--fs-m)/1.4 var(--heavy);cursor:pointer}.faq details p{margin:8px 0;font-size:var(--fs-s)}
.faq .perma{font-size:var(--fs-xs)}
article.q{background:var(--panel);border-radius:var(--r-l);padding:20px}
article.q h1{font:900 var(--fs-xl)/1.25 var(--heavy);margin:0 0 8px}article.q p{font-size:var(--fs-m)}
/* 关注入口 */
.follow{background:var(--ink);color:#fff;border-radius:var(--r-l);padding:20px;margin-top:24px;display:flex;gap:16px;align-items:center;flex-wrap:wrap}
.follow img{width:112px;height:112px;border-radius:var(--r-m);background:#fff}
.follow b{font:900 var(--fs-l)/1.3 var(--heavy);display:block}.follow p{margin:4px 0 0;color:#C9C9CF;font-size:var(--fs-s)}.follow a{color:var(--yellow)}
footer{margin:36px 0 28px;font-size:var(--fs-xs);color:var(--muted);text-align:center;line-height:1.9}
footer a{color:var(--muted)}
`;

const JS = `
(function(){
  function pad(n){return (n<10?'0':'')+n}
  function tick(){document.querySelectorAll('.counter[data-since]').forEach(function(el){
    var ms=Date.now()-new Date(el.dataset.since).getTime(); if(ms<0)ms=0;
    var d=Math.floor(ms/86400000), h=Math.floor(ms%86400000/3600000), m=Math.floor(ms%3600000/60000);
    el.innerHTML='<span>'+pad(d)+'</span><i>天</i><span>'+pad(h)+'</span><i>时</i><span>'+pad(m)+'</span><i>分</i>';
  })}
  tick(); setInterval(tick,30000);
  document.querySelectorAll('.filters button').forEach(function(b){b.addEventListener('click',function(){
    document.querySelectorAll('.filters button').forEach(function(x){x.classList.remove('on')});b.classList.add('on');
    var f=b.dataset.f;document.querySelectorAll('.tl li').forEach(function(li){li.style.display=(f==='all'||li.dataset.p===f)?'':'none'});
  })});
  document.querySelectorAll('.more-btn').forEach(function(b){b.addEventListener('click',function(){b.parentElement.querySelectorAll('li.hid').forEach(function(li){li.classList.remove('hid')});b.remove();})});
})();
`;

// ───────── 组件 ─────────
const badge = (e) => `<span class="badge ${e.kind}">${KINDS[e.kind].zh}</span>${e.confidence === "low" ? ' <span class="badge low">待补证</span>' : ""}`;
const ICON = { codex: "&gt;_", claude: "✳" };
const SVG_CLOCK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`;
const SVG_Q = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7"/><circle cx="12" cy="17" r=".6" fill="currentColor"/></svg>`;
const SVG_CHEV = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M9 6l6 6-6 6"/></svg>`;

function statusCard(p) {
  const last = events.find((e) => e.provider === p);
  return `<section class="card ${p}">
  <div class="head"><span class="ic">${ICON[p]}</span><span class="name">${PROVIDERS[p].zh}</span>${badge(last)}</div>
  <div class="lbl">距上次送额度已过去</div>
  <div class="counter" data-since="${last.announcedAt}"><span>--</span><i>天</i><span>--</span><i>时</i><span>--</span><i>分</i></div>
  <div class="last">${esc(last.zh)}</div>
  <div class="date">${bj(last.announcedAt)} 北京时间 · 适用：${esc(last.scope)}</div>
  <div class="foot"><span>官方下次：尚未公布</span><a href="${esc(last.sourceUrl)}" target="_blank" rel="noopener">原帖 ↗</a></div>
</section>`;
}

function recentPanel(n = 6) {
  return `<section class="panel"><div class="ph">${SVG_CLOCK}最近记录<a class="more" href="/timeline">查看全部 →</a></div>
<div class="rows">${events.slice(0, n).map((e) => `<a class="row" href="/timeline#e${e.id}"><span class="d">${bj(e.announcedAt, "md")}</span><span class="p">${PROVIDERS[e.provider].zh}</span><span class="z">${esc(e.zh)}</span>${badge(e)}</a>`).join("")}</div></section>`;
}
function faqPanel() {
  return `<section class="panel"><div class="ph">${SVG_Q}常见问题<a class="more" href="/faq">全部 →</a></div>
<div class="rows">${FAQ.filter((f) => f.home).map((f) => `<a class="qrow" href="/q/${f.slug}"><span>${esc(f.q)}</span>${SVG_CHEV}</a>`).join("")}</div></section>`;
}

function timeline(list, { filters = false, initial = 30 } = {}) {
  const items = list.map((e, i) => `<li id="e${e.id}" data-p="${e.provider}" class="${i >= initial ? "hid" : ""}">
  <div class="d"><span class="p ${e.provider}">${PROVIDERS[e.provider].zh}</span><span>${bj(e.announcedAt)}</span>${badge(e)}</div>
  <div class="t">${esc(e.zh)}</div>
  <div class="s">适用：${esc(e.scope)}${e.detail ? " · " + esc(e.detail) : ""} · ${esc(e.account)} · <a href="${esc(e.sourceUrl)}" target="_blank" rel="noopener">原帖 ↗</a>${(e.extraLinks || []).map((u, k) => ` <a href="${esc(u)}" target="_blank" rel="noopener">原帖${k + 2} ↗</a>`).join("")}</div>
  <details><summary>英文原文</summary><blockquote>${esc(e.textEn)}</blockquote></details>
</li>`).join("\n");
  const f = filters ? `<div class="filters"><button class="on" data-f="all">全部</button><button data-f="codex">Codex</button><button data-f="claude">Claude</button></div>` : "";
  const more = list.length > initial ? `<button class="more-btn">展开更早的 ${list.length - initial} 条</button>` : "";
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
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${esc(url)}"><meta property="og:type" content="website"><meta property="og:image" content="${esc(site.url)}/assets/mascot.png">
<meta name="theme-color" content="#FFE600">
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#FFE600"/><circle cx="16" cy="16" r="7" fill="#2A5BFF"/><circle cx="16" cy="16" r="2.5" fill="#fff"/></svg>')}">
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
只收录官方消息 · 不预测下次<br>
数据更新：${bj(updatedAt || BUILT)} 北京时间 · <a href="/api/events.json">JSON</a> · <a href="/rss.xml">RSS</a> · <a href="/q/edu-xiaoxi-laiyuan-kekao-ma">数据说明</a>
</footer>
</div>
<script>${JS}</script>
</body>
</html>`;
}

// ───────── 页面 ─────────
const hero = `<section class="hero">
  <div><h2>AI 额度动态<br><span class="b">一眼看清</span></h2><p class="sub">${esc(site.tagline)}</p></div>
  <div class="art"><img src="/assets/mascot.png" alt="额度雷达吉祥物" width="280" height="270"><span class="sticker">好消息，马上通知！</span></div>
</section>`;

out("index.html", page({ title: `Codex 什么时候重置？Claude 额度什么时候恢复？| ${site.name}`, desc: "中文转播 OpenAI Codex 与 Claude 官方在 X 上的送额度、全员重置、重置卡公告。每条附原帖、适用套餐、北京时间。不预测，只记录。", path: "/", active: "/",
  body: `${hero}<div class="cards">${statusCard("codex")}${statusCard("claude")}</div><div class="panels">${recentPanel(6)}${faqPanel()}</div>`,
  jsonld: { "@context": "https://schema.org", "@type": "WebSite", name: site.name, url: site.url, inLanguage: "zh-CN", description: site.tagline } }));

out("timeline.html", page({ title: `官方送额度记录（全部 ${events.length} 条）| ${site.name}`, desc: "Codex 与 Claude 官方每一次全员重置、重置卡、提额公告，附原帖与适用套餐。", path: "/timeline", active: "/",
  body: `<h2 class="sec" style="margin-top:12px">官方送额度记录<small>${events.length} 条</small></h2>${timeline(events, { filters: true, initial: 30 })}` }));

for (const p of ["codex", "claude"]) {
  const list = events.filter((e) => e.provider === p);
  const body = `
<h2 class="sec" style="margin-top:12px">${PROVIDERS[p].zh} 现在的状态</h2>
<div class="cards">${statusCard(p)}</div>
<p class="note">${p === "codex"
    ? "Codex 的送额度公告几乎全部来自 OpenAI Codex 负责人 @thsottiaux 的个人 X 账号。他不预告，通常绑着新模型发布、用户里程碑或事故修复。"
    : "Claude 的公告来自 @ClaudeDevs 官方账号，偶尔来自 Anthropic 员工。一般写明「5-hour and weekly」两个桶一起重置。"}</p>
<h2 class="sec">${PROVIDERS[p].zh} 全部记录<small>${list.length} 条</small></h2>
${timeline(list, { initial: 40 })}
<h2 class="sec">相关问题</h2>
<div class="faq">${FAQ.filter((f) => f.slug.includes(p) || f.slug.startsWith("chongzhi") || f.slug.startsWith("ruhe")).map((f) => `<details><summary>${esc(f.q)}</summary>${f.a}</details>`).join("")}</div>`;
  out(`${p}.html`, page({ title: p === "codex" ? `Codex 什么时候重置？官方送额度记录 | ${site.name}` : `Claude 额度什么时候恢复？官方重置记录 | ${site.name}`,
    desc: `${PROVIDERS[p].full} 官方全员重置、重置卡、提额公告的中文记录，附原帖与适用套餐。`, path: `/${p}`, active: `/${p}`, body }));
}

const plain = (html) => html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
const faqLd = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: plain(f.a) } })) };
out("faq.html", page({ title: `Codex / Claude 额度常见问题 | ${site.name}`, desc: "额度消息来源、多久送一次、谁能收到、重置卡和直接重置的区别、怎么看剩余额度。", path: "/faq", active: "/faq",
  body: `<h2 class="sec" style="margin-top:12px">常见问题</h2><div class="faq">${FAQ.map((f) => `<details id="${f.slug}" open><summary>${esc(f.q)}</summary>${f.a}<p class="perma"><a href="/q/${f.slug}">单独打开 ↗</a></p></details>`).join("")}</div>`, jsonld: faqLd }));

for (const f of FAQ) {
  out(`q/${f.slug}.html`, page({ title: `${f.q} | ${site.name}`, desc: plain(f.a).slice(0, 120), path: `/q/${f.slug}`, active: "/faq",
    body: `<article class="q" style="margin-top:12px"><h1>${esc(f.q)}</h1>${f.a}</article><h2 class="sec">最近的官方动态</h2>${timeline(events.slice(0, 5), { initial: 5 })}<p style="margin-top:8px;font-size:14px"><a href="/timeline">查看全部记录 →</a> · <a href="/faq">其他问题 →</a></p>`,
    jsonld: { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: [{ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: plain(f.a) } }] } }));
}

// ───────── 机器可读 ─────────
out("api/events.json", JSON.stringify({ site: site.name, url: site.url, updatedAt: updatedAt || BUILT, kinds: Object.fromEntries(Object.entries(KINDS).map(([k, v]) => [k, v.zh])),
  events: events.map(({ textEn, ...e }) => e) }, null, 1));
const base = site.url.replace(/\/$/, "");
out("rss.xml", `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${esc(site.name)}</title><link>${base}</link><description>${esc(site.tagline)}</description><language>zh-CN</language>
${events.slice(0, 50).map((e) => `<item><title>${esc(`[${PROVIDERS[e.provider].zh}·${KINDS[e.kind].zh}] ${e.zh}`)}</title><link>${esc(e.sourceUrl)}</link><guid isPermaLink="false">${e.id}</guid><pubDate>${new Date(e.announcedAt).toUTCString()}</pubDate><description>${esc(`适用：${e.scope}。${e.detail || ""} 原文：${e.textEn}`)}</description></item>`).join("\n")}
</channel></rss>`);
const urls = ["/", "/timeline", "/codex", "/claude", "/faq", ...FAQ.map((f) => `/q/${f.slug}`)];
out("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((u) => `<url><loc>${base}${u}</loc><lastmod>${BUILT.slice(0, 10)}</lastmod></url>`).join("")}</urlset>`);
out("robots.txt", `User-agent: *\nAllow: /\nSitemap: ${base}/sitemap.xml\n`);
if (fs.existsSync(path.join(ROOT, "site/assets"))) fs.cpSync(path.join(ROOT, "site/assets"), path.join(DIST, "assets"), { recursive: true });

console.log(`构建完成：${events.length} 条事件，${urls.length} 个页面 → dist/`);
