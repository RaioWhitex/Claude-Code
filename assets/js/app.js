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
    themeBtn?.setAttribute('aria-pressed', String(theme === 'light'));
    $('meta[name="theme-color"]')?.setAttribute('content', theme === 'light' ? '#f3f1ec' : '#07090d');
    window.dispatchEvent(new CustomEvent('themechange'));
  };
  themeBtn?.addEventListener('click', () => {
    const next = root.dataset.theme === 'light' ? 'dark' : 'light';
    safe.set('gs-theme', next);
    if (document.startViewTransition && !reduced) document.startViewTransition(() => applyTheme(next));
    else applyTheme(next);
  });
  themeBtn?.setAttribute('aria-pressed', String(root.dataset.theme === 'light'));

  /* ---------- Menu mobile ---------- */
  const nav = $('.nav');
  const menuBtn = $('.menu-btn');
  const setMenu = (open) => {
    nav.classList.toggle('is-open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
  };
  menuBtn?.addEventListener('click', () => setMenu(!nav.classList.contains('is-open')));
  $$('.nav__links a').forEach((a) => a.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });
  document.addEventListener('click', (e) => { if (nav && !nav.contains(e.target)) setMenu(false); });

  /* ---------- Pílula deslizante + seção ativa ---------- */
  const pill = $('.nav__pill');
  const links = $$('.nav__links a');
  const movePill = (a) => {
    if (!pill || !a) { if (pill) pill.style.opacity = '0'; return; }
    pill.style.opacity = '1';
    pill.style.width = `${a.offsetWidth}px`;
    pill.style.transform = `translateX(${a.offsetLeft}px)`;
  };
  const setActive = (id) => {
    let current = null;
    links.forEach((a) => {
      const on = a.getAttribute('href') === `#${id}`;
      a.classList.toggle('is-active', on);
      if (on) { a.setAttribute('aria-current', 'true'); current = a; } else a.removeAttribute('aria-current');
    });
    movePill(current);
  };
  if ('IntersectionObserver' in window) {
    const sections = links.map((a) => $(a.getAttribute('href'))).filter(Boolean);
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) setActive(en.target.id); });
    }, { rootMargin: '-45% 0px -50% 0px' });
    sections.forEach((s) => spy.observe(s));
  }
  window.addEventListener('resize', () => movePill($('.nav__links a.is-active')));

  /* ---------- Revelação ao rolar ---------- */
  const revealEls = $$('.reveal');
  if ('IntersectionObserver' in window && !reduced) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        en.target.classList.add('is-visible');
        io.unobserve(en.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -30px 0px' });
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add('is-visible'));
  }

  /* ---------- Brilho que segue o mouse nos cartões ---------- */
  if (window.matchMedia('(hover: hover)').matches) {
    $$('.card.glow').forEach((card) => {
      card.addEventListener('pointermove', (e) => {
        const r = card.getBoundingClientRect();
        card.style.setProperty('--mx', `${e.clientX - r.left}px`);
        card.style.setProperty('--my', `${e.clientY - r.top}px`);
      });
    });
  }

  /* ---------- Habilidades: medidores e filtro ---------- */
  $$('.skill').forEach((s) => {
    const lvl = Number(s.dataset.level || 0);
    const meter = $('.meter', s);
    if (meter) meter.innerHTML = [1, 2, 3].map((i) => `<i class="${i <= lvl ? 'on' : ''}"></i>`).join('');
  });
  const filterBtns = $$('.filters button');
  filterBtns.forEach((btn) => btn.addEventListener('click', () => {
    const f = btn.dataset.filter;
    filterBtns.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
    $$('.skill').forEach((s, i) => {
      const show = f === 'all' || s.dataset.cat === f;
      s.classList.toggle('is-hidden', !show);
      s.classList.remove('is-entering');
      if (show && !reduced) {
        void s.offsetWidth;
        s.style.animationDelay = `${(i % 12) * 25}ms`;
        s.classList.add('is-entering');
      }
    });
  }));

  /* ---------- Copiar e-mail + toast ---------- */
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
    t.timer = setTimeout(() => t.classList.remove('is-on'), 2200);
  };
  $$('[data-copy]').forEach((b) => b.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(b.dataset.copy); toast('E-mail copiado!'); }
    catch { toast(b.dataset.copy); }
  }));

  /* ---------- Formulário → aplicativo de e-mail ---------- */
  const form = $('#form');
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    const d = new FormData(form);
    const name = String(d.get('name')).trim();
    const subject = String(d.get('subject') || '').trim() || `Contato pelo portfólio — ${name}`;
    const body = `${String(d.get('message')).trim()}\n\n${name}\n${String(d.get('email')).trim()}`;
    window.location.href = `mailto:${form.dataset.to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    $('.form__status', form).textContent = 'Abrindo seu aplicativo de e-mail…';
  });

  /* ---------- Ano ---------- */
  $$('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });
})();
