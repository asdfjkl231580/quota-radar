// Searchable event pages keep the same evidence rules as the public timeline.
// Build dates are deliberately not presented as content modification dates.
export const eventPath = e => `/events/${e.id}`;
export const searchableEvent = e => e.verified === true && e.confidence === 'high';
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function breadcrumbs(base, entries) {
  return { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: entries.map(([name, url], i) => ({ '@type': 'ListItem', position: i + 1, name, item: base + url })) };
}

export function eventArticle(T, e, { timeEl, verificationDate, evidenceLabel, badge, tweetCard, href }) {
  const zh = T.code === 'zh', esc = escapeHtml, provider = e.provider === 'codex' ? 'Codex' : 'Claude';
  const label = (cn, en) => zh ? cn : en;
  const pending = e.pendingReset || e.kind === 'teaser';
  const usageUrl = e.provider === 'codex' ? 'https://chatgpt.com/codex/settings/usage' : 'https://claude.ai/settings/usage';
  const action = pending
    ? label('这是一条预告，请先看官方是否确认生效。公告没有给出确定时间时，本站不会推算你何时到账。', 'This is an announcement, not confirmation of delivery. If no definite time is given, we do not estimate when your account will receive it.')
    : e.kind === 'banked'
      ? label('发卡不等于额度已经恢复。请在官方用量页查看是否有可用重置、影响哪些窗口、是否有有效期，再按页面提示决定何时使用。', 'A banked grant does not reset usage immediately. Check the official usage page for availability, affected limits and expiry before deciding when to redeem it.')
      : e.kind === 'boost'
        ? label('提额与清空已使用额度不同。先核对适用套餐和公告条件，再在官方用量页查看自己的变化。', 'A quota boost differs from resetting used allowance. Check the eligible plans and conditions, then inspect your own official usage page.')
        : label('先核对公告适用范围，再查看官方用量页。本站记录公开消息，不能证明你的账户已经收到这次重置。', 'Check the announced eligibility, then your official usage page. This record does not confirm that your individual account received the reset.');
  const review = searchableEvent(e) ? T.humanReview : e.confidence === 'auto' ? T.automatic : label('待补证，请勿据此判断到账', 'Unconfirmed; do not treat this as account delivery');
  const facts = [
    [label('公告时间', 'Announced'), timeEl(T, e.announcedAt, 'full')],
    [label('适用范围', 'Eligibility'), esc(T.scope(e))],
    [T.evidence, esc(evidenceLabel(T, e))],
    [label('生效记时', 'Recorded effective time'), e.effectiveAt ? timeEl(T, e.effectiveAt, 'full') : label('未单独记录，请看原帖说明', 'Not separately recorded; check the source')],
    [T.verified, verificationDate(T, e.verifiedAt)],
    [label('整理状态', 'Review status'), esc(review)],
  ];
  const sourceLinks = [...new Set([e.sourceUrl, e.effectiveEvidence?.url, ...(e.extraLinks || [])].filter(Boolean))];
  const corrections = (e.corrections || []).filter(c => c.at);
  const guide = e.provider === 'codex' ? 'codex-shenme-shihou-chongzhi' : 'claude-edu-shenme-shihou-huifu';
  return `<nav class="breadcrumbs" aria-label="${label('当前位置', 'Breadcrumb')}"><a href="${href(T, '/')}">${label('首页', 'Home')}</a><span> / </span><a href="${href(T, '/' + e.provider)}">${provider}</a><span> / ${label('公告详情', 'Announcement')}</span></nav>
<article class="event-article">
  <div class="event-kicker">${provider} · ${timeEl(T, e.announcedAt, 'date')} ${badge(T, e)}</div>
  <h1>${esc(T.summary(e))}</h1>
  <p class="event-intro">${label('一条官方消息，分清适用范围和下一步。', 'An official update, with eligibility and a clear next step.')}</p>
  ${!searchableEvent(e) ? `<p class="evidence-caution">${esc(review)}</p>` : ''}
  <dl class="event-facts">${facts.map(([key, value]) => `<div><dt>${key}</dt><dd>${value}</dd></div>`).join('')}</dl>
  ${T.detail(e) ? `<section><h2>${label('这条消息说了什么', 'What the announcement says')}</h2><p>${esc(T.detail(e))}</p></section>` : ''}
  <section><h2>${label('你现在可以怎么做', 'What you can do')}</h2><p>${action}</p><p><a class="text-action" href="${usageUrl}" target="_blank" rel="noopener">${label('打开', 'Open')} ${provider} ${label('官方用量页', 'usage dashboard')} ↗</a></p></section>
  <section><h2>${label('原帖与核验依据', 'Source and evidence')}</h2>${tweetCard(T, e)}<ul class="source-links">${sourceLinks.map((url, i) => `<li><a href="${esc(url)}" target="_blank" rel="noopener">${i === 0 ? label('最初公告', 'Original announcement') : label('关联原帖', 'Related source')} ${i + 1} ↗</a></li>`).join('')}</ul>${e.effectiveEvidence?.sourceText ? `<blockquote>${esc(e.effectiveEvidence.sourceText)}</blockquote>` : ''}</section>
  ${corrections.length ? `<section><h2>${label('更正记录', 'Record amendments')}</h2><ul>${corrections.map(c => `<li>${timeEl(T, c.at, 'full')} · ${esc(zh ? c.reason || '复核后更新记录' : 'Record amended after review; see the current evidence above.')}</li>`).join('')}</ul></section>` : ''}
  <section class="related-guides"><h2>${label('继续了解', 'Related guides')}</h2><a href="${href(T, '/q/' + guide)}">${provider} ${label('个人额度何时恢复？', 'personal reset times')}</a><a href="${href(T, '/q/chongzhi-ka-shi-shenme')}">${label('重置卡和直接重置有什么不同？', 'Banked grants vs full resets')}</a><a href="${href(T, '/q/weishenme-bieren-chongzhi-wo-meiyou')}">${label('为什么别人收到了，我没有？', 'Why did another account receive it, but not mine?')}</a></section>
</article>
<p class="event-return"><a href="${href(T, '/' + e.provider)}">← ${label('返回', 'Back to')} ${provider} ${label('全部记录', 'history')}</a> · <a href="${href(T, '/method')}">${T.method}</a></p>`;
}
