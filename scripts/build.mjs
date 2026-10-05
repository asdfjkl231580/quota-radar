/**
 * build.mjs — 由 data/events.json 生成静态站到 dist/（中文根路径 + /en 英文）
 * 皮肤：docs/design/UI交付规范V1.0.md + reference/full-reference.png（唯一视觉真源）
 * 样式在 site/styles.css，脚本在本文件 JS 常量（时区/计数器/菜单）
 */
import fs from "node:fs";
import path from "node:path";
import { eventVersion } from "./snapshot.mjs";
import { validateEvents } from "./validate-events.mjs";
import { ROOT, readJson, KINDS, PROVIDERS, bj, daysAgo } from "./lib.mjs";
import { eventPath, searchableEvent, eventArticle, breadcrumbs } from "./search-pages.mjs";
import { enrichGuides } from "./guides.mjs";

const DIST = path.join(ROOT, "dist");
const site = readJson("site.json");
const { events, updatedAt } = readJson("events.json");
const validation = validateEvents(events);
if (validation.length) throw new Error("事件校验失败：\n" + validation.join("\n"));
const VERSION = eventVersion(events);
const NOW = Date.now();
const BUILT = new Date().toISOString();
const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const count = (p, days) => events.filter((e) => e.provider === p && !e.pendingReset && e.kind !== "teaser" && new Date(e.effectiveAt || e.announcedAt).getTime() <= NOW && daysAgo(e.effectiveAt || e.announcedAt, NOW) <= days).length;   // 预告不算送过
const CSS = fs.readFileSync(path.join(ROOT, "site/styles.css"), "utf8");
const plain = (html) => html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });
const out = (rel, content) => { const f = path.join(DIST, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, content); };

// ───────── 文案字典 ─────────
const SCOPE_EN = { "全部套餐": "All plans", "待核实": "Eligibility under review", "全部付费套餐": "All paid plans", "全部用户": "All users", "全部订阅用户": "All subscribers", "全部 Codex 用户": "All Codex users", "全部账户": "All accounts", "全部": "Everyone", "全部付费订阅": "All paid subscriptions", "全部付费用户": "All paid users",
  "Codex 与 ChatGPT Work 全部用户": "All Codex & ChatGPT Work users", "Codex 与 ChatGPT Work 全部付费用户": "All paid Codex & ChatGPT Work users", "Codex 与 ChatGPT Work 全部付费订阅": "All paid Codex & ChatGPT Work subscriptions",
  "受影响用户": "Affected users", "受影响的 Max / Pro": "Affected Max / Pro users", "Pro / Max 现有订阅者": "Existing Pro / Max subscribers", "Plus / Business 未获 Astra 者": "Plus / Business users without Astra", "付费 ChatGPT 套餐中尚未获得 Astra 的用户": "Paid ChatGPT users without Astra yet", "ChatGPT 账号登录的 Astra 用户": "Astra users signed in with ChatGPT", "Astra 用户": "Astra users", "未明确": "Not specified" };
const scopeEn = (s) => SCOPE_EN[s] || (/[\u3400-\u9fff]/.test(s || "") ? "See the source post for eligibility" : s || "Not specified");
const enSummary = (e) => e.en || (e.textEn || "").replace(/https?:\/\/\S+/g, "").replace(/\s+/g, " ").trim().slice(0, 150).replace(/\s\S*$/, "") + ((e.textEn || "").length > 150 ? "…" : "");

const L = {
  zh: {
    code: "zh", locale: "zh-CN", base: "", other: { code: "en", label: "EN", base: "/en" },
    name: site.name, tagline: site.tagline,
    title: `Codex 什么时候重置？Claude 额度什么时候恢复？| ${site.name}`, desc: "官方送额度、全员重置、重置卡的中文记录，附原帖与适用套餐。Codex、Claude 什么时候送额度，一眼看清。不预测。",
    nav: [["/", "首页"], ["/codex", "Codex"], ["/claude", "Claude"], ["/faq", "常见问题"]],
    hero1: "AI 额度动态", hero2: "一眼看清", sticker: "好消息<br>马上通知！", mascotAlt: "额度雷达吉祥物：拿着喇叭的雷达小人",
    since: "距上次送额度已过去", next: "官方下次：尚未公布",
    untilLbl: "距官方预告的重置还有", untilDayLbl: "距官方预告那天（美西时间）还有", annLbl: "官方已宣布重置，公告发出已过去", dueLbl: "预告时间已到，等官方确认生效",
    expLine: "官方预告", expDayNote: "（美西当天，几点未公布）", annLine: "公告", nextUnknown: "生效时间：官方未公布", nextKnown: "时间来自官方原帖", prevGrant: "上次送额度", tzSwitched: "已切换到", observedTag: "（第三方观察）", source: "原帖 ↗", last: "上次", units: ["天", "时", "分"],
    recent: "最近记录", viewAll: "查看全部 →", faq: "常见问题", all: "全部 →", openAlone: "单独打开 ↗",
    footer: "只收录官方消息 · 不预测下次", menu: "菜单", tz: "时区", about: "关于", updated: "记录最近变更", method: "数据说明", privacy: "隐私与服务边界", status: "服务状态", verified: "原帖核验", humanReview: "已复核整理", automatic: "自动收录，待整理", pendingEvidence: "预告，尚未确认生效", scheduledEvidence: "按官方预告时间记录，未获独立到账确认", officialEvidence: "官方确认", thirdPartyEvidence: "第三方执行证据", announcementEvidence: "依据官方原帖", evidence: "时间依据", noVerification: "核验日期未记录", snapshotNote: "记录未变化不代表采集失败；状态页区分数据版本与发布情况。",
    kinds: { reset: "全员重置", banked: "重置卡", boost: "提额", teaser: "预告" }, lowBadge: "待补证", autoBadge: "待整理", teaserLbl: "预告", viewOnX: "在 X 上看 ↗", tweetCard: "原帖",
    tlTitle: "官方送额度记录", tlDesc: "Codex 与 Claude 官方每一次全员重置、重置卡、提额公告，附原帖与适用套餐。", items: "条", filters: ["全部", "Codex", "Claude"],
    scopeLbl: "适用", original: "英文原文", moreBtn: (n) => `展开更早的 ${n} 条`,
    pTitle: { codex: `Codex 什么时候重置？官方送额度记录 | ${site.name}`, claude: `Claude 额度什么时候恢复？官方重置记录 | ${site.name}` },
    pDesc: (p) => `${PROVIDERS[p].full} 官方全员重置、重置卡、提额公告的中文记录，附原帖与适用套餐。`,
    pNow: (p) => `${PROVIDERS[p].zh} 现在的状态`, pAll: (p) => `${PROVIDERS[p].zh} 全部记录`, related: "相关问题",
    pNote: { codex: "Codex 的送额度公告几乎全部来自 OpenAI Codex 负责人 @thsottiaux 的个人 X 账号。公告有时提前给出日期或时间，也可能只说稍后重置。预告、生效确认和重置卡分开展示。", claude: "Claude 的公告来自 @ClaudeDevs 官方账号，偶尔来自 Anthropic 员工。每次恢复哪些额度窗口、适用于哪些账户，以该条公告和账户权益说明为准。" },
    faqTitle: `Codex / Claude 额度常见问题 | ${site.name}`, faqDesc: "额度消息来源、多久送一次、谁能收到、重置卡和直接重置的区别、怎么看剩余额度。", recentNews: "最近的官方动态", allRecords: "查看全部记录 →", otherQ: "其他问题 →",
    summary: (e) => e.zh, scope: (e) => e.scope, detail: (e) => e.detail || "",
    dateFallback: (iso, mode) => bj(iso, mode === "date" ? "md" : mode), tzFallback: "北京",
  },
  en: {
    code: "en", locale: "en-US", base: "/en", other: { code: "zh", label: "中文", base: "" },
    name: "Quota Radar", tagline: "When Codex and Claude grant quota, at a glance",
    title: "When does Codex reset? Claude quota reset tracker | Quota Radar", desc: "Official Codex and Claude quota resets, banked resets and quota boosts, verified against the original posts on X. No predictions.",
    nav: [["/", "Home"], ["/codex", "Codex"], ["/claude", "Claude"], ["/faq", "FAQ"]],
    hero1: "AI Quota Updates", hero2: "at a Glance", sticker: "Good news,<br>instantly!", mascotAlt: "Quota Radar mascot: a radar character holding a megaphone",
    since: "Since the last quota grant", next: "Next: not announced",
    untilLbl: "Announced reset in", untilDayLbl: "Announced day (US Pacific) starts in", annLbl: "Reset announced, time since announcement", dueLbl: "Announced time reached, awaiting confirmation",
    expLine: "Announced for", expDayNote: " (US Pacific day, time not given)", annLine: "Announced", nextUnknown: "Effective time: not announced", nextKnown: "Time from the official post", prevGrant: "Previous grant", tzSwitched: "Time zone:", observedTag: " (third-party observation)", source: "Source ↗", last: "Last", units: ["d", "h", "m"],
    recent: "Recent", viewAll: "View all →", faq: "FAQ", all: "All →", openAlone: "Open ↗",
    footer: "Official announcements only · No predictions", menu: "Menu", tz: "Time zone", about: "About", updated: "Records last changed", method: "Data method", privacy: "Privacy & limits", status: "Service status", verified: "Source checked", humanReview: "Reviewed summary", automatic: "Auto-collected; summary pending review", pendingEvidence: "Announced; not confirmed effective", scheduledEvidence: "Recorded at the scheduled time; no independent confirmation", officialEvidence: "Official confirmation", thirdPartyEvidence: "Third-party execution evidence", announcementEvidence: "Official source post", evidence: "Time evidence", noVerification: "Verification date not recorded", snapshotNote: "Unchanged records do not mean collection has failed. See status for the data version and publication details.",
    kinds: { reset: "Full reset", banked: "Banked reset", boost: "Quota boost", teaser: "Heads-up" }, lowBadge: "unconfirmed", autoBadge: "auto", teaserLbl: "Heads-up", viewOnX: "View on X ↗", tweetCard: "Source post",
    tlTitle: "Official quota grants", tlDesc: "Every official full reset, banked reset and quota boost for Codex and Claude, with source posts and eligible plans.", items: "events", filters: ["All", "Codex", "Claude"],
    scopeLbl: "Eligible", original: "Original post", moreBtn: (n) => `Show ${n} older`,
    pTitle: { codex: "When does Codex reset? Official quota grants | Quota Radar", claude: "When does Claude quota reset? Official record | Quota Radar" },
    pDesc: (p) => `Official full resets, banked resets and quota boosts for ${PROVIDERS[p].full}, with source posts and eligible plans.`,
    pNow: (p) => `${PROVIDERS[p].zh} right now`, pAll: (p) => `All ${PROVIDERS[p].zh} events`, related: "Related questions",
    pNote: { codex: "Almost every Codex quota announcement comes from @thsottiaux, who leads Codex at OpenAI, on his personal X account. Posts may announce a date or time in advance, or leave the timing open. We distinguish announcements, effective resets and banked resets.", claude: "Claude announcements come from the official @ClaudeDevs account, occasionally from Anthropic staff. The affected limits and eligible accounts depend on each announcement and the entitlement shown in your account." },
    faqTitle: "Codex / Claude quota FAQ | Quota Radar", faqDesc: "Where the data comes from, how often grants happen, who gets them, banked reset vs full reset, how to check your own quota.", recentNews: "Latest official updates", allRecords: "All events →", otherQ: "Other questions →",
    summary: enSummary, scope: (e) => e.scopeEn || scopeEn(e.scope), detail: () => "",
    dateFallback: (iso, mode) => { const d = new Date(iso); const o = { timeZone: "UTC", month: "short", day: "numeric", hour12: false }; if (mode !== "date") { o.hour = "2-digit"; o.minute = "2-digit"; } if (mode === "full") o.year = "numeric"; return new Intl.DateTimeFormat("en-US", o).format(d) + (mode === "full" ? " UTC" : ""); }, tzFallback: "UTC",
  },
};

// ───────── 常见问题（两种语言）─────────
const FAQ = {
  zh: [
    { slug: "edu-xiaoxi-laiyuan-kekao-ma", q: "额度消息来源可靠吗？", home: true, a: `<p>只收录官方账号在 X 上的原帖：OpenAI Codex 负责人 @thsottiaux、@OpenAIDevs、@ClaudeDevs、@lydiahallie。自动采集会核对原帖作者、时间和原文；自动摘要标「待整理」，复核整理后再更新。原帖核验不代表逐账户确认到账。每条列出适用范围、核验日期和时间依据，都能点回原帖。</p><p>X 原帖在国内不易访问，所以做了这个中文转播。本站不做「下次重置概率」，历史间隔预测不了运营决定。</p><p>数据开放：<a href="/api/events.json">JSON</a>、<a href="/rss.xml">RSS</a>。</p>` },
    { slug: "yiban-duojiu-zai-song-edu", q: "一般多久会再送额度？", home: true, a: `<p>没有固定周期。官方有时会提前给出日期或时间，未给出时就显示「生效时间未公布」。送额度通常跟三件事绑在一起：新模型发布、用户数里程碑、事故修复后的补偿。</p><p>只说历史事实：Codex 近 90 天记录了 ${count("codex", 90)} 次，Claude 近 90 天 ${count("claude", 90)} 次。这是过去，不是承诺。</p><p>与其猜，不如新模型发布那天来看一眼。</p>` },
    { slug: "suoyou-ren-dou-hui-shoudao-ma", q: "所有人都会收到吗？", home: true, a: `<p>不一定，看每条记录里的「适用」。常见的几种范围：</p><p><b>全部付费套餐</b>：Plus / Pro / Business（Codex）或 Pro / Max / Team（Claude）都有，免费用户一般不在内。</p><p><b>只给受影响的人</b>：比如某次 bug 只影响 3% 用户，就只给这 3% 重置。</p><p><b>要自己点</b>：重置卡存进账户不会自动生效，得你自己在桌面端、网页或手机端点「使用重置」。</p>` },
    { slug: "ruhe-chakan-ziji-shifou-you-edu", q: "如何查看自己是否有额度？", home: true, a: `<p><b>Codex</b>：<a href="https://chatgpt.com/codex/settings/usage" target="_blank" rel="noopener">官方用量页</a>能看到当前用量和是否有可用的重置卡；CLI 里输入 <code>/status</code>。</p><p><b>Claude</b>：Claude Code 里输入 <code>/usage</code>，或 claude.ai 设置里的用量页。</p><p>本站不接入你的账户，不读取个人剩余额度，也不会索取 OpenAI / Anthropic 密码、Cookie 或 API Key。个人恢复时间以官方用量页为准。</p>` },
    { slug: "chongzhi-ka-shi-shenme", q: "「重置卡」和「直接重置」有什么区别？", a: `<p><b>直接重置（全员重置）</b>：官方按下按钮，适用账户的额度按公告范围恢复，通常不需要手动领取；实际到账以官方账户用量页为准。</p><p><b>重置卡（banked reset）</b>：官方授予一次可在之后手动使用的重置机会，不等于发卡时就恢复额度。可领取的账户、有效期、可用入口、影响哪些额度窗口以及是否改变重置日期，以该次公告和官方用量页为准。<a href="https://help.openai.com/en/articles/20001498-how-banked-codex-resets-work" target="_blank" rel="noopener">OpenAI 官方说明</a></p><p><b>付费重置</b>：与官方免费赠送的额度分开理解。若官方账户提供购买入口，请在购买前查看当前价格、适用套餐、生效方式及后续窗口规则。本站不销售、不代购，也不会要求你提交账号凭证。<a href="https://help.openai.com/en/articles/20001507-paid-weekly-work-and-codex-rate-limit-resets" target="_blank" rel="noopener">OpenAI 官方说明</a></p><p><b>提额</b>：不是重置，是额度变多。限额上调、送额外额度、或官方优化后同样额度用更久，都算这类。</p><p>这就是两个英文同类站「距上次重置」能差十天的原因：一家把发卡算进去，一家不算。本站分开标。</p>` },
    { slug: "codex-shenme-shihou-chongzhi", q: "Codex 什么时候重置？", a: `<p>分两件事，别混在一起：</p><p><b>你自己的额度窗口。</b>官方按 5 小时窗口给用量估计，周限额也可能适用。每个账户的恢复时间都不一样，没有「每天几点」「每周一」这种统一时钟。看你自己的：打开 <a href="https://chatgpt.com/codex/settings/usage" target="_blank" rel="noopener">Codex 官方用量页</a>，或在 Codex CLI 里输入 <code>/status</code>。</p><p><b>官方送的额度。</b>OpenAI 不定期给所有付费用户「全员重置」或发「重置卡」，相关公告常见于 X。本站区分已发生记录和将来预告：给了准确时间就显示倒计时，只给日期就标明日期，没给时间就写「生效时间未公布」。按预告时间记录的生效状态会保留标识，不代表已核验你的账户到账。</p>` },
    { slug: "claude-edu-shenme-shihou-huifu", q: "Claude 额度什么时候恢复？", a: `<p>Claude 订阅（含 Claude Code）有 5 小时会话窗和周限额两个桶，各自计数。5 小时窗从你开始用起滚动，周限额到你账户自己的周窗口时间恢复。</p><p>看自己的：在 Claude Code 里输入 <code>/usage</code>，或到 claude.ai 设置里的用量页。</p><p>官方偶尔会给特定范围的用户恢复额度，公告中可能同时包含 5 小时窗和周限额。本站跟踪 @ClaudeDevs 等官方账号的公告，适用范围以每条原帖为准。<a href="/claude">查看 Claude 记录</a>。</p>` },
    { slug: "5-xiaoshi-chuang-he-zhou-edu", q: "5 小时窗和周额度是什么关系？", a: `<p>两个独立的桶。5 小时窗管短时间内用多猛，周额度管一周总量。碰到任一个上限都要等。</p><p>官方送的「全员重置」通常两个桶一起清：Claude 公告一般写「5-hour and weekly」，Codex 公告写「100% weekly and 100% hourly」。重置卡影响哪些额度窗口，以该次赠送规则为准。</p><p>每条消息消耗多少，跟模型、任务大小、上下文长度、工具调用都有关，官方文档明确说不能按条数反推百分比。</p>` },
  ],
  en: [
    { slug: "edu-xiaoxi-laiyuan-kekao-ma", q: "Is the data reliable?", home: true, a: `<p>Only original posts from official accounts on X: @thsottiaux (OpenAI Codex lead), @OpenAIDevs, @ClaudeDevs and @lydiahallie. Automated collection checks the source author, time and text. Automatic summaries remain marked "auto" until reviewed. Checking a post does not verify delivery to every account. Entries show eligibility, the source-check date and the evidence used for the effective time.</p><p>We publish no "probability of the next reset". Past intervals cannot predict an operational decision.</p><p>Open data: <a href="/api/events.json">JSON</a>, <a href="/en/rss.xml">RSS</a>.</p>` },
    { slug: "yiban-duojiu-zai-song-edu", q: "How often do they grant quota?", home: true, a: `<p>There is no fixed cycle. Official posts sometimes give a date or time in advance; otherwise we say that the effective time has not been announced. Grants usually come with one of three things: a model launch, a user milestone, or compensation after an incident.</p><p>Historical fact only: Codex had ${count("codex", 90)} events in the last 90 days, Claude ${count("claude", 90)}. That is the past, not a promise.</p><p>Instead of guessing, check back on launch days.</p>` },
    { slug: "suoyou-ren-dou-hui-shoudao-ma", q: "Does everyone get it?", home: true, a: `<p>Not always. Check the "Eligible" field on each event. Common cases:</p><p><b>All paid plans</b>: Plus / Pro / Business (Codex) or Pro / Max / Team (Claude). Free users are usually excluded.</p><p><b>Affected users only</b>: when a bug hit 3% of users, only those 3% were reset.</p><p><b>You must redeem it</b>: a banked reset sits in your account until you press "use reset" in the desktop app, web or mobile.</p>` },
    { slug: "ruhe-chakan-ziji-shifou-you-edu", q: "How do I check my own quota?", home: true, a: `<p><b>Codex</b>: the <a href="https://chatgpt.com/codex/settings/usage" target="_blank" rel="noopener">official usage page</a> shows current usage and any available banked reset; in the CLI type <code>/status</code>.</p><p><b>Claude</b>: type <code>/usage</code> in Claude Code, or open the usage page in claude.ai settings.</p><p>This site does not connect to your account, read personal usage, or request OpenAI / Anthropic passwords, cookies or API keys. Check your personal reset time on the official usage page.</p>` },
    { slug: "chongzhi-ka-shi-shenme", q: "Banked reset vs full reset?", a: `<p><b>Full reset</b>: the vendor presses the button and eligible accounts receive the reset described in the announcement, usually without redemption. Confirm delivery on your official usage page.</p><p><b>Banked reset</b>: a granted reset that can be redeemed later. Receiving the grant is not the same as resetting your quota immediately. Eligibility, expiry, redemption entry points, affected limits and changes to reset dates depend on the specific offer and official usage page. <a href="https://help.openai.com/en/articles/20001498-how-banked-codex-resets-work" target="_blank" rel="noopener">OpenAI help article</a></p><p><b>Paid resets</b>: separate these from free grants. If your official account offers a purchase, check its current price, eligible plans, effective time and impact on later windows before buying. This site does not sell resets or request your account credentials. <a href="https://help.openai.com/en/articles/20001507-paid-weekly-work-and-codex-rate-limit-resets" target="_blank" rel="noopener">OpenAI help article</a></p><p><b>Quota boost</b>: not a reset. Limits raised, extra credits granted, or efficiency fixes that make the same quota last longer.</p><p>This is why two other tracking sites can disagree by ten days on "time since last reset": one counts banked resets, the other does not. We label them separately.</p>` },
    { slug: "codex-shenme-shihou-chongzhi", q: "When does Codex reset?", a: `<p>Two different things:</p><p><b>Your own window.</b> Usage is metered in 5-hour windows, and weekly limits may apply. Every account has its own reset time; there is no shared clock. Check yours on the <a href="https://chatgpt.com/codex/settings/usage" target="_blank" rel="noopener">Codex usage page</a> or with <code>/status</code> in the CLI.</p><p><b>Vendor grants.</b> OpenAI occasionally resets everyone or hands out banked resets, often announced on X. This site separates completed events from future announcements. We show a countdown only for an official time; a date-only announcement keeps that precision. Scheduled-time records are labelled and do not verify delivery to your own account.</p>` },
    { slug: "claude-edu-shenme-shihou-huifu", q: "When does Claude quota come back?", a: `<p>Claude subscriptions (including Claude Code) have two buckets: a rolling 5-hour session window and a weekly limit. The 5-hour window rolls from when you start; the weekly limit restores at your account's own weekly boundary.</p><p>Check yours with <code>/usage</code> in Claude Code or the usage page in claude.ai settings.</p><p>Anthropic occasionally resets both buckets for everyone, usually around model launches or incident fixes, announced by @ClaudeDevs on X. See the <a href="/en/claude">Claude page</a> for the full record.</p>` },
    { slug: "5-xiaoshi-chuang-he-zhou-edu", q: "5-hour window vs weekly limit?", a: `<p>Two independent buckets. The 5-hour window limits burst usage; the weekly limit caps the total. Hit either one and you wait.</p><p>Vendor "full resets" usually clear both: Claude posts say "5-hour and weekly", Codex posts say "100% weekly and 100% hourly". Redeeming a banked reset refreshes both buckets and moves your weekly reset date.</p><p>How much a message costs depends on model, task size, context length and tool calls. The official docs say you cannot back out a percentage from message counts.</p>` },
  ],
};


enrichGuides(FAQ);

const ABOUT = {
  zh: (a) => `<article class="q" style="margin-top:12px"><h1>关于额度雷达</h1>
<p><b>这是什么。</b>OpenAI Codex 和 Anthropic Claude 的官方会不定期给用户送额度：全员重置、发重置卡、提额。这些消息常见于 X。这个站核对原帖、提供中文说明、按时间排好，让你一眼看到「上次什么时候送的、送的什么、给谁」。</p>
<p><b>数据规则。</b>只收录官方账号（@thsottiaux、@OpenAIDevs、@ClaudeDevs、@lydiahallie）的原帖；每条标注适用套餐和核验日期，能点回原帖；自动收录的条目会标「待整理」，复核整理后去掉；官方只说「将重置」时记为预告。生效时间依据分别标为官方确认、第三方执行证据、官方预告时间；预告到点的记录不代表逐账户确认到账。没有时间也没有确认的预告不会自动当作已发生；不做预测、不算概率。</p>
<p><b>线索来源。</b>新公告的线索部分来自 <a href="https://codex-resets.com" target="_blank" rel="noopener">Codex Resets</a> 的公开接口，每条仍回 X 原帖核对后才收录。</p>
<p><b>谁在维护。</b>${esc(a.owner)}。${a.contact ? `联系：<a href="${esc(a.contact)}">${esc(a.contactLabel || a.contact)}</a>。` : ""}发现错误或漏掉的公告，欢迎告诉我们。</p>
<p><b>数据开放。</b><a href="/api/events.json">JSON</a>、<a href="/rss.xml">RSS</a>，可自由引用，注明来源即可。</p>
<p><b>目前免费。</b>公开公告、时间线与规则说明免费提供。未来可能提供付费的个性化提醒和工作流服务，目前尚未开放订阅或收费。</p><p><a href="/method">数据说明与纠错方式</a> · <a href="/privacy">隐私与服务边界</a> · <a href="/status">服务状态</a></p>
<p><b>不隶属。</b>本站与 OpenAI、Anthropic 无关，Codex、Claude 为各自公司的商标。</p></article>`,
  en: (a) => `<article class="q" style="margin-top:12px"><h1>About Quota Radar</h1>
<p><b>What this is.</b> OpenAI (Codex) and Anthropic (Claude) occasionally grant quota to users: full resets, banked resets, quota boosts. Announcements often appear on X. This site checks the source posts and records relevant events, so you can see at a glance when the last grant happened, what it was, and who got it.</p>
<p><b>Rules.</b> Only original posts from official accounts (@thsottiaux, @OpenAIDevs, @ClaudeDevs, @lydiahallie). Every event lists eligible plans and a verification date and links to the source. Auto-collected events are marked until the summary and evidence are reviewed. "We will reset" is a heads-up. Effective times are labelled as official confirmation, third-party evidence or the official scheduled time. Reaching a scheduled time does not confirm delivery to every account. Announcements with no time stay pending until there is evidence. No predictions, no probabilities.</p>
<p><b>Leads.</b> Some new-announcement leads come from the public API of <a href="https://codex-resets.com" target="_blank" rel="noopener">Codex Resets</a>; every event is still verified against the original post on X.</p>
<p><b>Who runs it.</b> ${esc(a.ownerEn || a.owner)}. ${a.contact ? `Contact: <a href="${esc(a.contact)}">${esc(a.contactLabel || a.contact)}</a>.` : ""} Spotted an error or a missing announcement? Tell us.</p>
<p><b>Open data.</b> <a href="/api/events.json">JSON</a>, <a href="/en/rss.xml">RSS</a>. Free to reuse with attribution.</p>
<p><b>Currently free.</b> Public announcements, the timeline and explanations are free. Paid personalized alerts and workflows may be added later; subscriptions and payments are not available yet.</p><p><a href="/en/method">Data method and corrections</a> · <a href="/en/privacy">Privacy and service limits</a> · <a href="/en/status">Service status</a></p>
<p><b>Not affiliated</b> with OpenAI or Anthropic. Codex and Claude are trademarks of their respective owners.</p></article>`,
};

// ───────── 前端脚本：计数器 / 时区 / 菜单 / 筛选 ─────────
const JS = `
(function(){
  var lang=document.documentElement.lang.slice(0,2), units=JSON.parse(document.body.dataset.units), TZ_KEY='qr_tz';
  var TZ_LABELS=JSON.parse(document.body.dataset.tzlabels);
  function pad(n){return (n<10?'0':'')+n}
  function tick(){document.querySelectorAll('.counter[data-since],.counter[data-until]').forEach(function(el){
    var ms=el.dataset.until?new Date(el.dataset.until).getTime()-Date.now():Date.now()-new Date(el.dataset.since).getTime();
    if(ms<0){ms=0;if(el.dataset.until){var l=el.parentNode.querySelector('.lbl[data-due]');if(l)l.textContent=l.dataset.due}}
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
  document.querySelectorAll('.tzsel').forEach(function(s){s.addEventListener('change',function(){
    try{localStorage.setItem(TZ_KEY,s.value)}catch(e){}apply();
    var n=document.querySelector('nav.main.open'),bgb=document.querySelector('.burger');if(n){n.classList.remove('open');if(bgb)bgb.setAttribute('aria-expanded','false')}
    document.querySelectorAll('time[data-ts]').forEach(function(t){t.classList.remove('flash');void t.offsetWidth;t.classList.add('flash')});
    var tip=document.createElement('div');tip.className='tz-toast';tip.textContent=document.body.dataset.tzmsg+' '+(s.options[s.selectedIndex]||{}).text;document.body.appendChild(tip);setTimeout(function(){tip.remove()},1800);
  })});
  apply();
  var bg=document.querySelector('.burger'), nav=document.querySelector('nav.main');
  if(bg&&nav){bg.addEventListener('click',function(){var o=nav.classList.toggle('open');bg.setAttribute('aria-expanded',o?'true':'false')})}
  document.querySelectorAll('.filters button').forEach(function(b){b.addEventListener('click',function(){
    document.querySelectorAll('.filters button').forEach(function(x){x.classList.remove('on')});b.classList.add('on');
    var f=b.dataset.f;document.querySelectorAll('.tl li').forEach(function(li){li.style.display=(f==='all'||li.dataset.p===f)?'':'none'});
  })});
  function revealHash(){var id;try{id=decodeURIComponent(location.hash.slice(1))}catch(e){return}var li=document.getElementById(id);if(!li||!li.matches('.tl li'))return;li.classList.remove('hid');li.style.display='';document.querySelectorAll('.filters button').forEach(function(b){b.classList.toggle('on',b.dataset.f==='all')});document.querySelectorAll('.tl li').forEach(function(x){x.style.display=''});requestAnimationFrame(function(){li.scrollIntoView({block:'center'});li.setAttribute('tabindex','-1');li.focus({preventScroll:true})})}
  window.addEventListener('hashchange',revealHash);revealHash();
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

const AUTHORS = readJson("authors.json", {});
const badge = (T, e) => `<span class="badge ${e.kind}">${T.kinds[e.kind]}</span>${e.confidence === "low" ? ` <span class="badge low">${T.lowBadge}</span>` : ""}${e.confidence === "auto" ? ` <span class="badge auto">${T.autoBadge}</span>` : ""}`;
const REAL = (e) => !e.pendingReset && ["reset", "banked", "boost"].includes(e.kind) && Number.isFinite(new Date(e.effectiveAt || e.announcedAt).getTime()) && new Date(e.effectiveAt || e.announcedAt).getTime() <= NOW;
function tweetCard(T, e) {
  const h = e.account.replace(/^@/, ""); const au = AUTHORS[h] || { name: h, handle: h, avatar: "" };
  const av = au.avatar ? `<img src="${esc(au.avatar)}" alt="" width="36" height="36" loading="lazy">` : `<span class="ini">${esc(h[0].toUpperCase())}</span>`;
  return `<div class="tweet"><div class="au">${av}<div><b>${esc(au.name)}</b><span>@${esc(h)}</span></div></div><p class="tx">${esc(e.textEn)}</p><div class="ft"><span>${timeEl(T, e.announcedAt, "full")}</span><a href="${esc(e.sourceUrl)}" target="_blank" rel="noopener">${T.viewOnX}</a></div></div>`;
}
const timeEl = (T, iso, mode = "md") => Number.isFinite(new Date(iso).getTime()) && iso ? `<time datetime="${esc(iso)}" data-ts="${esc(iso)}" data-mode="${mode}">${esc(T.dateFallback(iso, mode))}</time>` : (T.code === "zh" ? "未记录" : "Not recorded");
const href = (T, p) => (T.base + p).replace(/\/$/, "") || "/";

const at = (e) => e.effectiveAt || e.announcedAt;   // 实际生效时间：转正的预告按预告时间，其余按公告时间
const tzPick = (T) => `<select class="tzsel tzinline" aria-label="${T.tz}">${TZ.map(([v, zh, en]) => `<option value="${v}">${T.code === "zh" ? zh : en}</option>`).join("")}</select>`;
const COUNTER = (T, attr) => `<div class="counter" ${attr}><span>--</span><i>${T.units[0]}</i><span>--</span><i>${T.units[1]}</i><span>--</span><i>${T.units[2]}</i></div>`;
function statusCard(T, p) {
  const last = events.filter((e) => e.provider === p && REAL(e)).sort((x, y) => at(y).localeCompare(at(x)))[0];
  const pend = events.find((e) => e.provider === p && e.pendingReset && (!last || e.announcedAt > last.announcedAt));
  const head = (e) => `<div class="head"><span class="logo" aria-hidden="true">${LOGO[p]}</span><span class="name">${PROVIDERS[p].zh}</span>${badge(T, e)}</div>`;
  // 状态一/二：官方已宣布要重置（有时间 → 倒计时；没时间 → 已宣布多久）
  if (pend) {
    const thirdPartyTime = pend.expectedFrom && !["official", "source", "manual"].includes(pend.expectedFrom);
    const exp = pend.expectedAmbiguity || thirdPartyTime ? null : pend.expectedAt, day = pend.expectedPrecision === "day";
    const timingNote = pend.expectedAmbiguity ? (T.code === "zh" ? "时间有歧义，待核实" : "Announced time is ambiguous; under review") : thirdPartyTime ? (T.code === "zh" ? "第三方时间线索，待核实" : "Third-party time lead; under review") : exp ? T.nextKnown : T.nextUnknown;
    const lbl = exp ? (day ? T.untilDayLbl : T.untilLbl) : T.annLbl;
    const line = exp ? `${T.expLine}：${timeEl(T, exp, day ? "date" : "full")}${day ? T.expDayNote : ""} · ${tzPick(T)}` : `${T.annLine}：${timeEl(T, pend.announcedAt, "full")} · ${tzPick(T)}`;
    return `<section class="card ${p} pending" aria-label="${PROVIDERS[p].zh}">
  ${head(pend)}
  <div class="lbl" data-due="${esc(T.dueLbl)}">${lbl}</div>
  ${COUNTER(T, exp ? `data-until="${exp}"` : `data-since="${pend.announcedAt}"`)}
  <div class="last">${line}</div>
  <button class="beg" type="button" data-p="${p}" hidden><span class="beg-l"></span><span class="beg-n">0</span><span class="beg-u"></span></button>
  <div class="teaser-line">${esc(T.summary(pend))}<br><span class="prev">${T.prevGrant}：${last ? timeEl(T, at(last), "full") + " · " + T.kinds[last.kind] : (T.code === "zh" ? "暂无记录" : "No record")}</span></div>
  <div class="foot"><span>${timingNote}</span><a href="${esc(pend.sourceUrl)}" target="_blank" rel="noopener">${T.source}</a></div>
</section>`;
  }
  if (!last) return `<section class="card ${p}"><div class="head"><span class="name">${PROVIDERS[p].zh}</span></div><p>${T.code === "zh" ? "暂无已发生的送额度记录" : "No completed quota grants recorded"}</p></section>`;
  // 状态三：没有预告 → 距上次送额度
  return `<section class="card ${p}" aria-label="${PROVIDERS[p].zh}">
  ${head(last)}
  <div class="lbl">${T.since}</div>
  ${COUNTER(T, `data-since="${at(last)}"`)}
  <div class="last">${T.last}：${timeEl(T, at(last), "full")} · ${tzPick(T)}</div>
  <button class="beg" type="button" data-p="${p}" hidden><span class="beg-l"></span><span class="beg-n">0</span><span class="beg-u"></span></button>
  <div class="evidence-note">${esc(evidenceLabel(T, last))}</div>
  <div class="foot"><span>${T.next}</span><a href="${esc(last.sourceUrl)}" target="_blank" rel="noopener">${T.source}</a></div>
</section>`;
}
function recentPanel(T, n = 4) {
  return `<section class="panel" aria-label="${T.recent}"><div class="ph">${SVG_CLOCK}${T.recent}<a class="more" href="${href(T, "/timeline")}">${T.viewAll}</a></div>
<div class="rows">${events.filter((e) => REAL(e) || e.pendingReset).slice(0, n).map((e) => `<a class="row" href="${href(T, eventPath(e))}"><span class="d">${timeEl(T, e.announcedAt, "date")}</span><span class="p ${e.provider}">${PROVIDERS[e.provider].zh}</span><span>${badge(T, e)}</span></a>`).join("")}</div></section>`;
}
function faqPanel(T) {
  return `<section class="panel" aria-label="${T.faq}"><div class="ph">${SVG_Q}${T.faq}<a class="more" href="${href(T, "/faq")}">${T.all}</a></div>
<div class="faq-rows">${FAQ[T.code].filter((f) => f.home).map((f) => `<details><summary>${esc(f.q)}${SVG_CHEV}</summary><div class="ans">${f.a}<p><a href="${href(T, "/q/" + f.slug)}">${T.openAlone}</a></p></div></details>`).join("")}</div></section>`;
}
function verificationDate(T, iso) {
  if (!iso) return T.noVerification;
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return esc(iso); // a date-only check must not shift with time zones
  return timeEl(T, iso, "full");
}
function evidenceLabel(T, e) {
  if (e.pendingReset || e.kind === "teaser") return T.pendingEvidence;
  if (e.confirmedBy || e.effectiveEvidence?.type === "official") return T.officialEvidence;
  if (e.observedAt || e.effectiveEvidence?.type === "observed") return T.thirdPartyEvidence;
  if (e.effectiveEvidence?.type === "scheduled" || (e.expectedAt && e.effectiveAt === e.expectedAt)) return T.scheduledEvidence;
  if (e.effectiveEvidence?.type === "manual") return T.code === "zh" ? "人工确认，见原帖与备注" : "Manual review; see source and notes";
  return T.announcementEvidence;
}
function timeline(T, list, { filters = false, initial = 30 } = {}) {
  const items = list.map((e, i) => `<li id="e${e.id}" data-p="${e.provider}" class="${i >= initial ? "hid" : ""}">
  <div class="d"><span class="p ${e.provider}">${PROVIDERS[e.provider].zh}</span><span>${timeEl(T, e.announcedAt, "full")}</span>${badge(T, e)}</div>
  <div class="t"><a href="${href(T, eventPath(e))}">${esc(T.summary(e))}</a></div>
  <div class="s">${T.scopeLbl}：${esc(T.scope(e))}${T.detail(e) ? " · " + esc(T.detail(e)) : ""} · ${esc(e.account)} · <a href="${esc(e.sourceUrl)}" target="_blank" rel="noopener">${T.source}</a>${(e.extraLinks || []).map((u, k) => ` <a href="${esc(u)}" target="_blank" rel="noopener">${T.source.replace(" ↗", "")} ${k + 2} ↗</a>`).join("")}</div>
  <div class="evidence-note">${T.verified}：${verificationDate(T, e.verifiedAt)} · ${e.confidence === "auto" ? T.automatic : e.confidence === "high" ? T.humanReview : (T.code === "zh" ? "审核状态未注明" : "Review status not specified")}<br>${T.evidence}：${esc(evidenceLabel(T, e))}${e.effectiveEvidence?.url ? ` · <a href="${esc(e.effectiveEvidence.url)}" target="_blank" rel="noopener">${T.source}</a>` : ""}${e.effectiveAt ? " · " + timeEl(T, e.effectiveAt, "full") : ""}</div>
  <details><summary>${T.tweetCard}</summary>${tweetCard(T, e)}</details>
</li>`).join("\n");
  const f = filters ? `<div class="filters"><button class="on" data-f="all">${T.filters[0]}</button><button data-f="codex">${T.filters[1]}</button><button data-f="claude">${T.filters[2]}</button></div>` : "";
  const more = list.length > initial ? `<button class="more-btn">${T.moreBtn(list.length - initial)}</button>` : "";
  return `${f}<div><ul class="tl">${items}</ul>${more}</div>`;
}
function followBlock() {
  const f = site.follow;
  if (!f?.enabled) return "";
  return `<section class="follow">${f.imagePath ? `<img src="${esc(f.imagePath)}" alt="">` : ""}<div><b>${esc(f.title)}</b><p>${esc(f.desc)}</p>${f.link ? `<p><a href="${esc(f.link)}">${esc(f.linkText || f.link)}</a></p>` : ""}</div></section>`;
}

function shareData(T) {
  // 与首页卡片同一套三态：until=倒计时到预告时间 / since=已宣布多久或距上次多久
  const pick = (p) => {
    const e = events.filter((x) => x.provider === p && REAL(x)).sort((x, y) => at(y).localeCompare(at(x)))[0];
    const pd = events.find((x) => x.provider === p && x.pendingReset && (!e || x.announcedAt > e.announcedAt));
    if (pd) {
      const thirdPartyTime = pd.expectedFrom && !["official", "source", "manual"].includes(pd.expectedFrom);
      const exp = pd.expectedAmbiguity || thirdPartyTime ? null : pd.expectedAt;
      const next = pd.expectedAmbiguity ? (T.code === "zh" ? "时间有歧义，待核实" : "Time ambiguous; under review") : thirdPartyTime ? (T.code === "zh" ? "第三方时间，待核实" : "Third-party time; under review") : exp ? T.nextKnown : T.nextUnknown;
      return { kind: "teaser", until: exp || null, since: exp ? null : pd.announcedAt, lbl: exp ? (pd.expectedPrecision === "day" ? T.untilDayLbl : T.untilLbl) : T.annLbl, next, zh: pd.zh, en: enSummary(pd).slice(0, 80) };
    }
    if (!e) return { kind: "teaser", since: null, lbl: T.code === "zh" ? "暂无记录" : "No record", zh: "暂无已发生的送额度记录", en: "No completed grants recorded", next: T.next };
    return { kind: e.kind, since: at(e), lbl: T.since, next: T.next, zh: e.zh, en: enSummary(e).slice(0, 80) };
  };
  return { site: T.name, url: site.url + T.base, dataUpdatedAt: updatedAt || null, version: VERSION, buildAt: BUILT, codex: pick("codex"), claude: pick("claude"), kinds: T.kinds };
}
function page(T, { title, desc, path: p, active, body, jsonld, noindex = false }) {
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
${noindex ? '<meta name="robots" content="noindex,follow">' : ''}
<meta name="qr-data-version" content="${VERSION}">
<link rel="canonical" href="${esc(url)}">
<link rel="alternate" hreflang="${T.code === "zh" ? "zh-CN" : "en"}" href="${esc(url)}">
<link rel="alternate" hreflang="${T.code === "zh" ? "en" : "zh-CN"}" href="${esc(alt || base + "/")}">
<link rel="alternate" hreflang="x-default" href="${esc(base + (T.code === "zh" ? href(T, p) : (T.other.base + p).replace(/\/$/, "") || "/"))}">
<link rel="alternate" type="application/rss+xml" title="${esc(T.name)}" href="${T.code === "zh" ? "/rss.xml" : "/en/rss.xml"}">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${esc(url)}"><meta property="og:type" content="website"><meta property="og:image" content="${esc(base)}/assets/share.jpg"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${esc(base)}/assets/share.jpg"><meta itemprop="image" content="${esc(base)}/assets/share.jpg"><meta itemprop="name" content="${esc(title)}"><meta itemprop="description" content="${esc(desc)}">
${site.verify && site.verify.baidu ? `<meta name="baidu-site-verification" content="${esc(site.verify.baidu)}">` : ""}
<meta name="theme-color" content="#FFEA00">
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#FFEA00"/><circle cx="16" cy="16" r="7" fill="#1467F5"/><circle cx="16" cy="16" r="2.5" fill="#fff"/></svg>')}">
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, "\\u003c")}</script>` : ""}
<style>${CSS}</style>
</head>
<body data-units='${JSON.stringify(T.units)}' data-tzmsg="${T.tzSwitched}" data-tzlabels='${JSON.stringify(tzLabels)}'>
<div class="page">
<header class="top">
  <div class="brand"><p class="brand-name"><a href="${href(T, "/")}">${esc(T.name)}</a></p><span class="tag">${esc(T.tagline)}</span></div>
  <button class="burger" aria-label="${T.menu}" aria-expanded="false" aria-controls="mainnav">${SVG_BURGER}</button>
  <nav class="main" id="mainnav">${T.nav.map(([h, t]) => `<a href="${href(T, h)}" class="${active === h ? "on" : ""}">${t}</a>`).join("")}<a class="lang" href="${(T.other.base + p).replace(/\/$/, "") || "/"}" hreflang="${T.other.code}">${T.other.label}</a><select class="tzsel" aria-label="${T.tz}">${tzOptions}</select></nav>
</header>
<main>
<div class="snapshot-strip"><span>${T.updated}：${timeEl(T, updatedAt, "full")}</span><a href="${href(T, "/status")}">${T.status} ↗</a></div><div class="version-notice" role="status" hidden></div>
${body}
</main>
${followBlock()}
<footer>${T.footer}<br><span class="fmeta">${T.updated}：${timeEl(T, updatedAt, "full")} · <a href="${href(T, "/about")}">${T.about}</a> · <a href="${href(T, "/method")}">${T.method}</a> · <a href="${href(T, "/privacy")}">${T.privacy}</a> · <a href="${href(T, "/status")}">${T.status}</a> · <a href="/api/events.json">JSON</a> · <a href="${T.code === "zh" ? "/rss.xml" : "/en/rss.xml"}">RSS</a></span></footer>
</div>
<script type="application/json" id="share-data">${JSON.stringify(shareData(T)).replace(/</g, "\\u003c")}</script>
<script>${JS}</script>
<script defer src="/status.js"></script>
<script defer src="/share.js"></script>
<script defer src="/beg.js"></script>
<script defer src="/_vercel/insights/script.js"></script>

${site.analytics && site.analytics.baiduTongji ? `<script>var _hmt=_hmt||[];(function(){var hm=document.createElement("script");hm.src="https://hm.baidu.com/hm.js?${site.analytics.baiduTongji}";var s=document.getElementsByTagName("script")[0];s.parentNode.insertBefore(hm,s);})();</script>` : ""}
</body>
</html>`;
}

// ───────── 逐语言生成 ─────────
for (const T of [L.zh, L.en]) {
  const dir = T.base.replace(/^\//, "");
  const file = (rel) => (dir ? dir + "/" : "") + rel;
  const hero = `<section class="hero">
  <div><h1>${T.hero1}<br><span class="b">${T.hero2}</span></h1><p class="sub">${esc(T.tagline)}</p></div>
  <div class="art"><span class="bolt" aria-hidden="true"></span><picture><source media="(min-width:769px)" type="image/webp" srcset="${T.code === "zh" ? "/assets/radar-mascot-sign.webp" : "/assets/radar-mascot-sign-en.webp"}"><source media="(min-width:769px)" srcset="${T.code === "zh" ? "/assets/radar-mascot-sign.png" : "/assets/radar-mascot-sign-en.png"}"><source type="image/webp" srcset="/assets/radar-mascot.webp"><img src="/assets/radar-mascot.png" alt="${esc(T.mascotAlt)}" width="900" height="603" fetchpriority="high"></picture></div>
</section>`;
  out(file("index.html"), page(T, { title: T.title, desc: T.desc, path: "/", active: "/",
    body: `${hero}<div class="quota-grid">${statusCard(T, "codex")}${statusCard(T, "claude")}</div><div class="info-grid">${recentPanel(T, 4)}${faqPanel(T)}</div>`,
    jsonld: { "@context": "https://schema.org", "@type": "WebSite", name: T.name, url: site.url + T.base, inLanguage: T.locale, description: T.tagline } }));

  out(file("timeline.html"), page(T, { title: `${T.tlTitle} (${events.length}) | ${T.name}`, desc: T.tlDesc, path: "/timeline", active: "/",
    body: `<h1 class="sec" style="margin-top:12px">${T.tlTitle}<small>${events.length} ${T.items}</small></h1>${timeline(T, events, { filters: true, initial: 30 })}` }));

  for (const p of ["codex", "claude"]) {
    const list = events.filter((e) => e.provider === p);
    out(file(`${p}.html`), page(T, { title: T.pTitle[p], desc: T.pDesc(p), path: `/${p}`, active: `/${p}`,
      body: `<h1 class="sec" style="margin-top:12px">${T.pNow(p)}</h1><div class="quota-grid one">${statusCard(T, p)}</div><p class="note">${T.pNote[p]}</p>
<h2 class="sec">${T.pAll(p)}<small>${list.length} ${T.items}</small></h2>${timeline(T, list, { initial: 40 })}
<h2 class="sec">${T.related}</h2><div class="faq">${FAQ[T.code].filter((f) => f.slug.includes(p) || f.slug.startsWith("chongzhi") || f.slug.startsWith("ruhe")).map((f) => `<details><summary>${esc(f.q)}</summary>${f.a}<p class="perma"><a href="${href(T, "/q/" + f.slug)}">${T.openAlone}</a></p></details>`).join("")}</div>` }));
  }

  const faqLd = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: FAQ[T.code].map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: plain(f.a) } })) };
  out(file("faq.html"), page(T, { title: T.faqTitle, desc: T.faqDesc, path: "/faq", active: "/faq",
    body: `<h1 class="sec" style="margin-top:12px">${T.faq}</h1><div class="faq">${FAQ[T.code].map((f) => `<details id="${f.slug}" open><summary>${esc(f.q)}</summary>${f.a}<p class="perma"><a href="${href(T, "/q/" + f.slug)}">${T.openAlone}</a></p></details>`).join("")}</div>`, jsonld: faqLd }));

  for (const f of FAQ[T.code]) {
    out(file(`q/${f.slug}.html`), page(T, { title: `${f.q} | ${T.name}`, desc: plain(f.a).slice(0, 120), path: `/q/${f.slug}`, active: "/faq",
      body: `<nav class="breadcrumbs" aria-label="${T.code === 'zh' ? '当前位置' : 'Breadcrumb'}"><a href="${href(T, '/')}">${T.nav[0][1]}</a> / <a href="${href(T, '/faq')}">${T.faq}</a></nav><article class="q guide" style="margin-top:12px"><h1>${esc(f.q)}</h1>${f.body || f.a}</article><h2 class="sec">${T.recentNews}</h2>${timeline(T, events.filter(searchableEvent).filter(e => !f.slug.includes('codex') && !f.slug.includes('claude') || f.slug.includes(e.provider)).slice(0, 5), { initial: 5 })}<p style="margin-top:8px;font-size:14px"><a href="${href(T, "/timeline")}">${T.allRecords}</a> · <a href="${href(T, "/faq")}">${T.otherQ}</a></p>`,
      jsonld: breadcrumbs(site.url, [[T.name, href(T, '/')], [T.faq, href(T, '/faq')], [f.q, href(T, '/q/' + f.slug)]]) }));
  }

  for (const e of events) {
    const title = `${PROVIDERS[e.provider].zh} · ${e.announcedAt.slice(0, 10)} · ${T.summary(e)} | ${T.name}`;
    out(file(`events/${e.id}.html`), page(T, { title, desc: `${T.summary(e)} ${T.scopeLbl}: ${T.scope(e)}. ${e.confidence === 'auto' ? T.automatic : !searchableEvent(e) ? T.lowBadge : T.humanReview}`,
      path: eventPath(e), active: '/' + e.provider, noindex: !searchableEvent(e),
      body: eventArticle(T, e, { timeEl, verificationDate, evidenceLabel, badge, tweetCard, href }),
      jsonld: breadcrumbs(site.url, [[T.name, href(T, '/')], [PROVIDERS[e.provider].zh, href(T, '/' + e.provider)], [T.summary(e), href(T, eventPath(e))]]) }));
  }

  out(file("about.html"), page(T, { title: `${T.about} | ${T.name}`, desc: T.desc, path: "/about", active: "",
    body: ABOUT[T.code](site.about || {}) }));

  const documents = T.code === "zh" ? {
    method: `<h1>数据说明与纠错</h1><p class="lede">一条公告、一次到账、一张待领取的卡，是三件事。</p><h2>记录如何产生</h2><p>参考站接口和官方账号时间线提供线索；采集器回查原帖的账号、发布时间和完整正文。只有符合来源与分类规则的记录才进入公开时间线。无法确定的线索保留待处理，不应当作已发生重置。</p><p>「原帖核验」表示检查过来源，不代表核验了每个账户。标「待整理」的是自动收录摘要；未给明确适用范围时保留「待核实」，不能据此承诺你一定有额度。</p><h2>四种类型</h2><ul><li><b>全员重置：</b>按公告的适用范围恢复额度；「全员」仍受套餐和条件限制。</li><li><b>重置卡：</b>存入账户、需要手动使用；提醒领取旧卡不算一次新发卡。</li><li><b>提额：</b>限额或可用额度增加，不等同于重置。</li><li><b>预告：</b>未来计划，单独展示，不计入已发生记录。</li></ul><h2>时间依据</h2><p>优先采用关联的官方确认；其次是明确匹配该公告的第三方执行证据；最后才按官方预告时间记录。只给日期时保留日期精度，未给日期的预告不会因等待很久就变成已发生。按计划记时和第三方观察均有标识，不代表本站在你的账户上做过实测。</p><p>时间线的主日期是原帖发布时间，生效时间另列。原帖核验只有日期时不伪造钟点。「记录最近变更」是内容快照时间；没有新公告不代表采集失败。<a href="/status">状态页</a>说明当前可核对的范围。</p><h2>纠错和开放数据</h2><p>用右下角「留言」提交记录链接、错误点和原帖依据。更正后会更新本站数据版本；旧截图不会自动变化。可读取 <a href="/api/events.json">JSON</a> 或订阅 <a href="/rss.xml">RSS</a>，引用请注明本站和官方原帖；原帖版权归原作者。</p>`,
    privacy: `<h1>隐私与服务边界</h1><p class="lede">公开信息免费。本站不接入你的 AI 账户。</p><h2>使用本站</h2><p>不需要注册，也不需要提交 OpenAI / Anthropic 的密码、Cookie 或 API Key。本站不能展示或恢复你的个人额度；公告适用范围、领取资格和实际到账以官方账户页面为准。本站与两家公司没有隶属关系。</p><h2>浏览与本地设置</h2><p>浏览器本地保存你选择的时区，刷新后沿用。页面使用 Vercel Web Analytics 和百度统计了解访问情况；托管和统计服务可能处理 IP、设备及页面访问等请求信息，其处理同时受各自服务规则约束。清除浏览器站点数据可重置本地偏好。</p><h2>留言和点击</h2><p>留言会把你填写的内容、可选联系方式、所在页面和语言发送到维护者的飞书运维收件处，用于处理反馈。请勿填写密码、密钥、订单付款信息等敏感内容。联系方式不是必填项。</p><p>「求重置」数字是点击次数，不是独立人数。接口用短期请求标识进行限流和批次去重；这不能证明有多少真实用户希望重置。提交失败会提示未计入，不保证所有离线点击均保存。</p><p>反馈处理依赖托管、计数和飞书服务。需要更正或删除已提交的信息，可通过「留言」说明提交时间和内容；维护者会据此核实处理，目前不承诺固定处理时限。</p><h2>当前服务与未来收费</h2><p>公告时间线、数据说明与公开查询当前免费。本站正在探索广告、合作链接等公开网页商业模式，目前没有订阅或支付功能。未来如有广告或佣金链接，会作出明确标识；商业合作不应影响公告核验结论。</p><p>自动摘要可能出错，第三方来源可能延迟，历史间隔不能用来预测下一次重置。本站不保证实时性、完整性或特定账户一定收到额度。</p>`,
    status: `<h1>服务状态</h1><p class="lede">每天北京时间 09:30 检查一次官方额度消息；更新可能有延迟，非实时监控。</p><section class="health-panel" role="status"><h2>运行情况</h2><p data-health-summary>正在检查采集与发布状态…</p><ul data-health-reasons></ul><p data-health-times></p></section><dl class="status-facts"><dt>记录最近变更</dt><dd>${timeEl(T, updatedAt, "full")}</dd><dt>本站构建时间</dt><dd>${timeEl(T, BUILT, "full")}</dd><dt>公开记录</dt><dd>${events.length} 条</dd><dt>数据版本</dt><dd><code>${VERSION}</code></dd><dt>页面版本核对</dt><dd data-version-status>正在核对…</dd></dl><h2>这些信息能说明什么</h2><p>版本一致只说明当前页面匹配已发布数据，不代表最近一次采集、通知或部署全部成功。上方运行情况来自公开健康接口，检查采集心跳与线上版本是否匹配。下方构建信息来自静态快照。健康接口也有短暂缓存，并非账户到账证明。</p><p>记录没有变化可能是没有新公告，不能据此判断采集异常。若打开旧页面后有新的发布，页面会提示刷新。临时无法检查版本会明确显示，不会标为「一切正常」。</p><p><a href="/api/health">运行健康 JSON</a> · <a href="/api/status.json">构建快照 JSON</a> · <a href="/api/events.json">公开事件 JSON</a> · <a href="/method">数据口径</a></p><p>发现某条公告遗漏、过期或错误，请用「留言」附上原帖链接。</p>`
  } : {
    method: `<h1>Data method & corrections</h1><p class="lede">An announcement, an effective reset and a redeemable reset are different events.</p><h2>How records are collected</h2><p>Reference-site APIs and official account timelines provide leads. The collector checks the original author, timestamp and full text. Records must satisfy the source and classification rules before publication; ambiguous leads belong in the review queue.</p><p>“Source checked” verifies a post, not every user's account. “Auto” means the summary has not completed a separate summary and evidence review. Unspecified eligibility stays under review rather than promising quota to everyone.</p><h2>Types and timing</h2><ul><li><b>Full reset:</b> quota restored within the announcement's eligibility conditions.</li><li><b>Banked reset:</b> a grant that must be redeemed; a reminder about an old grant is not a new one.</li><li><b>Quota boost:</b> more allowance, not necessarily a reset.</li><li><b>Heads-up:</b> a future plan, excluded from completed-event counts.</li></ul><p>Related official confirmation takes priority, followed by matching third-party execution evidence, then the officially scheduled time. Day-only announcements keep their precision. Announcements without a time remain pending until there is evidence. Scheduled-time entries and third-party observations do not verify delivery to your account.</p><p>The timeline's main date is the post timestamp; effective times are listed separately. A date-only source check does not imply a precise check time. “Records last changed” describes the content snapshot, not collector health. See <a href="/en/status">service status</a>.</p><h2>Corrections and open data</h2><p>Use Feedback to send the affected record, correction and source link. Corrections update the data version; existing screenshots do not change. Use <a href="/api/events.json">JSON</a> or <a href="/en/rss.xml">RSS</a> with attribution to this site and the original post. Original posts remain their authors' work.</p>`,
    privacy: `<h1>Privacy & service limits</h1><p class="lede">Public information is free. We do not connect to your AI account.</p><h2>Using the site</h2><p>No registration, OpenAI / Anthropic password, cookie or API key is required. We cannot show or restore your personal quota. Official account pages determine your eligibility and actual delivery. We are not affiliated with either company.</p><h2>Browsing and preferences</h2><p>Your selected time zone is stored locally in the browser. Vercel Web Analytics and Baidu Analytics help us understand visits; hosting and analytics services may process request information such as IP addresses, devices and page visits under their own rules. Clearing site data resets local preferences.</p><h2>Feedback and taps</h2><p>Feedback sends your message, optional contact details, page and language to the maintainer's Feishu operations inbox. Do not submit passwords, keys or payment information. Contact details are optional.</p><p>The reset button counts taps, not unique people. Short-lived request identifiers support rate limiting and batch deduplication. These counts are not a measure of real unique demand, and offline taps are not guaranteed to be saved.</p><p>Feedback relies on hosting and messaging services. To request correction or deletion of feedback, submit its approximate time and content through Feedback. We currently do not promise a fixed handling time.</p><h2>Free service and future plans</h2><p>The public timeline, data explanations and queries are free. We are exploring advertising and affiliate links; subscriptions and payments are not available now. Any ads or commission-bearing links will be labeled. Commercial relationships must not determine our evidence conclusions.</p><p>Automatic summaries can be wrong and sources can be delayed. Historical intervals do not predict future resets. We do not guarantee completeness, real-time delivery or quota for a specific account.</p>`,
    status: `<h1>Service status</h1><p class="lede">Official quota news is checked once daily at 09:30 Beijing time (01:30 UTC). Updates may be delayed; this is not real-time monitoring.</p><section class="health-panel" role="status"><h2>Operations</h2><p data-health-summary>Checking collection and publication…</p><ul data-health-reasons></ul><p data-health-times></p></section><dl class="status-facts"><dt>Records last changed</dt><dd>${timeEl(T, updatedAt, "full")}</dd><dt>Site built</dt><dd>${timeEl(T, BUILT, "full")}</dd><dt>Public records</dt><dd>${events.length}</dd><dt>Data version</dt><dd><code>${VERSION}</code></dd><dt>Page version check</dt><dd data-version-status>Checking…</dd></dl><h2>What this tells you</h2><p>A matching version only means this page matches the published data. It does not prove that collection, notifications or every deployment succeeded. The operations section checks the public health endpoint for collection heartbeats and deployed versions. Build details are a static snapshot. Health checks may be briefly cached and do not confirm quota delivery.</p><p>Unchanged records may mean no new announcements. An older page shows a refresh notice when a new version is published. Failed version checks are shown as unavailable, never as “all systems operational”.</p><p><a href="/api/health">Health JSON</a> · <a href="/api/status.json">Build snapshot JSON</a> · <a href="/api/events.json">Events JSON</a> · <a href="/en/method">Data method</a></p><p>For missing, outdated or incorrect announcements, use Feedback and include the source link.</p>`
  };
  for (const [slug, text] of Object.entries(documents)) {
    const label = T[slug];
    out(file(`${slug}.html`), page(T, { title: `${label} | ${T.name}`, desc: label, path: `/${slug}`, active: "", body: `<article class="q public-doc" style="margin-top:12px">${text}</article>` }));
  }

  // RSS（两种语言）
  const base = site.url.replace(/\/$/, "");
  out(file("rss.xml"), `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${esc(T.name)}</title><link>${base}${T.base}</link><description>${esc(T.tagline)}</description><language>${T.locale}</language>
${events.filter(searchableEvent).slice(0, 50).map((e) => `<item><title>${esc(`[${PROVIDERS[e.provider].zh} · ${T.kinds[e.kind]}] ${T.summary(e)}`)}</title><link>${esc(base + href(T, eventPath(e)))}</link><guid isPermaLink="false">${e.id}-${T.code}</guid><pubDate>${new Date(e.announcedAt).toUTCString()}</pubDate><description>${esc(`<p>${esc(T.scopeLbl)}: ${esc(T.scope(e))}. ${esc(T.detail(e))}</p><p>${esc(e.textEn)}</p><p><a href="${esc(e.sourceUrl)}">${esc(T.source)}</a></p>`)}</description></item>`).join("\n")}
</channel></rss>`);
}

// ───────── 机器可读（共用）─────────
const base = site.url.replace(/\/$/, "");
out("api/events.json", JSON.stringify({ site: site.name, url: site.url, version: VERSION, updatedAt: updatedAt || null, kinds: Object.fromEntries(Object.entries(KINDS).map(([k, v]) => [k, { zh: v.zh, en: L.en.kinds[k] || k }])),
  events: events.map(({ textEn, ...e }) => ({ ...e, en: enSummary({ ...e, textEn }), scopeEn: e.scopeEn || scopeEn(e.scope) })) }, null, 1));
out("api/status.json", JSON.stringify({ schemaVersion: 1, version: VERSION, dataUpdatedAt: updatedAt || null, buildAt: BUILT, eventCount: events.length, source: "static-build", note: "Build snapshot only; not a live collector health check." }, null, 2));
const urls = [];
for (const T of [L.zh, L.en]) for (const u of ["/", "/timeline", "/codex", "/claude", "/faq", "/about", "/method", "/privacy", "/status", ...FAQ[T.code].map((f) => `/q/${f.slug}`), ...events.filter(searchableEvent).map(eventPath)]) urls.push(href(T, u));
// lastmod is optional; a build timestamp is not a trustworthy content change date.
out("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((u) => `<url><loc>${base}${u}</loc></url>`).join("")}</urlset>`);
out("robots.txt", `User-agent: *\nAllow: /\nSitemap: ${base}/sitemap.xml\n`);
out("404.html", page(L.zh, { title: `页面不存在 | ${site.name}`, desc: "页面不存在", path: "/404", active: "", noindex: true,
  body: `<article class="q" style="margin-top:12px"><h1>这一页不存在</h1><p>可能链接打错了，或者这条记录已合并。</p><p><a href="/">回首页</a> · <a href="/timeline">全部记录</a> · <a href="/en">English</a></p></article>` }));
out("en/404.html", page(L.en, { title: "Page not found | Quota Radar", desc: "Page not found", path: "/404", active: "", noindex: true,
  body: `<article class="q" style="margin-top:12px"><h1>Page not found</h1><p>The link may be incorrect, or the record may have been merged.</p><p><a href="/en">Home</a> · <a href="/en/timeline">All events</a> · <a href="/">中文</a></p></article>` }));
for (const f of fs.readdirSync(path.join(ROOT, "site"))) if (/^[0-9a-f]{32}\.txt$/.test(f)) out(f, fs.readFileSync(path.join(ROOT, "site", f), "utf8"));
// 百度站长验证文件原样进根目录（vercel.json 已关 cleanUrls，.html→308 的规则放过 baidu_verify_）
for (const f of fs.readdirSync(path.join(ROOT, "site"))) if (/^baidu_verify_.*\.html$/.test(f)) out(f, fs.readFileSync(path.join(ROOT, "site", f), "utf8"));
if (fs.existsSync(path.join(ROOT, "site/assets"))) fs.cpSync(path.join(ROOT, "site/assets"), path.join(DIST, "assets"), { recursive: true });
fs.copyFileSync(path.join(ROOT, "site/share.js"), path.join(DIST, "share.js"));
fs.copyFileSync(path.join(ROOT, "site/beg.js"), path.join(DIST, "beg.js"));
fs.copyFileSync(path.join(ROOT, "site/status.js"), path.join(DIST, "status.js"));

console.log(`构建完成：${events.length} 条事件，${urls.length} 个页面（中英）→ dist/`);
