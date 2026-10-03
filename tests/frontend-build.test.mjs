import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'qr-frontend-build-'));
for (const dir of ['scripts', 'site', 'data']) fs.cpSync(path.join(root, dir), path.join(tmp, dir), { recursive: true });
fs.copyFileSync(path.join(root, 'package.json'), path.join(tmp, 'package.json'));
const day = new Date(Date.now() - 86400000 * 2).toISOString();
const prior = new Date(Date.now() - 86400000 * 5).toISOString();
function event(id, provider, extra = {}) { return { id, provider, kind: 'reset', account: '@Official', announcedAt: prior, sourceUrl: 'https://x.com/Official/status/' + id, zh: '官方重置', textEn: 'Quotas reset. </script><script>alert(1)</script>', en: 'Quotas reset. </script><script>alert(1)</script>', scope: '全部套餐', verified: true, verifiedAt: '2026-09-23', confidence: 'high', ...extra }; }
const input = { updatedAt: prior, events: [event('101', 'codex', { kind: 'teaser', pendingReset: true, announcedAt: day, expectedAmbiguity: 'PST/PDT ambiguous', zh: '官方预告', detail: 'Time ambiguous' }), event('102', 'codex', { effectiveAt: prior, effectiveEvidence: { type: 'scheduled', at: prior } }), event('103', 'claude', { effectiveEvidence: { type: 'observed', at: prior } })] };
fs.writeFileSync(path.join(tmp, 'data/events.json'), JSON.stringify(input));
const build = () => spawnSync(process.execPath, ['scripts/build.mjs'], { cwd: tmp, encoding: 'utf8' });
const initial = build(); assert.equal(initial.status, 0, initial.stderr);
const read = p => fs.readFileSync(path.join(tmp, 'dist', p), 'utf8');
test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
test('public pages expose identical version metadata and separate build and data timestamps', () => {
  const api = JSON.parse(read('api/events.json')), status = JSON.parse(read('api/status.json'));
  assert.equal(status.version, api.version); assert.equal(status.dataUpdatedAt, input.updatedAt); assert.notEqual(status.buildAt, input.updatedAt);
  assert.match(api.version, /^sha256:[a-f0-9]{64}$/);
  for (const p of ['index.html', 'timeline.html', 'en/index.html', 'method.html', 'privacy.html', 'status.html', 'en/method.html', 'en/privacy.html', 'en/status.html']) {
    const html = read(p); assert.ok(html.includes(`<meta name="qr-data-version" content="${api.version}">`));
    const share = JSON.parse(html.match(/id="share-data">([\s\S]*?)<\/script>/)[1]); assert.equal(share.dataUpdatedAt, input.updatedAt); assert.equal(share.version, api.version);
  }
});
test('ambiguous announcements do not pretend the time was not announced or start a false countdown', () => {
  const html = read('index.html'), share = JSON.parse(html.match(/id="share-data">([\s\S]*?)<\/script>/)[1]);
  assert.match(html, /时间有歧义，待核实/); assert.equal(share.codex.kind, 'teaser'); assert.equal(share.codex.until, null); assert.match(share.codex.next, /歧义/);
  assert.match(html, /第三方执行证据/); assert.match(read('timeline.html'), /按官方预告时间记录，未获独立到账确认/);
});
test('English feed and eligibility are English; raw text cannot close JSON script elements', () => {
  assert.match(read('en/faq.html'), /href="\/en\/rss.xml"/); assert.doesNotMatch(read('en/timeline.html'), /全部套餐/); assert.match(read('en/timeline.html'), /All plans/);
  const html = read('en/index.html'); assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/); const share = JSON.parse(html.match(/id="share-data">([\s\S]*?)<\/script>/)[1]); assert.match(share.claude.en, /<\/script>/);
});
test('date-only verification is not turned into a midnight instant', () => {
  const html = read('timeline.html'); assert.match(html, /原帖核验：2026-09-23/); assert.doesNotMatch(html, /data-ts="2026-09-23"/);
});
test('build validates conflicting states before removing the previous valid output', () => {
  const before = read('index.html'); input.events[0].kind = 'reset'; fs.writeFileSync(path.join(tmp, 'data/events.json'), JSON.stringify(input));
  const result = build(); assert.notEqual(result.status, 0); assert.match(result.stderr, /待生效事件必须/); assert.equal(read('index.html'), before);
});
