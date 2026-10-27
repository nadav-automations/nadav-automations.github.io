// Nadav Automations – homepage movement: sticky header, fade-ins, the tools carousel and the topic buttons
(() => {
  'use strict';
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.documentElement.classList.add('js');

  // Header turns to frosted glass once you scroll
  const top = $('#top');
  const onScroll = () => top && top.classList.toggle('scrolled', scrollY > 8);
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  // Fade things in as they come into view, and underline the section you're in
  const links = $$('.top nav a');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('seen'); io.unobserve(e.target); } }), { threshold: .12 });
    $$('.reveal').forEach((el, i) => { el.style.transitionDelay = `${(i % 4) * 70}ms`; io.observe(el); });
    const so = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) links.forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + e.target.id));
    }), { rootMargin: '-45% 0px -50% 0px' });
    $$('main .sec[id]').forEach(s => so.observe(s));
  } else $$('.reveal').forEach(el => el.classList.add('seen'));

  // Carousel: arrows, dots, swipe, keyboard; moves on its own every 5 seconds unless you're pointing at it
  const car = $('#car');
  if (car) {
    const slides = [...car.querySelectorAll('.slide')], dots = car.querySelector('.dots');
    let i = 0, timer = null;
    slides.forEach((s, n) => {
      s.setAttribute('aria-roledescription', 'slide'); s.setAttribute('aria-label', `${n + 1} of ${slides.length}`);
      const d = document.createElement('button'); d.type = 'button'; d.setAttribute('aria-label', `Show slide ${n + 1}`);
      d.onclick = () => { show(n); restart(); }; dots.appendChild(d);
    });
    function show(n) {
      const prev = i; i = (n + slides.length) % slides.length;
      slides.forEach((s, k) => { s.classList.toggle('on', k === i); s.classList.toggle('out', k === prev && k !== i); s.setAttribute('aria-hidden', String(k !== i)); });
      [...dots.children].forEach((d, k) => d.classList.toggle('on', k === i));
    }
    const restart = () => { clearInterval(timer); if (!still) timer = setInterval(() => show(i + 1), 5000); };
    car.querySelector('.prev').onclick = () => { show(i - 1); restart(); };
    car.querySelector('.next').onclick = () => { show(i + 1); restart(); };
    car.addEventListener('mouseenter', () => clearInterval(timer));
    car.addEventListener('mouseleave', restart);
    car.addEventListener('focusin', () => clearInterval(timer));
    car.addEventListener('keydown', e => { if (e.key === 'ArrowRight') { show(i + 1); restart(); } if (e.key === 'ArrowLeft') { show(i - 1); restart(); } });
    let x0 = null;
    car.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
    car.addEventListener('touchend', e => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 40) { show(i + (dx < 0 ? 1 : -1)); restart(); } x0 = null; });
    show(0); restart();
  }

  // "What's it about?" buttons – the choice is added to the start of the message
  const form = $('#qform');
  const pick = topic => {
    if (!form) return;
    form.dataset.topic = topic;
    form.querySelectorAll('.topics [data-topic]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.topic === topic)));
  };
  $$('.topics [data-topic]').forEach(b => b.addEventListener('click', () => pick(b.getAttribute('aria-checked') === 'true' ? '' : b.dataset.topic)));
  // Links like "Suggest an idea" pick the topic for you on the way to the form
  $$('a[data-topic]').forEach(a => a.addEventListener('click', () => pick(a.dataset.topic)));
})();
