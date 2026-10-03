// Count taps, not people. One immutable batch in flight per provider; retry the same id.
(function () {
  var btns = document.querySelectorAll('.beg[data-p]');
  if (!btns.length) return;
  var zh = document.documentElement.lang.slice(0, 2) === 'zh';
  var L = zh ? { beg: '求重置', thanks: '谢谢重置', unit: '次', retry: '网络暂不可用，正在重试', failed: '未计入，请稍后再试' } : { beg: 'Beg for a reset', thanks: 'Thanks for the reset', unit: 'taps', retry: 'Connection unavailable; retrying', failed: 'Not counted; please try later' };
  var state = {}, queue = { codex: { pending: 0 }, claude: { pending: 0 } }, seq = 0;
  function uuid() { return globalThis.crypto && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + '-' + (++seq) + '-' + Math.random().toString(36).slice(2); }
  function paint() {
    btns.forEach(function (b) {
      var p = b.dataset.p, s = state[p], q = queue[p]; if (!s) return;
      b.dataset.mode = s.mode; b.querySelector('.beg-l').textContent = L[s.mode];
      b.querySelector('.beg-n').textContent = (Math.max(0, Number(s.count) || 0) + q.pending + (q.batch ? q.batch.n : 0)).toLocaleString(zh ? 'zh-CN' : 'en-US');
      b.querySelector('.beg-u').textContent = L.unit; b.title = q.error || ''; if (b.qrFeedback) b.qrFeedback.textContent = q.error || ''; b.hidden = false;
    });
  }
  function cycle(s) { return s && s.id + ':' + s.mode; }
  function accept(j, fromPost) {
    ['codex', 'claude'].forEach(function (p) {
      if (!j[p]) return; var q = queue[p];
      if (state[p] && cycle(state[p]) !== cycle(j[p])) {
        clearTimeout(q.timer); clearTimeout(q.retry); q.pending = 0; q.batch = null;
      }
      // A delayed GET or the other provider's POST must not overwrite an in-flight optimistic count.
      if (fromPost === p || !q.busy) state[p] = j[p];
    });
  }
  function load() {
    if (queue.codex.busy || queue.claude.busy) return;
    var before = seq;
    fetch('/api/beg', { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error(); return r.json(); }).then(function (j) {
      if (j.ok && before === seq && !queue.codex.busy && !queue.claude.busy) { accept(j); paint(); }
    }).catch(function () {});
  }
  function flush(p) {
    var q = queue[p]; clearTimeout(q.timer); clearTimeout(q.retry); q.timer = null; q.retry = null;
    if (q.busy || !state[p] || (!q.batch && !q.pending)) return;
    if (!q.batch) {
      var n = Math.min(10, q.pending); q.pending -= n;
      q.batch = { provider: p, id: state[p].id, mode: state[p].mode, n: n, batchId: uuid() }; q.attempt = 0;
    }
    var batch = q.batch; q.busy = true; seq++;
    fetch('/api/beg', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(batch) }).then(async function (r) {
      var j = await r.json();
      if (r.status >= 500) throw new Error('retry');
      if (q.batch !== batch) return;
      q.batch = null; q.error = j.ok ? '' : L.failed; if (!j.ok) q.pending = 0;
      accept(j, p);
    }).catch(function () {
      if (q.batch !== batch) return;
      q.attempt = (q.attempt || 0) + 1; q.error = L.retry;
      if (q.attempt <= 3) q.retry = setTimeout(function () { flush(p); }, Math.min(1000 * Math.pow(2, q.attempt - 1), 8000));
      else { q.batch = null; q.pending = 0; q.error = L.failed; }
    }).finally(function () {
      q.busy = false; paint();
      if (!q.batch && q.pending) q.timer = setTimeout(function () { flush(p); }, 0);
    });
  }
  btns.forEach(function (b) { if (b.insertAdjacentElement) { var feedback = document.createElement('span'); feedback.className = 'beg-feedback'; feedback.setAttribute('role', 'status'); b.insertAdjacentElement('afterend', feedback); b.qrFeedback = feedback; } b.addEventListener('click', function () {
    var p = b.dataset.p, q = queue[p]; if (!state[p]) return;
    q.pending++; q.error = ''; paint();
    var f = document.createElement('span'); f.className = 'beg-plus'; f.textContent = '+1'; f.style.left = (30 + Math.random() * 40) + '%'; b.appendChild(f); setTimeout(function () { f.remove(); }, 700);
    b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
    if (q.pending >= 10) flush(p); else if (!q.timer && !q.batch) q.timer = setTimeout(function () { flush(p); }, 400);
  }); });
  load(); setInterval(function () { if (!document.hidden) load(); }, 15000);
  document.addEventListener('visibilitychange', function () { if (document.hidden) { flush('codex'); flush('claude'); } else load(); });
})();
