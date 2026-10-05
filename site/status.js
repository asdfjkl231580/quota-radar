// Compare published data versions. This is not a collector heartbeat.
(function () {
  var data = document.getElementById('share-data'); if (!data) return;
  var S = JSON.parse(data.textContent), zh = document.documentElement.lang.slice(0, 2) === 'zh';
  var notice = document.querySelector('.version-notice'), busy = null;
  var state = { state: 'unchecked', version: S.version, checkedAt: null };
  function update(value) {
    state = value; window.qrVersionState = state;
    document.querySelectorAll('[data-version-status]').forEach(function (el) {
      el.textContent = state.state === 'outdated' ? (zh ? '有新版本可刷新' : 'A newer version is available') : state.state === 'current' ? (zh ? '此页面与公开数据版本一致' : 'This page matches the published data version') : (zh ? '暂时无法核对公开数据版本' : 'Unable to check the published data version');
    });
    if (notice) {
      notice.hidden = state.state !== 'outdated';
      if (!notice.hidden) {
        notice.textContent = zh ? '已有新记录或更正，当前页面是旧版本。' : 'New records or corrections are available. This page is an older version. ';
        var b = document.createElement('button'); b.type = 'button'; b.className = 'qr-btn'; b.textContent = zh ? '刷新数据' : 'Refresh'; b.addEventListener('click', function () { location.reload(); }); notice.appendChild(b);
      }
    }
    return state;
  }
  function check() {
    if (busy) return busy;
    var controller = new AbortController(), timeout = setTimeout(function () { controller.abort(); }, 5000);
    busy = fetch('/api/status.json', { cache: 'no-store', signal: controller.signal }).then(function (r) { if (!r.ok) throw new Error(); return r.json(); }).then(function (j) {
      if (typeof j.version !== 'string' || !j.version) throw new Error();
      return update({ state: j.version === S.version ? 'current' : 'outdated', version: j.version, dataUpdatedAt: j.dataUpdatedAt, checkedAt: new Date().toISOString() });
    }).catch(function () { if (state.state === 'outdated') return state; return update({ state: 'unavailable', version: S.version, checkedAt: new Date().toISOString() }); }).finally(function () { clearTimeout(timeout); busy = null; });
    return busy;
  }
  var healthBusy = false;
  var reasons = zh ? {
    collection_unknown: '暂未获取可靠的采集记录', collection_failed: '最近采集失败', sources_degraded: '部分来源暂不可用', collection_stale: '每日检查已超过 26 小时未成功或尚未记录', release_unknown: '尚无法核实发布版本', release_mismatch: '待发布、已发布和线上版本不一致', release_failed: '最近发布失败'
  } : {
    collection_unknown: 'Collection status is not yet known', collection_failed: 'The latest collection failed', sources_degraded: 'Some sources are unavailable', collection_stale: 'The daily source check has not succeeded for over 26 hours or is unrecorded', release_unknown: 'Publication version could not be verified', release_mismatch: 'Target, deployed and production versions differ', release_failed: 'The latest release failed'
  };
  function healthDate(iso) { if (!iso || !Number.isFinite(Date.parse(iso))) return zh ? '未记录' : 'Not recorded'; return new Intl.DateTimeFormat(zh ? 'zh-CN' : 'en-US', { dateStyle: 'short', timeStyle: 'short', timeZone: zh ? 'Asia/Shanghai' : 'UTC' }).format(new Date(iso)) + (zh ? ' 北京' : ' UTC'); }
  function checkHealth() {
    var summary = document.querySelector('[data-health-summary]'); if (!summary || healthBusy) return;
    healthBusy = true; var controller = new AbortController(), timeout = setTimeout(function () { controller.abort(); }, 7000);
    fetch('/api/health', { cache: 'no-store', signal: controller.signal }).then(function (r) { return r.json(); }).then(function (j) {
      if (!['ok', 'degraded', 'error'].includes(j.status) || !Array.isArray(j.reasons) || !j.checkedAt) throw new Error();
      summary.textContent = j.status === 'ok' ? (zh ? '每日采集在有效时间内，发布版本一致' : 'Daily collection is within its freshness window; published versions match') : j.status === 'degraded' ? (zh ? '服务部分受限' : 'Service partly degraded') : (zh ? '检测到运行异常' : 'An operational issue was detected');
      summary.closest('.health-panel').dataset.health = j.status;
      var list = document.querySelector('[data-health-reasons]'); list.textContent = '';
      j.reasons.forEach(function (code) { var li = document.createElement('li'); li.textContent = reasons[code] || (zh ? '一项运行检查未通过' : 'An operational check failed'); list.appendChild(li); });
      document.querySelector('[data-health-times]').textContent = (zh ? '检查时间：' : 'Checked: ') + healthDate(j.checkedAt) + ' · ' + (zh ? '最近有效采集：' : 'Last successful source check: ') + healthDate(j.collector && j.collector.lastSuccessAt);
    }).catch(function () {
      summary.textContent = zh ? '暂时无法读取运行状态，请稍后重试。' : 'Operational status is temporarily unavailable. Please try later.';
      summary.closest('.health-panel').dataset.health = 'unknown'; document.querySelector('[data-health-reasons]').textContent = ''; document.querySelector('[data-health-times]').textContent = '';
    }).finally(function () { clearTimeout(timeout); healthBusy = false; });
  }
  window.qrCheckVersion = check; window.qrVersionState = state;
  checkHealth(); setInterval(function () { if (!document.hidden) checkHealth(); }, 60000);
  check(); setInterval(function () { if (!document.hidden) check(); }, 60000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) { check(); checkHealth(); } });
})();
