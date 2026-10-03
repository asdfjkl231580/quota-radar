import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../site/status.js', import.meta.url), 'utf8');
const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
function fixture() {
  const pending = [], notice = { hidden: true, children: [], textContent: '', appendChild(x) { this.children.push(x); } }, status = { textContent: '' }, window = {};
  const document = { hidden: false, documentElement: { lang: 'en-US' }, getElementById: () => ({ textContent: JSON.stringify({ version: 'old', dataUpdatedAt: '2026-09-20T00:00:00Z' }) }), querySelector(s) { return s === '.version-notice' ? notice : null; }, querySelectorAll: () => [status], addEventListener() {}, createElement() { return { addEventListener() {} }; } };
  vm.runInNewContext(source, { document, window, Date, Intl, AbortController, setTimeout() {}, clearTimeout() {}, setInterval() {}, location: { reload() {} }, fetch() { return new Promise((resolve, reject) => pending.push({ resolve, reject })); } });
  return { pending, notice, status, window };
}
test('old-but-unchanged data is current; age alone does not produce a collection-failure warning', async () => {
  const f = fixture(); f.pending.shift().resolve({ ok: true, json: async () => ({ version: 'old', dataUpdatedAt: '2026-09-20T00:00:00Z' }) }); await settle();
  assert.equal(f.window.qrVersionState.state, 'current'); assert.equal(f.notice.hidden, true); assert.match(f.status.textContent, /matches/);
});
test('new published version prompts refresh and remains outdated if a later check is unavailable', async () => {
  const f = fixture(); f.pending.shift().resolve({ ok: true, json: async () => ({ version: 'new' }) }); await settle();
  assert.equal(f.window.qrVersionState.state, 'outdated'); assert.equal(f.notice.hidden, false); assert.equal(f.notice.children.length, 1);
  const next = f.window.qrCheckVersion(); f.pending.shift().reject(new Error('offline')); await next; assert.equal(f.window.qrVersionState.state, 'outdated');
});
test('unavailable status is not reported as a current or healthy version', async () => {
  const f = fixture(); f.pending.shift().reject(new Error('offline')); await settle();
  assert.equal(f.window.qrVersionState.state, 'unavailable'); assert.match(f.status.textContent, /Unable/);
});

test('health HTTP 503 with structured error still shows the operational reason', async () => {
  const panel = { dataset: {} }, summary = { textContent: '', closest: () => panel }, reasons = { textContent: '', children: [], appendChild(x) { this.children.push(x); } }, times = { textContent: '' };
  const document = { hidden: false, documentElement: { lang: 'en-US' }, getElementById: () => ({ textContent: '{"version":"v1"}' }), querySelector(s) { return ({ '[data-health-summary]': summary, '[data-health-reasons]': reasons, '[data-health-times]': times })[s] || null; }, querySelectorAll: () => [], addEventListener() {}, createElement: () => ({ textContent: '' }) };
  vm.runInNewContext(source, { document, window: {}, Date, Intl, AbortController, setTimeout() {}, clearTimeout() {}, setInterval() {}, fetch: async (url) => url === '/api/health' ? { ok: false, status: 503, json: async () => ({ status: 'error', checkedAt: '2026-10-02T03:00:00Z', reasons: ['release_mismatch'], collector: { lastSuccessAt: '2026-10-02T02:55:00Z' } }) } : { ok: true, json: async () => ({ version: 'v1' }) } });
  await settle(); assert.equal(panel.dataset.health, 'error'); assert.match(summary.textContent, /operational issue/); assert.equal(reasons.children[0].textContent, 'Target, deployed and production versions differ'); assert.match(times.textContent, /Last successful source check/);
});
