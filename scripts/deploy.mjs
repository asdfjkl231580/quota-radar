// Production is complete only after the public domain returns the target snapshot.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { ROOT, readJson, writeJson } from './lib.mjs';
import { eventVersion, comparePublicSnapshot } from './snapshot.mjs';
import { validateEvents } from './validate-events.mjs';

export async function verifyDeployment(base, expected, { fetchImpl = fetch, attempts = 8, delayMs = 2500, sleep = ms => new Promise(r => setTimeout(r, ms)) } = {}) {
  let reason = '没有完成生产回读';
  for (let i = 0; i < attempts; i++) {
    try {
      const query = '?release=' + encodeURIComponent(expected.version) + '&check=' + i;
      const r = await fetchImpl(base.replace(/\/$/, '') + '/api/events.json' + query, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' }, signal: AbortSignal.timeout(15000) });
      if (!r.ok) throw new Error('production JSON HTTP ' + r.status);
      const comparison = comparePublicSnapshot(expected, await r.json());
      if (!comparison.ok) throw new Error(comparison.reason);
      const home = await fetchImpl(base.replace(/\/$/, '') + '/' + query, { cache: 'no-store', signal: AbortSignal.timeout(15000) });
      if (!home.ok || !(await home.text()).includes(`name="qr-data-version" content="${expected.version}"`)) throw new Error('homepage version differs');
      return { version: expected.version, checkedAt: new Date().toISOString() };
    } catch (e) { reason = e.message; }
    if (i + 1 < attempts) await sleep(delayMs);
  }
  throw new Error('生产回读未通过：' + reason);
}

export async function deploy() {
  const site = readJson('site.json'), data = readJson('events.json');
  const errors = validateEvents(data.events);
  if (errors.length) throw new Error('数据校验失败：' + errors.slice(0, 8).join('；'));
  const targetVersion = eventVersion(data.events);
  const state = { ...readJson('release.json', {}), targetVersion, lastAttemptAt: new Date().toISOString(), lastError: null };
  writeJson('release.json', state);
  try {
    execFileSync(process.execPath, ['scripts/build.mjs'], { cwd: ROOT, stdio: 'inherit' });
    const expected = JSON.parse(fs.readFileSync(path.join(ROOT, 'dist/api/events.json'), 'utf8'));
    if (expected.version !== targetVersion) throw new Error('构建结果与待发布版本不一致');
    const vercel = ['/Users/kenyuanlin/.npm-global/bin/vercel', '/opt/homebrew/bin/vercel', '/usr/local/bin/vercel'].find(p => fs.existsSync(p)) || 'vercel';
    // CI credentials stay in the environment; exceptions must never include a token argument.
    try {
      execFileSync(vercel, ['--prod', '--yes'], { cwd: ROOT, stdio: 'inherit', timeout: 300000, env: { ...process.env, PATH: (process.env.PATH || '') + ':/opt/homebrew/bin:/usr/local/bin' } });
    } catch { throw new Error('Vercel 部署命令失败；查看任务日志，待发布版本已保留'); }
    const receipt = await verifyDeployment(site.url, expected);
    Object.assign(state, { deployedVersion: targetVersion, deployedAt: receipt.checkedAt, lastError: null });
    writeJson('release.json', state);
    console.log('生产已回读确认：' + targetVersion);
  } catch (e) {
    state.lastError = e.message.slice(0, 240);
    writeJson('release.json', state);
    throw e;
  }
  if (!process.argv.includes('--no-indexnow')) {
    try {
      const { key } = readJson('indexnow.json');
      const sm = fs.readFileSync(path.join(ROOT, 'dist/sitemap.xml'), 'utf8');
      const urls = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
      const host = new URL(site.url).host;
      const r = await fetch('https://api.indexnow.org/indexnow', { method: 'POST', signal: AbortSignal.timeout(15000), headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ host, key, keyLocation: `${site.url}/${key}.txt`, urlList: urls }) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      console.log(`IndexNow 已接受 ${urls.length} 个地址`);
    } catch (e) { console.warn('生产已发布，IndexNow 提交未完成：' + e.message); }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await deploy().catch(e => { console.error(e.message); process.exitCode = 1; });
}
