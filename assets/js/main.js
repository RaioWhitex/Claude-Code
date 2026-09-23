/* ==========================================================================
   // GUSTAVO.DEV — interações
   JavaScript puro, sem dependências. Tudo respeita prefers-reduced-motion.
   ========================================================================== */
(() => {
  'use strict';

  const root = document.documentElement;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

  const store = {
    get(key) { try { return localStorage.getItem(key); } catch { return null; } },
    set(key, value) { try { localStorage.setItem(key, value); } catch { /* sem storage */ } },
    sessionGet(key) { try { return sessionStorage.getItem(key); } catch { return null; } },
    sessionSet(key, value) { try { sessionStorage.setItem(key, value); } catch { /* sem storage */ } },
  };

  const accentRgb = () => getComputedStyle(root).getPropertyValue('--accent-glow').trim().split(/\s+/).join(',');

  /* ---------- Loader: sequência de boot ---------- */
  function runLoader() {
    const loader = $('.loader');
    if (!loader) return Promise.resolve();

    const pctEl = $('.loader__pct', loader);
    const barEl = $('.loader__bar', loader);
    const labelEl = $('.loader__label', loader);
    const logEl = $('.loader__log', loader);
    const seen = store.sessionGet('gs-booted');
    const duration = reducedMotion ? 0 : seen ? 550 : 1500;

    const steps = [
      [0, 'INICIANDO_SISTEMA'],
      [22, 'CARREGANDO_FONTES'],
      [48, 'MONTANDO_INTERFACE'],
      [74, 'SINCRONIZANDO_DADOS'],
      [94, 'RENDERIZANDO_PÁGINA'],
    ];
    const logs = ['> kernel gustavo.dev v2.0', '> módulos: html5 · css3 · javascript', '> status: online', '> bem-vindo(a).'];

    const finish = () => {
      loader.classList.add('is-done');
      root.classList.add('is-loaded');
      store.sessionSet('gs-booted', '1');
      setTimeout(() => loader.remove(), 600);
    };

    if (!duration) { finish(); return Promise.resolve(); }

    const fontsReady = 'fonts' in document
      ? Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1400))])
      : Promise.resolve();

    return new Promise((resolve) => {
      const start = performance.now();
      let fontsDone = false;
      fontsReady.then(() => { fontsDone = true; });

      const tick = (now) => {
        let t = Math.min((now - start) / duration, 1);
        if (!fontsDone) t = Math.min(t, .9);
        const eased = 1 - Math.pow(1 - t, 3);
        const pct = Math.round(eased * 100);
        pctEl.textContent = String(pct).padStart(2, '0') + '%';
        barEl.style.transform = `scaleX(${eased})`;
        const step = steps.filter(([p]) => pct >= p).pop();
        if (step && labelEl.textContent !== step[1]) labelEl.textContent = step[1];
        logEl.innerHTML = logs.slice(0, Math.ceil(eased * logs.length)).join('<br>');
        if (t < 1) requestAnimationFrame(tick);
        else setTimeout(() => { finish(); resolve(); }, 180);
      };
      requestAnimationFrame(tick);
    });
  }

  /* ---------- Tema de acento (azul / ouro) ---------- */
  function initAccentSwitch() {
    const buttons = $$('.accent-switch button');
    const sync = () => {
      const current = root.dataset.accent || 'blue';
      buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.accent === current)));
    };
    buttons.forEach((btn) => btn.addEventListener('click', () => {
      const value = btn.dataset.accent;
      if (value === 'gold') root.dataset.accent = 'gold';
      else delete root.dataset.accent;
      store.set('gs-accent', value);
      sync();
      window.dispatchEvent(new CustomEvent('accentchange'));
    }));
    sync();
  }

  /* ---------- Menu mobile ---------- */
  function initMenu() {
    const header = $('.site-header');
    const trigger = $('.menu-trigger');
    if (!header || !trigger) return;
    const setOpen = (open) => {
      header.classList.toggle('is-open', open);
      trigger.setAttribute('aria-expanded', String(open));
      trigger.textContent = open ? '[ FECHAR ]' : '[ MENU ]';
    };
    trigger.addEventListener('click', () => setOpen(!header.classList.contains('is-open')));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });
    document.addEventListener('click', (e) => { if (!header.contains(e.target)) setOpen(false); });
  }

  /* ---------- Barra de progresso ---------- */
  function initScrollProgress() {
    const bar = $('.scroll-progress');
    if (!bar) return;
    let ticking = false;
    const update = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.transform = `scaleX(${max > 0 ? window.scrollY / max : 0})`;
      ticking = false;
    };
    window.addEventListener('scroll', () => {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();
  }

  /* ---------- Cursor ---------- */
  function initCursor() {
    const cursor = $('.cursor');
    if (!cursor || !finePointer || reducedMotion) return;
    let x = -100, y = -100, cx = -100, cy = -100;
    window.addEventListener('pointermove', (e) => {
      x = e.clientX; y = e.clientY;
      cursor.classList.add('is-visible');
    }, { passive: true });
    document.addEventListener('pointerleave', () => cursor.classList.remove('is-visible'));
    document.addEventListener('pointerover', (e) => {
      cursor.classList.toggle('is-hover', !!e.target.closest('a, button, input, textarea, [data-hover]'));
    });
    const loop = () => {
      cx += (x - cx) * .22;
      cy += (y - cy) * .22;
      cursor.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
      requestAnimationFrame(loop);
    };
    loop();
  }

  /* ---------- Reveal ao rolar ---------- */
  function initReveal() {
    const els = $$('.reveal, .reveal-mask, [data-observe]');
    if (!('IntersectionObserver' in window)) { els.forEach((el) => el.classList.add('is-in')); return; }
    // Elementos com clip-path total têm área zero para o observer: observa o pai deles
    const targets = new Map();
    els.forEach((el) => {
      const target = el.classList.contains('reveal-mask') ? el.parentElement : el;
      if (!targets.has(target)) targets.set(target, []);
      targets.get(target).push(el);
    });
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        targets.get(entry.target).forEach((el) => {
          el.classList.add('is-in');
          el.dispatchEvent(new CustomEvent('reveal'));
        });
        io.unobserve(entry.target);
      });
    }, { threshold: .15, rootMargin: '0px 0px -40px 0px' });
    targets.forEach((_, target) => io.observe(target));
  }

  /* ---------- Texto digitado ---------- */
  function initTyped() {
    $$('[data-typed]').forEach((el) => {
      const words = JSON.parse(el.dataset.typed);
      if (reducedMotion) { el.textContent = words[0]; return; }
      let w = 0, i = 0, deleting = false;
      const step = () => {
        const word = words[w];
        i += deleting ? -1 : 1;
        el.textContent = word.slice(0, i);
        let delay = deleting ? 35 : 70;
        if (!deleting && i === word.length) { deleting = true; delay = 1900; }
        else if (deleting && i === 0) { deleting = false; w = (w + 1) % words.length; delay = 350; }
        setTimeout(step, delay);
      };
      step();
    });
  }

  /* ---------- Embaralhar texto no hover ---------- */
  function initScramble() {
    if (reducedMotion) return;
    const glyphs = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/<>_#*';
    $$('[data-scramble]').forEach((el) => {
      const original = el.textContent;
      let raf = null;
      el.addEventListener('pointerenter', () => {
        cancelAnimationFrame(raf);
        let frame = 0;
        const total = original.length * 2.2;
        const run = () => {
          el.textContent = original.split('').map((ch, idx) => {
            if (ch === ' ' || idx < frame / 2.2) return ch;
            return glyphs[Math.floor(Math.random() * glyphs.length)];
          }).join('');
          frame++;
          if (frame <= total) raf = requestAnimationFrame(run);
          else el.textContent = original;
        };
        run();
      });
    });
  }

  /* ---------- Glitch periódico ---------- */
  function initGlitch() {
    if (reducedMotion) return;
    $$('.glitch').forEach((el) => {
      const fire = () => {
        el.classList.add('is-glitching');
        setTimeout(() => el.classList.remove('is-glitching'), 340);
        setTimeout(fire, 2800 + Math.random() * 4200);
      };
      setTimeout(fire, 1800);
    });
  }

  /* ---------- Marquee contínuo ---------- */
  function initMarquee() {
    $$('.marquee').forEach((m) => {
      const track = $('.marquee__track', m);
      if (!track) return;
      const clone = track.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      m.appendChild(clone);
    });
  }

  /* ---------- Contadores ---------- */
  function initCounters() {
    $$('[data-count]').forEach((el) => {
      const target = Number(el.dataset.count);
      const pad = el.dataset.pad ? Number(el.dataset.pad) : 0;
      const render = (v) => { el.textContent = String(v).padStart(pad, '0'); };
      if (reducedMotion) { render(target); return; }
      render(0);
      const host = el.closest('[data-observe]') || el;
      host.addEventListener('reveal', () => {
        const start = performance.now();
        const dur = 1200;
        const tick = (now) => {
          const t = Math.min((now - start) / dur, 1);
          render(Math.round(target * (1 - Math.pow(1 - t, 3))));
          if (t < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }, { once: true });
    });
  }

  /* ---------- Barras de nível segmentadas ---------- */
  function initLevels() {
    $$('.level').forEach((row) => {
      const bar = $('.level__bar', row);
      const value = Number(bar.dataset.value || 0);
      bar.innerHTML = '<i></i>'.repeat(10);
      const cells = $$('i', bar);
      const fill = () => cells.forEach((c, idx) => {
        if (idx < value) setTimeout(() => c.classList.add('on'), reducedMotion ? 0 : idx * 70);
      });
      if (reducedMotion || !('IntersectionObserver' in window)) { fill(); return; }
      row.addEventListener('reveal', fill, { once: true });
    });
  }

  /* ---------- Cards com inclinação + spotlight ---------- */
  function initTilt() {
    if (!finePointer || reducedMotion) return;
    $$('[data-tilt]').forEach((card) => {
      card.addEventListener('pointermove', (e) => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        card.style.setProperty('--mx', `${px * 100}%`);
        card.style.setProperty('--my', `${py * 100}%`);
        card.style.transform = `perspective(900px) rotateX(${(.5 - py) * 7}deg) rotateY(${(px - .5) * 9}deg) translateY(-4px)`;
      });
      card.addEventListener('pointerleave', () => { card.style.transform = ''; });
    });
  }

  /* ---------- Copiar e-mail ---------- */
  function toast(message) {
    let el = $('.toast');
    if (!el) {
      el = document.createElement('div');
      el.className = 'toast';
      el.setAttribute('role', 'status');
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.add('is-visible');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('is-visible'), 2200);
  }

  function initCopy() {
    $$('[data-copy]').forEach((btn) => btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      try {
        await navigator.clipboard.writeText(btn.dataset.copy);
        toast('E-mail copiado ✓');
      } catch {
        toast(btn.dataset.copy);
      }
    }));
  }

  /* ---------- Formulário → e-mail ---------- */
  function initForm() {
    const form = $('#contact-form');
    if (!form) return;
    const status = $('.form__status', form);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!form.reportValidity()) return;
      const data = new FormData(form);
      const name = String(data.get('name')).trim();
      const email = String(data.get('email')).trim();
      const subject = String(data.get('subject') || '').trim() || `Contato pelo portfólio — ${name}`;
      const body = `${String(data.get('message')).trim()}\n\n— ${name}\n${email}`;
      window.location.href = `mailto:${form.dataset.to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      status.textContent = '> Abrindo seu aplicativo de e-mail...';
    });
  }

  /* ======================================================================
     Canvas: base com pausa fora da tela e suporte a alta densidade
     ====================================================================== */
  class CanvasScene {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.mouse = { x: .5, y: .5, tx: .5, ty: .5 };
      this.running = false;
      this.visible = true;
      this.t = 0;
      this.color = accentRgb();
      this.resize();
      new ResizeObserver(() => this.resize()).observe(canvas);
      window.addEventListener('accentchange', () => { this.color = accentRgb(); if (reducedMotion) this.draw(); });
      window.addEventListener('pointermove', (e) => {
        const r = canvas.getBoundingClientRect();
        this.mouse.tx = (e.clientX - r.left) / r.width;
        this.mouse.ty = (e.clientY - r.top) / r.height;
      }, { passive: true });
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(([entry]) => {
          this.visible = entry.isIntersecting;
          if (this.visible) this.start();
        }).observe(canvas);
      }
      document.addEventListener('visibilitychange', () => { if (!document.hidden) this.start(); });
    }
    resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const { width, height } = this.canvas.getBoundingClientRect();
      this.w = width; this.h = height;
      this.canvas.width = Math.max(1, Math.round(width * dpr));
      this.canvas.height = Math.max(1, Math.round(height * dpr));
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.setup?.();
      if (reducedMotion) this.draw();
    }
    start() {
      if (reducedMotion) { this.draw(); return; }
      if (this.running) return;
      this.running = true;
      let last = performance.now();
      const loop = (now) => {
        if (!this.visible || document.hidden) { this.running = false; return; }
        const dt = Math.min((now - last) / 1000, .05);
        last = now;
        this.t += dt;
        this.mouse.x += (this.mouse.tx - this.mouse.x) * .06;
        this.mouse.y += (this.mouse.ty - this.mouse.y) * .06;
        this.draw(dt);
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    }
  }

  /* Globo de pontos 3D que gira e reage ao mouse */
  class DotGlobe extends CanvasScene {
    setup() {
      if (this.points) return;
      const n = 900;
      const golden = Math.PI * (3 - Math.sqrt(5));
      this.points = Array.from({ length: n }, (_, i) => {
        const y = 1 - (i / (n - 1)) * 2;
        const r = Math.sqrt(1 - y * y);
        const th = golden * i;
        return [Math.cos(th) * r, y, Math.sin(th) * r];
      });
      this.orbits = Array.from({ length: 3 }, (_, i) => ({ tilt: .4 + i * .5, speed: .25 + i * .12, phase: i * 2 }));
    }
    draw() {
      const { ctx, w, h, t } = this;
      ctx.clearRect(0, 0, w, h);
      const R = Math.min(w, h) * .36;
      const cx = w / 2, cy = h / 2;
      const rotY = t * .25 + (this.mouse.x - .5) * 1.2;
      const rotX = -.35 + (this.mouse.y - .5) * .8;
      const sy = Math.sin(rotY), cyR = Math.cos(rotY), sx = Math.sin(rotX), cxR = Math.cos(rotX);
      const c = this.color;

      // aro
      ctx.strokeStyle = `rgba(${c},.18)`;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx, cy, R * 1.02, 0, Math.PI * 2); ctx.stroke();

      for (const [x0, y0, z0] of this.points) {
        const x1 = x0 * cyR + z0 * sy;
        const z1 = -x0 * sy + z0 * cyR;
        const y1 = y0 * cxR - z1 * sx;
        const z2 = y0 * sx + z1 * cxR;
        const depth = (z2 + 1) / 2;
        const px = cx + x1 * R, py = cy + y1 * R;
        const size = .6 + depth * 1.6;
        if (depth > .5) {
          ctx.fillStyle = `rgba(${c},${.25 + depth * .75})`;
        } else {
          ctx.fillStyle = `rgba(242,242,242,${.05 + depth * .25})`;
        }
        ctx.fillRect(px - size / 2, py - size / 2, size, size);
      }

      // órbitas com satélites
      for (const o of this.orbits) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(o.tilt + (this.mouse.x - .5) * .3);
        ctx.strokeStyle = 'rgba(242,242,242,.12)';
        ctx.setLineDash([2, 6]);
        ctx.beginPath(); ctx.ellipse(0, 0, R * 1.35, R * .38, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
        const a = t * o.speed + o.phase;
        const sx2 = Math.cos(a) * R * 1.35, sy2 = Math.sin(a) * R * .38;
        ctx.fillStyle = `rgb(${c})`;
        ctx.shadowColor = `rgb(${c})`;
        ctx.shadowBlur = 12;
        ctx.fillRect(sx2 - 3, sy2 - 3, 6, 6);
        ctx.shadowBlur = 0;
        ctx.restore();
      }

      // mira
      ctx.strokeStyle = 'rgba(242,242,242,.25)';
      const m = 10;
      ctx.beginPath();
      ctx.moveTo(cx - R * 1.15, cy); ctx.lineTo(cx - R * 1.15 + m, cy);
      ctx.moveTo(cx + R * 1.15, cy); ctx.lineTo(cx + R * 1.15 - m, cy);
      ctx.moveTo(cx, cy - R * 1.15); ctx.lineTo(cx, cy - R * 1.15 + m);
      ctx.moveTo(cx, cy + R * 1.15); ctx.lineTo(cx, cy + R * 1.15 - m);
      ctx.stroke();
    }
  }

  /* Terreno de pontos em onda, com perspectiva e distorção pelo mouse */
  class WaveField extends CanvasScene {
    setup() {
      this.cols = Math.max(24, Math.round(this.w / 26));
      this.rows = 34;
    }
    draw() {
      const { ctx, w, h, t, cols, rows } = this;
      ctx.clearRect(0, 0, w, h);
      const c = this.color;
      const horizon = h * .18;
      const mx = this.mouse.x, my = this.mouse.y;
      for (let r = 0; r < rows; r++) {
        const z = r / (rows - 1);
        const persp = .25 + z * .75;
        const y0 = horizon + Math.pow(z, 1.6) * (h - horizon) * .95;
        for (let col = 0; col < cols; col++) {
          const u = col / (cols - 1) - .5;
          const xw = u * w * 1.6 * persp + w / 2;
          const dx = xw / w - mx, dy = y0 / h - my;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const bump = Math.exp(-dist * dist * 18) * 38;
          const wave = Math.sin(col * .35 + t * 1.4 + r * .25) * 10 * persp + Math.cos(r * .4 - t) * 6 * persp;
          const y = y0 - wave - bump;
          const size = .7 + persp * 1.8;
          const intensity = Math.min(1, .15 + bump / 30);
          ctx.fillStyle = bump > 4 ? `rgba(${c},${intensity})` : `rgba(242,242,242,${.08 + persp * .32})`;
          ctx.fillRect(xw - size / 2, y - size / 2, size, size);
        }
      }
    }
  }

  function initCanvases() {
    if (!window.CanvasRenderingContext2D || !('ResizeObserver' in window)) return;
    $$('canvas[data-scene]').forEach((canvas) => {
      const Scene = canvas.dataset.scene === 'globe' ? DotGlobe : WaveField;
      const scene = new Scene(canvas);
      scene.start();
    });
  }

  /* ---------- Ano no rodapé / relógio ---------- */
  function initMeta() {
    $$('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });
    const clocks = $$('[data-clock]');
    if (!clocks.length) return;
    const fmt = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const tick = () => clocks.forEach((el) => { el.textContent = fmt.format(new Date()); });
    tick();
    setInterval(tick, 1000);
  }

  /* ---------- Boot ---------- */
  initAccentSwitch();
  initMenu();
  initMarquee();
  initLevels();
  initCounters();
  initMeta();
  initCopy();
  initForm();
  initScrollProgress();
  initCursor();
  initScramble();
  initTilt();
  initCanvases();

  runLoader().then(() => {
    initReveal();
    initTyped();
    initGlitch();
  });

  console.log('%c// GUSTAVO.DEV', 'color:#3157ff;font:700 16px monospace', '\nFeito com HTML, CSS e JavaScript puros.');
})();
