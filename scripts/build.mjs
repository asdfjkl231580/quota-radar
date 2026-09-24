/**
 * build.mjs — 由 data/events.json 生成静态站到 dist/（中文根路径 + /en 英文）
 * 皮肤：docs/design/UI交付规范V1.0.md + reference/full-reference.png（唯一视觉真源）
 * 样式在 site/styles.css，脚本在本文件 JS 常量（时区/计数器/菜单）
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
const CSS = fs.readFileSync(path.join(ROOT, "site/styles.css"), "utf8");
const plain = (html) => html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });
const out = (rel, content) => { const f = path.join(DIST, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, content); };

// ───────── 文案字典 ─────────
const SCOPE_EN = { "全部付费套餐": "All paid plans", "全部用户": "All users", "全部订阅用户": "All subscribers", "全部 Codex 用户": "All Codex users", "全部账户": "All accounts", "全部": "Everyone", "全部付费订阅": "All paid subscriptions", "全部付费用户": "All paid users",
  "Codex 与 ChatGPT Work 全部用户": "All Codex & ChatGPT Work users", "Codex 与 ChatGPT Work 全部付费用户": "All paid Codex & ChatGPT Work users", "Codex 与 ChatGPT Work 全部付费订阅": "All paid Codex & ChatGPT Work subscriptions",
  "受影响用户": "Affected users", "受影响的 Max / Pro": "Affected Max / Pro users", "Pro / Max 现有订阅者": "Existing Pro / Max subscribers", "Plus / Business 未获 Astra 者": "Plus / Business users without Astra", "付费 ChatGPT 套餐中尚未获得 Astra 的用户": "Paid ChatGPT users without Astra yet", "ChatGPT 账号登录的 Astra 用户": "Astra users signed in with ChatGPT", "Astra 用户": "Astra users", "未明确": "Not specified" };
const scopeEn = (s) => SCOPE_EN[s] || s;
const enSummary = (e) => e.en || e.textEn.replace(/https?:\/\/\S+/g, "").replace(/\s+/g, " ").trim().slice(0, 150).replace(/\s\S*$/, "") + (e.textEn.length > 150 ? "…" : "");

const L = {
  zh: {
    code: "zh", locale: "zh-CN", base: "", other: { code: "en", label: "EN", base: "/en" },
    name: site.name, tagline: site.tagline,
    title: `${site.name} - Codex、Claude 官方额度动态`, desc: "整理 Codex 与 Claude 官方额度重置、重置卡和提额消息，中文快速查看官方额度动态。",
    nav: [["/", "首页"], ["/codex", "Codex"], ["/claude", "Claude"], ["/faq", "常见问题"]],
    hero1: "AI 额度动态", hero2: "一眼看清", sticker: "好消息<br>马上通知！", mascotAlt: "额度雷达吉祥物：拿着喇叭的雷达小人",
    since: "距上次送额度已过去", next: "官方下次：尚未公布", source: "原帖 ↗", last: "上次", units: ["天", "时", "分"],
    recent: "最近记录", viewAll: "查看全部 →", faq: "常见问题", all: "全部 →", openAlone: "单独打开 ↗",
    footer: "只收录官方消息 · 不预测下次", menu: "菜单", tz: "时区",
    kinds: { reset: "全员重置", banked: "重置卡", boost: "提额" }, lowBadge: "待补证",
    tlTitle: "官方送额度记录", tlDesc: "Codex 与 Claude 官方每一次全员重置、重置卡、提额公告，附原帖与适用套餐。", items: "条", filters: ["全部", "Codex", "Claude"],
    scopeLbl: "适用", original: "英文原文", moreBtn: (n) => `展开更早的 ${n} 条`,
    pTitle: { codex: `Codex 什么时候重置？官方送额度记录 | ${site.name}`, claude: `Claude 额度什么时候恢复？官方重置记录 | ${site.name}` },
    pDesc: (p) => `${PROVIDERS[p].full} 官方全员重置、重置卡、提额公告的中文记录，附原帖与适用套餐。`,
    pNow: (p) => `${PROVIDERS[p].zh} 现在的状态`, pAll: (p) => `${PROVIDERS[p].zh} 全部记录`, related: "相关问题",
    pNote: { codex: "Codex 的送额度公告几乎全部来自 OpenAI Codex 负责人 @thsottiaux 的个人 X 账号。他不预告，通常绑着新模型发布、用户里程碑或事故修复。", claude: "Claude 的公告来自 @ClaudeDevs 官方账号，偶尔来自 Anthropic 员工。一般写明「5-hour and weekly」两个桶一起重置。" },
    faqTitle: `Codex / Claude 额度常见问题 | ${site.name}`, faqDesc: "额度消息来源、多久送一次、谁能收到、重置卡和直接重置的区别、怎么看剩余额度。", recentNews: "最近的官方动态", allRecords: "查看全部记录 →", otherQ: "其他问题 →",
    summary: (e) => e.zh, scope: (e) => e.scope, detail: (e) => e.detail || "",
    dateFallback: (iso, mode) => bj(iso, mode === "date" ? "md" : mode), tzFallback: "北京",
  },
  en: {
    code: "en", locale: "en-US", base: "/en", other: { code: "zh", label: "中文", base: "" },
    name: "Quota Radar", tagline: "When Codex and Claude grant quota, at a glance",
    title: "Quota Radar - Official Codex & Claude quota resets", desc: "Every official Codex and Claude quota reset, banked reset and quota boost, verified against the original posts on X. No predictions.",
    nav: [["/", "Home"], ["/codex", "Codex"], ["/claude", "Claude"], ["/faq", "FAQ"]],
    hero1: "AI Quota Updates", hero2: "at a Glance", sticker: "Good news,<br>instantly!", mascotAlt: "Quota Radar mascot: a radar character holding a megaphone",
    since: "Since the last quota grant", next: "Next: not announced", source: "Source ↗", last: "Last", units: ["d", "h", "m"],
    recent: "Recent", viewAll: "View all →", faq: "FAQ", all: "All →", openAlone: "Open ↗",
    footer: "Official announcements only · No predictions", menu: "Menu", tz: "Time zone",
    kinds: { reset: "Full reset", banked: "Banked reset", boost: "Quota boost" }, lowBadge: "unconfirmed",
    tlTitle: "Official quota grants", tlDesc: "Every official full reset, banked reset and quota boost for Codex and Claude, with source posts and eligible plans.", items: "events", filters: ["All", "Codex", "Claude"],
    scopeLbl: "Eligible", original: "Original post", moreBtn: (n) => `Show ${n} older`,
    pTitle: { codex: "When does Codex reset? Official quota grants | Quota Radar", claude: "When does Claude quota reset? Official record | Quota Radar" },
    pDesc: (p) => `Official full resets, banked resets and quota boosts for ${PROVIDERS[p].full}, with source posts and eligible plans.`,
    pNow: (p) => `${PROVIDERS[p].zh} right now`, pAll: (p) => `All ${PROVIDERS[p].zh} events`, related: "Related questions",
    pNote: { codex: "Almost every Codex quota announcement comes from @thsottiaux, who leads Codex at OpenAI, on his personal X account. No advance notice; grants usually follow model launches, user milestones or incident fixes.", claude: "Claude announcements come from the official @ClaudeDevs account, occasionally from Anthropic staff. They usually reset both the 5-hour and weekly buckets." },
    faqTitle: "Codex / Claude quota FAQ | Quota Radar", faqDesc: "Where the data comes from, how often grants happen, who gets them, banked reset vs full reset, how to check your own quota.", recentNews: "Latest official updates", allRecords: "All events →", otherQ: "Other questions →",
    summary: enSummary, scope: (e) => scopeEn(e.scope), detail: () => "",
    dateFallback: (iso, mode) => { const d = new Date(iso); const o = { timeZone: "UTC", month: "short", day: "numeric", hour12: false }; if (mode !== "date") { o.hour = "2-digit"; o.minute = "2-digit"; } if (mode === "full") o.year = "numeric"; return new Intl.DateTimeFormat("en-US", o).format(d) + (mode === "full" ? " UTC" : ""); }, tzFallback: "UTC",
  },
};

// ───────── 常见问题（两种语言）─────────
const FAQ = {
  zh: [
    { slug: "edu-xiaoxi-laiyuan-kekao-ma", q: "额度消息来源可靠吗？", home: true, a: `<p>只收录官方账号在 X 上的原帖：OpenAI Codex 负责人 @thsottiaux、@OpenAIDevs、@ClaudeDevs、@lydiahallie。每条都人工核对原帖后才上线，标了适用套餐和核验日期，每条都能点回原帖。</p><p>X 在国内打不开，官方又只在那里发，所以做了这个中文转播。本站不做「下次重置概率」，历史间隔预测不了运营决定。</p><p>数据开放：<a href="/api/events.json">JSON</a>、<a href="/rss.xml">RSS</a>。</p>` },
    { slug: "yiban-duojiu-zai-song-edu", q: "一般多久会再送额度？", home: true, a: `<p>没有规律，官方也从不预告。送额度通常跟三件事绑在一起：新模型发布、用户数里程碑、事故修复后的补偿。</p><p>只说历史事实：Codex 近 90 天记录了 ${count("codex", 90)} 次，Claude 近 90 天 ${count("claude", 90)} 次。这是过去，不是承诺。</p><p>与其猜，不如新模型发布那天来看一眼。</p>` },
    { slug: "suoyou-ren-dou-hui-shoudao-ma", q: "所有人都会收到吗？", home: true, a: `<p>不一定，看每条记录里的「适用」。常见的几种范围：</p><p><b>全部付费套餐</b>：Plus / Pro / Business（Codex）或 Pro / Max / Team（Claude）都有，免费用户一般不在内。</p><p><b>只给受影响的人</b>：比如某次 bug 只影响 3% 用户，就只给这 3% 重置。</p><p><b>要自己点</b>：重置卡存进账户不会自动生效，得你自己在桌面端、网页或手机端点「使用重置」。</p>` },
    { slug: "ruhe-chakan-ziji-shifou-you-edu", q: "如何查看自己是否有额度？", home: true, a: `<p><b>Codex</b>：<a href="https://chatgpt.com/codex/settings/usage" target="_blank" rel="noopener">官方用量页</a>能看到当前用量和是否有可用的重置卡；CLI 里输入 <code>/status</code>。</p><p><b>Claude</b>：Claude Code 里输入 <code>/usage</code>，或 claude.ai 设置里的用量页。</p><p>本站读不到你的账户，任何网页都读不到。要是有网站说「登录就能看你的额度」，要么让你交 API Key，要么在猜。</p>` },
    { slug: "chongzhi-ka-shi-shenme", q: "「重置卡」和「直接重置」有什么区别？", a: `<p><b>直接重置（全员重置）</b>：官方按下按钮，你的额度立刻回到 100%，不用做任何事。</p><p><b>重置卡（banked reset）</b>：官方往你账户里存一张卡，不会自动生效。你在 Codex 桌面端、网页或手机端自己点「使用重置」，什么时候快用完了什么时候点。Claude 侧叫「a reset to use anytime」，是同一个意思。</p><p><b>提额</b>：不是重置，是额度变多。限额上调、送额外额度、或官方优化后同样额度用更久，都算这类。</p><p>这就是两个英文同类站「距上次重置」能差十天的原因：一家把发卡算进去，一家不算。本站分开标。</p>` },
    { slug: "codex-shenme-shihou-chongzhi", q: "Codex 什么时候重置？", a: `<p>分两件事，别混在一起：</p><p><b>你自己的额度窗口。</b>官方按 5 小时窗口给用量估计，周限额也可能适用。每个账户的恢复时间都不一样，没有「每天几点」「每周一」这种统一时钟。看你自己的：打开 <a href="https://chatgpt.com/codex/settings/usage" target="_blank" rel="noopener">Codex 官方用量页</a>，或在 Codex CLI 里输入 <code>/status</code>。</p><p><b>官方送的额度。</b>OpenAI 不定期给所有付费用户「全员重置」或发「重置卡」，只在 X 上宣布，事先不预告。本站时间线记录每一次，「下次」永远写「尚未公布」，因为官方确实没公布过。</p>` },
    { slug: "claude-edu-shenme-shihou-huifu", q: "Claude 额度什么时候恢复？", a: `<p>Claude 订阅（含 Claude Code）有 5 小时会话窗和周限额两个桶，各自计数。5 小时窗从你开始用起滚动，周限额到你账户自己的周窗口时间恢复。</p><p>看自己的：在 Claude Code 里输入 <code>/usage</code>，或到 claude.ai 设置里的用量页。</p><p>官方偶尔会给所有人重置 5 小时窗和周限额，一般绑着新模型发布或事故修复，只在 X 的 @ClaudeDevs 宣布。本站 <a href="/claude">Claude 页</a> 有完整记录。</p>` },
    { slug: "5-xiaoshi-chuang-he-zhou-edu", q: "5 小时窗和周额度是什么关系？", a: `<p>两个独立的桶。5 小时窗管短时间内用多猛，周额度管一周总量。碰到任一个上限都要等。</p><p>官方送的「全员重置」通常两个桶一起清：Claude 公告一般写「5-hour and weekly」，Codex 公告写「100% weekly and 100% hourly」。「重置卡」用掉时恢复的是周额度。</p><p>每条消息消耗多少，跟模型、任务大小、上下文长度、工具调用都有关，官方文档明确说不能按条数反推百分比。</p>` },
  ],
  en: [
    { slug: "edu-xiaoxi-laiyuan-kekao-ma", q: "Is the data reliable?", home: true, a: `<p>Only original posts from official accounts on X: @thsottiaux (OpenAI Codex lead), @OpenAIDevs, @ClaudeDevs and @lydiahallie. Every event is checked against the original post by a human before it goes live, with the eligible plans and verification date, and links back to the source.</p><p>We publish no "probability of the next reset". Past intervals cannot predict an operational decision.</p><p>Open data: <a href="/api/events.json">JSON</a>, <a href="/rss.xml">RSS</a>.</p>` },
    { slug: "yiban-duojiu-zai-song-edu", q: "How often do they grant quota?", home: true, a: `<p>There is no schedule and no advance notice. Grants usually come with one of three things: a model launch, a user milestone, or compensation after an incident.</p><p>Historical fact only: Codex had ${count("codex", 90)} events in the last 90 days, Claude ${count("claude", 90)}. That is the past, not a promise.</p><p>Instead of guessing, check back on launch days.</p>` },
    { slug: "suoyou-ren-dou-hui-shoudao-ma", q: "Does everyone get it?", home: true, a: `<p>Not always. Check the "Eligible" field on each event. Common cases:</p><p><b>All paid plans</b>: Plus / Pro / Business (Codex) or Pro / Max / Team (Claude). Free users are usually excluded.</p><p><b>Affected users only</b>: when a bug hit 3% of users, only those 3% were reset.</p><p><b>You must redeem it</b>: a banked reset sits in your account until you press "use reset" in the desktop app, web or mobile.</p>` },
    { slug: "ruhe-chakan-ziji-shifou-you-edu", q: "How do I check my own quota?", home: true, a: `<p><b>Codex</b>: the <a href="https://chatgpt.com/codex/settings/usage" target="_blank" rel="noopener">official usage page</a> shows current usage and any available banked reset; in the CLI type <code>/status</code>.</p><p><b>Claude</b>: type <code>/usage</code> in Claude Code, or open the usage page in claude.ai settings.</p><p>This site cannot read your account, and neither can any other website. Anyone claiming "log in to see your quota" is either asking for your API key or guessing.</p>` },
    { slug: "chongzhi-ka-shi-shenme", q: "Banked reset vs full reset?", a: `<p><b>Full reset</b>: the vendor presses the button and your quota is back to 100% immediately. Nothing to do.</p><p><b>Banked reset</b>: a reset is deposited into your account and does nothing until you redeem it. Press "use reset" in the Codex desktop app, web or mobile when you are about to run out. Claude calls it "a reset to use anytime".</p><p><b>Quota boost</b>: not a reset. Limits raised, extra credits granted, or efficiency fixes that make the same quota last longer.</p><p>This is why two other tracking sites can disagree by ten days on "time since last reset": one counts banked resets, the other does not. We label them separately.</p>` },
    { slug: "codex-shenme-shihou-chongzhi", q: "When does Codex reset?", a: `<p>Two different things:</p><p><b>Your own window.</b> Usage is metered in 5-hour windows, and weekly limits may apply. Every account has its own reset time; there is no shared clock. Check yours on the <a href="https://chatgpt.com/codex/settings/usage" target="_blank" rel="noopener">Codex usage page</a> or with <code>/status</code> in the CLI.</p><p><b>Vendor grants.</b> OpenAI occasionally resets everyone or hands out banked resets, announced only on X with no warning. This site records every one; "next" always says "not announced", because it never is.</p>` },
    { slug: "claude-edu-shenme-shihou-huifu", q: "When does Claude quota come back?", a: `<p>Claude subscriptions (including Claude Code) have two buckets: a rolling 5-hour session window and a weekly limit. The 5-hour window rolls from when you start; the weekly limit restores at your account's own weekly boundary.</p><p>Check yours with <code>/usage</code> in Claude Code or the usage page in claude.ai settings.</p><p>Anthropic occasionally resets both buckets for everyone, usually around model launches or incident fixes, announced by @ClaudeDevs on X. See the <a href="/en/claude">Claude page</a> for the full record.</p>` },
    { slug: "5-xiaoshi-chuang-he-zhou-edu", q: "5-hour window vs weekly limit?", a: `<p>Two independent buckets. The 5-hour window limits burst usage; the weekly limit caps the total. Hit either one and you wait.</p><p>Vendor "full resets" usually clear both: Claude posts say "5-hour and weekly", Codex posts say "100% weekly and 100% hourly". Redeeming a banked reset restores the weekly bucket.</p><p>How much a message costs depends on model, task size, context length and tool calls. The official docs say you cannot back out a percentage from message counts.</p>` },
  ],
};

// ───────── 前端脚本：计数器 / 时区 / 菜单 / 筛选 ─────────
const JS = `
(function(){
  var lang=document.documentElement.lang.slice(0,2), units=JSON.parse(document.body.dataset.units), TZ_KEY='qr_tz';
  var TZ_LABELS=JSON.parse(document.body.dataset.tzlabels);
  function pad(n){return (n<10?'0':'')+n}
  function tick(){document.querySelectorAll('.counter[data-since]').forEach(function(el){
    var ms=Date.now()-new Date(el.dataset.since).getTime(); if(ms<0)ms=0;
    var d=Math.floor(ms/86400000), h=Math.floor(ms%86400000/3600000), m=Math.floor(ms%3600000/60000);
    el.innerHTML='<span>'+pad(d)+'</span><i>'+units[0]+'</i><span>'+pad(h)+'</span><i>'+units[1]+'</i><span>'+pad(m)+'</span><i>'+units[2]+'</i>';
  })}
  tick(); setInterval(tick,60000);
  function stored(){try{return localStorage.getItem(TZ_KEY)}catch(e){return null}}
  function tzValue(){return stored()||(lang==='zh'?'Asia/Shanghai':'auto')}
  function tzResolved(v){return v==='auto'?Intl.DateTimeFormat().resolvedOptions().timeZone:v}
  function fmt(iso,mode,tz){
    var d=new Date(iso), o={timeZone:tz,month:lang==='zh'?'numeric':'short',day:'numeric',hour12:false};
    if(mode!=='date'){o.hour='2-digit';o.minute='2-digit'}
    if(mode==='full')o.year='numeric';
    try{
      if(lang==='zh'){var p={};new Intl.DateTimeFormat('zh-CN',o).formatToParts(d).forEach(function(x){p[x.type]=x.value});
        return (mode==='full'?p.year+'年':'')+p.month+'月'+p.day+'日'+(mode==='date'?'':' '+p.hour+':'+p.minute)}
      return new Intl.DateTimeFormat('en-US',o).format(d);
    }catch(e){return d.toISOString().slice(0,16).replace('T',' ')}
  }
  function apply(){
    var v=tzValue(), tz=tzResolved(v), label=TZ_LABELS[v]||tz.replace(/_/g,' ');
    if(v==='auto')label=(lang==='zh'?'本地 · ':'Local · ')+tz.split('/').pop().replace(/_/g,' ');
    document.querySelectorAll('time[data-ts]').forEach(function(t){t.textContent=fmt(t.dataset.ts,t.dataset.mode||'md',tz);t.title=tz});
    document.querySelectorAll('.tzname').forEach(function(s){s.textContent=label});
    document.querySelectorAll('.tzsel').forEach(function(s){s.value=v});
  }
  document.querySelectorAll('.tzsel').forEach(function(s){s.addEventListener('change',function(){try{localStorage.setItem(TZ_KEY,s.value)}catch(e){}apply()})});
  apply();
  var bg=document.querySelector('.burger'), nav=document.querySelector('nav.main');
  if(bg&&nav){bg.addEventListener('click',function(){var o=nav.classList.toggle('open');bg.setAttribute('aria-expanded',o?'true':'false')})}
  document.querySelectorAll('.filters button').forEach(function(b){b.addEventListener('click',function(){
    document.querySelectorAll('.filters button').forEach(function(x){x.classList.remove('on')});b.classList.add('on');
    var f=b.dataset.f;document.querySelectorAll('.tl li').forEach(function(li){li.style.display=(f==='all'||li.dataset.p===f)?'':'none'});
  })});
  document.querySelectorAll('.more-btn').forEach(function(b){b.addEventListener('click',function(){b.parentElement.querySelectorAll('li.hid').forEach(function(li){li.classList.remove('hid')});b.remove();})});
})();
`;

const TZ = [["auto", "本地时间", "Local time"], ["Asia/Shanghai", "北京", "Beijing"], ["Asia/Taipei", "台北", "Taipei"], ["Asia/Hong_Kong", "香港", "Hong Kong"], ["Asia/Tokyo", "东京", "Tokyo"], ["Asia/Singapore", "新加坡", "Singapore"], ["Asia/Kolkata", "新德里", "New Delhi"], ["Europe/London", "伦敦", "London"], ["Europe/Berlin", "柏林", "Berlin"], ["America/New_York", "纽约", "New York"], ["America/Los_Angeles", "洛杉矶", "Los Angeles"], ["Australia/Sydney", "悉尼", "Sydney"], ["UTC", "UTC", "UTC"]];

// ───────── 组件 ─────────
const LOGO = {
  codex: fs.readFileSync(path.join(ROOT, "site/assets/codex-logo.svg"), "utf8").replace(/<\?xml[^>]*>/, ""),
  claude: fs.readFileSync(path.join(ROOT, "site/assets/claude-logo.svg"), "utf8").replace(/<\?xml[^>]*>/, ""),
};
const SVG_CLOCK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`;
const SVG_Q = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7"/><circle cx="12" cy="17" r=".6" fill="currentColor"/></svg>`;
const SVG_CHEV = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M9 6l6 6-6 6"/></svg>`;
const SVG_BURGER = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>`;

const badge = (T, e) => `<span class="badge ${e.kind}">${T.kinds[e.kind]}</span>${e.confidence === "low" ? ` <span class="badge low">${T.lowBadge}</span>` : ""}`;
const timeEl = (T, iso, mode = "md") => `<time datetime="${iso}" data-ts="${iso}" data-mode="${mode}">${esc(T.dateFallback(iso, mode))}</time>`;
const href = (T, p) => (T.base + p).replace(/\/$/, "") || "/";

function statusCard(T, p) {
  const last = events.find((e) => e.provider === p);
  return `<section class="card ${p}" aria-label="${PROVIDERS[p].zh}">
  <div class="head"><span class="logo" aria-hidden="true">${LOGO[p]}</span><span class="name">${PROVIDERS[p].zh}</span>${badge(T, last)}</div>
  <div class="lbl">${T.since}</div>
  <div class="counter" data-since="${last.announcedAt}"><span>--</span><i>${T.units[0]}</i><span>--</span><i>${T.units[1]}</i><span>--</span><i>${T.units[2]}</i></div>
  <div class="last">${T.last}：${timeEl(T, last.announcedAt, "full")} · <span class="tzname">${T.tzFallback}</span></div>
  <div class="foot"><span>${T.next}</span><a href="${esc(last.sourceUrl)}" target="_blank" rel="noopener">${T.source}</a></div>
</section>`;
}
function recentPanel(T, n = 4) {
  return `<section class="panel" aria-label="${T.recent}"><div class="ph">${SVG_CLOCK}${T.recent}<a class="more" href="${href(T, "/timeline")}">${T.viewAll}</a></div>
<div class="rows">${events.slice(0, n).map((e) => `<a class="row" href="${href(T, "/timeline")}#e${e.id}"><span class="d">${timeEl(T, e.announcedAt, "date")}</span><span class="p ${e.provider}">${PROVIDERS[e.provider].zh}</span><span>${badge(T, e)}</span></a>`).join("")}</div></section>`;
}
function faqPanel(T) {
  return `<section class="panel" aria-label="${T.faq}"><div class="ph">${SVG_Q}${T.faq}<a class="more" href="${href(T, "/faq")}">${T.all}</a></div>
<div class="faq-rows">${FAQ[T.code].filter((f) => f.home).map((f) => `<details><summary>${esc(f.q)}${SVG_CHEV}</summary><div class="ans">${f.a}<p><a href="${href(T, "/q/" + f.slug)}">${T.openAlone}</a></p></div></details>`).join("")}</div></section>`;
}
function timeline(T, list, { filters = false, initial = 30 } = {}) {
  const items = list.map((e, i) => `<li id="e${e.id}" data-p="${e.provider}" class="${i >= initial ? "hid" : ""}">
  <div class="d"><span class="p ${e.provider}">${PROVIDERS[e.provider].zh}</span><span>${timeEl(T, e.announcedAt, "full")}</span>${badge(T, e)}</div>
  <div class="t">${esc(T.summary(e))}</div>
  <div class="s">${T.scopeLbl}：${esc(T.scope(e))}${T.detail(e) ? " · " + esc(T.detail(e)) : ""} · ${esc(e.account)} · <a href="${esc(e.sourceUrl)}" target="_blank" rel="noopener">${T.source}</a>${(e.extraLinks || []).map((u, k) => ` <a href="${esc(u)}" target="_blank" rel="noopener">${T.source.replace(" ↗", "")} ${k + 2} ↗</a>`).join("")}</div>
  <details><summary>${T.original}</summary><blockquote>${esc(e.textEn)}</blockquote></details>
</li>`).join("\n");
  const f = filters ? `<div class="filters"><button class="on" data-f="all">${T.filters[0]}</button><button data-f="codex">${T.filters[1]}</button><button data-f="claude">${T.filters[2]}</button></div>` : "";
  const more = list.length > initial ? `<button class="more-btn">${T.moreBtn(list.length - initial)}</button>` : "";
  return `${f}<div><ul class="tl">${items}</ul>${more}</div>`;
}
function followBlock() {
  const f = site.follow;
  if (!f.enabled) return "";
  return `<section class="follow">${f.imagePath ? `<img src="${esc(f.imagePath)}" alt="">` : ""}<div><b>${esc(f.title)}</b><p>${esc(f.desc)}</p>${f.link ? `<p><a href="${esc(f.link)}">${esc(f.linkText || f.link)}</a></p>` : ""}</div></section>`;
}

function page(T, { title, desc, path: p, active, body, jsonld }) {
  const base = site.url.replace(/\/$/, "");
  const url = base + href(T, p);
  const alt = base + (T.other.base + p).replace(/\/$/, "");
  const tzOptions = TZ.map(([v, zh, en]) => `<option value="${v}">${T.code === "zh" ? zh : en}</option>`).join("");
  const tzLabels = Object.fromEntries(TZ.map(([v, zh, en]) => [v, T.code === "zh" ? zh : en]));
  return `<!doctype html>
<html lang="${T.locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(url)}">
<link rel="alternate" hreflang="${T.code === "zh" ? "zh-CN" : "en"}" href="${esc(url)}">
<link rel="alternate" hreflang="${T.code === "zh" ? "en" : "zh-CN"}" href="${esc(alt || base + "/")}">
<link rel="alternate" hreflang="x-default" href="${esc(base + (T.code === "zh" ? href(T, p) : (T.other.base + p).replace(/\/$/, "") || "/"))}">
<link rel="alternate" type="application/rss+xml" title="${esc(T.name)}" href="${T.code === "zh" ? "/rss.xml" : "/en/rss.xml"}">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${esc(url)}"><meta property="og:type" content="website"><meta property="og:image" content="${esc(base)}/assets/radar-mascot.png">
<meta name="theme-color" content="#FFEA00">
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#FFEA00"/><circle cx="16" cy="16" r="7" fill="#1467F5"/><circle cx="16" cy="16" r="2.5" fill="#fff"/></svg>')}">
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>` : ""}
<style>${CSS}</style>
</head>
<body data-units='${JSON.stringify(T.units)}' data-tzlabels='${JSON.stringify(tzLabels)}'>
<div class="page">
<header class="top">
  <div class="brand"><h1><a href="${href(T, "/")}">${esc(T.name)}</a></h1><span class="tag">${esc(T.tagline)}</span></div>
  <button class="burger" aria-label="${T.menu}" aria-expanded="false" aria-controls="mainnav">${SVG_BURGER}</button>
  <nav class="main" id="mainnav">${T.nav.map(([h, t]) => `<a href="${href(T, h)}" class="${active === h ? "on" : ""}">${t}</a>`).join("")}<a class="lang" href="${(T.other.base + p).replace(/\/$/, "") || "/"}" hreflang="${T.other.code}">${T.other.label}</a><select class="tzsel" aria-label="${T.tz}">${tzOptions}</select></nav>
</header>
<main>
${body}
</main>
${followBlock()}
<footer>${T.footer}</footer>
</div>
<script>${JS}</script>
</body>
</html>`;
}

// ───────── 逐语言生成 ─────────
for (const T of [L.zh, L.en]) {
  const dir = T.base.replace(/^\//, "");
  const file = (rel) => (dir ? dir + "/" : "") + rel;
  const hero = `<section class="hero">
  <div><h2>${T.hero1}<br><span class="b">${T.hero2}</span></h2><p class="sub">${esc(T.tagline)}</p></div>
  <div class="art ${T.code === "zh" ? "" : "plain"}"><span class="bolt" aria-hidden="true"></span><picture>${T.code === "zh" ? `<source media="(min-width:769px)" srcset="/assets/radar-mascot-sign.png">` : ""}<img src="/assets/radar-mascot.png" alt="${esc(T.mascotAlt)}" width="1168" height="791"></picture>${T.code === "zh" ? "" : `<span class="sticker" aria-hidden="true">${T.sticker}</span>`}</div>
</section>`;
  out(file("index.html"), page(T, { title: T.title, desc: T.desc, path: "/", active: "/",
    body: `${hero}<div class="quota-grid">${statusCard(T, "codex")}${statusCard(T, "claude")}</div><div class="info-grid">${recentPanel(T, 4)}${faqPanel(T)}</div>`,
    jsonld: { "@context": "https://schema.org", "@type": "WebSite", name: T.name, url: site.url + T.base, inLanguage: T.locale, description: T.tagline } }));

  out(file("timeline.html"), page(T, { title: `${T.tlTitle} (${events.length}) | ${T.name}`, desc: T.tlDesc, path: "/timeline", active: "/",
    body: `<h2 class="sec" style="margin-top:12px">${T.tlTitle}<small>${events.length} ${T.items}</small></h2>${timeline(T, events, { filters: true, initial: 30 })}` }));

  for (const p of ["codex", "claude"]) {
    const list = events.filter((e) => e.provider === p);
    out(file(`${p}.html`), page(T, { title: T.pTitle[p], desc: T.pDesc(p), path: `/${p}`, active: `/${p}`,
      body: `<h2 class="sec" style="margin-top:12px">${T.pNow(p)}</h2><div class="quota-grid one">${statusCard(T, p)}</div><p class="note">${T.pNote[p]}</p>
<h2 class="sec">${T.pAll(p)}<small>${list.length} ${T.items}</small></h2>${timeline(T, list, { initial: 40 })}
<h2 class="sec">${T.related}</h2><div class="faq">${FAQ[T.code].filter((f) => f.slug.includes(p) || f.slug.startsWith("chongzhi") || f.slug.startsWith("ruhe")).map((f) => `<details><summary>${esc(f.q)}</summary>${f.a}</details>`).join("")}</div>` }));
  }

  const faqLd = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: FAQ[T.code].map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: plain(f.a) } })) };
  out(file("faq.html"), page(T, { title: T.faqTitle, desc: T.faqDesc, path: "/faq", active: "/faq",
    body: `<h2 class="sec" style="margin-top:12px">${T.faq}</h2><div class="faq">${FAQ[T.code].map((f) => `<details id="${f.slug}" open><summary>${esc(f.q)}</summary>${f.a}<p class="perma"><a href="${href(T, "/q/" + f.slug)}">${T.openAlone}</a></p></details>`).join("")}</div>`, jsonld: faqLd }));

  for (const f of FAQ[T.code]) {
    out(file(`q/${f.slug}.html`), page(T, { title: `${f.q} | ${T.name}`, desc: plain(f.a).slice(0, 120), path: `/q/${f.slug}`, active: "/faq",
      body: `<article class="q" style="margin-top:12px"><h1>${esc(f.q)}</h1>${f.a}</article><h2 class="sec">${T.recentNews}</h2>${timeline(T, events.slice(0, 5), { initial: 5 })}<p style="margin-top:8px;font-size:14px"><a href="${href(T, "/timeline")}">${T.allRecords}</a> · <a href="${href(T, "/faq")}">${T.otherQ}</a></p>`,
      jsonld: { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: [{ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: plain(f.a) } }] } }));
  }

  // RSS（两种语言）
  const base = site.url.replace(/\/$/, "");
  out(file("rss.xml"), `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${esc(T.name)}</title><link>${base}${T.base}</link><description>${esc(T.tagline)}</description><language>${T.locale}</language>
${events.slice(0, 50).map((e) => `<item><title>${esc(`[${PROVIDERS[e.provider].zh} · ${T.kinds[e.kind]}] ${T.summary(e)}`)}</title><link>${esc(e.sourceUrl)}</link><guid isPermaLink="false">${e.id}-${T.code}</guid><pubDate>${new Date(e.announcedAt).toUTCString()}</pubDate><description>${esc(`${T.scopeLbl}: ${T.scope(e)}. ${T.detail(e)} ${e.textEn}`)}</description></item>`).join("\n")}
</channel></rss>`);
}

// ───────── 机器可读（共用）─────────
const base = site.url.replace(/\/$/, "");
out("api/events.json", JSON.stringify({ site: site.name, url: site.url, updatedAt: updatedAt || BUILT, kinds: Object.fromEntries(Object.entries(KINDS).map(([k, v]) => [k, { zh: v.zh, en: L.en.kinds[k] }])),
  events: events.map(({ textEn, ...e }) => ({ ...e, en: enSummary({ ...e, textEn }), scopeEn: scopeEn(e.scope) })) }, null, 1));
const urls = [];
for (const T of [L.zh, L.en]) for (const u of ["/", "/timeline", "/codex", "/claude", "/faq", ...FAQ[T.code].map((f) => `/q/${f.slug}`)]) urls.push(href(T, u));
out("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((u) => `<url><loc>${base}${u}</loc><lastmod>${BUILT.slice(0, 10)}</lastmod></url>`).join("")}</urlset>`);
out("robots.txt", `User-agent: *\nAllow: /\nSitemap: ${base}/sitemap.xml\n`);
if (fs.existsSync(path.join(ROOT, "site/assets"))) fs.cpSync(path.join(ROOT, "site/assets"), path.join(DIST, "assets"), { recursive: true });

console.log(`构建完成：${events.length} 条事件，${urls.length} 个页面（中英）→ dist/`);
