// Nadav Automations – homepage questions form.
// Answers go straight into the "Inquiries" Google Form, so they land in its sheet and on the Admin page.
(() => {
  'use strict';
  const FORM = 'https://docs.google.com/forms/d/e/1FAIpQLScfDJTG7ZXgilgmlJ1SHXUb3wXl-_w1Oc6QwPsimgDVk98pnA';
  const FIELDS = { name: 'entry.928880259', email: 'entry.1919349893', question: 'entry.2004174116' };   // from the form's pre-filled link

  const f = document.getElementById('qform');
  if (!f) return;
  const $ = id => document.getElementById(id);
  const msg = (text, cls) => { $('qMsg').textContent = text; $('qMsg').className = 'qmsg ' + (cls || ''); };
  // A small warning pops up under a box as soon as it's too long (nothing is cut off)
  const LIMITS = { qName: [80, 'Names can be up to 80 characters.'], qText: [2000, 'Please keep your message under 2000 characters – you can email more details.'] };
  Object.keys(LIMITS).forEach(id => {
    const el = $(id), [max, text] = LIMITS[id], field = el.closest('.field');
    const tip = document.createElement('div');
    tip.className = 'tip'; tip.setAttribute('role', 'alert'); tip.hidden = true;
    tip.textContent = `${text} (${max} max)`;
    field.appendChild(tip);
    el.addEventListener('input', () => {
      const over = el.value.length > max;
      tip.hidden = !over;
      if (over) tip.textContent = `${text} You're at ${el.value.length}.`;
      field.classList.toggle('bad', over);
    });
  });

  function check() {
    const rules = [
      ['qName', v => v.trim().length > 0 && v.length <= 80, 'Please enter your name (up to 80 characters).'],
      ['qEmail', v => /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(v.trim()), 'Please enter a valid email address, e.g. name@example.com.'],
      ['qText', v => v.trim().length > 0 && v.length <= 2000, 'Please write your message (up to 2000 characters).']
    ];
    let first = null;
    rules.forEach(([id, ok, text]) => {
      const el = $(id), field = el.closest('.field');
      let err = field.querySelector('.err');
      if (ok(el.value)) { field.classList.remove('bad'); if (err) err.remove(); return; }
      field.classList.add('bad');
      if (!err) { err = document.createElement('small'); err.className = 'err'; field.appendChild(err); }
      err.textContent = text;
      if (!first) first = el;
    });
    if (first) first.focus();
    return !first;
  }

  f.addEventListener('submit', async e => {
    e.preventDefault();
    if (f.elements.website.value) return;                // filled in by a spam robot, not a person
    if (!check()) return;
    if (/_ID$/.test(FIELDS.name)) { msg('The form isn\'t connected yet – please email instead.', 'bad'); return; }
    const body = new URLSearchParams();
    body.set(FIELDS.name, f.elements.name.value.trim());
    body.set(FIELDS.email, f.elements.email.value.trim());
    body.set(FIELDS.question, f.elements.question.value.trim());
    $('qSend').disabled = true; msg('Sending…');
    try {
      // Google Forms doesn't send a readable reply to other websites, so a sent request counts as success
      await fetch(FORM + '/formResponse', { method: 'POST', mode: 'no-cors', body });
      f.reset();
      msg('Thanks – your message has been sent. You\'ll get a reply by email.', 'ok');
    } catch (err) {
      msg('Sorry, that didn\'t send. Please check your connection, or email instead.', 'bad');
    }
    $('qSend').disabled = false;
  });
})();
