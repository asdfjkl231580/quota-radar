/** Official-source collector. Production publishing is retried by version, independently of new posts.
 * node scripts/sentinel.mjs [--tikhub] [--tikhub-all] [--dry] [--no-deploy] [--no-feishu]
 * Importing this file is safe; runSentinel supports isolated offline tests.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {ROOT,DATA,readJson,writeJson,tikhubKey,sendFeishu,fxTweet,bj} from './lib.mjs';
import {classify,parseExpected,confirmationFor,applyEvidence,scheduledEvidence,relatedTo} from './pipeline.mjs';
import {eventVersion} from './snapshot.mjs';

const ZH={reset:'官方宣布重置（适用范围见原帖，中文待整理）',banked:'官方发放重置卡（中文待整理）',boost:'官方提额或送额度（中文待整理）',teaser:'官方宣布即将重置（生效时间未公布）'};
const sourceId=url=>String(url||'').match(/(?:x|twitter)\.com\/([^/]+)\/status\/(\d+)/);
const safeError=e=>String(e?.message||e).slice(0,240).replace(/(?:Bearer\s+|token[=:\s]+)[^\s]+/gi,'[redacted]');
function realLog(...parts){const line=`[${new Date().toISOString()}] ${parts.join(' ')}`;console.log(line);fs.appendFileSync(path.join(DATA,'sentinel.log'),line+'\n');}
function commitData(){
  execFileSync('git',['config','user.name','quota-radar-bot'],{cwd:ROOT});
  execFileSync('git',['config','user.email','bot@airesetclock.com'],{cwd:ROOT});
  const files=['events','pending','rejected','release','health'].map(n=>`data/${n}.json`).filter(p=>fs.existsSync(path.join(ROOT,p)));
  execFileSync('git',['add',...files],{cwd:ROOT});
  const changed=execFileSync('git',['diff','--cached','--name-only','--',...files],{cwd:ROOT,encoding:'utf8'}).trim();
  if(changed)execFileSync('git',['commit','-m','哨兵：保存采集、发布版本与来源健康状态'],{cwd:ROOT,stdio:'inherit'});
  const ahead=Number(execFileSync('git',['rev-list','--count','@{upstream}..HEAD'],{cwd:ROOT,encoding:'utf8'}).trim());
  if(ahead>0)execFileSync('git',['push'],{cwd:ROOT,stdio:'inherit'});
}
export async function runSentinel(options={}){
  const args=new Set(options.args||[]), now=options.now?.()||new Date().toISOString();
  const read=options.read||readJson, write=options.write||writeJson, fetcher=options.fetcher||fetch, tweet=options.tweet||fxTweet;
  const key=options.key||tikhubKey, notify=options.notify||sendFeishu,log=options.log||realLog;
  const deploy=options.deploy||(()=>execFileSync('node',['scripts/deploy.mjs'],{cwd:ROOT,stdio:'inherit',timeout:360000,env:{...process.env,PATH:(process.env.PATH||'')+':/Users/kenyuanlin/.npm-global/bin:/opt/homebrew/bin:/usr/local/bin'}}));
  const ef=structuredClone(read('events.json',{events:[]})),pf=structuredClone(read('pending.json',{pending:[]})),rf=structuredClone(read('rejected.json',{rejected:[]}));
  const watch=read('watch.json');
  const accounts=new Map(watch.accounts.map(a=>[a.screen_name.toLowerCase(),a.provider]));
  const known=new Set([...ef.events,...pf.pending,...rf.rejected].map(e=>String(e.id))),found=new Map();
  const add=(id,account,via)=>{id=String(id||'');if(id&&!known.has(id)&&!found.has(id))found.set(id,{account,via});};
  const before=JSON.stringify(ef.events),beforePending=JSON.stringify(pf.pending),beforeRejected=JSON.stringify(rf.rejected);
  const health=structuredClone(read('health.json',{schemaVersion:1,sources:{}}));health.schemaVersion=1;health.sources??={};health.lastAttemptAt=now;
  const errors=[],attempted=[];let discoverySuccess=0,verificationSuccess=0;
  async function source(name,fn,discovery=false){
    const state={...health.sources[name],lastAttemptAt:now};health.sources[name]=state;attempted.push(state);
    try{const value=await fn();state.status='ok';state.lastSuccessAt=now;state.lastError=null;state.items=Array.isArray(value)?value.length:undefined;if(discovery)discoverySuccess++;return value;}
    catch(e){state.status='error';state.lastError=safeError(e);log(`${name} 失败: ${state.lastError}`);return null;}
  }
  async function json(url,headers={}){const response=await fetcher(url,{headers:{'User-Agent':'quota-radar-sentinel (airesetclock.com)',...headers},signal:AbortSignal.timeout(25000)});if(!response.ok)throw Error(`HTTP ${response.status}`);return response.json();}
  for(const src of watch.leadSources||[]){
    await source(`lead:${src.name}:${src.provider}`,async()=>{
      const j=await json(src.url),list=j.events??j.data;if(!Array.isArray(list))throw Error('线索响应不是事件数组');
      for(const item of list){const m=sourceId(item.sourceUrl||item.source?.url);if(m)add(m[2],m[1],src.name);}
      log(`${src.name}/${src.provider}: ${list.length} 条`);return list;
    },true);
  }
  let scheduled=null;const evidence=new Map();
  const offer=(id,value)=>{const list=evidence.get(String(id))||[];list.push(value);evidence.set(String(id),list);};
  const status=await source('codex-resets:status',async()=>{const j=await json('https://codex-resets.com/api/v1/status');if(!j.data||typeof j.data!=='object')throw Error('状态响应无 data');return j.data;});
  if(status){
    scheduled=status.scheduled_reset;
    if(scheduled){const m=sourceId(scheduled.source?.url);if(m)add(m[2],m[1],'codex-resets');}
    const resets=await source('codex-resets:evidence',async()=>{const j=await json('https://codex-resets.com/api/v1/resets?limit=20');if(!Array.isArray(j.data))throw Error('执行证据响应不是数组');return j.data;});
    for(const event of ef.events.filter(e=>e.provider==='codex'&&(e.pendingReset||['scheduled','observed'].includes(e.effectiveEvidence?.type)))){
      if(scheduled?.id===event.id&&scheduled.scheduled_for&&!event.expectedAt){
        const at=Date.parse(scheduled.scheduled_for);
        if(Number.isFinite(at)&&!event.expectedAmbiguity){event.expectedAt=new Date(at).toISOString();event.expectedPrecision='time';event.expectedFrom='codex-resets';log(`记录第三方排期 ${event.id}；不作为官方时间自动转正`);}
      }
      const observed=resets?.find(r=>r.id==='observed-'+event.id);
      if(observed&&Number.isFinite(Date.parse(observed.announced_at)))offer(event.id,{type:'observed',at:new Date(observed.announced_at).toISOString(),url:'https://codex-resets.com',sourceId:observed.id});
      else if(status.latest_reset?.id===event.id&&scheduled?.id!==event.id)offer(event.id,{type:'observed',at:now,url:'https://codex-resets.com',sourceId:event.id,note:'第三方标记已执行；时间为本站发现时间'});
    }
  }
  const useTikHub=args.has('--tikhub')||args.has('--tikhub-all');
  if(useTikHub){
    const token=key();if(!token)errors.push('TikHub 配置缺失');
    else for(const account of (args.has('--tikhub-all')?watch.accounts:watch.accounts.filter(a=>['thsottiaux','ClaudeDevs'].includes(a.screen_name)))){
      await source(`tikhub:${account.screen_name}`,async()=>{
        const j=await json(`https://api.tikhub.io/api/v1/twitter/web/fetch_user_post_tweet?screen_name=${account.screen_name}`,{Authorization:'Bearer '+token});
        const list=j.data?.timeline;if(!Array.isArray(list))throw Error('TikHub 响应无 timeline');
        for(const t of list)if(new RegExp(watch.keywords,'i').test(t.text||''))add(t.tweet_id,account.screen_name,'tikhub');return list;
      },true);
    }
    const candidates=ef.events.filter(e=>(e.pendingReset||['scheduled','observed'].includes(e.effectiveEvidence?.type))&&Date.parse(now)-Date.parse(e.announcedAt)<7*86400000);
    if(token)for(const account of [...new Set(candidates.map(e=>e.account.replace(/^@/,'')))]){
      const list=await source(`tikhub:replies:${account}`,async()=>{const j=await json(`https://api.tikhub.io/api/v1/twitter/web/fetch_user_tweet_replies?screen_name=${account}`,{Authorization:'Bearer '+token});if(!Array.isArray(j.data?.timeline))throw Error('TikHub 回复响应无 timeline');return j.data.timeline;});
      for(const item of list||[]){
        const id=String(item.tweet_id||'');if(!id||!candidates.some(e=>relatedTo(item,e)))continue;
        // Independently validate author, text and relationship, not just a broad “is live”.
        await source(`fx:reply:${id}`,async()=>{const t=await tweet(account,id);if(!t.text||!accounts.has(String(t.author).toLowerCase()))throw Error('确认帖作者或正文未核实');const event=confirmationFor(t,candidates);if(event)offer(event.id,{type:'official',at:t.createdAt,sourceId:id,url:t.url||`https://x.com/${account}/status/${id}`});return t;});
      }
    }
  }
  const auto=[],pending=[];
  for(const [id,meta]of found){
    await source(`fx:${id}`,async()=>{
      const t=await tweet(meta.account,id);if(!t.text||!t.author||!Number.isFinite(Date.parse(t.createdAt)))throw Error('原帖正文、作者或时间不完整');
      if(t.id&&String(t.id)!==id)throw Error('原帖 ID 不匹配');
      if(!accounts.has(t.author.toLowerCase())){rf.rejected.push({id,why:'作者非官方账号 @'+t.author,at:now,textEn:t.text,sourceUrl:t.url});verificationSuccess++;return t;}
      verificationSuccess++;
      const kind=classify(t.text),base={id,provider:accounts.get(t.author.toLowerCase()),account:'@'+t.author,sourceUrl:t.url||`https://x.com/${t.author}/status/${id}`,announcedAt:t.createdAt,textEn:t.text};
      if(['reset','banked','boost','teaser'].includes(kind)){
        const event={...base,kind,extraLinks:[],zh:ZH[kind],detail:'',scope:'待核实',verified:true,verifiedBy:`自动：${meta.via} 线索 + 原帖核验`,verifiedAt:now.slice(0,10),confidence:'auto'};
        if(kind==='teaser'){event.pendingReset=true;Object.assign(event,parseExpected(t.text,t.createdAt)||{});if(event.expectedAmbiguity)event.detail=event.expectedAmbiguity;}
        const related=confirmationFor(t,ef.events);
        if(related&&kind==='reset'){
          // Keep one event for the announcement and its confirmation; retain the new source link.
          offer(related.id,{type:'official',at:t.createdAt,sourceId:id,url:event.sourceUrl});
          rf.rejected.push({id,why:'确认帖已关联预告 '+related.id,at:now,originalEvent:event,relatedEventId:related.id});
        }else auto.push(event);
      }else pending.push({...base,via:meta.via,foundAt:now,zhDraft:'',guess:kind});
      return t;
    });
  }
  let promoted=0;const nudges=[];
  for(const event of ef.events){
    const fallback=scheduledEvidence(event,now);if(fallback)offer(event.id,fallback);
    if(applyEvidence(event,evidence.get(event.id)||[],now)){promoted++;log(`更新生效证据 ${event.id} ${event.effectiveEvidence.type}`);}
    if(event.pendingReset&&!event.expectedAt&&Date.parse(now)-Date.parse(event.announcedAt)>86400000&&!event.nudgedAt)nudges.push(event);
  }
  ef.events.push(...auto);ef.events.sort((a,b)=>a.announcedAt<b.announcedAt?1:-1);pf.pending.push(...pending);
  if(discoverySuccess===0)errors.push('全部主要线索源失败');
  if(found.size>0&&verificationSuccess===0)errors.push('所有新线索均未通过原帖核验');
  health.status=errors.length?'error':attempted.some(s=>s.status==='error')?'degraded':'ok';
  if(discoverySuccess>0&&(!found.size||verificationSuccess>0))health.lastSuccessAt=now;
  if(args.has('--dry'))return{exitCode:errors.length?1:0,auto:auto.length,pending:pending.length,promoted,health,errors,events:ef};
  // Persist the reminder only after confirmed delivery; a failed notification is retryable.
  if(nudges.length&&!args.has('--no-feishu')){
    try{await notify('【额度雷达】预告已满 24 小时，尚无明确时间/确认：\n'+nudges.map(e=>`${e.account} ${e.id}；人工确认：review.mjs edit ${e.id} --kind reset --at <ISO>`).join('\n'));for(const e of nudges)e.nudgedAt=now;}
    catch(e){errors.push('预告提醒发送失败: '+safeError(e));}
  }
  if(JSON.stringify(ef.events)!==before){ef.updatedAt=now;write('events.json',ef);}
  if(JSON.stringify(pf.pending)!==beforePending)write('pending.json',pf);
  if(JSON.stringify(rf.rejected)!==beforeRejected)write('rejected.json',rf);
  write('health.json',health);
  const version=eventVersion(ef.events);let release=structuredClone(read('release.json',{}));let published=false,attemptedDeploy=false;
  if(release.targetVersion!==version){release.targetVersion=version;write('release.json',release);}
  if(release.deployedVersion!==version&&!args.has('--no-deploy')){
    attemptedDeploy=true;release.lastAttemptAt=now;release.lastError=null;write('release.json',release);
    try{await deploy();release=read('release.json',{});if(release.deployedVersion!==version)throw Error('部署未提供生产回读版本确认');published=true;log('生产版本回读确认 '+version);}
    catch(e){release=structuredClone(read('release.json',release));release.targetVersion=version;release.lastAttemptAt=now;release.lastError=safeError(e);write('release.json',release);errors.push('生产发布失败: '+release.lastError);log(errors.at(-1));}
  }
  if((auto.length||pending.length||promoted||attemptedDeploy)&&!args.has('--no-feishu')){
    const label=published?'生产已回读确认':release.deployedVersion===version?'生产版本一致':attemptedDeploy?'已入库，生产发布失败（将重试）':'已入库，待发布';
    try{await notify(`【额度雷达】${label}\n新增 ${auto.length} 条；待办 ${pending.length} 条；证据更新 ${promoted} 条。\n${auto.map(e=>`[${e.kind}] ${e.account} ${bj(e.announcedAt,'md')} ${e.zh}`).join('\n')}`);}
    catch(e){errors.push('状态通知失败: '+safeError(e));}
  }
  // Commit collected state even when deployment fails, then return failure to Actions/watchdog.
  if(options.commit||process.env.GITHUB_ACTIONS){try{await(options.commit||commitData)();}catch(e){errors.push('状态提交失败: '+safeError(e));}}
  for(const error of errors)log(error);
  return{exitCode:errors.length?1:0,auto:auto.length,pending:pending.length,promoted,health,release,errors,published};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{const result=await runSentinel({args:process.argv.slice(2)});process.exitCode=result.exitCode;}
  catch(e){console.error(safeError(e));process.exitCode=1;}
}
