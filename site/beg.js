// 「求重置」按钮：点一下 +1（数字是次数，不是人数）；连点攒成一批再提交；每 15 秒刷新一次别人点的
(function(){
  var btns=document.querySelectorAll('.beg[data-p]'); if(!btns.length) return;
  var zh=document.documentElement.lang.slice(0,2)==='zh';
  var L=zh?{beg:'求重置',thanks:'谢谢重置',unit:'次'}:{beg:'Beg for a reset',thanks:'Thanks for the reset',unit:'taps'};
  var state={}, pend={codex:0,claude:0}, timer={};
  function fmt(n){return Number(n||0).toLocaleString(zh?'zh-CN':'en-US')}
  function paint(){btns.forEach(function(b){var s=state[b.dataset.p];if(!s)return;b.dataset.mode=s.mode;b.querySelector('.beg-l').textContent=L[s.mode];b.querySelector('.beg-n').textContent=fmt(s.count+pend[b.dataset.p]);b.querySelector('.beg-u').textContent=L.unit;b.hidden=false})}
  function load(){fetch('/api/beg',{cache:'no-store'}).then(function(r){return r.json()}).then(function(j){if(j.ok){state.codex=j.codex;state.claude=j.claude;paint()}}).catch(function(){})}
  function flush(p){clearTimeout(timer[p]);timer[p]=null;var n=pend[p];if(!n)return;
    fetch('/api/beg',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({p:p,n:n})}).then(function(r){return r.json()}).then(function(j){if(j.ok){pend[p]-=n;state.codex=j.codex;state.claude=j.claude;paint()}else{pend[p]=0;paint()}}).catch(function(){pend[p]=0;paint()})}
  btns.forEach(function(b){b.addEventListener('click',function(){var p=b.dataset.p;if(!state[p])return;pend[p]+=1;paint();
    var f=document.createElement('span');f.className='beg-plus';f.textContent='+1';f.style.left=(30+Math.random()*40)+'%';b.appendChild(f);setTimeout(function(){f.remove()},700);
    b.classList.remove('pop');void b.offsetWidth;b.classList.add('pop');
    if(pend[p]>=10)flush(p);else if(!timer[p])timer[p]=setTimeout(function(){flush(p)},400)})});
  load(); var iv=setInterval(function(){if(!document.hidden)load()},15000);
  document.addEventListener('visibilitychange',function(){if(document.hidden){flush('codex');flush('claude')}});
})();
