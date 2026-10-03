import test, {beforeEach,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {sendFeishu,sendFeishuApi} from '../scripts/lib.mjs';
const realFetch=globalThis.fetch;
const envNames=['FEISHU_APP_ID','FEISHU_APP_SECRET','FEISHU_TO_CHAT_ID'];
const original=Object.fromEntries(envNames.map(name=>[name,process.env[name]]));
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
beforeEach(()=>{
  Object.assign(process.env,{FEISHU_APP_ID:'test-app',FEISHU_APP_SECRET:'test-secret',FEISHU_TO_CHAT_ID:'test-chat'});
  globalThis.fetch=async()=>{throw new Error('Unmocked network prohibited');};
});
afterEach(()=>{
  globalThis.fetch=realFetch;
  for(const name of envNames) { if(original[name]===undefined) delete process.env[name]; else process.env[name]=original[name]; }
});

test('CLI cloud notifications reject HTTP failure and missing message receipt',async()=>{
  for(const transport of [sendFeishuApi, message=>sendFeishu(message,{exists:()=>false})]) {
    for(const failure of [()=>json({code:0,data:{}},200),()=>json({code:0,data:{message_id:'untrusted'}},502),()=>json({code:230002,msg:'private details'},200)]) {
      globalThis.fetch=async(url,options)=>{
        assert.ok(options.signal);
        return String(url).includes('/auth/') ? json({code:0,tenant_access_token:'test-token'}) : failure();
      };
      await assert.rejects(transport('test only'),/feishu_message/);
    }
    globalThis.fetch=async()=>json({code:0,tenant_access_token:'untrusted'},502);
    await assert.rejects(transport('test only'),/feishu_token_http_502/);
  }
});

test('CLI cloud notifications return only a confirmed receipt',async()=>{
  globalThis.fetch=async url=>String(url).includes('/auth/') ? json({code:0,tenant_access_token:'test-token'}) : json({code:0,data:{message_id:'message-1'}});
  assert.deepEqual(await sendFeishu('test only',{exists:()=>false}),{messageId:'message-1'});
});

test('Hermes process exit zero alone does not mean delivered',async()=>{
  for(const raw of ['not json','{}','null',JSON.stringify({success:true}),JSON.stringify({success:true,message_id:13}),JSON.stringify({success:true,message_id:' '}),JSON.stringify({success:false,message_id:'m'}),JSON.stringify({success:true,message_id:'m',skipped:true}),JSON.stringify({success:true,message_id:'m',error:'rejected'})]) {
    await assert.rejects(sendFeishu('test only',{exists:()=>true,execute:()=>raw}),/hermes_(invalid_receipt|message_unconfirmed)/);
  }
});

test('Hermes validates success receipt and bounds execution without exposing cloud credentials',async()=>{
  let commands=0;
  const receipt=await sendFeishu('test only',{exists:()=>true,execute:(binary,args,options)=>{
    commands++;
    assert.ok(binary.endsWith('/venv/bin/python'));
    assert.ok(args.includes('--json'));
    assert.ok(args.includes('--file'));
    assert.equal(options.input,'test only');
    assert.equal(options.timeout,30000);
    assert.equal(options.env.FEISHU_APP_SECRET,undefined);
    assert.equal(options.env.HERMES_PROFILE,undefined);
    return JSON.stringify({success:true,message_id:'confirmed-hermes'});
  }});
  assert.deepEqual(receipt,{messageId:'confirmed-hermes'});
  assert.equal(commands,1);
});

test('Hermes command failure stays a rejected promise and never falls back to duplicate delivery',async()=>{
  let network=0;
  globalThis.fetch=async()=>{network++;throw new Error('must not send');};
  await assert.rejects(sendFeishu('test only',{exists:()=>true,execute:()=>{throw new Error('mock timeout');}}),/mock timeout/);
  assert.equal(network,0);
});
