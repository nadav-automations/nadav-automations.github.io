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
  const CSS = '.cookiebar { font-family: Arial, Helvetica, sans-serif; line-height: 1.5; color: #1f2430; box-sizing: border-box; position: fixed; left: 16px; right: 16px; bottom: 16px; max-width: 640px; margin: 0 auto; background: #fff; border: 1px solid #dde0ea; border-radius: 12px; box-shadow: 0 8px 30px rgba(31,36,48,.18); padding: 16px 18px; display: flex; gap: 14px 18px; align-items: center; flex-wrap: wrap; z-index: 50; font-size: .93rem; } .cookiebar p { margin: 0; flex: 1 1 300px; } .cookiebar .cbtns { display: flex; gap: 8px; margin-left: auto; } .cookiebar button { font: inherit; font-weight: bold; padding: 8px 16px; border-radius: 7px; cursor: pointer; border: 1px solid #535FC1; } .cookiebar .cyes { background: #535FC1; color: #fff; } .cookiebar .cyes:hover { background: #3f4aa6; } .cookiebar .cno { background: #fff; color: #535FC1; } .cookiebar .cno:hover { background: #EEEFFB; }';
  function banner() {
    if (document.getElementById('cookieBar')) return;
    if (!document.getElementById('cookieCss')) { const st = document.createElement('style'); st.id = 'cookieCss'; st.textContent = CSS; document.head.appendChild(st); }
    const b = document.createElement('div');
    b.id = 'cookieBar'; b.className = 'cookiebar'; b.setAttribute('role', 'dialog'); b.setAttribute('aria-label', 'Cookies');
    b.innerHTML = '<p>Can I use cookies to count visits to this site? It helps me see which pages are useful. ' +
      'No adverts, and nothing is shared. <a href="privacy.html#cookies">More info</a></p>' +
      '<div class="cbtns"><button type="button" class="cno">Decline</button><button type="button" class="cyes">Accept</button></div>';
    document.body.appendChild(b);
    b.querySelector('.cyes').onclick = () => { set('yes'); b.remove(); start(); };
    b.querySelector('.cno').onclick = () => { set('no'); b.remove(); stop(); };
  }

  const choice = get();
  if (choice === 'yes') start(); else if (choice !== 'no') banner();

  // "Cookie settings" link in the footer reopens the choice
  document.querySelectorAll('[data-cookies]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); banner(); }));
})();
