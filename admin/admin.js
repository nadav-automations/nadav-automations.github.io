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

  // Signed-in session (the old #k= Admin links are no longer used)
  store.del('hubKey');
  if (location.hash) history.replaceState(null, '', location.pathname);
  let SESSION = store.get('hubSession') || '';
  const DEVICE = (() => {
    const u = navigator.userAgent;
    const kind = /iPad|Tablet/i.test(u) ? 'Tablet' : /Mobi|iPhone|Android/i.test(u) ? 'Phone' : 'Computer';
    const b = /Edg\//.test(u) ? 'Edge' : /OPR\//.test(u) ? 'Opera' : /Firefox\//.test(u) ? 'Firefox' : /Chrome\//.test(u) ? 'Chrome' : /Safari\//.test(u) ? 'Safari' : 'other browser';
    return `${kind} (${b})`;
  })();

  async function call(params) {
    if (!/^https:\/\/script\.google\.com\/.+\/exec$/.test(API)) throw new Error('The hub address is missing from admin/config.js.');
    let res, j;
    try { res = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(Object.assign({ s: SESSION }, params)) }); }
    catch (e) { throw new Error('Couldn\'t reach the hub. Check your internet connection and try again.'); }
    try { j = await res.json(); } catch (e) { throw new Error('The hub sent back something unexpected.'); }
    if (!j.ok) { const err = new Error(j.error || 'Something went wrong.'); if (/sign in again/i.test(j.error || '')) { store.del('hubSession'); SESSION = ''; err.badKey = true; } throw err; }
    return j;
  }

  function keyPage(problem) {
    document.body.classList.remove('admin-in');
    $('#forget').hidden = true;
    app.innerHTML = `<div class="card login">
        <h1 style="margin-top:0;">Sign in</h1>
        ${problem ? `<div class="msg err">${esc(problem)}</div>` : ''}
        <form id="f">
          <label class="f" for="user">Username</label><input type="text" id="user" autocomplete="username" required>
          <label class="f" for="pass">Password</label><input type="password" id="pass" autocomplete="current-password" required>
          <div class="formbar"><span class="status" id="st"></span><button type="submit" id="go">Sign in</button></div>
        </form></div>`;
    $('#user').focus();
    $('#f').onsubmit = async e => {
      e.preventDefault();
      $('#go').disabled = true; $('#st').textContent = 'Signing in…';
      try {
        const r = await call({ a: 'login', user: $('#user').value, pass: $('#pass').value, device: store.get('hubDevice') || '', dv: DEVICE });
        SESSION = r.session; store.set('hubSession', SESSION);
        if (r.device) store.set('hubDevice', r.device);
        load();
      } catch (err) { $('#st').innerHTML = `<span style="color:#b42318;">${esc(err.message)}</span>`; $('#go').disabled = false; $('#pass').value = ''; }
    };
  }

  const F = { days: '7', tool: '', who: '', q: '' };
  let ROWS = [];

  const VIEW = () => (/[?&]p=questions/.test(location.search) ? 'questions' : /[?&]p=website/.test(location.search) ? 'website' : 'activity');
  function tabs() {
    $('#tabAct').classList.toggle('on', VIEW() === 'activity');
    $('#tabQ').classList.toggle('on', VIEW() === 'questions');
    $('#tabW').classList.toggle('on', VIEW() === 'website');
  }
  [['#tabAct', ''], ['#tabQ', '?p=questions'], ['#tabW', '?p=website']].forEach(([id, q]) => {
    $(id).onclick = e => { e.preventDefault(); history.pushState(null, '', location.pathname + q); load(); };
  });
  window.addEventListener('popstate', () => load());

  // ---- Inquiries from the website's form
  const QF = { q: '' };
  let Q = null;
  async function loadQuestions() {
    app.innerHTML = '<h1>Inquiries</h1><p class="loading">Loading…</p>';
    try { Q = await call({ a: 'questions' }); }
    catch (err) { return err.badKey ? keyPage(err.message) : (app.innerHTML = `<h1>Inquiries</h1><div class="msg err">${esc(err.message)}</div>`); }
    drawQuestions();
  }
  function drawQuestions() {
    if (!Q.linked) {
      app.innerHTML = `<h1>Inquiries</h1><div class="card"><p>No inquiries yet. To show the website form's answers here, open the form → <b>Responses</b> → <b>Link to Sheets</b> → <b>Select existing spreadsheet</b> → <b>Nadav Automations – activity</b>.</p></div>`;
      return;
    }
    const q = QF.q.trim().toLowerCase();
    const rows = Q.rows.filter(r => !q || r.join(' ').toLowerCase().includes(q));
    const emailCol = Q.headers.findIndex(h => /e-?mail/i.test(h));
    app.innerHTML = `<h1>Inquiries</h1>
      <div class="tools filters"><input type="search" id="qq" placeholder="Search inquiries…" value="${esc(QF.q)}"><button class="light" id="refresh">Refresh</button></div>
      ${!Q.rows.length ? '<div class="card"><p style="margin:0;">No inquiries yet. When someone uses the form on your homepage, it appears here.</p></div>' : ''}
      ${rows.map(r => `<div class="card qa">
        <div class="muted">${esc(r[0])}</div>
        <dl>${Q.headers.slice(1).map((h, i) => r[i + 1] ? `<dt>${esc(h)}</dt><dd>${i + 1 === emailCol ? `<a href="mailto:${esc(r[i + 1])}">${esc(r[i + 1])}</a>` : esc(r[i + 1])}</dd>` : '').join('')}</dl>
        ${emailCol > 0 && r[emailCol] ? `<a class="btn small" href="mailto:${esc(r[emailCol])}?subject=${encodeURIComponent('Re: your question')}">Reply by email</a>` : ''}
      </div>`).join('') || (Q.rows.length ? '<p class="muted">No inquiries match.</p>' : '')}
      <p class="muted">${rows.length} inquir${rows.length === 1 ? 'y' : 'ies'}.</p>`;
    $('#qq').oninput = e => { QF.q = e.target.value; const pos = e.target.selectionStart; drawQuestions(); const el = $('#qq'); el.focus(); el.setSelectionRange(pos, pos); };
    $('#refresh').onclick = loadQuestions;
  }


  // ---- Website visitors (Google Analytics, via the hub)
  const GA_LINK = 'https://analytics.google.com/analytics/web/#/p560891745/reports/intelligenthome';
  const WF = { days: '28' };
  const num = n => Number(n || 0).toLocaleString('en-GB');
  const PAGE_NAMES = { '/': 'Homepage', '/index.html': 'Homepage', '/privacy.html': 'Privacy policy' };
  const cap = s => String(s || '').replace(/^./, c => c.toUpperCase());
  async function loadWebsite() {
    app.innerHTML = '<h1>Website</h1><p class="loading">Loading visitor numbers…</p>';
    let W;
    try { W = await call({ a: 'website', days: WF.days }); }
    catch (err) { return err.badKey ? keyPage(err.message) : (app.innerHTML = `<h1>Website</h1><div class="msg err">${esc(err.message)}</div>`); }
    const max = Math.max(1, ...W.daily.map(d => d.users));
    const step = W.daily.length > 31 ? 14 : W.daily.length > 8 ? 7 : 1;
    const list = (title, items, label, value, unit) => {
      const top = Math.max(1, ...items.map(value));
      return `<div class="card wl"><h2>${title}</h2>${items.length ? `<ol>${items.map(it => `<li><span class="wn">${esc(label(it))}</span><span class="wv">${num(value(it))}</span><span class="wb"><i style="width:${Math.max(2, value(it) / top * 100)}%"></i></span></li>`).join('')}</ol>` : '<p class="muted">Nothing yet.</p>'}<p class="wunit">${unit}</p></div>`;
    };
    app.innerHTML = `<h1>Website</h1>
      <div class="tools filters">
        <select id="wdays">${[['7', 'Last 7 days'], ['28', 'Last 28 days'], ['90', 'Last 90 days']].map(([v, t]) => `<option value="${v}"${v === WF.days ? ' selected' : ''}>${t}</option>`).join('')}</select>
        <button class="light" id="refresh">Refresh</button>
        <a class="galink" href="${GA_LINK}" target="_blank" rel="noopener">Open Google Analytics ↗</a>
      </div>
      <div class="wnow"><span class="dot${W.now ? ' live' : ''}"></span><b>${num(W.now)}</b> on the site right now</div>
      <div class="wtiles">
        <div class="wtile"><span>Visitors</span><b>${num(W.totals.users)}</b></div>
        <div class="wtile"><span>Page views</span><b>${num(W.totals.views)}</b></div>
        <div class="wtile"><span>Visits</span><b>${num(W.totals.visits)}</b></div>
      </div>
      <div class="card wchart"><h2>Visitors per day</h2>
        <div class="wplot"><span class="wmax">${num(max)}</span>
          <div class="wbars">${W.daily.map((d, i) => `<div class="wbar" tabindex="0" data-tip="${esc(d.date)}: ${num(d.users)} visitor${d.users === 1 ? '' : 's'}, ${num(d.views)} page view${d.views === 1 ? '' : 's'}"><i style="height:${d.users ? Math.max(3, d.users / max * 100) : 0}%"></i></div>`).join('')}</div>
        </div>
        <div class="waxis">${W.daily.map((d, i) => `<span>${i % step === 0 || i === W.daily.length - 1 ? esc(d.date.replace(/^\w+ /, '')) : ''}</span>`).join('')}</div>
      </div>
      <div class="wgrid">
        ${list('Top pages', W.pages, p => PAGE_NAMES[p.path] || p.path, p => p.views, 'page views')}
        ${list('Countries', W.countries, c => c.name, c => c.users, 'visitors')}
        ${list('How people found the site', W.sources, s => s.name, s => s.visits, 'visits')}
        ${list('Devices', W.devices, d => cap(d.name), d => d.users, 'visitors')}
      </div>
      <p class="muted">Only counts visitors who clicked Accept on the cookie banner. Google can take a few hours to catch up. Updated ${esc(W.updated)}.</p>`;
    $('#wdays').onchange = e => { WF.days = e.target.value; loadWebsite(); };
    $('#refresh').onclick = loadWebsite;
  }

  async function load() {
    tabs();
    if (!SESSION) return keyPage();
    document.body.classList.add('admin-in');
    if (VIEW() === 'questions') { $('#forget').hidden = false; return loadQuestions(); }
    if (VIEW() === 'website') { $('#forget').hidden = false; return loadWebsite(); }
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

  // Home button: asks first, so you don't leave the admin area by accident
  $('#homeBtn').onclick = () => {
    const d = $('#leave');
    if (!d || !d.showModal) { if (confirm('This takes you back to the homepage. Continue?')) location.href = '../'; return; }
    d.returnValue = '';
    d.onclose = () => { if (d.returnValue === 'go') location.href = '../'; };
    d.showModal();
  };

  $('#forget').onclick = async e => {
    e.preventDefault();
    try { await call({ a: 'logout' }); } catch (err) {}
    store.del('hubSession'); SESSION = ''; keyPage();
  };
  load();
})();
