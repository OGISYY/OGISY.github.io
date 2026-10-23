/* ==================================================================
   main.js | comportamiento comun (modulo ES, sin dependencias)
   - Idioma ES/EN recordado en localStorage (clave heredada: portfolio_lang)
   - Navegacion, reveal al hacer scroll, indice activo del breakdown
   - Visor de imagenes con teclado, swipe y carga progresiva
   - Fachada ligera de YouTube, copiar email
   - Carga diferida de la escena 3D del hero
   ================================================================== */

const root = document.documentElement;
const BASE = root.dataset.base || '';
const STORE_KEY = 'portfolio_lang';
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

const UI = {
  es: {
    viewer: 'Visor de imágenes', close: 'Cerrar', prev: 'Imagen anterior', next: 'Imagen siguiente',
    copy: 'Copiar', copied: 'Copiado', copiedStatus: 'Email copiado al portapapeles',
    videoSoon: 'Vídeo próximamente',
    ue5: 'Material en UE5', zbrush: 'Escultura en ZBrush',
  },
  en: {
    viewer: 'Image viewer', close: 'Close', prev: 'Previous image', next: 'Next image',
    copy: 'Copy', copied: 'Copied', copiedStatus: 'Email copied to clipboard',
    videoSoon: 'Video coming soon',
    ue5: 'Material in UE5', zbrush: 'ZBrush sculpt',
  },
};

let lang = 'es';
try { if (localStorage.getItem(STORE_KEY) === 'en') lang = 'en'; } catch {}

/* ---------------- Idioma ---------------- */
// El espanol vive en el HTML; el ingles se carga bajo demanda desde i18n-en.js
const originals = new WeakMap();
let enDict = null;

function snapshot(el) {
  let s = originals.get(el);
  if (!s) { s = { html: null, attrs: {} }; originals.set(el, s); }
  return s;
}

async function applyLang(next) {
  if (next === 'en' && !enDict) {
    try { enDict = (await import('./i18n-en.js')).default; }
    catch (err) { console.warn('[i18n] No se pudo cargar el ingles', err); next = 'es'; }
  }
  lang = next;
  root.lang = next;
  const t = (key, fallback) => (next === 'en' && enDict && key in enDict ? enDict[key] : fallback);

  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const s = snapshot(el);
    if (s.html === null) s.html = el.innerHTML;
    el.innerHTML = t(el.dataset.i18n, s.html);
  });
  document.querySelectorAll('[data-i18n-attr]').forEach((el) => {
    const s = snapshot(el);
    el.dataset.i18nAttr.split(',').forEach((pair) => {
      const [attr, key] = pair.split(':').map((x) => x.trim());
      if (!(attr in s.attrs)) s.attrs[attr] = el.getAttribute(attr);
      const value = t(key, s.attrs[attr]);
      if (value != null) el.setAttribute(attr, value);
    });
  });
  document.querySelectorAll('[data-set-lang]').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.setLang === next));
  });
  try { localStorage.setItem(STORE_KEY, next); } catch {}
  root.removeAttribute('data-lang-pending');
}

document.querySelectorAll('[data-set-lang]').forEach((b) => {
  b.addEventListener('click', () => { if (b.dataset.setLang !== lang) applyLang(b.dataset.setLang); });
});
if (lang === 'en') applyLang('en');
else root.removeAttribute('data-lang-pending');

/* ---------------- Navegacion ---------------- */
const nav = document.querySelector('[data-nav]');
if (nav) {
  // Fondo solido en cuanto se deja atras el principio de la pagina
  const sentinel = document.createElement('div');
  sentinel.setAttribute('aria-hidden', 'true');
  sentinel.style.cssText = 'position:absolute;top:0;left:0;width:1px;height:48px;pointer-events:none;';
  document.body.prepend(sentinel);
  new IntersectionObserver(([e]) => nav.classList.toggle('is-solid', !e.isIntersecting)).observe(sentinel);

  const toggle = nav.querySelector('[data-nav-toggle]');
  const links = nav.querySelector('.nav__links');
  const setOpen = (open) => {
    nav.classList.toggle('is-open', open);
    toggle?.setAttribute('aria-expanded', String(open));
  };
  toggle?.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
  links?.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && nav.classList.contains('is-open')) { setOpen(false); toggle?.focus(); }
  });
  document.addEventListener('click', (e) => {
    if (nav.classList.contains('is-open') && !nav.contains(e.target)) setOpen(false);
  });
}

/* ---------------- Reveal al entrar en pantalla ---------------- */
const revealEls = document.querySelectorAll('.reveal');
if ('IntersectionObserver' in window && !reduceMotion.matches) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add('is-in');
      io.unobserve(e.target);
    });
  }, { rootMargin: '0px 0px -6% 0px', threshold: 0.06 });
  revealEls.forEach((el) => io.observe(el));
} else {
  revealEls.forEach((el) => el.classList.add('is-in'));
}

/* ---------------- Indice activo del breakdown ---------------- */
const idxLinks = [...document.querySelectorAll('.bd-index a')];
if (idxLinks.length) {
  const byId = new Map(idxLinks.map((a) => [decodeURIComponent(a.hash.slice(1)), a]));
  const narrow = matchMedia('(max-width: 899px)');
  const inBand = new Set();
  let current = null;
  const spy = new IntersectionObserver((entries) => {
    entries.forEach((e) => (e.isIntersecting ? inBand.add(e.target.id) : inBand.delete(e.target.id)));
    // Las zonas estan dentro de Blocking: gana la entrada visible mas especifica (la ultima del indice)
    const link = idxLinks.filter((a) => inBand.has(decodeURIComponent(a.hash.slice(1)))).pop();
    if (!link || link === current) return;
    current = link;
    idxLinks.forEach((a) => a.removeAttribute('aria-current'));
    link.setAttribute('aria-current', 'true');
    if (narrow.matches) {
      const rail = link.closest('ol');
      rail?.scrollTo({ left: link.parentElement.offsetLeft - 16, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
    }
  }, { rootMargin: '-35% 0px -60% 0px' });
  byId.forEach((_, id) => { const s = document.getElementById(id); if (s) spy.observe(s); });
}

/* ---------------- Imagenes ausentes (util en local) ---------------- */
document.querySelectorAll('.g-item img, .card__media img, .plate__link img, .db__cover img').forEach((img) => {
  const mark = () => {
    const box = img.parentElement;
    box.classList.add('img-missing');
    box.dataset.missing = img.getAttribute('src');
  };
  if (img.complete && img.naturalWidth === 0 && img.getAttribute('src')) mark();
  else img.addEventListener('error', mark, { once: true });
});

/* ---------------- Visor (lightbox) ---------------- */
const groups = {};
document.querySelectorAll('[data-lb]').forEach((a) => {
  (groups[a.dataset.lb] ||= []).push(a);
});

if (Object.keys(groups).length) {
  const icon = (id) => `<svg class="icon" aria-hidden="true"><use href="${BASE}assets/icons.svg#i-${id}"></use></svg>`;
  const dlg = document.createElement('dialog');
  dlg.className = 'lb';
  dlg.innerHTML = `
    <div class="lb__stage">
      <img class="lb__img" alt="" decoding="async">
      <button class="lb__btn lb__prev" type="button">${icon('caret-left')}</button>
      <button class="lb__btn lb__next" type="button">${icon('caret-right')}</button>
    </div>
    <div class="lb__bar">
      <p class="lb__cap"></p>
      <p class="lb__count" aria-live="polite"></p>
    </div>
    <button class="lb__btn lb__close" type="button">${icon('x')}</button>`;
  document.body.append(dlg);

  const stage = dlg.querySelector('.lb__stage');
  const img = dlg.querySelector('.lb__img');
  const cap = dlg.querySelector('.lb__cap');
  const count = dlg.querySelector('.lb__count');
  const btnPrev = dlg.querySelector('.lb__prev');
  const btnNext = dlg.querySelector('.lb__next');
  const btnClose = dlg.querySelector('.lb__close');
  const state = { group: null, index: 0, trigger: null, token: 0 };

  // Original a resolucion completa solo si la pantalla lo aprovecha y no hay ahorro de datos
  const wantsFull = () => innerWidth * devicePixelRatio > 1800 && !navigator.connection?.saveData;

  const captionOf = (a) => {
    const im = a.querySelector('img');
    const text = a.dataset.cap
      || a.closest('figure')?.querySelector('figcaption')?.textContent.trim()
      || im?.alt || '';
    // En el blocking se recorren todas las zonas seguidas: el pie lleva el nombre de la zona
    const zone = a.closest('.bd-zone')?.querySelector('.bd-zone__title')?.textContent.trim();
    if (zone) return `${zone} · ${text}`;
    // Materiales: cada uno aparece dos veces en el visor (UE5 y ZBrush)
    const variant = a.dataset.variant && UI[lang][a.dataset.variant];
    return variant ? `${text} · ${variant}` : text;
  };

  function show(i) {
    const list = groups[state.group];
    const n = list.length;
    state.index = (i + n) % n;
    const a = list[state.index];
    const token = ++state.token;
    const md = a.dataset.md || a.href;

    cap.textContent = captionOf(a);
    img.alt = a.querySelector('img')?.alt || cap.textContent;
    count.textContent = `${state.index + 1} / ${n}`;
    dlg.toggleAttribute('data-single', n < 2);

    img.classList.add('is-loading');
    img.onload = img.onerror = () => { if (token === state.token) img.classList.remove('is-loading'); };
    img.src = md;

    if (wantsFull() && a.href !== new URL(md, location.href).href) {
      const hi = new Image();
      hi.src = a.href;
      hi.decode().then(() => { if (token === state.token) img.src = hi.src; }).catch(() => {});
    }
    // Precarga de vecinas
    [1, -1].forEach((d) => {
      const b = list[(state.index + d + n) % n];
      if (b && b !== a) new Image().src = b.dataset.md || b.href;
    });
  }

  function open(group, index, trigger) {
    const t = UI[lang];
    dlg.setAttribute('aria-label', t.viewer);
    btnClose.setAttribute('aria-label', t.close);
    btnPrev.setAttribute('aria-label', t.prev);
    btnNext.setAttribute('aria-label', t.next);
    state.group = group;
    state.trigger = trigger;
    show(index);
    root.classList.add('lb-open');
    dlg.showModal();
    btnClose.focus();
  }

  dlg.addEventListener('close', () => {
    root.classList.remove('lb-open');
    img.removeAttribute('src');
    state.trigger?.focus({ preventScroll: true });
  });
  btnClose.addEventListener('click', () => dlg.close());
  btnPrev.addEventListener('click', () => show(state.index - 1));
  btnNext.addEventListener('click', () => show(state.index + 1));
  dlg.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); show(state.index + 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); show(state.index - 1); }
  });
  // Clic fuera de la imagen cierra
  stage.addEventListener('click', (e) => { if (e.target === stage) dlg.close(); });

  // Swipe tactil
  let startX = null;
  stage.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') startX = e.clientX; });
  stage.addEventListener('pointerup', (e) => {
    if (startX === null) return;
    const dx = e.clientX - startX;
    startX = null;
    if (Math.abs(dx) > 50) show(state.index + (dx < 0 ? 1 : -1));
  });

  document.querySelectorAll('[data-lb]').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      open(a.dataset.lb, groups[a.dataset.lb].indexOf(a), a);
    });
  });
  document.querySelectorAll('[data-lb-open]').forEach((a) => {
    const [group, i] = a.dataset.lbOpen.split(':');
    a.addEventListener('click', (e) => {
      if (!groups[group]) return;
      e.preventDefault();
      open(group, Number(i) || 0, a);
    });
  });
}

/* ---------------- Materiales: vista UE5 / ZBrush ---------------- */
document.querySelectorAll('.view-toggle').forEach((group) => {
  const gallery = group.nextElementSibling;
  if (!gallery?.matches('[data-view]')) return;
  group.querySelectorAll('[data-set-view]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.setView;
      gallery.dataset.view = view;
      group.querySelectorAll('[data-set-view]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      // Solo la variante visible es enfocable y legible por lectores de pantalla
      gallery.querySelectorAll('[data-variant]').forEach((a) => {
        const visible = a.dataset.variant === view;
        if (visible) {
          a.removeAttribute('aria-hidden');
          a.removeAttribute('tabindex');
        } else {
          a.setAttribute('aria-hidden', 'true');
          a.setAttribute('tabindex', '-1');
        }
      });
    });
  });
});

/* ---------------- Video: fachada ligera de YouTube ---------------- */
document.querySelectorAll('[data-yt]').forEach((box) => {
  const id = box.dataset.yt.trim();
  if (!id) {
    box.classList.add('video--empty');
    box.innerHTML = `<p>${UI[lang].videoSoon}</p>`;
    return;
  }
  box.querySelector('.video__btn')?.addEventListener('click', () => {
    const f = document.createElement('iframe');
    f.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0`;
    f.title = box.dataset.ytTitle || 'YouTube';
    f.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    f.allowFullscreen = true;
    f.referrerPolicy = 'strict-origin-when-cross-origin';
    box.replaceChildren(f);
    f.focus();
  });
});

/* ---------------- Copiar email ---------------- */
document.querySelectorAll('[data-copy]').forEach((btn) => {
  const label = btn.querySelector('[data-copy-label]');
  const status = btn.parentElement.querySelector('[data-copy-status]');
  let timer;
  btn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(btn.dataset.copy);
    } catch {
      location.href = `mailto:${btn.dataset.copy}`;
      return;
    }
    btn.setAttribute('data-copied', '');
    if (label) label.textContent = UI[lang].copied;
    if (status) status.textContent = UI[lang].copiedStatus;
    clearTimeout(timer);
    timer = setTimeout(() => {
      btn.removeAttribute('data-copied');
      if (label) label.textContent = UI[lang].copy;
      if (status) status.textContent = '';
    }, 2200);
  });
});

/* ---------------- Ano del footer ---------------- */
document.querySelectorAll('[data-year]').forEach((el) => { el.textContent = String(new Date().getFullYear()); });

/* ---------------- Tilt sutil de la imagen del hero ---------------- */
const tilt = document.querySelector('[data-tilt]');
if (tilt && matchMedia('(hover: hover) and (pointer: fine)').matches && !reduceMotion.matches) {
  const hero = tilt.closest('.hero') || document.body;
  let raf = 0; let x = 0; let y = 0;
  hero.addEventListener('pointermove', (e) => {
    const r = hero.getBoundingClientRect();
    x = (e.clientX - r.left) / r.width - 0.5;
    y = (e.clientY - r.top) / r.height - 0.5;
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      tilt.style.setProperty('--ry', `${(x * 5).toFixed(2)}deg`);
      tilt.style.setProperty('--rx', `${(-y * 4).toFixed(2)}deg`);
    });
  });
  hero.addEventListener('pointerleave', () => {
    tilt.style.setProperty('--ry', '0deg');
    tilt.style.setProperty('--rx', '0deg');
  });
}

/* ---------------- Escena 3D del hero (carga diferida) ---------------- */
const sceneHost = document.querySelector('[data-hero-scene]');
if (sceneHost) setupHeroScene(sceneHost);

function canUse3D() {
  const conn = navigator.connection;
  if (conn?.saveData || /(^|-)2g$/.test(conn?.effectiveType || '')) return false;
  const coarse = matchMedia('(pointer: coarse)').matches;
  const mem = navigator.deviceMemory ?? 8;
  const cores = navigator.hardwareConcurrency ?? 8;
  // Movil de gama baja: nos quedamos con la imagen estatica
  if (coarse && (mem <= 3 || cores <= 4)) return false;
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

function setupHeroScene(host) {
  if (!canUse3D()) return;
  const mobile = matchMedia('(pointer: coarse)').matches || innerWidth < 900;
  let started = false;
  const start = () => {
    if (started) return;
    started = true;
    import('./hero-scene.js')
      .then((m) => m.initHeroScene(host, { reducedMotion: reduceMotion.matches, mobile }))
      .catch((err) => console.warn('[hero] Escena 3D desactivada, se mantiene el fallback:', err));
  };

  if (mobile) {
    // En movil la escena espera a la primera interaccion: no compite con la carga inicial
    const events = ['pointerdown', 'touchstart', 'scroll', 'keydown', 'wheel'];
    const once = () => { events.forEach((ev) => removeEventListener(ev, once)); start(); };
    events.forEach((ev) => addEventListener(ev, once, { passive: true }));
  } else {
    const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 200));
    const go = () => idle(start, { timeout: 2500 });
    if (document.readyState === 'complete') go();
    else addEventListener('load', go, { once: true });
  }
}
