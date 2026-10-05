// Editorial guides checked against official sources on this date, not on every build.
export const GUIDE_REVIEWED_AT = '2026-10-05';
const pricing = 'https://learn.chatgpt.com/docs/pricing#what-are-the-usage-limits-for-my-plan';
const usage = 'https://chatgpt.com/codex/settings/usage';
const claudeUsage = 'https://claude.ai/settings/usage';
const claudeLimits = 'https://support.claude.com/en/articles/11647753-how-do-usage-and-length-limits-work';
const claudeCommands = 'https://support.claude.com/en/articles/14553413-claude-code-cheatsheet';
const claudeResets = 'https://support.claude.com/en/articles/17007452-what-is-a-limit-reset';
const link = (url, text) => `<a href="${url}" target="_blank" rel="noopener">${text} ↗</a>`;

export function enrichGuides(faq) {
  for (const lang of ['zh', 'en']) {
    const zh = lang === 'zh', base = zh ? '' : '/en';
    const text = (cn, en) => zh ? cn : en;
    const related = `<h2>${text('接下来可以看', 'Read next')}</h2><ul><li><a href="${base}/q/ruhe-chakan-ziji-shifou-you-edu">${text('查看自己的剩余额度', 'Check your remaining usage')}</a></li><li><a href="${base}/q/chongzhi-ka-shi-shenme">${text('重置卡、直接重置和提额的区别', 'Banked resets, full resets and boosts')}</a></li><li><a href="${base}/q/weishenme-bieren-chongzhi-wo-meiyou">${text('别人收到了，为什么我没有？', 'Why did someone else receive a reset?')}</a></li></ul>`;
    const overrides = {
      'codex-shenme-shihou-chongzhi': {
        q: text('Codex 额度什么时候恢复？怎么看自己的重置时间？', 'When does my Codex quota reset?'),
        a: text(`<p>个人恢复时间请看 ${link(usage, 'Codex 官方用量页')}，或在 CLI 输入 <code>/status</code>。本站记录的是官方额外送额度的公告，不是你的个人倒计时。</p>`, `<p>Check your reset time in the ${link(usage, 'Codex usage dashboard')} or run <code>/status</code> in the CLI. This site tracks extra grants announced by the vendor, not your personal countdown.</p>`),
        body: text(`<h2>先分清你在等哪一种恢复</h2><p><b>个人额度恢复：</b>账户会显示适用限制及恢复时间。不同套餐不应套同一个规则；核验时的官方文档说明，Plus 和标准 Business 有五小时用量估计，Pro 当前没有五小时限制，周限额也可能适用。</p><p><b>官方额外赠送：</b>可能是直接恢复、发一张以后用的卡，或增加额度。请到 <a href="/codex">Codex 官方公告记录</a>核对事件类型与适用范围。</p><h2>一分钟内找到自己的答案</h2><ol><li>打开官方用量页，确认登录的是日常使用的账号和工作区。</li><li>找到已经达到上限的那一项，读它显示的恢复时间；不要拿另一项的剩余比例替代。</li><li>若你在查额外赠送，核对公告条件和账户里是否出现相应权益。</li></ol><p>历史上两次赠送相隔多久，不能推算你的下一次恢复时间。</p>`, `<h2>Personal limits and extra grants are different</h2><p>Read the limits shown for your account. At our source check, OpenAI documents five-hour estimates for Plus and Standard Business; Pro currently has no five-hour limit. Weekly limits may apply.</p><p>Extra grants can be full resets, banked resets or boosts. Check the <a href="/en/codex">Codex announcement history</a> for eligibility.</p><h2>Find your answer</h2><ol><li>Open the dashboard for the account and workspace you actually use.</li><li>Find the exhausted limit and read its reset time, rather than the percentage for a different limit.</li><li>For a grant, compare the announcement conditions with the entitlement visible in your account.</li></ol><p>Historical grant intervals cannot predict your next reset.</p>`),
        sources: [[pricing, text('OpenAI：用量限制与查询入口', 'OpenAI: usage limits and dashboard')]],
      },
      'claude-edu-shenme-shihou-huifu': {
        q: text('Claude Code 额度用完了，什么时候恢复？', 'Claude Code usage limit reached: when does it reset?'),
        a: text(`<p>在 Claude Code 输入 <code>/usage</code>，或打开 ${link(claudeUsage, 'Claude 设置 → 用量')}，查看账户显示的限制与恢复时间。先确认是用量限制，还是单次对话太长。</p>`, `<p>Run <code>/usage</code> in Claude Code or open ${link(claudeUsage, 'Claude Settings → Usage')} for your limits and reset times. First distinguish an exhausted usage limit from a conversation that is too long.</p>`),
        body: text(`<h2>按这个顺序检查</h2><ol><li>确认登录方式：订阅账户和 API 账户的计费方式不同。</li><li>读限制提示和用量页：看清达到上限的是哪一项。</li><li>等该项显示的恢复时间，或自行评估账户提供的其他选项；付费选项另行计费。</li></ol><h2>开新对话会恢复额度吗？</h2><p>新对话可以解决某些对话长度问题，但不会把已经用完的账户额度恢复。Claude 的用量会在多个产品入口之间共享。</p><h2>官方送了重置，为什么还没恢复？</h2><p>查看 <a href="/claude">Claude 公告记录</a>。如账户提供可手动使用的 limit reset，请读清它恢复的是五小时还是周限制、是否有到期时间；不要把收到权益当成已经使用。</p>`, `<h2>Check in this order</h2><ol><li>Confirm how you signed in: a subscription and an API account have different billing.</li><li>Read the limit message and identify the exhausted allowance.</li><li>Wait for its displayed reset time, or evaluate options offered in your account. Paid options add costs.</li></ol><h2>Will a new conversation restore my quota?</h2><p>A new conversation may address conversation-length issues; it does not replenish account usage. Claude usage is shared across product surfaces.</p><h2>What about an announced reset?</h2><p>Check the <a href="/en/claude">Claude history</a>. If your account offers a redeemable limit reset, inspect the affected window and expiry before using it.</p>`),
        sources: [[claudeLimits, text('Claude：用量与对话长度', 'Claude: usage and conversation length')], [claudeCommands, text('Claude Code：/usage 命令', 'Claude Code: /usage command')], [claudeResets, text('Claude：手动重置说明', 'Claude: redeemable limit resets')]],
      },
      'ruhe-chakan-ziji-shifou-you-edu': {
        q: text('Codex 和 Claude Code 怎么查看剩余额度？', 'How to check remaining Codex and Claude Code usage'),
        a: text(`<p><b>Codex：</b>${link(usage, '官方用量页')}，CLI 输入 <code>/status</code>。<b>Claude：</b>${link(claudeUsage, '设置 → 用量')}，Claude Code 输入 <code>/usage</code>。</p><p>本站不接入你的账户，不索取密码、Cookie 或 API Key。</p>`, `<p><b>Codex:</b> ${link(usage, 'usage dashboard')} or <code>/status</code> in the CLI. <b>Claude:</b> ${link(claudeUsage, 'Settings → Usage')} or <code>/usage</code> in Claude Code.</p><p>We do not connect to your account or request passwords, cookies or API keys.</p>`),
        body: text(`<h2>用量页应该看什么</h2><ol><li><b>账户和工作区：</b>确保你查看的就是实际使用的账户。</li><li><b>限制名称：</b>短周期、周额度、额外购买的额度可能分别显示。</li><li><b>剩余量和恢复时间：</b>按同一项限制对应查看，注意页面采用的时区。</li><li><b>赠送权益：</b>有重置卡时，先读影响范围、有效期和使用按钮提示。</li></ol><h2>为什么本站数字和我的账户不同？</h2><p>首页的“距上次送额度”描述一条公开公告。它不是你的剩余额度，也不是账户恢复倒计时。你可以在这里核对消息，再回官方用量页确认自己的状态。</p>`, `<h2>What to look for</h2><ol><li><b>Account and workspace:</b> check the one you actually use.</li><li><b>Limit name:</b> short-period, weekly and purchased allowances may be separate.</li><li><b>Remaining allowance and reset time:</b> read the matching row and check its time zone.</li><li><b>Grants:</b> inspect the affected limits, expiry and redemption instructions.</li></ol><h2>Why is the homepage different?</h2><p>“Since the last quota grant” describes a public announcement. It is not your remaining quota or account countdown. Verify the news here, then your account on the official dashboard.</p>`),
        sources: [[pricing, 'OpenAI'], [claudeCommands, 'Claude Code']],
      },
      '5-xiaoshi-chuang-he-zhou-edu': {
        q: text('5 小时限额和周限额有什么区别？', 'Five-hour vs weekly usage limits: what is the difference?'),
        a: text(`<p>如果你的套餐同时有短周期和周限额，就需要分别查看。短周期恢复，不代表周额度也恢复；不同产品和套餐的限制可能不同，不能一概套用“五小时”。</p>`, `<p>If your plan has both short-period and weekly limits, check them separately. A short-period reset does not imply a weekly reset. Products and plans differ; do not assume every plan has a five-hour limit.</p>`),
        body: text(`<h2>一个容易理解的例子</h2><p>用量页假设显示“短周期还有80%，周额度已用完”。这里80%不代表你一定能继续，因为你还受另一项限制。这个数字只是说明例子，不是任何套餐的实际额度。</p><h2>为什么不能按消息条数算？</h2><p>任务、模型和上下文等会影响消耗。不要把一位用户的可用次数套到所有账户，也不要用 API 单价反推订阅额度。</p><h2>赠送的重置会恢复哪一项？</h2><p>按这次公告和账户权益说明判断。尤其是 Claude 的手动 limit reset，官方说明会指明五小时或周限制；不能笼统声称所有卡都重置两个窗口。</p>`, `<h2>A simple example</h2><p>Suppose a dashboard says “80% of short-period usage remains” but the weekly limit is exhausted. The remaining percentage alone does not guarantee access. These numbers are illustrative, not actual plan allowances.</p><h2>Why not count messages?</h2><p>Tasks, models and context affect consumption. Another user's message count is not your entitlement, and API prices do not determine included subscription usage.</p><h2>Which limit does a grant restore?</h2><p>Read that offer's conditions. Claude's redeemable reset specifies a five-hour or weekly limit; do not assume every grant restores both.</p>`),
        sources: [[pricing, 'OpenAI'], [claudeResets, text('Claude：手动重置说明', 'Claude: limit resets')]],
      },
      'weishenme-bieren-chongzhi-wo-meiyou': {
        q: text('为什么别人收到额度重置，我没有？', 'Why did someone else receive a reset, but not me?'),
        a: text(`<p>先核对同一条公告的套餐范围、事件类型和生效依据，再看自己的官方用量页。别人说“恢复了”，可能指个人窗口恢复，也可能指手动用了重置卡。</p>`, `<p>Compare the same announcement's eligible plans, event type and timing evidence, then check your own official usage page. Someone else may mean a personal window reset or a redeemed banked grant.</p>`),
        body: text(`<h2>逐项排查</h2><ol><li><b>是不是同一件事：</b>对方说的是常规恢复、免费赠送，还是付费购买？</li><li><b>套餐与范围是否符合：</b>有些公告只覆盖特定套餐或受影响账户。</li><li><b>只是预告，还是已确认：</b>官方说将要发放，不等于现在已生效。</li><li><b>发卡还是直接恢复：</b>如果需手动使用，请去官方入口看是否存在可用权益。</li><li><b>账户是否一致：</b>核对登录账户和工作区，仍有疑问时通过官方支持入口处理。</li></ol><p>不要向第三方提交密码、Cookie 或密钥换取“补发”。本站只能核对公告，无法代你发额度。</p>`, `<h2>A practical checklist</h2><ol><li><b>Same event?</b> Distinguish regular recovery, free grants and paid purchases.</li><li><b>Eligible account?</b> Some announcements apply only to specific plans or affected users.</li><li><b>Announcement or confirmation?</b> A future promise is not delivery now.</li><li><b>Banked or immediate?</b> Check the official entry point if redemption is required.</li><li><b>Same account?</b> Confirm the signed-in account and workspace. Use official support for unresolved account issues.</li></ol><p>Do not hand credentials to a third party promising a replacement grant. We can check announcements, but cannot grant quota.</p>`),
        sources: [[pricing, 'OpenAI'], [claudeResets, 'Claude']],
      },
    };
    faq[lang] = faq[lang].map(f => overrides[f.slug] ? { ...f, ...overrides[f.slug] } : f);
    const newSlug = 'weishenme-bieren-chongzhi-wo-meiyou';
    faq[lang].push({ slug: newSlug, ...overrides[newSlug] });
    // Eligibility is event-specific; do not promise all paid plans or all clients qualify.
    const eligibility = faq[lang].find(f => f.slug === 'suoyou-ren-dou-hui-shoudao-ma');
    eligibility.a = text('<p>不一定。先看每条记录的适用范围，再看自己的官方用量页。有些赠送只面向特定套餐或受影响账户；发放重置卡也不等于已经手动使用。公告未说明的条件，本站会保留为待核实。</p>', '<p>Not necessarily. Read the eligibility on that event and check your official account. A grant may be limited to specific plans or affected accounts; receiving a banked grant is not the same as redeeming it. Unspecified conditions remain unverified.</p>');
    for (const f of faq[lang]) {
      if (!f.body) continue;
      f.body = f.a + f.body + related + `<section class="guide-sources"><h2>${text('官方参考与核验日期', 'Official references and review date')}</h2><p>${text('核验日期', 'Reviewed')}: <time datetime="${GUIDE_REVIEWED_AT}">${GUIDE_REVIEWED_AT}</time> · ${text('规则可能变化，以官方账户显示为准。', 'Rules can change; check your official account.')}</p><ul>${f.sources.map(([url, title]) => `<li>${link(url, title)}</li>`).join('')}</ul></section>`;
    }
  }
  return faq;
}
