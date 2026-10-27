// Nadav Automations – admin: activity from all tools (reads the activity hub with the owner's key)
(() => {
  'use strict';
  const API = window.HUB_API || '';
  const $ = s => document.querySelector(s);
  const app = $('#app');
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} }
  };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  let KEY = store.get('hubKey') || '';
  const m = /(?:^#|&)k=([a-f0-9]{40})/.exec(location.hash);
  if (m) { KEY = m[1]; store.set('hubKey', KEY); history.replaceState(null, '', location.pathname); }

  async function call(params) {
    if (!/^https:\/\/script\.google\.com\/.+\/exec$/.test(API)) throw new Error('The hub address is missing from admin/config.js.');
    let res, j;
    try { res = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(Object.assign({ k: KEY }, params)) }); }
    catch (e) { throw new Error('Couldn\'t reach the hub. Check your internet connection and try again.'); }
    try { j = await res.json(); } catch (e) { throw new Error('The hub sent back something unexpected.'); }
    if (!j.ok) { const err = new Error(j.error || 'Something went wrong.'); if (/no longer works/.test(j.error || '')) { store.del('hubKey'); KEY = ''; err.badKey = true; } throw err; }
    return j;
  }

  function keyPage(problem) {
    $('#forget').hidden = true;
    app.innerHTML = `<h1>Admin</h1>${problem ? `<div class="msg err">${esc(problem)}</div>` : ''}
      <div class="card"><p>Open this page with your <b>Admin link</b> (it's in the hub script's Execution log after running <b>showLinks</b>), or paste it here:</p>
      <div class="row"><input type="text" id="paste" placeholder="Paste your Admin link" style="flex:1;min-width:220px;"><button id="go">Continue</button></div></div>`;
    $('#go').onclick = () => {
      const k = /k=([a-f0-9]{40})/.exec($('#paste').value);
      if (!k) return;
      KEY = k[1]; store.set('hubKey', KEY); load();
    };
  }

  const F = { days: '7', tool: '', who: '', q: '' };
  let ROWS = [];

  async function load() {
    if (!KEY) return keyPage();
    $('#forget').hidden = false;
    app.innerHTML = '<h1>Activity</h1><p class="loading">Loading…</p>';
    try { ROWS = (await call({ a: 'list', days: F.days })).rows; }
    catch (err) { return err.badKey ? keyPage(err.message) : (app.innerHTML = `<h1>Activity</h1><div class="msg err">${esc(err.message)}</div>`); }
    draw();
  }

  function draw() {
    const uniq = k => [...new Set(ROWS.map(r => r[k]).filter(Boolean))].sort();
    const opt = (list, cur, all) => `<option value="">${all}</option>` + list.map(v => `<option${v === cur ? ' selected' : ''}>${esc(v)}</option>`).join('');
    const q = F.q.trim().toLowerCase();
    const rows = ROWS.filter(r => (!F.tool || r.tool === F.tool) && (!F.who || r.who === F.who) &&
      (!q || [r.who, r.what, r.entry, r.device, r.tool].join(' ').toLowerCase().includes(q)));
    // Last seen per person
    const seen = {};
    rows.forEach(r => { if (r.who && !seen[r.who]) seen[r.who] = r; });
    app.innerHTML = `<h1>Activity</h1>
      <div class="tools filters">
        <select id="days">${[['1', 'Last 24 hours'], ['7', 'Last 7 days'], ['30', 'Last 30 days'], ['365', 'Last year'], ['0', 'Everything']].map(([v, t]) => `<option value="${v}"${v === F.days ? ' selected' : ''}>${t}</option>`).join('')}</select>
        <select id="tool">${opt(uniq('tool'), F.tool, 'All tools')}</select>
        <select id="who">${opt(uniq('who'), F.who, 'Everyone')}</select>
        <input type="search" id="q" placeholder="Search…" value="${esc(F.q)}">
        <button class="light" id="refresh">Refresh</button>
      </div>
      <div class="stats">${Object.keys(seen).map(n => `<div class="stat"><b>${esc(n)}</b><span>Last seen ${esc(seen[n].when)} · ${rows.filter(r => r.who === n).length} actions</span></div>`).join('') || '<p class="muted">Nothing in this period.</p>'}</div>
      <div class="tablewrap"><table class="log"><tr><th>When</th><th>Tool</th><th>Who</th><th>What</th><th>Entry</th><th>Device</th></tr>
      ${rows.map(r => `<tr><td class="when">${esc(r.when)}</td><td>${esc(r.tool)}</td><td>${esc(r.who)}</td><td>${esc(r.what)}</td><td>${esc(r.entry)}</td><td class="muted">${esc(r.device)}</td></tr>`).join('')}
      </table></div>
      <p class="muted" style="margin-top:10px;">${rows.length} line${rows.length === 1 ? '' : 's'}.</p>`;
    $('#days').onchange = e => { F.days = e.target.value; load(); };
    $('#tool').onchange = e => { F.tool = e.target.value; draw(); };
    $('#who').onchange = e => { F.who = e.target.value; draw(); };
    $('#q').oninput = e => { F.q = e.target.value; const pos = e.target.selectionStart; draw(); const el = $('#q'); el.focus(); el.setSelectionRange(pos, pos); };
    $('#refresh').onclick = load;
  }

  $('#forget').onclick = e => { e.preventDefault(); if (confirm('Forget your Admin link on this browser?')) { store.del('hubKey'); KEY = ''; keyPage(); } };
  load();
})();
