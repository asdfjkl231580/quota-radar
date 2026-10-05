import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'qr-search-build-'));
for (const dir of ['scripts', 'site', 'data']) fs.cpSync(path.join(root, dir), path.join(tmp, dir), { recursive: true });
fs.copyFileSync(path.join(root, 'package.json'), path.join(tmp, 'package.json'));
const event = (id, extra = {}) => ({ id, provider: 'codex', kind: 'banked', account: '@Official', announcedAt: '2026-09-01T10:00:00Z', sourceUrl: 'https://x.com/Official/status/' + id, zh: '可手动领取重置', en: 'Redeemable reset </script><script>alert(1)</script>', textEn: 'A banked reset & eligibility <example>', scope: '指定套餐', scopeEn: 'Eligible paid plans only', verified: true, verifiedAt: '2026-09-02', confidence: 'high', ...extra });
const events = [event('201'), event('202', { confidence: 'auto' }), event('203', { confidence: 'low' }), event('204', { verified: false }), event('205', { kind: 'teaser', pendingReset: true })];
fs.writeFileSync(path.join(tmp, 'data/events.json'), JSON.stringify({ updatedAt: '2026-09-02T00:00:00Z', events }));
const result = spawnSync(process.execPath, ['scripts/build.mjs'], { cwd: tmp, encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr);
const read = p => fs.readFileSync(path.join(tmp, 'dist', p), 'utf8');
test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));

test('reviewed event pages are discoverable; unreviewed pages stay out of sitemap and RSS', () => {
  const sitemap = read('sitemap.xml');
  assert.doesNotMatch(sitemap, /lastmod/);
  for (const lang of ['', 'en/']) {
    for (const id of ['201', '205']) {
      assert.ok(sitemap.includes('/' + lang + 'events/' + id + '</loc>'));
      assert.doesNotMatch(read(lang + 'events/' + id + '.html'), /name="robots" content="noindex/);
    }
    for (const id of ['202', '203', '204']) {
      assert.ok(!sitemap.includes('/events/' + id + '</loc>'));
      assert.match(read(lang + 'events/' + id + '.html'), /name="robots" content="noindex,follow"/);
      assert.ok(!read(lang + 'rss.xml').includes('<guid isPermaLink="false">' + id + '-'));
    }
  }
  assert.match(read('events/205.html'), /预告，请先看官方是否确认生效/);
});

test('permalinks keep language pairs, evidence, account limits and escaped original text', () => {
  const html = read('en/events/201.html');
  assert.match(html, /rel="canonical" href="https:\/\/airesetclock.com\/en\/events\/201"/);
  assert.match(html, /hreflang="zh-CN" href="https:\/\/airesetclock.com\/events\/201"/);
  assert.match(html, /Eligible paid plans only/);
  assert.match(html, /A banked grant does not reset usage immediately/);
  assert.match(html, /https:\/\/x.com\/Official\/status\/201/);
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
  const ld = JSON.parse(html.match(/type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  assert.equal(ld['@type'], 'BreadcrumbList');
  assert.equal(ld.itemListElement.at(-1).item, 'https://airesetclock.com/en/events/201');
  assert.equal((html.match(/<h1[ >]/g) || []).length, 1);
  assert.match(read('timeline.html'), /href="\/events\/201"/);
});

test('RSS leads to owned detail pages, preserves IDs and exposes original sources', () => {
  for (const lang of ['', 'en/']) {
    const feed = read(lang + 'rss.xml');
    assert.ok(feed.includes('<link>https://airesetclock.com/' + lang + 'events/201</link>'));
    assert.ok(feed.includes('<guid isPermaLink="false">201-' + (lang ? 'en' : 'zh') + '</guid>'));
    assert.match(feed, /https:\/\/x.com\/Official\/status\/201/);
    assert.match(feed, /&amp;lt;example&amp;gt;/);
  }
});

test('guides separate product limits and expose sources with a fixed review date', () => {
  const codex = read('q/codex-shenme-shihou-chongzhi.html');
  assert.match(codex, /Pro 当前没有五小时限制/);
  assert.match(codex, /learn.chatgpt.com\/docs\/pricing/);
  assert.match(codex, /datetime="2026-10-05"/);
  assert.match(read('q/claude-edu-shenme-shihou-huifu.html'), /不会把已经用完的账户额度恢复/);
  assert.match(read('q/weishenme-bieren-chongzhi-wo-meiyou.html'), /逐项排查/);
  assert.match(read('en/q/weishenme-bieren-chongzhi-wo-meiyou.html'), /A practical checklist/);
});

test('every generated internal link and sitemap URL resolves to an actual file', () => {
  const dist = path.join(tmp, 'dist');
  const exists = url => {
    const pathname = new URL(url, 'https://airesetclock.com').pathname;
    if (pathname === '/api/health') return true; // server function, not a static asset
    return [pathname, pathname + '.html', pathname.replace(/\/$/, '') + '/index.html'].some(p => fs.existsSync(path.join(dist, p)) && fs.statSync(path.join(dist, p)).isFile());
  };
  for (const file of fs.readdirSync(dist, { recursive: true }).filter(f => f.endsWith('.html'))) {
    const html = read(file);
    for (const m of html.matchAll(/href="(\/(?!\/)[^"]*)"/g)) assert.ok(exists(m[1]), `${file}: broken ${m[1]}`);
  }
  for (const m of read('sitemap.xml').matchAll(/<loc>([^<]+)<\/loc>/g)) assert.ok(exists(m[1]), 'missing sitemap page ' + m[1]);
});
