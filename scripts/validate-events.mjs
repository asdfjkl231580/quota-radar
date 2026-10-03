import { pathToFileURL } from 'node:url';
import { readJson } from './lib.mjs';

export function validateEvents(events, now = Date.now()) {
  const errors = [], ids = new Set();
  if (!Array.isArray(events) || !events.length) return ['事件列表必须是非空数组'];
  const date = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
  for (const e of events) {
    const fail = msg => errors.push(`${e.id || '(缺 ID)'}: ${msg}`);
    if (!/^\d+$/.test(String(e.id || '')) || ids.has(e.id)) fail('ID 缺失、无效或重复');
    ids.add(e.id);
    if (!['codex', 'claude'].includes(e.provider)) fail('provider 无效');
    if (!['reset', 'banked', 'boost', 'teaser'].includes(e.kind)) fail('kind 无效');
    for (const field of ['account', 'sourceUrl', 'scope', 'verifiedAt', 'textEn', 'zh']) if (typeof e[field] !== 'string' || !e[field].trim()) fail(`缺少 ${field}`);
    if (!date(e.announcedAt) || Date.parse(e.announcedAt) > now + 300000) fail('公告时间无效或在未来');
    if (!date(e.verifiedAt)) fail('核验日期无效');
    try {
      const u = new URL(e.sourceUrl);
      if (u.protocol !== 'https:' || !['x.com', 'twitter.com', 'www.x.com'].includes(u.hostname) || !u.pathname.endsWith('/status/' + e.id)) fail('原帖链接与 ID 不一致');
    } catch { fail('原帖链接无效'); }
    if (e.pendingReset && e.kind !== 'teaser') fail('待生效事件必须为 teaser');
    if (e.pendingReset && (e.effectiveAt || e.confirmedBy)) fail('待生效事件不能同时标为已确认生效');
    if (e.expectedAt && !date(e.expectedAt)) fail('预告时间无效');
    if (e.expectedPrecision && !['time', 'day'].includes(e.expectedPrecision)) fail('预告时间精度无效');
    if (e.effectiveAt && (!date(e.effectiveAt) || (e.kind !== 'teaser' && Date.parse(e.effectiveAt) > now + 300000))) fail('生效时间无效或尚未到达');
  }
  return errors;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const errors = validateEvents(readJson('events.json', {}).events);
  if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
  else console.log('事件结构与状态校验通过');
}
