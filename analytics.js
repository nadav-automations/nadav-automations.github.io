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

  function banner() {
    if (document.getElementById('cookieBar')) return;
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
