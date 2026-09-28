/* ==========================================================================
   Interações do site (sem dependências)
   ========================================================================== */
(() => {
  'use strict';

  const root = document.documentElement;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const safe = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* sem storage */ } },
  };

  /* ---------- Tema claro / escuro ---------- */
  const themeBtn = $('.theme-btn');
  const applyTheme = (theme) => {
    root.dataset.theme = theme;
    themeBtn?.setAttribute('aria-pressed', String(theme === 'dark'));
    $('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0b0a09' : '#f6f4ef');
  };
  themeBtn?.addEventListener('click', () => {
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    safe.set('gs-theme', next);
    if (document.startViewTransition && !reduced) document.startViewTransition(() => applyTheme(next));
    else applyTheme(next);
  });
  applyTheme(root.dataset.theme || 'light');

  /* ---------- Menu mobile ---------- */
  const nav = $('.nav');
  const menuBtn = $('.menu-btn');
  const setMenu = (open) => {
    nav?.classList.toggle('is-open', open);
    menuBtn?.setAttribute('aria-expanded', String(open));
  };
  menuBtn?.addEventListener('click', () => setMenu(!nav.classList.contains('is-open')));
  $$('.nav__links a').forEach((a) => a.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });
  document.addEventListener('click', (e) => { if (nav && !nav.contains(e.target)) setMenu(false); });

  /* ---------- Seção ativa no menu ---------- */
  const links = $$('.nav__links a');
  if ('IntersectionObserver' in window) {
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        links.forEach((a) => {
          const on = a.getAttribute('href') === `#${en.target.id}`;
          a.classList.toggle('is-active', on);
          if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    links.map((a) => $(a.getAttribute('href'))).filter(Boolean).forEach((s) => spy.observe(s));
  }

  /* ---------- Revelação ao rolar ---------- */
  const revealEls = $$('.reveal');
  if ('IntersectionObserver' in window && !reduced) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        en.target.classList.add('is-visible');
        io.unobserve(en.target);
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -30px 0px' });
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add('is-visible'));
  }

  /* ---------- Tecnologias: medidores e filtro ---------- */
  $$('.tool').forEach((t) => {
    const lvl = Number(t.dataset.level || 0);
    const meter = $('.meter', t);
    if (meter) meter.innerHTML = [1, 2, 3].map((i) => `<i class="${i <= lvl ? 'on' : ''}"></i>`).join('');
  });
  const filterBtns = $$('.filters button');
  filterBtns.forEach((btn) => btn.addEventListener('click', () => {
    const f = btn.dataset.filter;
    filterBtns.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
    $$('.tool').forEach((t, i) => {
      const show = f === 'all' || t.dataset.cat === f;
      t.classList.toggle('is-hidden', !show);
      t.classList.remove('is-entering');
      if (show && !reduced) {
        void t.offsetWidth;
        t.style.animationDelay = `${(i % 12) * 25}ms`;
        t.classList.add('is-entering');
      }
    });
  }));

  /* ---------- Toast + copiar e-mail ---------- */
  const toast = (msg) => {
    let t = $('.toast');
    if (!t) {
      t = document.createElement('div');
      t.className = 'toast';
      t.setAttribute('role', 'status');
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('is-on');
    clearTimeout(t.timer);
    t.timer = setTimeout(() => t.classList.remove('is-on'), 2400);
  };
  $$('[data-copy]').forEach((b) => b.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(b.dataset.copy); toast('E-mail copiado!'); } catch { toast(b.dataset.copy); }
  }));

  /* ---------- Formulário: envia direto para o e-mail do Gustavo ----------
     Usa o FormSubmit (https://formsubmit.co), serviço gratuito sem backend.
     Se o envio falhar, abre o aplicativo de e-mail com a mensagem pronta. */
  const form = $('#form');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    const status = $('.form__status', form);
    const btn = $('button[type="submit"]', form);
    const d = new FormData(form);
    if (String(d.get('_honey') || '')) return; // robô preencheu o campo oculto
    const name = String(d.get('name')).trim();
    const email = String(d.get('email')).trim();
    const topic = String(d.get('topic') || 'Contato');
    const message = String(d.get('message')).trim();
    const subject = `[Portfólio] ${topic} — ${name}`;

    status.className = 'form__status';
    status.textContent = 'Enviando…';
    btn.disabled = true;
    try {
      const res = await fetch(`https://formsubmit.co/ajax/${form.dataset.to}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          nome: name,
          email,
          assunto: topic,
          mensagem: message,
          _subject: subject,
          _replyto: email,
          _template: 'table',
          _captcha: 'false',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || String(data.success) === 'false') throw new Error(data.message || 'falha no envio');
      status.classList.add('ok');
      status.textContent = 'Mensagem enviada! Obrigado — responderei em breve.';
      form.reset();
    } catch (err) {
      status.classList.add('err');
      status.innerHTML = 'Não consegui enviar agora. <a href="#" class="mail-fallback" style="text-decoration:underline">Enviar pelo seu e-mail</a>.';
      $('.mail-fallback', status).addEventListener('click', (ev) => {
        ev.preventDefault();
        const body = `${message}\n\n${name}\n${email}`;
        window.location.href = `mailto:${form.dataset.to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      });
    } finally {
      btn.disabled = false;
    }
  });

  /* ---------- Ano ---------- */
  $$('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });
})();
