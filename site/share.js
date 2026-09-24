/* 分享系统 + 留言反馈（纯前端，Canvas 生成状态快照图，不截网页） */
(function(){
  var lang=document.documentElement.lang.slice(0,2), zh=lang==='zh';
  var S=JSON.parse(document.getElementById('share-data').textContent);   // {site,url,codex:{kind,since,zh,en},claude:{...},kinds:{}}
  var T=zh?{share:'分享',sharePage:'分享网页',shareImg:'生成当前状态图',copy:'复制链接',copied:'已复制',dl:'下载图片',sys:'系统分享',close:'关闭',gen:'生成中…',asof:'数据截至',bj:'北京时间',since:'距上次送额度已过去',next:'官方下次：尚未公布',fb:'留言',fbTitle:'留言 / 提建议',fbPh:'哪里不准、想加什么、看不懂的地方，都可以写',fbContact:'联系方式（选填，邮箱或微信）',fbSend:'发送',fbOk:'收到了，谢谢！',fbErr:'发送失败，稍后再试',units:['天','时','分'],portrait:'竖版 1080×1440',og:'横版 1200×630',tip:'这张图是生成那一刻的快照，之后不会变'}
                 :{share:'Share',sharePage:'Share this page',shareImg:'Snapshot image',copy:'Copy link',copied:'Copied',dl:'Download',sys:'System share',close:'Close',gen:'Generating…',asof:'Data as of',bj:'UTC',since:'Since the last quota grant',next:'Next: not announced',fb:'Feedback',fbTitle:'Feedback',fbPh:'Wrong data, missing events, anything confusing',fbContact:'Contact (optional)',fbSend:'Send',fbOk:'Got it, thanks!',fbErr:'Failed, try again later',units:['d','h','m'],portrait:'Portrait 1080×1440',og:'Card 1200×630',tip:'A snapshot of this moment; it will not change later'};
  function el(h){var d=document.createElement('div');d.innerHTML=h.trim();return d.firstChild}
  function pad(n){return (n<10?'0':'')+n}
  function elapsed(iso){var ms=Date.now()-new Date(iso).getTime();if(ms<0)ms=0;return [Math.floor(ms/86400000),Math.floor(ms%86400000/3600000),Math.floor(ms%3600000/60000)]}
  function nowLabel(){var d=new Date();var tz=zh?'Asia/Shanghai':'UTC';var o={timeZone:tz,year:'numeric',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false};if(zh){var p={};new Intl.DateTimeFormat('zh-CN',o).formatToParts(d).forEach(function(x){p[x.type]=x.value});return p.year+'年'+p.month+'月'+p.day+'日 '+p.hour+':'+p.minute+' '+T.bj}return new Intl.DateTimeFormat('en-US',{timeZone:tz,month:'short',day:'numeric',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(d)+' UTC'}
  function load(src){return new Promise(function(res,rej){var i=new Image();i.onload=function(){res(i)};i.onerror=function(){res(null)};i.src=src})}
  function roundRect(c,x,y,w,h,r){c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath()}
  var CN='"PingFang SC","Hiragino Sans GB","Noto Sans SC","Microsoft YaHei",sans-serif', EN='"NumCN",Inter,"Helvetica Neue",Arial,sans-serif', HERO='"HeroCN",'+CN;
  // 画一张卡：p=codex|claude
  function drawCard(c,x,y,w,h,p,big){
    var d=S[p]; var isC=p==='codex'; var e=elapsed(d.since);
    c.save(); roundRect(c,x,y,w,h,big?36:26); c.fillStyle=isC?'#1467F5':'#FFEA00'; c.fill();
    var fg=isC?'#fff':'#111'; c.fillStyle=fg; var pad_=big?44:30;
    c.font='900 '+(big?52:34)+'px '+EN; c.fillText(isC?'Codex':'Claude',x+pad_,y+pad_+(big?46:30));
    var badge=S.kinds[d.kind]||d.kind; c.font='700 '+(big?26:18)+'px '+CN; var bw=c.measureText(badge).width+(big?36:24);
    var bx=x+pad_+c.measureText(isC?'Codex':'Claude').width*(big?1.9:1.85)+(big?24:16), by=y+pad_+(big?8:4);
    roundRect(c,bx,by,bw,big?44:30,big?12:8); c.fillStyle=isC?'#fff':'#111'; c.fill(); c.fillStyle=isC?'#1467F5':'#FFEA00'; c.fillText(badge,bx+(big?18:12),by+(big?31:21));
    c.fillStyle=fg; c.font='600 '+(big?26:18)+'px '+CN; c.fillText(T.since,x+pad_,y+pad_+(big?110:76));
    var ny=y+pad_+(big?210:140); var nx=x+pad_; var nf=big?112:72, uf=big?40:26;
    [e[0],e[1],e[2]].forEach(function(v,i){c.font='900 '+nf+'px '+EN; c.fillText(pad(v),nx,ny); nx+=c.measureText(pad(v)).width+(big?10:6); c.font='800 '+uf+'px '+CN; c.fillText(T.units[i],nx,ny); nx+=c.measureText(T.units[i]).width+(big?34:22)});
    var sub=zh?d.zh:d.en; c.font='600 '+(big?24:16)+'px '+CN; c.globalAlpha=.95; var maxw=w-pad_*2; var t=sub; while(c.measureText(t).width>maxw&&t.length>4){t=t.slice(0,-2)} if(t!==sub)t=t.slice(0,-1)+'…'; c.fillText(t,x+pad_,y+pad_+(big?266:180)); c.globalAlpha=1;
    c.strokeStyle=isC?'rgba(255,255,255,.4)':'rgba(0,0,0,.2)'; c.lineWidth=2; c.beginPath(); c.moveTo(x+pad_,y+h-(big?78:52)); c.lineTo(x+w-pad_,y+h-(big?78:52)); c.stroke();
    c.font='700 '+(big?24:16)+'px '+CN; c.fillText(T.next,x+pad_,y+h-(big?34:22)); c.restore();
  }
  function drawBrand(c,x,y,size){c.save();c.font='900 '+size+'px '+HERO;c.fillStyle='#111';c.fillText(S.site,x,y);c.restore()}
  async function render(kind){   // 'portrait' | 'og'
    var W=kind==='portrait'?1080:1200, H=kind==='portrait'?1440:630;
    var cv=document.createElement('canvas'); cv.width=W; cv.height=H; var c=cv.getContext('2d');
    try{await document.fonts.load('900 40px HeroCN');await document.fonts.load('900 40px NumCN')}catch(e){}
    var mascot=await load(zh?'/assets/radar-mascot.png':'/assets/radar-mascot.png'), qr=await load(zh?'/assets/qr.png':'/assets/qr-en.png');
    c.fillStyle='#fff'; c.fillRect(0,0,W,H);
    if(kind==='portrait'){
      c.fillStyle='#FFEA00'; c.beginPath(); c.moveTo(W,0); c.lineTo(W,H); c.lineTo(W-420,H); c.lineTo(W-120,0); c.closePath(); c.fill();
      drawBrand(c,64,120,72); c.font='600 28px '+CN; c.fillStyle='#111'; c.fillText(zh?'Codex、Claude 什么时候送额度，一眼看清':'When Codex and Claude grant quota, at a glance',64,170);
      drawCard(c,64,230,952,420,'codex',true); drawCard(c,64,690,952,420,'claude',true);
      if(mascot){var mw=210;c.drawImage(mascot,W-mw-16,H-mw*mascot.height/mascot.width-66,mw,mw*mascot.height/mascot.width)}
      c.fillStyle='#111'; c.font='600 26px '+CN; c.fillText(T.asof+' '+nowLabel(),64,1230);
      c.font='500 24px '+CN; c.fillStyle='#727272'; c.fillText(zh?'只收录官方消息 · 不预测下次':'Official announcements only · No predictions',64,1275);
      c.font='700 30px '+EN; c.fillStyle='#111'; c.fillText(S.url.replace(/^https?:\/\//,''),64,1330);
      if(qr){c.fillStyle='#fff';c.fillRect(656,1160,196,196);c.drawImage(qr,664,1168,180,180)}
    }else{
      c.fillStyle='#FFEA00'; c.beginPath(); c.moveTo(W,0); c.lineTo(W,H); c.lineTo(W-300,H); c.lineTo(W-120,0); c.closePath(); c.fill();
      drawBrand(c,56,86,56); c.font='600 20px '+CN; c.fillStyle='#111'; c.fillText(T.asof+' '+nowLabel(),56,124);
      drawCard(c,56,160,400,300,'codex',false); drawCard(c,486,160,400,300,'claude',false);
      if(mascot){var mw2=240;c.drawImage(mascot,W-mw2-16,H-mw2*mascot.height/mascot.width-24,mw2,mw2*mascot.height/mascot.width)}
      c.font='700 22px '+EN; c.fillStyle='#111'; c.fillText(S.url.replace(/^https?:\/\//,''),56,H-60);
      if(qr){c.fillStyle='#fff';c.fillRect(W-560,H-160,136,136);c.drawImage(qr,W-552,H-152,120,120)}
    }
    return cv;
  }
  function modal(html){var m=el('<div class="qr-modal"><div class="qr-box">'+html+'<button class="qr-x" aria-label="'+T.close+'">×</button></div></div>');document.body.appendChild(m);m.addEventListener('click',function(e){if(e.target===m||e.target.classList.contains('qr-x'))m.remove()});return m}
  async function openShare(){
    var m=modal('<h3>'+T.share+'</h3><div class="qr-row"><button class="qr-btn" data-a="copy">'+T.copy+'</button>'+(navigator.share?'<button class="qr-btn" data-a="sys">'+T.sys+'</button>':'')+'</div><h4>'+T.shareImg+'</h4><div class="qr-row"><button class="qr-btn on" data-k="portrait">'+T.portrait+'</button><button class="qr-btn" data-k="og">'+T.og+'</button></div><div class="qr-prev"><span class="qr-gen">'+T.gen+'</span></div><p class="qr-tip">'+T.tip+'</p><div class="qr-row"><button class="qr-btn primary" data-a="dl">'+T.dl+'</button>'+(navigator.canShare?'<button class="qr-btn" data-a="sysimg">'+T.sys+'</button>':'')+'</div>');
    var cur='portrait', canvas=null;
    async function gen(){var prev=m.querySelector('.qr-prev');prev.innerHTML='<span class="qr-gen">'+T.gen+'</span>';canvas=await render(cur);prev.innerHTML='';var img=new Image();img.src=canvas.toDataURL('image/png');img.className='qr-img';prev.appendChild(img)}
    m.addEventListener('click',async function(e){var b=e.target.closest('button');if(!b)return;
      if(b.dataset.k){m.querySelectorAll('[data-k]').forEach(function(x){x.classList.remove('on')});b.classList.add('on');cur=b.dataset.k;gen();}
      if(b.dataset.a==='copy'){try{await navigator.clipboard.writeText(location.href);b.textContent=T.copied}catch(err){prompt('',location.href)}}
      if(b.dataset.a==='sys'){try{await navigator.share({title:document.title,text:document.querySelector('meta[name=description]').content,url:location.href})}catch(err){}}
      if(b.dataset.a==='dl'&&canvas){var a=document.createElement('a');a.download=(zh?'额度雷达-':'quota-radar-')+new Date().toISOString().slice(0,16).replace(/[:T]/g,'')+'.png';a.href=canvas.toDataURL('image/png');a.click()}
      if(b.dataset.a==='sysimg'&&canvas){canvas.toBlob(async function(blob){var f=new File([blob],'quota-radar.png',{type:'image/png'});if(navigator.canShare&&navigator.canShare({files:[f]})){try{await navigator.share({files:[f],title:document.title,url:location.href})}catch(err){}}else{alert(T.dl)}})}
    });
    gen();
  }
  function openFeedback(){
    var m=modal('<h3>'+T.fbTitle+'</h3><form class="qr-form"><textarea name="message" rows="5" maxlength="2000" placeholder="'+T.fbPh+'" required></textarea><input name="contact" placeholder="'+T.fbContact+'" maxlength="200"><input name="honey" style="display:none" tabindex="-1" autocomplete="off"><div class="qr-row"><button class="qr-btn primary" type="submit">'+T.fbSend+'</button><span class="qr-msg"></span></div></form>');
    m.querySelector('form').addEventListener('submit',async function(e){e.preventDefault();var f=e.target,msg=m.querySelector('.qr-msg'),btn=f.querySelector('button');btn.disabled=true;
      try{var r=await fetch('/api/feedback',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:f.message.value,contact:f.contact.value,honey:f.honey.value,page:location.href,lang:lang})});var j=await r.json();if(j.ok){msg.textContent=T.fbOk;f.message.value='';setTimeout(function(){m.remove()},1500)}else{msg.textContent=T.fbErr+' ('+(j.error||r.status)+')';btn.disabled=false}}catch(err){msg.textContent=T.fbErr;btn.disabled=false}
    });
  }
  var bar=el('<div class="qr-fab"><button class="qr-btn primary" id="qr-share">'+(zh?'分享':'Share')+' ↗</button><button class="qr-btn" id="qr-fb">'+T.fb+'</button></div>');
  document.body.appendChild(bar);
  document.getElementById('qr-share').addEventListener('click',openShare);
  document.getElementById('qr-fb').addEventListener('click',openFeedback);
})();
