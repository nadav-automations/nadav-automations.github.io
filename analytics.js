// Nadav Automations – Google Analytics, only after the visitor clicks Accept.
// Used on the homepage and privacy page only (never on the feedback app or Admin page).
(() => {
  'use strict';
  const ID = 'G-3468RWR6D1';
  const KEY = 'naCookies';                       // 'yes' or 'no', remembered in this browser
  const get = () => { try { return localStorage.getItem(KEY); } catch (e) { return null; } };
  const set = v => { try { localStorage.setItem(KEY, v); } catch (e) {} };

  function start() {
    if (window.gtag) return;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { dataLayer.push(arguments); };
    gtag('js', new Date());
    gtag('config', ID, { allow_google_signals: false, allow_ad_personalization_signals: false });
    const s = document.createElement('script');
    s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + ID;
    document.head.appendChild(s);
  }

  function stop() {                              // remove Google's cookies if someone changes their mind
    document.cookie.split(';').map(c => c.split('=')[0].trim()).filter(n => /^_ga/.test(n)).forEach(n => {
      const host = location.hostname;
      [host, '.' + host].forEach(d => { document.cookie = `${n}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=${d}`; });
      document.cookie = `${n}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    });
  }

  // The banner brings its own look, so it never depends on style.css being up to date
  const CSS = '#cookieBar{position:fixed;left:0;right:0;bottom:0;z-index:50;background:#fff;box-shadow:0 -10px 40px rgba(31,36,48,.35),0 -2px 8px rgba(31,36,48,.15);font-family:Arial,Helvetica,sans-serif;line-height:1.55;color:#1f2430;box-sizing:border-box}#cookieBar *{box-sizing:border-box}#cookieBar .cin{max-width:1240px;margin:0 auto;padding:28px 32px;display:flex;gap:16px 32px;align-items:center;flex-wrap:wrap}#cookieBar .cico{flex:none;width:64px;height:64px;animation:cwob 2.4s ease-in-out infinite;transform-origin:50% 60%}@keyframes cwob{0%,100%{transform:rotate(-6deg)}50%{transform:rotate(6deg)}}@media (prefers-reduced-motion:reduce){#cookieBar .cico{animation:none}}#cookieBar .ctext{flex:1 1 360px}#cookieBar h2{margin:0 0 4px;font-size:1.15rem;color:#1f2430}#cookieBar p{margin:0;font-size:1rem;color:#3a3f4d}#cookieBar a{color:#535FC1}#cookieBar .cbtns{display:flex;gap:10px;flex-wrap:wrap}#cookieBar button{font:inherit;font-weight:bold;font-size:1rem;padding:11px 26px;border-radius:8px;cursor:pointer;border:2px solid #535FC1;min-width:120px}#cookieBar .cyes{background:#535FC1;color:#fff}#cookieBar .cyes:hover{background:#3f4aa6;border-color:#3f4aa6}#cookieBar .cno{background:#fff;color:#535FC1}#cookieBar .cno:hover{background:#EEEFFB}@media (max-width:600px){#cookieBar .cin{padding:20px 16px}#cookieBar .cico{width:44px;height:44px;align-self:flex-start}#cookieBar .ctext{flex:1 1 0;min-width:0}#cookieBar .cbtns{width:100%}#cookieBar button{flex:1}}';
  function banner() {
    if (document.getElementById('cookieBar')) return;
    if (!document.getElementById('cookieCss')) { const st = document.createElement('style'); st.id = 'cookieCss'; st.textContent = CSS; document.head.appendChild(st); }
    const b = document.createElement('div');
    b.id = 'cookieBar'; b.setAttribute('role', 'dialog'); b.setAttribute('aria-labelledby', 'cookieTitle');
    b.innerHTML = '<div class="cin"><svg class="cico" viewBox="0 0 64 64" aria-hidden="true"><defs><mask id="cbite"><rect width="64" height="64" fill="#fff"/><circle cx="54" cy="11" r="9" fill="#000"/><circle cx="60" cy="22" r="6" fill="#000"/><circle cx="45" cy="5" r="6" fill="#000"/></mask></defs><g mask="url(#cbite)"><circle cx="32" cy="34" r="27" fill="#b9733a"/><circle cx="32" cy="32" r="27" fill="#e0a45e"/><circle cx="30" cy="30" r="21" fill="#e9b673" opacity=".55"/></g><g fill="#5a3418"><ellipse cx="20" cy="24" rx="4" ry="3.4"/><ellipse cx="34" cy="20" rx="3" ry="2.6"/><ellipse cx="42" cy="34" rx="4.2" ry="3.6"/><ellipse cx="24" cy="40" rx="3.6" ry="3.1"/><ellipse cx="35" cy="47" rx="3" ry="2.6"/><ellipse cx="14" cy="34" rx="2.4" ry="2"/><ellipse cx="47" cy="45" rx="2.4" ry="2"/></g><g fill="#e0a45e" opacity=".9"><circle cx="49" cy="15" r="1.6"/><circle cx="56" cy="27" r="1.3"/></g></svg><div class="ctext"><h2 id="cookieTitle">Cookies on this site</h2>' +
      '<p>This site uses analytics cookies to count visits and see which pages are useful. They\'re only set if you accept. ' +
      'No adverts, and nothing is shared. <a href="privacy.html#cookies">Read more</a></p></div>' +
      '<div class="cbtns"><button type="button" class="cno">Reject</button><button type="button" class="cyes">Accept</button></div></div>';
    document.body.appendChild(b);
    b.querySelector('.cyes').onclick = () => { set('yes'); b.remove(); start(); };
    b.querySelector('.cno').onclick = () => { set('no'); b.remove(); stop(); };
  }

  const choice = get();
  if (choice === 'yes') start(); else if (choice !== 'no') banner();

  // "Cookie settings" link in the footer reopens the choice
  document.querySelectorAll('[data-cookies]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); banner(); }));
})();
