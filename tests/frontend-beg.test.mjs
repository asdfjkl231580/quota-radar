import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const script = fs.readFileSync(new URL('../site/beg.js', import.meta.url), 'utf8');
const settle = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };
function fixture() {
  let id = 0; const pending = [], timers = new Map();
  const buttons = ['codex', 'claude'].map(p => ({ dataset: { p }, hidden: true, fields: {}, classList: { remove() {}, add() {} }, addEventListener(_, fn) { this.click = fn; }, appendChild() {}, querySelector(k) { return this.fields[k] ||= { textContent: '' }; } }));
  const document = { documentElement: { lang: 'zh-CN' }, hidden: false, querySelectorAll() { return buttons; }, addEventListener() {}, createElement() { return { style: {}, remove() {} }; } };
  vm.runInNewContext(script, { document, globalThis: {}, Math, Number, JSON, Date, setInterval() {}, setTimeout(fn, ms) { timers.set(++id, { fn, ms }); return id; }, clearTimeout(k) { timers.delete(k); }, fetch(url, options = {}) { return new Promise((resolve, reject) => pending.push({ url, options, resolve, reject })); } });
  function reply(request, j, status = 200) { request.resolve({ ok: status < 400, status, json: async () => j }); }
  function fire(ms) { const entry = [...timers].find(([, v]) => v.ms === ms); assert.ok(entry, `timer ${ms}`); timers.delete(entry[0]); entry[1].fn(); }
  const snapshot = (count, key = 'old', mode = 'beg') => ({ ok: true, codex: { id: key, mode, count }, claude: { id: 'claude', mode: 'beg', count: 0 } });
  return { pending, buttons, reply, fire, snapshot };
}
test('12 fast taps form disjoint 10 + 2 batches with no concurrent POST or negative UI', async () => {
  const f = fixture(); f.reply(f.pending.shift(), f.snapshot(0)); await settle();
  for (let i = 0; i < 12; i++) f.buttons[0].click();
  assert.equal(f.pending.length, 1); const first = f.pending.shift(), a = JSON.parse(first.options.body);
  assert.equal(a.n, 10); assert.equal(f.buttons[0].fields['.beg-n'].textContent, '12');
  f.reply(first, f.snapshot(10)); await settle(); f.fire(0);
  const second = f.pending.shift(), b = JSON.parse(second.options.body); assert.equal(b.n, 2); assert.notEqual(a.batchId, b.batchId);
  f.reply(second, f.snapshot(12)); await settle(); assert.equal(f.buttons[0].fields['.beg-n'].textContent, '12');
});
test('network retry reuses the immutable batch id and keeps newer taps separate', async () => {
  const f = fixture(); f.reply(f.pending.shift(), f.snapshot(3)); await settle();
  for (let i = 0; i < 10; i++) f.buttons[0].click(); const first = f.pending.shift(); const a = JSON.parse(first.options.body);
  first.reject(new Error('lost response')); await settle(); f.buttons[0].click(); f.fire(1000);
  const retry = f.pending.shift(); assert.deepEqual(JSON.parse(retry.options.body), a);
  f.reply(retry, f.snapshot(13)); await settle(); f.fire(0); const next = f.pending.shift(); assert.equal(JSON.parse(next.options.body).n, 1);
  f.reply(next, f.snapshot(14)); await settle(); assert.equal(f.buttons[0].fields['.beg-n'].textContent, '14');
});
test('a stale cycle response discards old taps instead of applying them to the new reset', async () => {
  const f = fixture(); f.reply(f.pending.shift(), f.snapshot(9)); await settle();
  for (let i = 0; i < 12; i++) f.buttons[0].click(); const first = f.pending.shift();
  f.reply(first, { ...f.snapshot(0, 'new', 'thanks'), ok: false, error: 'stale_cycle' }, 409); await settle();
  assert.equal(f.buttons[0].fields['.beg-n'].textContent, '0'); assert.equal(f.buttons[0].dataset.mode, 'thanks'); assert.equal(f.pending.length, 0);
});
test('rate limiting does not immediately resubmit the queued backlog', async () => {
  const f = fixture(); f.reply(f.pending.shift(), f.snapshot(0)); await settle();
  for (let i = 0; i < 22; i++) f.buttons[0].click(); f.reply(f.pending.shift(), { ok: false, error: 'too_many' }, 429); await settle();
  assert.equal(f.pending.length, 0); assert.equal(f.buttons[0].fields['.beg-n'].textContent, '0'); assert.match(f.buttons[0].title, /未计入/);
});
