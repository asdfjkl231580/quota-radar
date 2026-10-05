import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {classify,parseExpected,confirmationFor,applyEvidence,scheduledEvidence,editEvent} from '../scripts/pipeline.mjs';
import {runSentinel} from '../scripts/sentinel.mjs';
import {eventVersion} from '../scripts/snapshot.mjs';
const fixtures=JSON.parse(fs.readFileSync(new URL('../data/events.json',import.meta.url)));
const rejected=JSON.parse(fs.readFileSync(new URL('../data/rejected.json',import.meta.url)));
const original=id=>fixtures.events.find(e=>e.id===id)||rejected.rejected.find(e=>e.id===id)?.originalEvent;
const now='2026-10-02T12:00:00.000Z';
const event=(extra={})=>({id:'101',account:'@thsottiaux',provider:'codex',kind:'teaser',pendingReset:true,announcedAt:'2026-10-01T00:00:00.000Z',sourceUrl:'https://x.com/thsottiaux/status/101',textEn:'We will reset usage limits.',zh:'官方将重置（生效时间未公布）',...extra});
function harness({events=[],lead=[],tweets={},statuses={},deployFail=false,notifyFail=false}={}){
  const db={'events.json':{events,updatedAt:'2026-10-01T00:00:00Z'},'pending.json':{pending:[]},'rejected.json':{rejected:[]},'watch.json':{accounts:[{screen_name:'thsottiaux',provider:'codex'},{screen_name:'ClaudeDevs',provider:'claude'}],keywords:'reset|quota',leadSources:[{name:'fixture',provider:'codex',url:'https://fixture/lead'}]}};
  db['release.json']={targetVersion:eventVersion(events),deployedVersion:eventVersion(events),deployedAt:'2026-10-01T00:00:00Z'};
  const writes=[],messages=[];let attempts=0;
  const options={args:[],now:()=>now,read:(name,fallback)=>structuredClone(db[name]??fallback),write:(name,value)=>{writes.push(name);db[name]=structuredClone(value);},log:()=>{},key:()=>'',
    fetcher:async url=>{
      if(statuses[url] instanceof Error)throw statuses[url];
      const body=statuses[url]??(url==='https://fixture/lead'?{events:lead}:url.includes('/status')?{data:{scheduled_reset:null}}:{data:[]});
      return {ok:true,status:200,json:async()=>body};
    },tweet:async(account,id)=>{if(!tweets[id])throw Error('no fixture tweet');return tweets[id];},
    deploy:async()=>{attempts++;if(deployFail)throw Error('deployment failed');db['release.json']={...db['release.json'],deployedVersion:eventVersion(db['events.json'].events),deployedAt:now,lastError:null};},
    notify:async msg=>{messages.push(msg);if(notifyFail)throw Error('delivery rejected');},commit:async()=>{}};
  return{db,writes,messages,options,get attempts(){return attempts;},set deployFail(value){deployFail=value;}};
}

test('four real incorrectly classified source posts stay semantically distinct',()=>{
  assert.equal(classify(original('2105843926221660585').textEn),'teaser');
  assert.equal(classify(original('2105672058269212820').textEn),'unclear');
  assert.equal(classify(original('2104641323198472430').textEn),'reminder');
  assert.equal(classify(original('2104823812042940713').textEn),'unclear');
  assert.equal(classify(original('2103911959544610829').textEn),'reset');
});
test('new banked grant and real completed reset still publish, uncertain mentions do not',()=>{
  assert.equal(classify('We are loading a banked reset into all accounts.'),'banked');
  assert.equal(classify('We have now reset usage limits for all paid users.'),'reset');
  assert.equal(classify('Everyone gets a reset to use anytime.'),'banked');
  assert.equal(classify('Will there be a reset?'),'unclear');
  assert.equal(classify('Thinking about a reset.'),'unclear');
  assert.equal(classify('Tomorrow a new dashboard launches.'),'unclear');
});
test('roadmaps and benefit keywords cannot publish a quota boost',()=>{
  const roadmap=original('2106610099720720811').textEn;
  for(const text of [roadmap,'We will give subscribers a one-time credit tomorrow.','We are working on more usage.','More usage is our goal.','We might increase usage limits.','We did not increase usage limits.','Can users get free credits?','Free credits are planned.','Free credits are available next month.']) assert.equal(classify(text),'unclear',text);
  for(const text of [original('2102871550974427462').textEn,original('1986863197803192782').textEn,'We increased usage limits by 50%.','Free credits are now available to all paid users.','You now get 2x the usual usage.','Pro plans get a one-time credit of $100.','Usage limits are now raised by 20%.']) assert.equal(classify(text),'boost',text);
});
test('a roadmap goes to review without changing the public clock or triggering deployment',async()=>{
  const e=original('2106610099720720811');
  const h=harness({lead:[{sourceUrl:e.sourceUrl}],tweets:{[e.id]:{id:e.id,author:'thsottiaux',text:e.textEn,createdAt:e.announcedAt,url:e.sourceUrl}}});
  const r=await runSentinel(h.options);
  assert.equal(r.auto,0);assert.equal(r.pending,1);assert.equal(h.db['events.json'].events.length,0);assert.equal(h.attempts,0);
});
test('a previous deployment error is retried even after a correction restores the deployed data version',async()=>{
  const h=harness();h.db['release.json'].lastError='invalid deployment token';
  await runSentinel(h.options);assert.equal(h.attempts,1);assert.equal(h.db['release.json'].lastError,null);
  await runSentinel(h.options);assert.equal(h.attempts,1);
  const paused=harness();paused.db['release.json'].lastError='invalid deployment token';paused.options.args=['--no-deploy'];
  await runSentinel(paused.options);assert.equal(paused.attempts,0);assert.ok(paused.db['release.json'].lastError);
});
test('future reset sentence wins over unrelated now/have elsewhere',()=>{
  assert.equal(classify('We will reset limits tomorrow. We have now restored the dashboard.'),'teaser');
});
test('same Friday means upcoming same-day PT time, not seven days later',()=>{
  const p=parseExpected('Reset on Friday at 10am PT','2026-10-02T07:30:00Z');
  assert.equal(p.expectedAt,'2026-10-02T17:00:00.000Z');
});
test('unqualified past clock, PST seasonal mismatch and missing timezone stay ambiguous',()=>{
  assert.ok(parseExpected('Reset today at 10am PT','2026-10-02T20:00:00Z').expectedAmbiguity);
  assert.ok(parseExpected(original('2105843926221660585').textEn,original('2105843926221660585').announcedAt).expectedAmbiguity);
  assert.ok(parseExpected('Reset tomorrow at 10am','2026-10-02T07:30:00Z').expectedAmbiguity);
  assert.equal(parseExpected('Reset tomorrow at 10am PST','2026-12-02T12:00:00Z').expectedAt,'2026-12-03T18:00:00.000Z');
  assert.equal(parseExpected('Reset in a few hours','2026-10-02T07:30:00Z'),null);
});
test('day-only deadline follows DST calendar day (25-hour autumn Sunday)',()=>{
  const p=parseExpected('Reset tomorrow','2026-10-31T18:00:00Z');
  assert.equal(p.expectedAt,'2026-11-01T07:00:00.000Z');
  assert.equal(p.expectedUntil,'2026-11-02T08:00:00.000Z');
  assert.equal(scheduledEvidence(event(p),'2026-11-02T07:30:00Z'),null);
  assert.equal(scheduledEvidence(event(p),'2026-11-02T08:00:00Z').type,'scheduled');
});
test('same-account unrelated reply never confirms another reset',()=>{
  const t={author:'thsottiaux',text:'The new dashboard is live.',createdAt:now,replyToId:'unrelated'};
  assert.equal(confirmationFor(t,[event()]),null);
  assert.equal(confirmationFor({...t,text:'It is done.',replyToId:'101'},[event()]).id,'101');
  assert.equal(confirmationFor({...t,text:'It is done.',replyToId:'101',author:'someoneelse'},[event()]),null);
});
test('official > observed > schedule, and later higher-quality evidence can upgrade',()=>{
  const e=event();
  assert.ok(applyEvidence(e,[{type:'scheduled',at:'2026-10-02T10:00:00Z'},{type:'observed',at:'2026-10-02T11:00:00Z'},{type:'official',at:now,sourceId:'202'}],now));
  assert.equal(e.effectiveAt,now);assert.equal(e.confirmedBy,'202');assert.equal(e.pendingReset,false);
  const old=event();applyEvidence(old,[{type:'scheduled',at:'2026-10-02T10:00:00Z'}],now);
  assert.ok(applyEvidence(old,[{type:'official',at:now,sourceId:'202'}],now));
  assert.equal(old.corrections.length,1);assert.equal(old.effectiveEvidence.type,'official');
  assert.equal(applyEvidence(old,[{type:'observed',at:'2026-10-02T11:00:00Z'}],now),false);
});
test('manual confirmation atomically clears pending schedule, and reverting clears evidence',()=>{
  const result=editEvent(event({expectedAt:'2026-10-03T10:00:00Z',expectedPrecision:'time'}),{kind:'reset',at:'2026-10-02T11:00:00Z'},now);
  assert.equal(result.pendingReset,false);assert.equal(result.expectedAt,undefined);assert.equal(result.effectiveEvidence.type,'manual');
  assert.equal(result.effectiveAt,'2026-10-02T11:00:00.000Z');
  const pending=editEvent(result,{pending:true},now);assert.equal(pending.pendingReset,true);assert.equal(pending.effectiveAt,undefined);assert.equal(pending.effectiveEvidence,undefined);
  assert.throws(()=>editEvent(result,{kind:'whatever'},now));assert.throws(()=>editEvent(result,{pending:true,kind:'reset'},now));
});
test('reference-only schedule is persisted even without new events, but does not auto-promote',async()=>{
  const h=harness({events:[event()],statuses:{'https://codex-resets.com/api/v1/status':{data:{scheduled_reset:{id:'101',scheduled_for:'2026-10-02T10:00:00Z'}}}}});
  const result=await runSentinel(h.options);assert.equal(result.exitCode,0);
  assert.ok(h.writes.includes('events.json'));assert.equal(h.db['events.json'].events[0].expectedFrom,'codex-resets');assert.equal(h.db['events.json'].events[0].pendingReset,true);
});
test('24h reminder persists after delivery and does not repeat next run',async()=>{
  const h=harness({events:[event()]});
  await runSentinel(h.options);const first=h.messages.filter(x=>x.includes('预告已满')).length;assert.equal(first,1);
  assert.equal(h.db['events.json'].events[0].nudgedAt,now);
  await runSentinel(h.options);assert.equal(h.messages.filter(x=>x.includes('预告已满')).length,1);
});
test('failed reminder is not marked delivered and can retry',async()=>{
  const h=harness({events:[event()],notifyFail:true});const result=await runSentinel(h.options);
  assert.equal(result.exitCode,1);assert.equal(h.db['events.json'].events[0].nudgedAt,undefined);
});
test('deploy failure persists retry version, never says published, and retries without new posts',async()=>{
  const t={id:'900',author:'thsottiaux',text:'Resets all propagated.',createdAt:now,url:'https://x.com/thsottiaux/status/900'};
  const h=harness({lead:[{sourceUrl:t.url}],tweets:{900:t},deployFail:true});
  const first=await runSentinel(h.options);assert.equal(first.exitCode,1);assert.equal(h.attempts,1);assert.notEqual(h.db['release.json'].targetVersion,h.db['release.json'].deployedVersion);
  assert.ok(h.messages.some(m=>m.includes('生产发布失败')));assert.ok(h.messages.every(m=>!m.includes('已上线')&&!m.includes('生产已回读确认')));
  h.deployFail=false;const second=await runSentinel(h.options);assert.equal(second.auto,0);assert.equal(second.exitCode,0);assert.equal(h.attempts,2);assert.equal(h.db['release.json'].targetVersion,h.db['release.json'].deployedVersion);
});
test('deploy process success without live version receipt still fails',async()=>{
  const h=harness();h.db['release.json'].deployedVersion='older';h.options.deploy=async()=>{};
  const result=await runSentinel(h.options);assert.equal(result.exitCode,1);assert.match(h.db['release.json'].lastError,/生产回读/);
});
test('all discovery sources failing cannot be hidden by auxiliary status success',async()=>{
  const h=harness({statuses:{'https://fixture/lead':new Error('upstream offline')}});const result=await runSentinel(h.options);
  assert.equal(result.exitCode,1);assert.equal(h.db['health.json'].status,'error');assert.equal(h.db['health.json'].lastSuccessAt,undefined);
});
test('empty valid feed advances health without forcing a deploy',async()=>{
  const h=harness();const result=await runSentinel(h.options);
  assert.equal(result.exitCode,0);assert.equal(h.attempts,0);assert.equal(h.db['health.json'].lastSuccessAt,now);assert.ok(h.writes.includes('health.json'));
});
test('malformed upstream object is not a successful empty feed',async()=>{
  const h=harness({statuses:{'https://fixture/lead':{error:'payment required'}}});const result=await runSentinel(h.options);assert.equal(result.exitCode,1);
});
test('all new post verifications fail: persist error health and fail task',async()=>{
  const h=harness({lead:[{sourceUrl:'https://x.com/thsottiaux/status/999'}]});const result=await runSentinel(h.options);
  assert.equal(result.exitCode,1);assert.equal(result.health.status,'error');assert.equal(h.db['events.json'].events.length,0);
});
test('dry run writes nothing and never deploys or sends',async()=>{
  const h=harness({events:[event()]});h.options.args=['--dry'];await runSentinel(h.options);
  assert.equal(h.writes.length,0);assert.equal(h.attempts,0);assert.equal(h.messages.length,0);
});

test('editing a historical classification does not move its effective date to today',()=>{
  const original=event({kind:'reset',pendingReset:false});
  const edited=editEvent(original,{kind:'banked'},now);
  assert.equal(edited.effectiveAt,original.announcedAt);
});

test('banked confirmation remains a card and unrelated tomorrow does not change a new grant',()=>{
 assert.equal(classify('The banked reset has landed. Have a nice weekend.'),'banked');
 assert.equal(classify('We have added a banked reset.\nTomorrow we launch a dashboard.'),'banked');
 assert.equal(classify('All reset for everyone. Enjoy the week.'),'reset');
 assert.equal(classify('Enjoy a full reset. Propagating in the next hour.'),'teaser');
 assert.equal(parseExpected('We will reset at 10am PT today. Tomorrow a dashboard launches.','2026-10-02T07:30:00Z').expectedAt,'2026-10-02T17:00:00.000Z');
});

test('future execution evidence cannot promote or override a valid lower-priority observation',()=>{
 const e=event();
 assert.equal(applyEvidence(e,[{type:'official',at:'2026-10-03T10:00:00Z'}],now),false);
 assert.equal(e.pendingReset,true);
 assert.equal(applyEvidence(e,[{type:'official',at:'2026-10-03T10:00:00Z'},{type:'observed',at:'2026-10-02T11:00:00Z'}],now),true);
 assert.equal(e.effectiveEvidence.type,'observed');
 assert.equal(parseExpected('We will reset soon. New model tomorrow 10am PT.','2026-10-02T07:30:00Z'),null);
});

test('this and next weekday retain their calendar-week meaning',()=>{
 assert.equal(parseExpected('Reset next Friday at 10am PT','2026-10-01T12:00:00Z').expectedAt,'2026-10-09T17:00:00.000Z');
 assert.ok(parseExpected('Reset this Monday','2026-10-02T12:00:00Z').expectedAmbiguity);
});
