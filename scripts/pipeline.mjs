// Pure classification and state transitions. Importing this module never collects or publishes.
const normalize = (text) => String(text || '').toLowerCase().replace(/[’‘]/g, "'").replace(/[^\S\n]+/g, ' ').trim();
const RESET = /\breset(?:ting|s|ed)?\b|\breseting\b/;
const NEGATED = /\b(?:can't|cannot|can not|won't|will not|don't|do not|didn't|did not|not going to|unable to|not|no|never)\b[^.!?;]{0,65}\breset/;
const FUTURE = /\b(?:tomorrow|next week|later (?:today|tonight|this week)|coming soon|promis\w*|(?:will|we'll|going to|about to)[^.!?;]{0,24}reset|reset[^.!?;]{0,30}will|within|in \d+ (?:minute|hour)|on (?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|land(?:s|ing)? (?:tomorrow|at|in|within|by|around)|propagat(?:ing|e) (?:over|in|to))\b/;
const COMPLETE = /\b(?:all reset for|reset(?:s)? (?:all )?propagated|reset button pressed|(?:have|has|we've|i've) (?:now |just |also |again )?(?:been )?reset|(?:are|is) (?:now )?reset|(?:reset|limits?)[^.!?;]{0,45}(?:has landed|have landed|is done|completed|back to 100%)|(?:just |now )(?:reset|resetting)|reset (?:everyone|everybody|all|your|the|usage|rate)|resetting (?:everyone|everybody|all|your|the|usage|rate)|enjoy (?:a |the )?(?:nice |full |sweet )?reset)\b/;
const BANKED = /\bbanked\b|into (?:your|the) (?:reset )?bank|reset (?:credit|to use (?:anytime|at your|whenever))|(?:a|one) reset (?:you can|to) use|(?:use|apply) it (?:anytime|whenever)/;
const BOOST = /(?:limits? (?:increase|up|raised)|increase[sd]? (?:the )?(?:usage|limits|rate limits)|more usage|free credits?|one-time credit|goes? \d+% further|\d+x more usage|(?:lifting|lift) (?:the )?usage limits|2x the usual)/;

export function classify(text) {
  const t = normalize(text);
  if (!t || /^@/.test(t)) return 'unclear';
  if (/(?:^|[.!;])[^.!;?]*\breset(?:ting|s|ed)?\b[^.!;?]*\?/.test(t)) return 'unclear';
  const clauses = t.split(/[.!?;\n]+/).map(s => s.trim()).filter(Boolean);
  const resetClauses = clauses.filter(s => RESET.test(s));
  const continuations = clauses.filter((s,i)=>i>0&&RESET.test(clauses[i-1])&&/^(?:landing|lands|propagating|should land|should be showing|it will)/.test(s));
  if (resetClauses.some(s => NEGATED.test(s))) return 'unclear';
  // A reminder about an older grant does not create a new event or restart a clock.
  if (resetClauses.some(s => /\b(?:reset|granted|gave|issued)[^.!?;]{0,100}\b(?:last (?:week|month|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|yesterday|previously|earlier this (?:week|month)|\d+ days? ago)\b/.test(s)) ||
      (resetClauses.length && /(?:haven't|have not|hasn't|has not) used it yet|can still (?:apply|use|redeem)|reminder.*reset/.test(t))) return 'reminder';
  if (resetClauses.length) {
    // Future tense belongs to the reset sentence; unrelated “now” never overrides it.
    if ([...resetClauses,...continuations].some(s => FUTURE.test(s))) return 'teaser';
    const immediate = /(?:full|fully|hard|double|sneaky) reset|reset everyone's/.test(t);
    if (BANKED.test(t)&&!immediate) return 'banked';
    if (resetClauses.some(s => COMPLETE.test(s)) || (immediate&&/we (?:did|have|are)/.test(t))) return 'reset';
    return 'unclear';
  }
  if (BOOST.test(t) && !/\b(?:won't|not|never)\b[^.!?;]{0,20}(?:increase|more usage|credit)/.test(t)) {
    return FUTURE.test(clauses.find(s => BOOST.test(s)) || '') ? 'unclear' : 'boost';
  }
  return 'unclear';
}

const PT = 'America/Los_Angeles';
function localParts(date) {
  return Object.fromEntries(new Intl.DateTimeFormat('en-US', {timeZone:PT,hourCycle:'h23',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',weekday:'short'}).formatToParts(date).map(x=>[x.type,x.value]));
}
function offsetAt(ms) { const p=localParts(new Date(ms)); return Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute)-Math.floor(ms/60000)*60000; }
function ptAt(y,m,d,h=0,mi=0) {
  const target=Date.UTC(y,m-1,d,h,mi); let ms=target;
  for(let i=0;i<4;i++) ms=target-offsetAt(ms);
  // Reject nonexistent/ambiguous wall times on DST boundaries.
  const matches = [ms-3600000,ms,ms+3600000].filter(v=>v+offsetAt(v)===target);
  return matches.length===1 ? matches[0] : null;
}
export function parseExpected(text, announcedAt) {
  const source=normalize(text);
  const sentences=source.split(/[.!?;\n]+/).map(s=>s.trim()).filter(Boolean);
  const relevant=sentences.filter((s,i)=>RESET.test(s)||(i>0&&RESET.test(sentences[i-1])&&/^(?:landing|lands|propagating|should land|should be showing|it will)/.test(s)));
  const t=relevant.length?relevant.join(' '):source, a=new Date(announcedAt); if(!Number.isFinite(a.getTime())) return null;
  const nmap={a:1,an:1,one:1,two:2,three:3,four:4,five:5,six:6};
  // “a few” is not a precise official time, so never invent a three-hour deadline.
  const rel=t.match(/\b(?:in|within)(?: the next)? (\d+|an?|one|two|three|four|five|six) (min|minute|hour|hr)s?\b/);
  if(rel) return {expectedAt:new Date(a.getTime()+(nmap[rel[1]]??+rel[1])*(rel[2].startsWith('min')?60000:3600000)).toISOString(),expectedPrecision:'time',expectedFrom:'official'};
  if(/within the (?:next )?hour/.test(t)) return {expectedAt:new Date(+a+3600000).toISOString(),expectedPrecision:'time',expectedFrom:'official'};
  const p=localParts(a), y=+p.year,m=+p.month,d=+p.day;
  const tm=t.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*(pt|pst|pdt|pacific)\b/);
  const unzoned=t.match(/\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/);
  if(unzoned&&!tm) return {expectedAmbiguity:'原文给出钟点但未注明时区，待核实后再倒计时。'};
  let delta=null;
  if(/\btomorrow\b/.test(t)) delta=1;
  else if(/\b(?:today|tonight)\b/.test(t)) delta=0;
  else {
    const wd=t.match(/\b(?:(on|this|next) )?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);
    if(wd) { const index=['sunday','monday','tuesday','wednesday','thursday','friday','saturday'].indexOf(wd[2]); const current=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(p.weekday); delta=(index-current+7)%7; if(wd[1]==='next') delta=7-(current+6)%7+(index+6)%7; if(wd[1]==='this') delta=(index+6)%7-(current+6)%7; }
  }
  if(delta===null&&!tm) return null;
  const date=new Date(Date.UTC(y,m-1,d+(delta??0)));
  const yy=date.getUTCFullYear(), mm=date.getUTCMonth()+1, dd=date.getUTCDate();
  let h=0,mi=0;
  if(tm) { if(+tm[1]<1||+tm[1]>12||+(tm[2]||0)>59) return null; h=+tm[1]%12+(tm[3]==='pm'?12:0);mi=+(tm[2]||0); }
  let at=ptAt(yy,mm,dd,h,mi);
  if(at===null) return {expectedAmbiguity:'原文钟点处于美西夏令时切换的重复或不存在时段，需人工核实。'};
  if(tm&&['pst','pdt'].includes(tm[4])) {
    const explicit=tm[4]==='pst'?-8:-7;
    if(offsetAt(at)/3600000!==explicit) return {expectedAmbiguity:`原文使用 ${tm[4].toUpperCase()}，与该日期的美西当地时区相差一小时；需核实官方采用固定时区还是当地时间。`};
  }
  // Same-day times already in the past are ambiguous, not an invented next-day reset.
  if(tm&&at<+a) return {expectedAmbiguity:'原文钟点按公告当天解释已过去，需核实日期。'};
  if(tm) return {expectedAt:new Date(at).toISOString(),expectedPrecision:'time',expectedFrom:'official'};
  const end=ptAt(yy,mm,dd+1);
  if(end===null) return null;
  if(end<=+a) return {expectedAmbiguity:'原文日期按本周解释已过去，需核实具体日期。'};
  return {expectedAt:new Date(at).toISOString(),expectedUntil:new Date(end).toISOString(),expectedPrecision:'day',expectedFrom:'official'};
}

export function relatedTo(tweet, event) {
  const id=String(event.id);
  const ids=[tweet.replyToId,tweet.conversationId,tweet.in_reply_to_status_id,tweet.in_reply_to_status_id_str,tweet.conversation_id,tweet.quotedTweetId,tweet.quoted_tweet_id].filter(Boolean).map(String);
  return ids.includes(id)||new RegExp(`https?://(?:www\\.)?(?:x|twitter)\\.com/[^/]+/status/${id}(?:\\b|/)`).test(tweet.text||'');
}
export function confirmationFor(tweet, events) {
  const text=normalize(tweet.text);
  if(!/propagated|\bit is done\b|it's done|all done|has landed|have landed|is live|are live|now reset|been reset|reset (?:is )?(?:done|complete)|back to 100%|should (?:now )?see (?:it|the reset)|rolled out|went out/.test(text)||/[?]\s*$/.test(text)||NEGATED.test(text)) return null;
  return events.find(e=> (e.pendingReset||['scheduled','observed'].includes(e.effectiveEvidence?.type)) &&
    String(e.account).replace(/^@/,'').toLowerCase()===String(tweet.author||'').replace(/^@/,'').toLowerCase() &&
    new Date(tweet.createdAt)>=new Date(e.announcedAt)&&relatedTo(tweet,e)) || null;
}
const RANK={scheduled:1,observed:2,official:3,manual:4};
export function applyEvidence(event, candidates, now) {
  const valid=candidates.filter(c=>RANK[c.type]&&Number.isFinite(Date.parse(c.at))&&Date.parse(c.at)<=Date.parse(now)).sort((a,b)=>RANK[b.type]-RANK[a.type]||Date.parse(a.at)-Date.parse(b.at));
  const best=valid[0]; if(!best) return false;
  const old=event.effectiveEvidence;
  if(old && RANK[old.type]>=RANK[best.type]) return false;
  if(!event.pendingReset&&!old) return false;
  if(old) (event.corrections??=[]).push({at:now,reason:'使用更高优先级的生效证据',previousEffectiveEvidence:old,previousEffectiveAt:event.effectiveAt});
  event.pendingReset=false;event.kind=BANKED.test(normalize(event.textEn))?'banked':'reset';event.effectiveAt=best.at;event.promotedAt=now;event.effectiveEvidence={...best};
  if(best.type==='official') { event.confirmedBy=best.sourceId; if(best.url)event.extraLinks=[...new Set([...(event.extraLinks||[]),best.url])]; }
  if(best.type==='observed') event.observedAt=best.at;
  const label=best.type==='official'?'官方确认生效':best.type==='observed'?'第三方观测到账':'按官方预告时间计';
  event.zh=String(event.zh||'').replace(/[，,（(]?\s*(?:尚未确认生效|生效时间未公布|按预告时间计|已到账|已确认生效)\s*[）)]?/g,'').trim()+`（${label}）`;
  event.detail=String(event.detail||'').replace(/官方未另发确认，按预告时间计。/g,'').trim();
  return true;
}
export function scheduledEvidence(event, now) {
  if(!event.pendingReset||!event.expectedAt||event.expectedAmbiguity||!['official','manual',undefined].includes(event.expectedFrom)) return null;
  const due=event.expectedPrecision==='day'?(event.expectedUntil||new Date(Date.parse(event.expectedAt)+86400000).toISOString()):event.expectedAt;
  return Date.parse(now)>=Date.parse(due)?{type:'scheduled',at:event.expectedAt,url:event.sourceUrl}:null;
}
export function editEvent(event, options, now=new Date().toISOString()) {
  const e=structuredClone(event);
  if(options.kind&&!['reset','banked','boost','teaser'].includes(options.kind))throw Error('invalid --kind');
  if(options.provider&&!['codex','claude'].includes(options.provider))throw Error('invalid --provider');
  if(options.confidence&&!['auto','high'].includes(options.confidence))throw Error('invalid --confidence');
  if(options.pending&&options.kind&&options.kind!=='teaser')throw Error('--pending conflicts with --kind');
  if(options.precision&&!['time','day'].includes(options.precision))throw Error('invalid --precision');
  for(const k of ['zh','detail','scope','kind','provider','confidence'])if(options[k])e[k]=options[k];
  if(options.expect==='none')for(const k of ['expectedAt','expectedUntil','expectedPrecision','expectedFrom','expectedAmbiguity'])delete e[k];
  else if(options.expect){if(!Number.isFinite(Date.parse(options.expect)))throw Error('invalid --expect');e.expectedAt=new Date(options.expect).toISOString();e.expectedPrecision=options.precision||'time';e.expectedFrom='manual';delete e.expectedAmbiguity;delete e.expectedUntil;}
  if(options.pending||options.kind==='teaser') {e.kind='teaser';e.pendingReset=true;for(const k of ['promotedAt','effectiveAt','effectiveEvidence','confirmedBy','observedAt','fulfilledBy','nudgedAt'])delete e[k];}
  if(options.kind&&options.kind!=='teaser') {
    const at=options.at||options.effective||((event.pendingReset||event.kind==='teaser')?now:(event.effectiveAt||event.announcedAt||now));if(!Number.isFinite(Date.parse(at)))throw Error('invalid --at');
    e.pendingReset=false;e.effectiveAt=new Date(at).toISOString();e.promotedAt=now;e.effectiveEvidence={type:'manual',at:e.effectiveAt};
    for(const k of ['expectedAt','expectedUntil','expectedPrecision','expectedFrom','expectedAmbiguity','confirmedBy','observedAt','fulfilledBy','nudgedAt'])delete e[k];
  }
  if(e.confidence==='auto'&&options.zh){e.confidence='high';e.verifiedBy='人工核实 + 原帖';}
  e.verifiedAt=now.slice(0,10);return e;
}
