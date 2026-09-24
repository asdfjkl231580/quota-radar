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
@font-face{font-family:"HeroCN";src:url(/assets/hero-font.woff2) format("woff2");font-weight:900;font-display:swap}
@font-face{font-family:"NumCN";src:url(/assets/num-font.woff2) format("woff2");font-weight:900;font-display:swap}
:root{--black:#111111;--white:#FFFFFF;--blue:#1467F5;--blue-dark:#0D52D9;--blue-light:#E3EDFF;--yellow:#FFEA00;--yellow-highlight:#FFF200;--red-orange:#FF543D;
--text:#111111;--text-2:#727272;--text-3:#999999;--panel:#F7F8FA;--border:#E7E7E7;--page-bg:#FFFFFF;
--fs-hero:60px;--fs-num:64px;--fs-name:26px;--fs-h3:20px;--fs-nav:15px;--fs-body:15px;--fs-aux:13px;
--r-card:20px;--r-panel:16px;--r-badge:8px;--r-btn:10px;
--cn:"Noto Sans SC","Source Han Sans SC","PingFang SC","Hiragino Sans GB","Microsoft YaHei",-apple-system,sans-serif;--en:Inter,"Helvetica Neue",Helvetica,Arial,sans-serif}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--page-bg);color:var(--text);font:var(--fs-body)/1.55 var(--cn);overflow-x:hidden}
a{color:inherit}code{font:.92em ui-monospace,Menlo,monospace;background:var(--panel);padding:1px 6px;border-radius:6px}
.page{width:min(1200px,calc(100% - 64px));margin:0 auto;min-width:0}
/* Header */
header.top{height:72px;display:flex;align-items:center;justify-content:space-between;gap:16px}
.brand{min-width:0}.brand h1{margin:0;font:900 26px/1.15 "HeroCN",var(--cn);letter-spacing:-.01em}.brand h1 a{text-decoration:none}
.brand .tag{display:block;color:var(--text-2);font-size:var(--fs-aux);margin-top:2px}
nav.main{display:flex;align-items:center;gap:6px;font-size:var(--fs-nav);font-weight:600}
nav.main a{text-decoration:none;height:36px;display:inline-flex;align-items:center;padding:0 22px;border-radius:var(--r-btn);white-space:nowrap;color:var(--black)}
nav.main a.on{background:var(--blue);color:var(--white)}
.burger{display:none;width:40px;height:40px;border:0;background:transparent;cursor:pointer;color:var(--blue);padding:0}
.burger svg{width:26px;height:26px}
/* Hero */
.hero{position:relative;display:grid;grid-template-columns:1fr 400px;align-items:center;gap:24px;min-height:290px;padding:8px 0 8px;overflow:visible}
.hero h2{margin:0;font:900 var(--fs-hero)/1.02 "HeroCN",var(--cn);letter-spacing:-.01em}
.hero h2 .b{color:var(--blue);position:relative;display:inline-block;padding:0 6px 0 0;z-index:0}
.hero h2 .b::after{content:"";position:absolute;left:-2px;right:6px;bottom:-4px;height:.28em;background:var(--yellow);z-index:-1;transform:skew(-14deg) rotate(-1.5deg);border-radius:3px}
.hero .sub{margin:22px 0 0;color:var(--text);font-size:15px}
.hero .art{position:relative;width:100%;max-width:400px;justify-self:end;padding-right:110px}
.hero .art img{width:100%;height:auto;display:block}
.hero .sticker{position:absolute;right:-4px;bottom:70px;font:900 20px/1.25 "HeroCN",var(--cn);transform:rotate(-10deg);white-space:nowrap;text-align:center;background:linear-gradient(transparent 62%,var(--yellow) 62%);padding:0 4px}
.hero .bolt{position:absolute;left:-40px;top:-8px;width:34px;height:60px;background:var(--panel);clip-path:polygon(60% 0,100% 0,45% 55%,70% 55%,0 100%,30% 45%,10% 45%);z-index:-1}
/* 状态卡 */
.quota-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:16px}.quota-grid.one{grid-template-columns:minmax(0,560px)}
.card{min-width:0;min-height:205px;border-radius:var(--r-card);padding:24px 26px 20px;display:flex;flex-direction:column}
.card.codex{background:var(--blue);color:var(--white)}.card.claude{background:var(--yellow);color:var(--black)}
.card .head{display:flex;align-items:center;gap:14px}
.card .logo{width:48px;height:48px;border-radius:50%;background:var(--white);color:var(--blue);display:grid;place-items:center;flex:none}
.card .logo svg{width:30px;height:30px}
.card.claude .logo{background:var(--black);color:var(--yellow)}
.card .name{font:900 var(--fs-name)/1.1 "NumCN",var(--en)}
.card .lbl{font-size:15px;font-weight:600;margin-top:12px;opacity:.95}
.card .counter{font:900 var(--fs-num)/1 "NumCN",var(--en);letter-spacing:-.01em;display:flex;align-items:baseline;flex-wrap:nowrap;gap:0 4px;font-variant-numeric:tabular-nums;margin-top:8px;white-space:nowrap}
.card .counter i{font:900 calc(var(--fs-num)*.4)/1 "NumCN",var(--cn);font-style:normal;margin:0 14px 0 2px}
.card .counter i:last-child{margin-right:0}
.card .foot{display:flex;justify-content:space-between;gap:8px;margin-top:auto;padding-top:14px;border-top:1px solid rgba(255,255,255,.4);font-size:14px;font-weight:700}
.card.claude .foot{border-top-color:rgba(0,0,0,.2)}
.card .foot a{text-decoration:none;font-weight:800}
/* 标签 */
.badge{display:inline-flex;align-items:center;font-size:13px;font-weight:700;padding:3px 10px;border-radius:var(--r-badge);line-height:1.5;white-space:nowrap}
.badge.banked{background:var(--blue-light);color:var(--blue)}.badge.boost{background:var(--yellow);color:var(--black)}.badge.reset{background:#EDEEF1;color:var(--black)}
.badge.low{background:transparent;color:var(--text-2);border:1px dashed var(--border);font-weight:500}
.card.codex .badge{background:var(--white);color:var(--blue)}.card.claude .badge{background:var(--black);color:var(--yellow)}
/* 面板 */
.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:20px}
.panel{background:var(--panel);border-radius:var(--r-panel);padding:16px 18px}
.panel .ph{display:flex;align-items:center;gap:8px;font:800 var(--fs-h3)/1.3 var(--cn);margin-bottom:10px}
.panel .ph svg{width:22px;height:22px}.panel .ph .more{margin-left:auto;font-size:13px;font-weight:600;color:var(--text-2);text-decoration:none}
.rows{background:var(--white);border-radius:12px;overflow:hidden}
.row{display:grid;grid-template-columns:72px 76px auto;gap:12px;align-items:center;height:48px;padding:0 14px;border-bottom:1px solid var(--border);font-size:15px;text-decoration:none}
.row:last-child{border-bottom:0}
.row .d{color:var(--text);font-variant-numeric:tabular-nums;white-space:nowrap}.row .p{font-weight:600;white-space:nowrap;font-family:var(--en)}.row .p.codex{color:var(--blue)}
.faq-rows{background:var(--white);border-radius:12px;overflow:hidden}
.faq-rows details{border-bottom:1px solid var(--border)}.faq-rows details:last-child{border-bottom:0}
.faq-rows summary{list-style:none;display:flex;justify-content:space-between;align-items:center;gap:8px;min-height:48px;padding:0 14px;font-size:15px;font-weight:500;cursor:pointer}
.faq-rows summary::-webkit-details-marker{display:none}
.faq-rows summary svg{width:16px;height:16px;flex:none;color:var(--text);transition:transform .15s}
.faq-rows details[open] summary svg{transform:rotate(90deg)}
.faq-rows .ans{padding:0 14px 12px;font-size:14px;color:var(--text)}.faq-rows .ans p{margin:6px 0}
/* 内页 */
h2.sec{font:900 26px/1.2 var(--cn);margin:28px 0 12px}
h2.sec small{font-size:14px;font-weight:600;color:var(--text-2);margin-left:8px}
.note{font-size:14px;color:var(--text-2);background:var(--panel);border-radius:12px;padding:12px 14px;margin-top:12px}
.filters{display:flex;gap:6px;margin:0 0 12px}
.filters button{border:0;background:var(--panel);border-radius:var(--r-btn);padding:8px 16px;font:inherit;font-size:14px;font-weight:600;cursor:pointer;color:var(--black)}
.filters button.on{background:var(--blue);color:#fff}
.tl{list-style:none;margin:0;padding:0;display:grid;gap:10px}
.tl li{min-width:0;background:var(--panel);border-radius:12px;padding:12px 14px}
.tl li.hid{display:none}
.tl .d{font-size:13px;color:var(--text-2);display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.tl .d .p{font-weight:800;color:var(--black);font-size:14px;font-family:var(--en)}.tl .d .p.codex{color:var(--blue)}
.tl .t{margin:4px 0 2px;font:700 16px/1.45 var(--cn)}
.tl .s{font-size:13px;color:var(--text-2)}.tl .s a{font-weight:700;color:var(--black);text-decoration:none}
.tl details{margin-top:4px;font-size:13px}.tl summary{cursor:pointer;color:var(--text-2)}
.tl blockquote{margin:6px 0 0;padding:8px 10px;background:#fff;border-radius:8px;white-space:pre-wrap;color:#3C3C43;font-size:13px}
.more-btn{width:100%;margin:10px 0;padding:12px;border:2px dashed var(--border);background:transparent;border-radius:12px;font:inherit;font-size:14px;font-weight:600;color:var(--text-2);cursor:pointer}
.faq details{background:var(--panel);border-radius:12px;padding:12px 16px;margin-bottom:8px}
.faq summary{font:700 16px/1.4 var(--cn);cursor:pointer}.faq details p{margin:8px 0;font-size:14px}
.faq .perma{font-size:13px}
article.q{background:var(--panel);border-radius:var(--r-panel);padding:20px}
article.q h1{font:900 26px/1.25 var(--cn);margin:0 0 8px}article.q p{font-size:15px}
.follow{background:var(--black);color:#fff;border-radius:var(--r-card);padding:20px;margin-top:24px;display:flex;gap:16px;align-items:center;flex-wrap:wrap}
.follow img{width:112px;height:112px;border-radius:12px;background:#fff}
.follow b{font:900 20px/1.3 var(--cn);display:block}.follow p{margin:4px 0 0;color:#C9C9CF;font-size:14px}.follow a{color:var(--yellow)}
footer{margin:32px 0 28px;font-size:13px;color:var(--text-2);text-align:center;line-height:1.8}
footer a{color:var(--text-2)}
/* 响应式 */
@media(min-width:1280px){:root{--fs-hero:64px;--fs-num:72px}}
@media(max-width:1279px){:root{--fs-hero:54px;--fs-num:56px}.hero{grid-template-columns:1fr 340px}}
@media(max-width:1023px){:root{--fs-hero:46px;--fs-num:48px;--fs-name:22px}.hero{min-height:240px;grid-template-columns:1fr 300px}.hero .art{padding-right:90px}}
@media(max-width:768px){
  .page{width:calc(100% - 32px)}
  header.top{height:58px}.brand h1{font-size:22px}.brand .tag{display:none}
  nav.main{display:none;position:absolute;left:16px;right:16px;top:58px;background:var(--white);border:1px solid var(--border);border-radius:12px;padding:8px;flex-direction:column;align-items:stretch;z-index:20;box-shadow:0 4px 16px rgba(0,0,0,.05)}
  nav.main.open{display:flex}nav.main a{height:44px}
  .burger{display:inline-grid;place-items:center}
  body{position:relative}
  :root{--fs-hero:38px;--fs-num:42px;--fs-name:22px}
  .hero{grid-template-columns:1fr auto;gap:8px;min-height:0;padding:6px 0 4px}
  .hero h2{line-height:1.05}.hero h2 .b::after{height:.26em;bottom:-2px}
  .hero .sub{display:none}
  .hero .art{width:150px;max-width:40%;padding-right:0;align-self:end}
  .hero .sticker{display:none}.hero .bolt{display:none}
  .quota-grid{grid-template-columns:1fr;gap:14px;margin-top:8px}
  .card{min-height:150px;padding:18px 18px 14px}
  .card .logo{width:40px;height:40px}.card .logo svg{width:24px;height:24px}
  .card .lbl{margin-top:8px;font-size:14px}.card .counter{margin-top:6px}.card .counter i{margin:0 10px 0 2px}
  .card .foot{padding-top:12px;font-size:13px}
  .info-grid{grid-template-columns:1fr;gap:14px;margin-top:14px}
  .panel{padding:14px}.panel .ph{font-size:18px}
  .row{height:44px;grid-template-columns:64px 66px auto;font-size:14px;padding:0 12px}
  .faq-rows summary{min-height:44px;font-size:14px}
  h2.sec{font-size:22px}
}
@media(max-width:430px){:root{--fs-hero:34px;--fs-num:38px}}
@media(max-width:390px){:root{--fs-hero:32px;--fs-num:36px}.card .counter i{margin:0 8px 0 2px}}
`;

const JS = `
(function(){
  function pad(n){return (n<10?'0':'')+n}
  function tick(){document.querySelectorAll('.counter[data-since]').forEach(function(el){
    var ms=Date.now()-new Date(el.dataset.since).getTime(); if(ms<0)ms=0;
    var d=Math.floor(ms/86400000), h=Math.floor(ms%86400000/3600000), m=Math.floor(ms%3600000/60000);
    el.innerHTML='<span>'+pad(d)+'</span><i>天</i><span>'+pad(h)+'</span><i>时</i><span>'+pad(m)+'</span><i>分</i>';
  })}
  tick(); setInterval(tick,60000);
  var bg=document.querySelector('.burger'), nav=document.querySelector('nav.main');
  if(bg&&nav){bg.addEventListener('click',function(){var o=nav.classList.toggle('open');bg.setAttribute('aria-expanded',o?'true':'false')})}
  document.querySelectorAll('.filters button').forEach(function(b){b.addEventListener('click',function(){
    document.querySelectorAll('.filters button').forEach(function(x){x.classList.remove('on')});b.classList.add('on');
    var f=b.dataset.f;document.querySelectorAll('.tl li').forEach(function(li){li.style.display=(f==='all'||li.dataset.p===f)?'':'none'});
  })});
  document.querySelectorAll('.more-btn').forEach(function(b){b.addEventListener('click',function(){b.parentElement.querySelectorAll('li.hid').forEach(function(li){li.classList.remove('hid')});b.remove();})});
})();
`;

// ───────── 组件 ─────────
const badge = (e) => `<span class="badge ${e.kind}">${KINDS[e.kind].zh}</span>${e.confidence === "low" ? ' <span class="badge low">待补证</span>' : ""}`;
const LOGO = {
  codex: fs.readFileSync(path.join(ROOT, "site/assets/codex-logo.svg"), "utf8").replace(/<\?xml[^>]*>/, ""),
  claude: fs.readFileSync(path.join(ROOT, "site/assets/claude-logo.svg"), "utf8").replace(/<\?xml[^>]*>/, ""),
};
const SVG_CLOCK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`;
const SVG_Q = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7"/><circle cx="12" cy="17" r=".6" fill="currentColor"/></svg>`;
const SVG_CHEV = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M9 6l6 6-6 6"/></svg>`;
const SVG_BURGER = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>`;

// 同一个组件，不同数据（QuotaCard）
function statusCard(p) {
  const last = events.find((e) => e.provider === p);
  return `<section class="card ${p}" aria-label="${PROVIDERS[p].zh} 额度状态">
  <div class="head"><span class="logo" aria-hidden="true">${LOGO[p]}</span><span class="name">${PROVIDERS[p].zh}</span>${badge(last)}</div>
  <div class="lbl">距上次送额度已过去</div>
  <div class="counter" data-since="${last.announcedAt}" aria-live="off"><span>--</span><i>天</i><span>--</span><i>时</i><span>--</span><i>分</i></div>
  <div class="foot"><span>官方下次：尚未公布</span><a href="${esc(last.sourceUrl)}" target="_blank" rel="noopener">原帖 ↗</a></div>
</section>`;
}

function recentPanel(n = 4) {
  return `<section class="panel" aria-label="最近记录"><div class="ph">${SVG_CLOCK}最近记录<a class="more" href="/timeline">查看全部 →</a></div>
<div class="rows">${events.slice(0, n).map((e) => `<a class="row" href="/timeline#e${e.id}"><span class="d">${bj(e.announcedAt, "md")}</span><span class="p ${e.provider}">${PROVIDERS[e.provider].zh}</span><span>${badge(e)}</span></a>`).join("")}</div></section>`;
}
function faqPanel() {
  return `<section class="panel" aria-label="常见问题"><div class="ph">${SVG_Q}常见问题<a class="more" href="/faq">全部 →</a></div>
<div class="faq-rows">${FAQ.filter((f) => f.home).map((f) => `<details><summary>${esc(f.q)}${SVG_CHEV}</summary><div class="ans">${f.a}<p><a href="/q/${f.slug}">单独打开 ↗</a></p></div></details>`).join("")}</div></section>`;
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
<div class="page">
<header class="top">
  <div class="brand"><h1><a href="/">${esc(site.name)}</a></h1><span class="tag">${esc(site.tagline)}</span></div>
  <button class="burger" aria-label="菜单" aria-expanded="false" aria-controls="mainnav">${SVG_BURGER}</button>
  <nav class="main" id="mainnav">${[["/", "首页"], ["/codex", "Codex"], ["/claude", "Claude"], ["/faq", "常见问题"]].map(([h, t]) => `<a href="${h}" class="${active === h ? "on" : ""}">${t}</a>`).join("")}</nav>
</header>
<main>
${body}
</main>
${followBlock()}
<footer>只收录官方消息 · 不预测下次</footer>
</div>
<script>${JS}</script>
</body>
</html>`;
}

// ───────── 页面 ─────────
const hero = `<section class="hero">
  <div><h2>AI 额度动态<br><span class="b">一眼看清</span></h2><p class="sub">${esc(site.tagline)}</p></div>
  <div class="art"><span class="bolt" aria-hidden="true"></span><img src="/assets/radar-mascot.png" alt="额度雷达吉祥物：拿着喇叭的雷达小人" width="280" height="270"><span class="sticker" aria-hidden="true">好消息<br>马上通知！</span></div>
</section>`;

out("index.html", page({ title: `${site.name} - Codex、Claude 官方额度动态`, desc: "整理 Codex 与 Claude 官方额度重置、重置卡和提额消息，中文快速查看官方额度动态。", path: "/", active: "/",
  body: `${hero}<div class="quota-grid">${statusCard("codex")}${statusCard("claude")}</div><div class="info-grid">${recentPanel(4)}${faqPanel()}</div>`,
  jsonld: { "@context": "https://schema.org", "@type": "WebSite", name: site.name, url: site.url, inLanguage: "zh-CN", description: site.tagline } }));

out("timeline.html", page({ title: `官方送额度记录（全部 ${events.length} 条）| ${site.name}`, desc: "Codex 与 Claude 官方每一次全员重置、重置卡、提额公告，附原帖与适用套餐。", path: "/timeline", active: "/",
  body: `<h2 class="sec" style="margin-top:12px">官方送额度记录<small>${events.length} 条</small></h2>${timeline(events, { filters: true, initial: 30 })}` }));

for (const p of ["codex", "claude"]) {
  const list = events.filter((e) => e.provider === p);
  const body = `
<h2 class="sec" style="margin-top:12px">${PROVIDERS[p].zh} 现在的状态</h2>
<div class="quota-grid one">${statusCard(p)}</div>
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
