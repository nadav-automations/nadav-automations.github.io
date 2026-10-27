// AI order processing feedback – the app's pages.
// Everything is saved by the Apps Script engine (address in config.js), which checks the personal key
// on every request. This page only remembers the key (and a copy of the list, for speed) in this browser.
(() => {
  'use strict';
  const API = window.FEEDBACK_API || '';
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const app = $('#app');
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} }
  };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = n => String(n).padStart(3, '0');
  const bold = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');

  // Pop-out window (or ?pop=1): slim one-line header
  const POPOUT = window.name === 'feedbackPopout' || /[?&]pop=1/.test(location.search);
  if (POPOUT) { window.name = 'feedbackPopout'; document.body.classList.add('compact'); }

  // Opens a page of the app in a small window in the middle of the screen
  function popup(path) {
    const w = 560, h = 460;
    const left = Math.round((window.screenLeft || 0) + ((window.outerWidth || screen.availWidth) - w) / 2);
    const top = Math.round((window.screenTop || 0) + ((window.outerHeight || screen.availHeight) - h) / 2);
    const win = window.open(path, 'feedbackPopout', `popup,width=${w},height=${h},left=${left},top=${top}`);
    if (win) win.focus();
    else toast('Your browser blocked the small window – click the icon at the right of the address bar and allow pop-ups for this site.', 8000);
    return win;
  }

  // ---- Personal key: arrives once as #k=…, then lives in this browser only
  let KEY = store.get('fbKey') || '';
  const fromHash = /(?:^#|&)k=([a-f0-9]{40})/.exec(location.hash);
  if (fromHash) {
    if (fromHash[1] !== KEY) store.del('fbBoot');
    KEY = fromHash[1];
    store.set('fbKey', KEY);
    history.replaceState(null, '', location.pathname + location.search);
  }
  function forget() { KEY = ''; BOOT = null; store.del('fbKey'); store.del('fbBoot'); paintTop(); }

  // Rough device description for the owner's activity log, e.g. "Computer (Chrome)"
  const DEVICE = (() => {
    const u = navigator.userAgent;
    const kind = /iPad|Tablet/i.test(u) ? 'Tablet' : /Mobi|iPhone|Android/i.test(u) ? 'Phone' : 'Computer';
    const b = /Edg\//.test(u) ? 'Edge' : /OPR\//.test(u) ? 'Opera' : /Firefox\//.test(u) ? 'Firefox' : /Chrome\//.test(u) ? 'Chrome' : /Safari\//.test(u) ? 'Safari' : 'other browser';
    return `${kind} (${b})${POPOUT ? ' pop-out' : ''}`;
  })();

  // ---- Talking to the engine (POST with a plain-text body, so no extra browser checks are needed)
  async function call(a, params) {
    if (!/^https:\/\/script\.google\.com\/.+\/exec$/.test(API)) throw new Error('The app isn\'t set up yet – the engine address is missing from config.js.');
    let res, j;
    try {
      res = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(Object.assign({ a, k: KEY, dv: DEVICE }, params || {})) });
    } catch (e) { throw new Error('Couldn\'t reach the app\'s engine. Check your internet connection and try again.'); }
    try { j = await res.json(); } catch (e) { throw new Error('The engine sent back something unexpected. Please try again in a minute.'); }
    if (!j.ok) {
      const err = new Error(j.error || 'Something went wrong.');
      if (/no longer works/.test(j.error || '')) { forget(); err.badKey = true; }
      throw err;
    }
    track(a, params || {}, j);
    return j;
  }

  // ---- Activity: sent straight from the browser to the hub in the background (never slows the app).
  //      The engine's signed pass (BOOT.log) proves who it is; opening the app and viewing an entry
  //      are only sent once every 30 minutes.
  const WHAT = { boot: 'Opened the app', view: 'Viewed an entry', create: 'Added an entry', save: 'Changed an entry',
    shot: 'Added a screenshot', delete: 'Deleted an entry', linkAddViewer: 'Made a view-only link',
    linkEmail: 'Emailed a personal link', linkReset: 'Renewed a personal link', linkRemove: 'Removed a view-only link' };
  function track(a, params, res) {
    const pass = BOOT && BOOT.log;
    if (!pass || !WHAT[a] || pass.exp < Date.now()) return;
    const entry = a === 'create' ? res && res.id : params.id;
    if (a === 'boot' || a === 'view') {
      const k = `fbAct:${a}:${entry || ''}`, last = Number(store.get(k) || 0);
      if (Date.now() - last < 30 * 60e3) return;
      store.set(k, String(Date.now()));
    }
    try {
      fetch(pass.url, { method: 'POST', keepalive: true, headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ a: 'log', tool: pass.tool, who: pass.who, exp: pass.exp, sig: pass.sig,
          rows: [{ when: new Date().toISOString(), what: WHAT[a], entry: entry ? pad(entry) : '', device: DEVICE }] }) }).catch(() => {});
    } catch (e) {}
  }

  // ---- Data: shown straight away from this browser's copy, then refreshed
  let BOOT = null, FRESH = false, HELP = null;
  try { BOOT = JSON.parse(store.get('fbBoot') || 'null'); } catch (e) { BOOT = null; }
  async function load() {
    BOOT = await call('boot');
    track('boot', {}, null);
    FRESH = true;
    store.set('fbBoot', JSON.stringify(BOOT));
    paintTop();
    return BOOT;
  }
  const entry = id => BOOT.entries.find(e => e.id === id);
  const me = () => BOOT.me;
  const canWrite = () => me().role !== 'viewer';
  const canEdit = e => me().role === 'owner' || (me().role === 'member' && e.name === me().name);
  const colour = v => (BOOT && BOOT.colours[v]) || '#eceef3';
  const chip = v => v ? `<span class="chip" style="background:${esc(colour(v))}">${esc(v)}</span>` : '';
  const orderLinks = list => (list || []).map(n => `<a href="${esc(BOOT.orderUrl + n)}" target="_blank" rel="noopener">#${n}</a>`).join(', ');
  function priorityOf(sev, freq) {
    const s = ['Minor', 'Major', 'Critical'].indexOf(sev) + 1, f = ['Unique', 'Rarely', 'Often'].indexOf(freq) + 1;
    if (!s || !f) return '';
    return s === 3 || s * f >= 6 ? 'High' : s * f >= 3 ? 'Medium' : 'Low';
  }

  // ---- Pages and navigation
  let DIRTY = false, RENDER = 0;
  const route = () => { const q = new URLSearchParams(location.search); return { p: q.get('p') || 'list', id: parseInt(q.get('id'), 10) || 0 }; };
  function go(p, id, replace) {
    if (DIRTY && !confirm('Leave this page? Your changes haven\'t been saved.')) return;
    DIRTY = false;
    history[replace ? 'replaceState' : 'pushState'](null, '', `?p=${p}${id ? `&id=${id}` : ''}`);
    window.scrollTo(0, 0);
    render();
  }
  window.addEventListener('popstate', () => { DIRTY = false; render(); });
  window.addEventListener('beforeunload', e => { if (DIRTY) { e.preventDefault(); e.returnValue = ''; } });
  document.addEventListener('click', e => {
    const plain = e.target.closest('a:not([data-go])');
    if (plain && plain.getAttribute('href') !== '#') return;   // ordinary links (order numbers, sheet…) open as normal
    const a = e.target.closest('[data-go]');
    if (!a || e.ctrlKey || e.metaKey || e.shiftKey || e.button) return;
    e.preventDefault();
    go(a.dataset.go, parseInt(a.dataset.id, 10) || 0);
  });
  const link = (p, id, text, cls) => `<a href="?p=${p}${id ? `&id=${id}` : ''}" data-go="${p}"${id ? ` data-id="${id}"` : ''}${cls ? ` class="${cls}"` : ''}>${text}</a>`;

  function toast(text, ms) {
    const t = $('#toast');
    t.textContent = text; t.hidden = false;
    clearTimeout(toast.t); toast.t = setTimeout(() => { t.hidden = true; }, ms || 4000);
  }

  // Name menu in the top bar (Personal links, Pop out, Sheet, Admin, Forget me)
  (() => {
    const btn = $('#menuBtn'), menu = $('#menu');
    if (!btn || !menu) return;
    const set = open => { menu.hidden = !open; btn.setAttribute('aria-expanded', String(open)); };
    btn.onclick = e => { e.stopPropagation(); set(menu.hidden); };
    menu.addEventListener('click', () => set(false));
    document.addEventListener('click', e => { if (!e.target.closest('#menuWrap')) set(false); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') set(false); });
  })();

  function paintTop() {
    const nav = $('#nav'), who = $('#who'), side = $('#side');
    if (!KEY || !BOOT) { nav.hidden = true; if (side) side.hidden = true; who.innerHTML = ''; return; }
    nav.hidden = false; if (side) side.hidden = false;
    if ($('#navNew')) $('#navNew').hidden = !canWrite();
    if ($('#navLinks')) $('#navLinks').hidden = me().role !== 'owner';
    // The top bar's "＋ New entry" opens the form in a small window too (in place when already in one)
    const navNew = $('#navNew');
    if (navNew) navNew.onclick = e => {
      if (e.ctrlKey || e.metaKey || e.shiftKey || POPOUT) return;
      e.preventDefault(); e.stopPropagation();
      popup('./?p=new&pop=1');
    };
    const pop = $('#navPop');
    if (pop) pop.hidden = window.name === 'feedbackPopout';
    if (pop) pop.onclick = e => {
      e.preventDefault();
      popup(location.pathname + location.search + (location.search ? '&' : '?') + 'pop=1');
    };
    if ($('#navAdmin')) $('#navAdmin').hidden = me().role !== 'owner' || POPOUT;
    const sheet = $('#navSheet');
    if (sheet) { sheet.hidden = !BOOT.sheetUrl; if (BOOT.sheetUrl) sheet.href = BOOT.sheetUrl; }
    who.textContent = `${me().name}${me().role === 'viewer' ? ' (view only)' : ''}`;
    $('#forget').onclick = e => {
      e.preventDefault();
      if (confirm('Forget your personal link on this browser? You\'ll need the link from your email to get back in.')) { forget(); go('list'); }
    };
    const { p } = route();
    $$('#nav a[data-go]').forEach(a => a.classList.toggle('on', a.dataset.go === p));
  }

  async function render() {
    const n = ++RENDER, { p, id } = route();
    const paint = html => { if (n === RENDER) app.innerHTML = html; return n === RENDER; };
    document.title = 'Feedback app';
    try {
      if (p === 'help') return await pageHelp(paint);
      if (!KEY) return pageKey(paint);
      if (!BOOT || (p === 'edit' && !FRESH)) { paint('<p class="loading">Loading…</p>'); await load(); }
      else if (!FRESH) load().then(() => { if (n === RENDER && !DIRTY && ['list', 'view'].includes(route().p)) render(); }).catch(err => { if (err.badKey) pageKey(paint, err.message); });
      paintTop();
      if (p === 'go') return pageLaunch(paint);
      if (p === 'new') return pageForm(paint, null);
      if (p === 'edit') return pageForm(paint, id);
      if (p === 'shot') return pageShot(paint, id);
      if (p === 'view') return await pageView(paint, id, n);
      if (p === 'links') return await pageLinks(paint);
      return pageList(paint);
    } catch (err) {
      if (err.badKey) return pageKey(paint, err.message);
      paint(`<div class="msg err">${esc(err.message)}</div><p>${link('list', 0, '← Back to all entries')}</p>`);
    }
  }

  // ---- No key yet
  function pageKey(paint, problem) {
    paintTop();
    paint(`<h1>Welcome to the feedback app</h1>
      ${problem ? `<div class="msg err">${esc(problem)}</div>` : ''}
      <div class="card">
        <p>Open the app with your <b>personal link</b> – the one in the email you were sent. This browser will remember you afterwards.</p>
        <p>Or paste your link here:</p>
        <div class="row"><input type="text" id="paste" placeholder="Paste your personal link" style="flex:1;min-width:220px;"><button id="usePaste">Continue</button></div>
        <p id="pasteMsg" class="muted" style="margin-top:8px;"></p>
      </div>
      <div class="card">
        <h2 style="margin-top:0;">Lost your link?</h2>
        <p>Enter your email address and your link will be emailed to you again (only to the address on the list).</p>
        <div class="row"><input type="email" id="lostEmail" placeholder="you@example.com" style="flex:1;min-width:220px;"><button id="lost">Email me my link</button></div>
        <p id="lostMsg" class="muted" style="margin-top:8px;"></p>
      </div>
      <p class="muted">${link('help', 0, 'How the feedback app works')}</p>`);
    $('#usePaste').onclick = () => {
      const m = /k=([a-f0-9]{40})/.exec($('#paste').value) || /^\s*([a-f0-9]{40})\s*$/.exec($('#paste').value);
      if (!m) { $('#pasteMsg').textContent = 'That doesn\'t look like a personal link. Copy the whole link from your email.'; return; }
      KEY = m[1]; store.set('fbKey', KEY); store.del('fbBoot'); BOOT = null; FRESH = false;
      const r = route(); go(r.p === 'help' ? 'list' : r.p, r.id, true);
    };
    $('#lost').onclick = async () => {
      const btn = $('#lost'), msg = $('#lostMsg');
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test($('#lostEmail').value.trim())) { msg.textContent = 'Please enter your email address.'; return; }
      btn.disabled = true; msg.textContent = 'Sending…';
      try { msg.textContent = (await call('lost', { email: $('#lostEmail').value.trim() })).message; }
      catch (e) { msg.textContent = e.message; btn.disabled = false; }
    };
  }

  // ---- All entries
  const FILTER = { show: 'all', q: '' };
  function pageList(paint) {
    const viewer = !canWrite();
    paint(`<h1>All entries</h1>
      <div class="tools">
        <div class="row filters">
          ${[['all', 'All'], ['mine', 'Mine'], ['unsent', 'Not yet sent'], ['high', 'High priority']].filter(f => !(viewer && f[0] === 'mine'))
            .map(([k, t]) => `<button class="${FILTER.show === k ? 'on' : ''}" data-f="${k}">${t}</button>`).join('')}
        </div>
        <input type="search" id="q" placeholder="Search headlines, descriptions, order numbers…" value="${esc(FILTER.q)}">

      </div>
      <div id="list"></div>`);
    $$('.filters button').forEach(b => b.onclick = () => { FILTER.show = b.dataset.f; pageList(paint); });
    $('#q').oninput = () => { FILTER.q = $('#q').value; drawList(); };

    drawList();
  }
  function drawList() {
    const q = FILTER.q.trim().toLowerCase();
    const list = BOOT.entries.filter(e =>
      (FILTER.show !== 'mine' || e.name === me().name) &&
      (FILTER.show !== 'unsent' || !e.fedBack) &&
      (FILTER.show !== 'high' || e.priority === 'High') &&
      (!q || [pad(e.id), e.headline, e.description, e.type, e.name, (e.orders || []).join(' ')].join(' ').toLowerCase().includes(q))
    ).sort((a, b) => b.id - a.id);
    const ICON_SHOT = '<svg viewBox="0 0 20 20" width="15" height="15" aria-hidden="true"><path d="M3 6.5h3l1.5-2h5l1.5 2h3v9H3z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="10" cy="10.8" r="2.6" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';
    $('#list').innerHTML = list.length ? `<div class="rows">${list.map(e => `
      <div class="entry erow" data-go="view" data-id="${e.id}" title="Open entry ${pad(e.id)}">
        <span class="rid">${pad(e.id)}</span>
        <span class="rpri">${chip(e.priority)}</span>
        <span class="rmain">
          <span class="rh">${esc(e.headline || 'No headline')}</span>
          <span class="rm"><span class="dot" style="background:${esc(colour(e.type))}"></span>${esc(e.type)} · ${esc(e.name)} · ${esc(e.date)}${e.orders && e.orders.length ? ` · Order ${orderLinks(e.orders)}` : ''}${e.shots ? ` · <span class="shotn" title="${e.shots} screenshot${e.shots === 1 ? '' : 's'}">${ICON_SHOT}${e.shots}</span>` : ''}</span>
        </span>
        <span class="rstat">${e.updated ? '<span class="badge upd" title="Changed after it was sent">Updated</span>' : ''}${e.fedBack ? '<span class="badge sent">✓ Sent</span>' : ''}</span>
        <span class="racts">${canEdit(e) ? `<a href="?p=edit&id=${e.id}" data-go="edit" data-id="${e.id}" class="ibtn act-edit" title="Edit">✎</a><a href="?p=shot&id=${e.id}" data-go="shot" data-id="${e.id}" class="ibtn act-shot" title="Add a screenshot">＋</a>` : ''}</span>
      </div>`).join('')}</div>` : '<p class="muted">No entries match.</p>';
  }

  // ---- From the sheet's "＋ New entry" link: one click opens the form as a small window,
  //      and this tab turns into the sheet, scrolled to the row the new entry will go in
  function pageLaunch(paint) {
    if (!canWrite()) throw new Error('Your link is view-only, so it can\'t add entries.');
    const choice = store.get('fbNewChoice');
    if (choice === 'here') { history.replaceState(null, '', '?p=new&remembered=1'); return pageForm(paint, null); }
    document.title = 'New entry';
    paint(`<div class="card launch">
        <h1 style="margin-top:0;">New entry</h1>
        <p>The form opens in a small window, and this tab switches to the sheet at the row your entry will go in.</p>
        <button type="button" id="launch" class="big">＋ Open the New entry form</button>
        <p style="margin-top:14px;"><button type="button" class="light" id="here">Fill it in here instead</button></p>
        <label class="muted" style="display:inline-flex;gap:6px;align-items:center;margin-top:6px;"><input type="checkbox" id="remember"${choice ? ' checked' : ''}> Remember my choice on this computer</label>
        ${choice === 'popup' ? '<p class="muted" style="font-size:.8rem;">Browsers only open a small window after a click, so this button is always needed.</p>' : ''}
      </div>`);
    const keep = v => { if ($('#remember').checked) store.set('fbNewChoice', v); else store.del('fbNewChoice'); };
    $('#launch').onclick = () => {
      keep('popup');
      if (!popup('./?p=new&pop=1')) return;
      if (BOOT.sheetUrl) location.href = `${BOOT.sheetUrl}#gid=${BOOT.sheetGid || 0}&range=A${BOOT.nextRow || 2}`;
    };
    $('#here').onclick = () => { keep('here'); go('new', 0, true); };
  }

  // ---- New entry / Edit entry
  function pageForm(paint, id) {
    const e = id ? entry(id) : null;
    if (id && !e) throw new Error('That entry no longer exists.');
    if (!canWrite()) throw new Error('Your link is view-only, so it can\'t add or change entries.');
    if (e && !canEdit(e)) throw new Error('You can only change your own entries. Ask the person who added it, or Nadav.');
    const o = BOOT.options;
    const v = e ? Object.assign({}, e, { order: (e.orders || []).join(', ') })
                : { name: o.names.length === 1 ? o.names[0] : '', type: '', severity: '', frequency: '', headline: '', order: '', description: '' };
    const picker = (key, list) => `<div class="pick" data-key="${key}">${list.map(x =>
      `<button type="button" data-v="${esc(x)}" class="${v[key] === x ? 'on' : ''}" style="background:${esc(colour(x))}">${esc(x)}</button>`).join('')}</div>`;
    document.title = e ? `Edit ${pad(e.id)}` : 'New entry';
    const remembered = !e && /remembered=1/.test(location.search);
    paint(`<h1>${e ? `Edit entry ${pad(e.id)}` : 'New entry'}</h1>
      ${remembered ? '<p class="muted" style="margin-top:-6px;">Opened here because you asked this computer to remember. <a href="#" id="forgetChoice">Ask me again next time</a></p>' : ''}
      <div class="card">
        <label class="f">Name</label>
        ${o.names.length > 1 && !e ? `<select id="name"><option value="">Choose name</option>${o.names.map(n => `<option${n === v.name ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select>`
                                   : `<div>${chip(v.name)}</div>`}
        <label class="f">Type</label>${picker('type', o.types)}
        <label class="f">Severity</label>${picker('severity', o.severities)}
        <label class="f">Frequency</label>${picker('frequency', o.frequencies)}
        <div class="pribox">Priority: <span id="pri"></span></div>
        <label class="f" for="headline">Headline – a short summary someone can understand at a glance</label>
        <input type="text" id="headline" maxlength="${o.headlineMax}" value="${esc(v.headline)}" placeholder="e.g. Wrong ship-to address on order 23">
        <div class="count" id="count"></div>
        <label class="f" for="order">Order number(s) – optional</label>
        <input type="text" id="order" value="${esc(v.order)}" placeholder="e.g. 23, 27">
        <label class="f" for="description">Description – what you did, what happened, and what should have happened</label>
        <textarea id="description">${esc(v.description)}</textarea>
        <label class="f">Screenshots${e && e.shots ? ` – this entry has ${e.shots} (${link('view', e.id, 'view them')})` : ''}</label>
        ${shotPicker()}
        <div class="formbar"><span class="status" id="status"></span>
          <button type="button" class="light" id="cancel">Cancel</button>
          <button type="button" id="save">${e ? 'Save changes' : 'Add entry'}</button></div>
        ${e && e.fedBack ? '<p class="muted" style="margin-top:12px;">This entry has already been sent to the developer. Saving a change unticks Fed Back so it\'s sent again, marked UPDATED.</p>' : ''}
      </div>`);
    const shots = wireShots();
    if ($('#forgetChoice')) $('#forgetChoice').onclick = ev => { ev.preventDefault(); store.del('fbNewChoice'); ev.target.parentNode.textContent = 'Done – next time you\'ll be asked again.'; };
    $$('.pick').forEach(p => p.onclick = ev => {
      const b = ev.target.closest('button'); if (!b) return;
      v[p.dataset.key] = b.dataset.v;
      $$('button', p).forEach(x => x.classList.toggle('on', x === b));
      DIRTY = true; showPri(); $('#status').textContent = '';
    });
    const showPri = () => { const p = priorityOf(v.severity, v.frequency); $('#pri').innerHTML = p ? chip(p) : '<span class="muted">pick a Severity and Frequency</span>'; };
    const showCount = () => { const l = $('#headline').value.length; $('#count').textContent = `${l} / ${o.headlineMax}`; $('#count').classList.toggle('over', l >= o.headlineMax); };
    showPri(); showCount();
    $('#headline').oninput = () => { showCount(); DIRTY = true; };
    ['order', 'description', 'name'].forEach(k => { const el = $('#' + k); if (el) el.addEventListener('input', () => { DIRTY = true; }); });
    $('#cancel').onclick = () => go(e ? 'view' : 'list', e ? e.id : 0);
    $('#save').onclick = async () => {
      const status = $('#status'), btn = $('#save');
      const data = { name: $('#name') ? $('#name').value : v.name, type: v.type, severity: v.severity, frequency: v.frequency,
                     headline: $('#headline').value.trim(), order: $('#order').value, description: $('#description').value };
      const missing = !data.name ? 'a name' : !data.type ? 'a Type' : !data.severity ? 'a Severity' : !data.frequency ? 'a Frequency' : !data.headline ? 'a headline' : '';
      if (missing) { status.innerHTML = `<span style="color:#b42318;">Please choose ${missing}.</span>`; return; }
      btn.disabled = true; $('#cancel').disabled = true;
      status.textContent = 'Saving…';
      try {
        let entryId = id, message;
        if (e) message = (await call('save', { id, data })).message;
        else { const r = await call('create', { data }); entryId = r.id; message = r.message; }
        const failed = await shots.upload(entryId, status);
        DIRTY = false;
        await load();
        toast(failed ? `${message} But ${failed} screenshot${failed === 1 ? '' : 's'} didn't upload – click ＋ Screenshot to try again.` : message, failed ? 8000 : 4000);
        go('view', entryId, true);
      } catch (err) {
        status.innerHTML = `<span style="color:#b42318;">${esc(err.message)}</span>`;
        btn.disabled = false; $('#cancel').disabled = false;
      }
    };
  }

  // ---- Screenshot picker (paste, drag or browse); images are uploaded after the entry is saved
  const shotPicker = () => `<div class="drop" id="drop">Paste a screenshot here (<b>Ctrl + V</b>), drag images in, or
      <label style="color:#535FC1;text-decoration:underline;cursor:pointer;">browse<input type="file" id="file" accept="image/*" multiple hidden></label></div>
    <div class="thumbs" id="thumbs"></div>`;
  function wireShots() {
    const items = [];
    const drop = $('#drop'), thumbs = $('#thumbs');
    const add = files => Array.from(files || []).filter(f => /^image\//.test(f.type)).forEach(async f => {
      const item = { caption: '', el: document.createElement('div') };
      item.el.className = 'thumb';
      item.el.innerHTML = '<img alt=""><input type="text" placeholder="Caption (optional)" maxlength="300"><button type="button" class="x small" title="Remove">✕</button><div class="state muted"></div>';
      thumbs.appendChild(item.el); items.push(item); DIRTY = true;
      $('input', item.el).oninput = ev => { item.caption = ev.target.value; };
      $('.x', item.el).onclick = () => { items.splice(items.indexOf(item), 1); item.el.remove(); };
      item.ready = shrink(f).then(async url => { item.data = url; $('img', item.el).src = url; item.thumb = await thumbOf(url); })
        .catch(() => { $('.state', item.el).textContent = 'Couldn\'t read this image.'; });
    });
    document.onpaste = ev => {
      if (!document.body.contains(drop)) return;
      const files = Array.from((ev.clipboardData || {}).items || []).filter(i => i.kind === 'file').map(i => i.getAsFile());
      if (files.length) { ev.preventDefault(); add(files); }
    };
    drop.ondragover = ev => { ev.preventDefault(); drop.classList.add('over'); };
    drop.ondragleave = () => drop.classList.remove('over');
    drop.ondrop = ev => { ev.preventDefault(); drop.classList.remove('over'); add(ev.dataTransfer.files); };
    $('#file').onchange = ev => { add(ev.target.files); ev.target.value = ''; };
    return {
      count: () => items.length,
      // Uploads one at a time; returns how many failed
      async upload(entryId, status) {
        let failed = 0, i = 0;
        for (const item of items.slice()) {
          i++;
          const state = $('.state', item.el);
          if (status) status.textContent = `Uploading screenshot ${i} of ${items.length}…`;
          try {
            await item.ready;
            if (!item.data) throw new Error('unreadable');
            state.textContent = 'Uploading…';
            await call('shot', { id: entryId, image: item.data, caption: item.caption, thumb: item.thumb || '' });
            state.textContent = '✓ Added';
          } catch (err) { failed++; state.textContent = 'Didn\'t upload: ' + err.message; }
        }
        return failed;
      }
    };
  }
  // Big images are made smaller before uploading (max 2000 pixels wide or tall)
  function shrink(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onerror = reject;
      r.onload = () => {
        const url = r.result, img = new Image();
        img.onerror = () => resolve(url);
        img.onload = () => {
          const max = 2000, scale = Math.min(1, max / Math.max(img.width, img.height));
          if (scale === 1 && file.size < 2.5e6) return resolve(url);
          const c = document.createElement('canvas');
          c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          const png = c.toDataURL('image/png');
          resolve(png.length < 3e6 ? png : c.toDataURL('image/jpeg', 0.88));
        };
        img.src = url;
      };
      r.readAsDataURL(file);
    });
  }

  // Small copy for the sheet's Screenshots tab (max 320 pixels)
  function thumbOf(url) {
    return new Promise(resolve => {
      const img = new Image();
      img.onerror = () => resolve('');
      img.onload = () => {
        const scale = Math.min(1, 320 / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.width * scale)); c.height = Math.max(1, Math.round(img.height * scale));
        const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
        g.drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', 0.85));
      };
      img.src = url;
    });
  }

  // ---- Add screenshots to an entry
  function pageShot(paint, id) {
    const e = entry(id);
    if (!e) throw new Error('That entry no longer exists.');
    if (!canEdit(e)) throw new Error('You can only add screenshots to your own entries.');
    document.title = `Screenshots for ${pad(e.id)}`;
    paint(`<h1>Add screenshots to ${pad(e.id)}</h1>
      <div class="card">
        <p><b>${esc(e.headline)}</b><br><span class="muted">${e.shots ? `It has ${e.shots} screenshot${e.shots === 1 ? '' : 's'} already – ${link('view', e.id, 'view them')}.` : 'No screenshots yet.'}</span></p>
        ${shotPicker()}
        <div class="formbar"><span class="status" id="status"></span>
          <button type="button" class="light" id="cancel">Cancel</button>
          <button type="button" id="save">Upload</button></div>
      </div>`);
    const shots = wireShots();
    $('#cancel').onclick = () => go('view', id);
    $('#save').onclick = async () => {
      if (!shots.count()) { $('#status').textContent = 'Add a screenshot first.'; return; }
      $('#save').disabled = true; $('#cancel').disabled = true;
      const failed = await shots.upload(id, $('#status'));
      if (failed) { $('#status').innerHTML = `<span style="color:#b42318;">${failed} didn't upload. Remove the ones marked ✓ Added, then try again.</span>`; $('#save').disabled = false; $('#cancel').disabled = false; return; }
      DIRTY = false;
      await load().catch(() => {});
      toast('Screenshots added.');
      go('view', id, true);
    };
  }

  // ---- One entry, with its screenshots
  async function pageView(paint, id, n) {
    const e = entry(id);
    if (!e) throw new Error('That entry no longer exists.');
    document.title = `${pad(e.id)} – ${e.headline}`;
    const owner = me().role === 'owner';
    track('view', { id }, null);
    if (!paint(`<p class="muted">${link('list', 0, '← All entries')}</p>
      <h1>${pad(e.id)} · ${esc(e.headline || 'No headline')}</h1>
      ${e.updated ? `<div class="msg">Changed on ${esc(e.updated)}, after it had been sent to the developer.</div>` : ''}
      <div class="card">
        <dl class="facts">
          <dt>Priority</dt><dd>${chip(e.priority) || '–'}</dd>
          <dt>Type</dt><dd>${chip(e.type) || '–'}</dd>
          <dt>Severity</dt><dd>${chip(e.severity) || '–'}</dd>
          <dt>Frequency</dt><dd>${chip(e.frequency) || '–'}</dd>
          <dt>Raised by</dt><dd>${chip(e.name)} on ${esc(e.date)}</dd>
          <dt>Order</dt><dd>${e.orders && e.orders.length ? orderLinks(e.orders) : '–'}</dd>
          <dt>Fed back?</dt><dd>${e.fedBack ? '✓ Sent to the developer' : 'Not yet sent'}</dd>
        </dl>
        <h2>Description</h2>
        <div class="desc">${e.description ? esc(e.description) : '<span class="muted">No description.</span>'}</div>
        <div class="row" style="margin-top:18px;">
          ${canEdit(e) ? link('edit', e.id, '✎ Edit', 'btn') + ' ' + link('shot', e.id, '＋ Screenshot', 'btn light') : ''}
          ${owner ? '<button type="button" class="danger" id="del" style="margin-left:auto;">Delete entry</button>' : ''}
        </div>
      </div>
      <h2>Screenshots</h2>
      <div id="shots">${e.shots ? '<p class="loading">Loading screenshots…</p>' : '<p class="muted">None yet.</p>'}</div>`)) return;
    if (owner) {
      let armed = false;
      $('#del').onclick = async () => {
        const b = $('#del');
        if (!armed) { armed = true; b.textContent = 'Click again to delete for good'; setTimeout(() => { armed = false; if (document.body.contains(b)) b.textContent = 'Delete entry'; }, 4000); return; }
        b.disabled = true; b.textContent = 'Deleting…';
        try { const r = await call('delete', { id }); await load(); toast(r.message); go('list', 0, true); }
        catch (err) { toast(err.message, 6000); b.disabled = false; b.textContent = 'Delete entry'; }
      };
    }
    if (!e.shots) return;
    const detail = await call('entry', { id });
    if (n !== RENDER) return;
    const box = $('#shots');
    if (!detail.shots.length) { box.innerHTML = '<p class="muted">None yet.</p>'; return; }
    box.className = 'shots';
    box.innerHTML = detail.shots.map((s, i) => `<div class="shot card"><img alt="Screenshot ${i + 1}" id="img${i}">
      <div class="cap">${s.caption ? `<b>${esc(s.caption)}</b><br>` : ''}<span class="muted">Added by ${esc(s.by)}${s.date ? ` on ${esc(s.date)}` : ''}</span></div></div>`).join('');
    for (let i = 0; i < detail.shots.length; i++) {
      try {
        const img = await call('img', { f: detail.shots[i].f });
        if (n !== RENDER) return;
        $('#img' + i).src = `data:${img.mime};base64,${img.data}`;
      } catch (err) { if (n !== RENDER) return; $('#img' + i).alt = 'Couldn\'t load this screenshot.'; }
    }
  }

  // ---- Personal links (owner)
  async function pageLinks(paint) {
    if (me().role !== 'owner') throw new Error('Only the owner can see this page.');
    document.title = 'Personal links';
    paint('<h1>Personal links</h1><p class="loading">Loading…</p>');
    const { links } = await call('links');
    if (!paint(`<h1>Personal links</h1>
      <p class="muted">Each person's own link. Anyone with a link can use the app as that person, so only send a link to its owner. <b>Renew</b> makes a new link and stops the old one working.</p>
      <div class="card" style="overflow-x:auto;"><table class="links"><tr><th>Name</th><th>Kind</th><th>Email</th><th>Link</th><th></th></tr>
      ${links.map(l => `<tr data-t="${esc(l.token)}"><td><b>${esc(l.name)}</b></td><td>${esc(l.kind)}</td><td>${esc(l.email || '–')}</td>
        <td class="url" title="${esc(l.url)}">${esc(l.url)}</td>
        <td><div class="row">
          <button type="button" class="small light" data-act="copy">Copy</button>
          <button type="button" class="small light" data-act="linkEmail">Email link</button>
          <button type="button" class="small light" data-act="linkReset">Renew</button>
          ${l.viewer ? '<button type="button" class="small danger" data-act="linkRemove">Remove</button>' : ''}
        </div></td></tr>`).join('')}</table></div>
      <div class="card"><h2 style="margin-top:0;">Add someone who can only read the feedback</h2>
        <p class="muted">For example the developer. They can see every entry, description and screenshot, but can't change anything.</p>
        <div class="row"><input type="text" id="vName" placeholder="Name" style="flex:1;min-width:140px;"><input type="email" id="vEmail" placeholder="Email address" style="flex:2;min-width:200px;"><button type="button" id="vAdd">Add</button></div>
        <p id="vMsg" class="muted" style="margin-top:8px;"></p></div>`)) return;
    $$('table.links button').forEach(b => b.onclick = async () => {
      const tr = b.closest('tr'), t = tr.dataset.t, l = links.find(x => x.token === t), act = b.dataset.act;
      if (act === 'copy') {
        try { await navigator.clipboard.writeText(l.url); toast(`${l.name}'s link copied.`); }
        catch (e) { prompt('Copy this link:', l.url); }
        return;
      }
      if (act === 'linkReset' && !confirm(`Make a new link for ${l.name}? Their current link will stop working.`)) return;
      if (act === 'linkRemove' && !confirm(`Remove ${l.name}'s view-only link?`)) return;
      b.disabled = true;
      try { toast((await call(act, { token: t })).message, 6000); if (act !== 'linkEmail') render(); }
      catch (err) { toast(err.message, 6000); }
      b.disabled = false;
    });
    $('#vAdd').onclick = async () => {
      $('#vAdd').disabled = true;
      try { toast((await call('linkAddViewer', { name: $('#vName').value, email: $('#vEmail').value })).message, 6000); render(); }
      catch (err) { $('#vMsg').textContent = err.message; $('#vAdd').disabled = false; }
    };
  }

  // ---- Help
  async function pageHelp(paint) {
    paintTop();
    document.title = 'Help';
    if (!HELP) { paint('<h1>Help</h1><p class="loading">Loading…</p>'); HELP = (await call('help')).help; }
    let html = '<div class="help"><h1>How to use the feedback app</h1>', open = false;
    const close = () => { if (open) { html += '</ul>'; open = false; } };
    HELP.forEach(c => {
      if (c[0] === 'b') { if (!open) { html += '<ul>'; open = true; } html += `<li>${bold(c[1])}</li>`; return; }
      close();
      if (c[0] === 'h') html += `<h2>${esc(c[1])}</h2>`;
      else if (c[0] === 'step') html += `<div class="step"><b class="n">${esc(c[1])}.</b><div>${bold(c[2])}</div></div>`;
      else if (c[0] === 'note') html += `<p class="note">${bold(c[1])}</p>`;
      else if (c[1]) html += `<p>${bold(c[1])}</p>`;
    });
    close();
    paint(html + `</div><p style="margin-top:24px;">${link('list', 0, '← Back to the app')}</p>`);
  }

  render();
})();
