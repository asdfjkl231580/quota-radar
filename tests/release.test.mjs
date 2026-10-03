import test from 'node:test';
import assert from 'node:assert/strict';
import { eventVersion, comparePublicSnapshot, normalizeSource } from '../scripts/snapshot.mjs';
import { verifyDeployment } from '../scripts/deploy.mjs';
import { validateEvents } from '../scripts/validate-events.mjs';

test('snapshot ignores key/list order but catches a same-count correction', () => {
  const a = [{id:'1',kind:'reset'},{id:'2',kind:'banked'}];
  assert.equal(eventVersion(a), eventVersion([{kind:'banked',id:'2'}, {kind:'reset',id:'1'}]));
  assert.notEqual(eventVersion(a), eventVersion([{id:'1',kind:'teaser'}, a[1]]));
  const expected = {version:eventVersion(a),updatedAt:'2026-10-02',events:a};
  assert.equal(comparePublicSnapshot(expected, {...expected, events:[{id:'1',kind:'teaser'},a[1]]}).ok,false);
});

test('source comparison sees changes after the first sixty characters', () => {
  const prefix = 'Official announcement with details about the subscription eligibility. ';
  assert.notEqual(normalizeSource(prefix+'$100 on Pro, $250 on Max.'),normalizeSource(prefix+'$1 on Pro, $2 on Max.'));
  assert.equal(normalizeSource('It’s  ready.\n\nEnjoy.'),normalizeSource("It's ready. Enjoy."));
});

test('release verification waits for data AND homepage then confirms', async () => {
  const expected = {version:'sha256:test',updatedAt:'2026-10-02',events:[{id:'1'}]};
  let count=0;
  const fetchImpl = async url => {
    count++;
    if (url.includes('/api/events.json')) return new Response(JSON.stringify(count===1?{...expected,version:'old'}:expected));
    return new Response('<meta name="qr-data-version" content="sha256:test">');
  };
  const result=await verifyDeployment('https://example.invalid',expected,{fetchImpl,sleep:async()=>{},attempts:2});
  assert.equal(result.version,expected.version);
  assert.equal(count,3);
});

test('an old homepage or edited data never passes release verification', async () => {
  const expected = {version:'sha256:test',updatedAt:'2026-10-02',events:[{id:'1'}]};
  await assert.rejects(verifyDeployment('https://example.invalid',expected,{
    fetchImpl:async url=>url.includes('/api/events.json')?new Response(JSON.stringify(expected)):new Response('old homepage'),attempts:1
  }),/homepage version differs/);
  await assert.rejects(verifyDeployment('https://example.invalid',expected,{
    fetchImpl:async()=>new Response(JSON.stringify({...expected,events:[{id:'2'}]})),attempts:1
  }),/event content differs/);
});

test('invalid state cannot pass the publication guard', () => {
  const event={id:'1',provider:'codex',kind:'reset',pendingReset:true,account:'@test',sourceUrl:'https://x.com/test/status/1',scope:'All',verifiedAt:'2026-10-01',announcedAt:'2026-10-01T00:00:00Z',textEn:'reset',zh:'重置'};
  assert.ok(validateEvents([event],Date.parse('2026-10-02')).some(x=>x.includes('teaser')));
  assert.ok(validateEvents([{...event,pendingReset:false,effectiveAt:'2026-10-03T00:00:00Z'}],Date.parse('2026-10-02')).some(x=>x.includes('尚未到达')));
});
