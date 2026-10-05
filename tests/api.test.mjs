import test, { afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { kv, feishu, notifyOnce } from '../api/_kv.js';
import { assessHealth } from '../api/_health.js';
import { eventVersion } from '../scripts/snapshot.mjs';
import cron from '../api/cron.js';
import feedback from '../api/feedback.js';
import { eventCycles } from '../api/beg.js';

const realFetch = globalThis.fetch;
const envNames = ['KV_REST_API_URL', 'KV_REST_API_TOKEN', 'FEISHU_APP_ID', 'FEISHU_APP_SECRET', 'FEISHU_TO_CHAT_ID', 'CRON_SECRET', 'GH_DISPATCH_TOKEN'];
const originalEnv = Object.fromEntries(envNames.map(k => [k, process.env[k]]));
let calls;
beforeEach(() => {
  calls = [];
  Object.assign(process.env, { KV_REST_API_URL:'https://test-kv.invalid', KV_REST_API_TOKEN:'test-kv-token', FEISHU_APP_ID:'test-app', FEISHU_APP_SECRET:'test-secret', FEISHU_TO_CHAT_ID:'test-chat', CRON_SECRET:'test-cron', GH_DISPATCH_TOKEN:'test-gh' });
  globalThis.fetch = async (...args) => { throw new Error(`Unexpected mocked network: ${args[0]}`); };
});
afterEach(() => {
  globalThis.fetch = realFetch;
  for (const name of envNames) { if (originalEnv[name] === undefined) delete process.env[name]; else process.env[name] = originalEnv[name]; }
});
const json = (value, status=200) => new Response(JSON.stringify(value), {status, headers:{'Content-Type':'application/json'}});
const response = () => ({ headers:{}, statusCode:0, body:null, setHeader(k,v){this.headers[k]=v;}, status(v){this.statusCode=v;return this;}, json(v){this.body=v;return this;} });
const req = (method='GET', body, extra={}) => ({method, body, headers:{authorization:'Bearer test-cron','x-forwarded-for':'192.0.2.1', ...extra}});
const recent = () => new Date(Date.now()-60000).toISOString();
const VERSION = eventVersion([]);
const healthy = () => ({schemaVersion:1, lastAttemptAt:recent(), lastSuccessAt:recent(), status:'ok'});
const release = () => ({targetVersion:VERSION, deployedVersion:VERSION, deployedAt:recent(), lastError:null});
const live = () => ({version:VERSION, events:[], updatedAt:'2020-01-01T00:00:00Z'});
const freshModule = async name => import(`../api/${name}.js?test=${Math.random()}`);

test('KV rejects HTTP errors, command errors, missing results and length mismatch', async () => {
  for (const reply of [() => json({error:'bad'},503), () => json([{error:'WRONGTYPE private upstream detail'}]), () => json([{}]), () => json([]), () => json({result:1})]) {
    globalThis.fetch = async () => reply();
    await assert.rejects(kv(['GET','x']), /kv_/);
  }
  globalThis.fetch = async (_url, options) => { assert.ok(options.signal); return json([{result:null},{result:3}]); };
  assert.deepEqual(await kv(['GET','missing'],['GET','counter']), [null,3]);
});

test('Feishu requires configured credentials, HTTP success, business success and receipt', async () => {
  delete process.env.FEISHU_APP_SECRET;
  await assert.rejects(feishu('hello'), /not_configured/);
  process.env.FEISHU_APP_SECRET='test-secret';
  for (const reply of [() => json({code:999}), () => json({code:0}), () => json({code:0,tenant_access_token:'t'},500)]) {
    globalThis.fetch = async () => reply();
    await assert.rejects(feishu('hello'), /feishu_token/);
  }
  for (const reply of [() => json({code:230002,msg:'private detail'}), () => json({code:0,data:{}}), () => json({code:0,data:{message_id:'m'}},503)]) {
    globalThis.fetch = async url => String(url).includes('/auth/') ? json({code:0,tenant_access_token:'test-token'}) : reply();
    await assert.rejects(feishu('hello'), /feishu_message/);
  }
  globalThis.fetch = async url => String(url).includes('/auth/') ? json({code:0,tenant_access_token:'test-token'}) : json({code:0,data:{message_id:'receipt-1'}});
  assert.deepEqual(await feishu('hello'), {messageId:'receipt-1'});
});

// Stateful fixture for Redis protocol responses. Lua execution is a Redis deployment check;
// these offline tests check handlers' atomic command boundaries, failure handling and receipts.
function redisFixture(extra) {
  const state = new Map();
  const fetch = async (url, options={}) => {
    calls.push({url:String(url), options});
    if (!String(url).includes('test-kv.invalid')) return extra(url, options);
    const commands = JSON.parse(options.body);
    return json(commands.map(command => {
      const [op,key,value,...tail]=command;
      if (op==='GET') return {result:state.get(key) ?? null};
      if (op==='SET') { if(tail.includes('NX') && state.has(key)) return {result:null}; state.set(key,String(value)); return {result:'OK'}; }
      if (op==='EVAL' && key.includes('unlock-v1')) {
        const lockKey=command[3], expected=command[4];
        if(state.get(lockKey) === expected) { state.delete(lockKey); return {result:1}; }
        return {result:0};
      }
      if (op==='EVAL' && key.includes('rate-v1')) {
        const bucket=command[3], max=Number(command[4]);
        const accepted=Number(state.get(bucket) || 0);
        if(accepted>=max) return {result:0};
        state.set(bucket,accepted+1); return {result:1};
      }
      throw new Error(`Unexpected KV command ${op}`);
    }));
  };
  return {state,fetch};
}

test('failed alert never writes dedupe success; retry delivers and only then persists receipt', async () => {
  let reject=true, messages=0;
  const fixture=redisFixture(async url => {
    if(String(url).includes('/auth/')) return json({code:0,tenant_access_token:'token'});
    messages++;
    return reject ? json({code:230002}) : json({code:0,data:{message_id:'receipt'}});
  });
  globalThis.fetch=fixture.fetch;
  await assert.rejects(notifyOnce('test','hello'), /feishu_message/);
  assert.equal(fixture.state.has('alert:test'),false);
  assert.equal(fixture.state.has('alert:test:sending'),false);
  reject=false;
  assert.deepEqual(await notifyOnce('test','hello'),{delivered:true,deduped:false});
  assert.equal(fixture.state.get('alert:test'),'receipt');
  assert.deepEqual(await notifyOnce('test','hello'),{delivered:true,deduped:true});
  assert.equal(messages,2);
});

test('same feedback limit is enforced across separate cold module instances', async () => {
  let messages=0;
  const fixture=redisFixture(async url => String(url).includes('/auth/') ? json({code:0,tenant_access_token:'token'}) : (messages++,json({code:0,data:{message_id:`receipt-${messages}`}})));
  globalThis.fetch=fixture.fetch;
  const other=(await freshModule('feedback')).default;
  for(let i=0;i<6;i++) {
    const res=response();
    await (i%2 ? other : feedback)(req('POST',{message:' useful feedback ',contact:'',page:'https://airesetclock.com/a?secret=hidden',lang:'zh'}),res);
    assert.equal(res.statusCode,i<5 ? 200:429);
  }
  assert.equal(messages,5);
  const sent=calls.filter(c => c.url.includes('/im/'));
  for(const item of sent) { assert.equal(item.options.body.includes('secret=hidden'),false); assert.equal(item.options.body.includes('192.0.2.1'),false); }
  const rateCommands=calls.filter(c => c.url.includes('test-kv')).map(c=>JSON.parse(c.options.body));
  assert.ok(rateCommands.every(commands => commands.length===1 && commands[0][0]==='EVAL'));
});

test('feedback refuses malformed payloads and fails closed when delivery is unavailable', async () => {
  for(const body of ['{',null,{message:'a'},{message:'x'.repeat(2001)}]) {
    const res=response(); await feedback(req('POST',body),res); assert.equal(res.statusCode,400);
  }
  const fixture=redisFixture(async ()=>json({code:230002})); globalThis.fetch=fixture.fetch;
  const res=response(); await feedback(req('POST',{message:'please help'}),res);
  assert.equal(res.statusCode,503); assert.deepEqual(res.body,{ok:false,error:'feedback_unavailable'});
});

test('cron missing secret, incorrect auth and unsupported method produce zero network side effects', async () => {
  globalThis.fetch=async()=>{calls.push('unexpected');throw new Error('must not call');};
  delete process.env.CRON_SECRET;
  let res=response(); await cron(req(),res); assert.equal(res.statusCode,503);
  process.env.CRON_SECRET='test-cron';
  res=response(); await cron(req('GET',undefined,{authorization:'Bearer wrong'}),res); assert.equal(res.statusCode,401);
  res=response(); await cron(req('POST'),res); assert.equal(res.statusCode,405);
  assert.equal(calls.length,0);
});

test('old event timestamp is healthy when collection is fresh and production versions match', () => {
  const health=assessHealth(healthy(),release(),live());
  assert.equal(health.status,'ok'); assert.deepEqual(health.reasons,[]);
  assert.equal(health.eventsUpdatedAt,'2020-01-01T00:00:00Z');
});

test('health distinguishes missing data, failed collector, degradation and release mismatch', () => {
  assert.equal(assessHealth(null,null,null).status,'error');
  assert.ok(assessHealth({...healthy(),status:'error'},release(),live()).reasons.includes('collection_failed'));
  assert.equal(assessHealth({...healthy(),status:'degraded'},release(),live()).status,'degraded');
  assert.ok(assessHealth({...healthy(),lastSuccessAt:'2020-01-01T00:00:00Z'},release(),live()).reasons.includes('collection_stale'));
  const bad=assessHealth(healthy(),{...release(),targetVersion:'sha256:'+'b'.repeat(64),lastError:'secret-upstream-body'},live());
  assert.ok(bad.reasons.includes('release_mismatch')); assert.ok(bad.reasons.includes('release_failed'));
  assert.equal(JSON.stringify(bad).includes('secret-upstream-body'),false);
});

test('daily collection stays healthy between runs but expires after the grace window', () => {
  const now=Date.parse('2026-10-05T02:30:00Z');
  const state=hours=>({...healthy(),lastAttemptAt:new Date(now-hours*3600000).toISOString(),lastSuccessAt:new Date(now-hours*3600000).toISOString()});
  assert.equal(assessHealth(state(25),release(),live(),now).status,'ok');
  assert.equal(assessHealth(state(26),release(),live(),now).status,'ok');
  assert.ok(assessHealth(state(27),release(),live(),now).reasons.includes('collection_stale'));
  assert.ok(assessHealth({...state(1),status:'error'},release(),live(),now).reasons.includes('collection_failed'));
});

test('only one daily scheduler can trigger paid collection; GitHub keeps manual dispatch', () => {
  const config=JSON.parse(fs.readFileSync(new URL('../vercel.json',import.meta.url),'utf8'));
  assert.deepEqual(config.crons,[{path:'/api/cron',schedule:'30 1 * * *'}]);
  const workflow=fs.readFileSync(new URL('../.github/workflows/sentinel.yml',import.meta.url),'utf8');
  assert.doesNotMatch(workflow,/^\s+schedule:/m);
  assert.match(workflow,/workflow_dispatch:/);
});

function operationalFixture({badRelease=false,rejectAlert=false,dispatchStatus=204,ageHours=0}={}) {
  let dispatches=0;
  const fixture=redisFixture(async url => {
    const u=String(url);
    if(u.includes('/main/data/health.json')) return json({...healthy(),lastAttemptAt:new Date(Date.now()-ageHours*3600000).toISOString(),lastSuccessAt:new Date(Date.now()-ageHours*3600000).toISOString()});
    if(u.includes('/main/data/release.json')) return json({...release(), ...(badRelease ? {targetVersion:'sha256:'+'b'.repeat(64),lastError:'private token failure'}:{})});
    if(u.includes('/api/events.json')) return json(live());
    if(u.includes('/runs?')) return json({workflow_runs:[{created_at:new Date(Date.now()-ageHours*3600000).toISOString(),updated_at:new Date(Date.now()-ageHours*3600000).toISOString()}]});
    if(u.includes('/dispatches')) { dispatches++; return new Response(null,{status:dispatchStatus}); }
    if(u.includes('/auth/')) return json({code:0,tenant_access_token:'t'});
    if(u.includes('/im/')) return json(rejectAlert ? {code:230002} : {code:0,data:{message_id:'receipt'}});
    throw new Error(`unmocked ${u}`);
  });
  return {...fixture, dispatches:()=>dispatches};
}

test('recent successful workflow cannot hide a stale production version; dispatch still runs for recovery', async () => {
  const fixture=operationalFixture({badRelease:true}); globalThis.fetch=fixture.fetch;
  const res=response(); await cron(req(),res);
  assert.equal(res.statusCode,503); assert.equal(res.body.ok,false);
  assert.ok(res.body.problems.includes('release_mismatch')); assert.equal(res.body.dispatched,true);
  assert.equal(fixture.dispatches(),1); assert.equal(res.body.notification.delivered,true);
  assert.equal(JSON.stringify(res.body).includes('private token failure'),false);
});

test('cron exposes notification failure and never sets a successful alert marker', async () => {
  const fixture=operationalFixture({badRelease:true,rejectAlert:true}); globalThis.fetch=fixture.fetch;
  const res=response(); await cron(req(),res);
  assert.equal(res.statusCode,503); assert.ok(res.body.problems.includes('notification_failed'));
  assert.equal([...fixture.state.keys()].filter(k=>k.startsWith('alert:')).length,0);
});

test('healthy cron returns success after 204 dispatch; failed dispatch returns failure', async () => {
  let fixture=operationalFixture(); globalThis.fetch=fixture.fetch;
  let res=response(); await cron(req(),res); assert.equal(res.statusCode,200); assert.equal(res.body.ok,true);
  fixture=operationalFixture({dispatchStatus:401}); globalThis.fetch=fixture.fetch;
  res=response(); await cron(req(),res); assert.equal(res.statusCode,503); assert.ok(res.body.problems.includes('dispatch_failed'));
});

test('daily cron includes TikHub without falsely alarming on yesterday success', async () => {
  const fixture=operationalFixture({ageHours:25}); globalThis.fetch=fixture.fetch;
  const res=response(); await cron(req(),res);
  assert.equal(res.statusCode,200); assert.deepEqual(res.body.problems,[]);
  const dispatch=calls.find(c=>c.url.includes('/dispatches'));
  assert.deepEqual(JSON.parse(dispatch.options.body),{ref:'main',inputs:{tikhub:'true'}});
  assert.equal(fixture.dispatches(),1);
});

test('public health is read-only, sanitized and reuses fresh checks', async () => {
  const fixture=operationalFixture(); globalThis.fetch=fixture.fetch;
  const handler=(await freshModule('health')).default;
  let res=response(); await handler(req(),res); assert.equal(res.statusCode,200); assert.equal(res.body.ok,true);
  const networkCalls=calls.length;
  res=response(); await handler(req(),res); assert.equal(calls.length,networkCalls);
  assert.equal(fixture.dispatches(),0);
  assert.equal(calls.some(c=>c.url.includes('test-kv.invalid') || c.url.includes('feishu')),false);
  res=response(); await handler(req('POST'),res); assert.equal(res.statusCode,405);
});

test('beg cycle excludes future and unconfirmed events, recomputes thanks expiry', () => {
  const now=Date.now();
  const events=[
    {provider:'codex',id:'good',kind:'reset',effectiveAt:new Date(now-10000).toISOString()},
    {provider:'codex',id:'future',kind:'reset',effectiveAt:new Date(now+10000).toISOString()},
    {provider:'codex',id:'unconfirmed',kind:'reset',pendingReset:true,effectiveAt:new Date(now-1000).toISOString()},
    {provider:'claude',id:'announcement',kind:'teaser',effectiveAt:new Date(now-1000).toISOString()}
  ];
  assert.equal(eventCycles(events,now).codex.id,'good'); assert.equal(eventCycles(events,now).codex.mode,'thanks');
  assert.equal(eventCycles(events,now).claude.id,'none');
  assert.equal(eventCycles(events.slice(0,1),now+86400000).codex.mode,'beg');
});

async function begFixture(evalReply, getReply=null) {
  const module=await freshModule('beg');
  const event={provider:'codex',id:'cycle-1',kind:'reset',effectiveAt:new Date(Date.now()-2*86400000).toISOString()};
  globalThis.fetch=async(url,options={})=>{
    calls.push({url:String(url),options});
    if(String(url).includes('/api/events.json'))return json({events:[event]});
    const commands=JSON.parse(options.body);
    if(commands[0][0]==='EVAL')return json([evalReply]);
    return json(commands.map(()=>getReply || {result:10}));
  };
  return module.default;
}
const batch=(extra={})=>({provider:'codex',id:'cycle-1',mode:'beg',n:10,batchId:'12345678-1234-1234-1234-123456789abc',...extra});

test('beg uses one atomic batch and returns acknowledged duplicate without another increment', async()=>{
  for(const [reply,duplicate] of [[{result:[0,10]},false],[{result:[1,10]},true]]) {
    calls=[]; const handler=await begFixture(reply); const res=response(); await handler(req('POST',batch()),res);
    assert.equal(res.statusCode,200); assert.equal(res.body.duplicate,duplicate); assert.equal(res.body.count,10);
    const writes=calls.filter(c=>c.url.includes('test-kv')).map(c=>JSON.parse(c.options.body)).filter(c=>c.some(x=>x[0]!=='GET'));
    assert.equal(writes.length,1); assert.equal(writes[0].length,1); assert.equal(writes[0][0][0],'EVAL');
    assert.equal(writes[0][0][2],3); assert.ok(writes[0][0][3].includes(batch().batchId));
    assert.equal(calls.some(c=>c.url.includes('192.0.2.1')),false);
  }
});

test('beg rejects stale id/mode and invalid batches before mutations',async()=>{
  const handler=await begFixture({result:[0,10]});
  for(const extra of [{id:'old-cycle'},{mode:'thanks'}]) {
    calls=[];const res=response();await handler(req('POST',batch(extra)),res);assert.equal(res.statusCode,409);assert.equal(res.body.error,'stale_cycle');
    assert.equal(calls.some(c=>c.options.body?.includes('EVAL')),false);
  }
  for(const extra of [{n:11},{n:0},{n:1.2},{provider:'unknown'},{batchId:''},{mode:undefined}]) {
    calls=[];const res=response();await handler(req('POST',batch(extra)),res);assert.equal(res.statusCode,400);assert.equal(calls.length,0);
  }
});

test('beg surfaces rate limits, reused-batch conflicts and command/read errors',async()=>{
  for(const [reply,status,error] of [[{result:[-1,10]},429,'too_many'],[{result:[-2,10]},409,'batch_conflict'],[{error:'private error'},503,'counter_unavailable'],[{result:[0,'not-a-number']},503,'counter_unavailable']]) {
    const handler=await begFixture(reply);const res=response();await handler(req('POST',batch()),res);assert.equal(res.statusCode,status);assert.equal(res.body.error,error);
  }
  const handler=await begFixture({result:[0,10]},{error:'private kv error'});const res=response();await handler(req(),res);assert.equal(res.statusCode,503);assert.equal(res.body.ok,false);
});
