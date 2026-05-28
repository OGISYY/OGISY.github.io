/* ================================================================
   ANDREU SUREDA — PORTFOLIO  |  main.js
   ================================================================ */


/* ── LANGUAGE SYSTEM ─────────────────────────────────────────────── */
(function () {
  const KEY = 'portfolio_lang';

  window.setLang = function (lang) {
    document.body.classList.toggle('lang-en', lang === 'en');
    document.body.classList.toggle('lang-es', lang !== 'en');
    document.querySelectorAll('.lang-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.lang === lang);
    });
    localStorage.setItem(KEY, lang);
  };

  const saved = localStorage.getItem(KEY) || 'es';
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.setLang(saved));
  } else {
    window.setLang(saved);
  }
})();

/* ── NAV — scroll background ─────────────────────────────────────── */
(function () {
  const nav = document.querySelector('nav');
  if (!nav) return;
  const update = () => nav.classList.toggle('scrolled', window.scrollY > 60);
  window.addEventListener('scroll', update, { passive: true });
  update();
})();

/* ── SMOOTH SCROLL ───────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', e => {
      const id = link.getAttribute('href');
      const target = document.querySelector(id);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
});

/* ── DEMON'S BELL — SUBNAV TABS ──────────────────────────────────── */
document.addEventListener('DOMContentLoaded', function () {
  const subnav = document.querySelector('.subnav');
  if (!subnav) return;

  const tabs    = subnav.querySelectorAll('.subnav-tab');
  const sections = [];

  tabs.forEach(tab => {
    const target = document.querySelector(tab.dataset.target);
    if (target) sections.push({ tab, target });

    tab.addEventListener('click', () => {
      target && target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  if (!sections.length) return;

  const NAV_H    = 64;
  const SUBNAV_H = 44;
  const OFFSET   = NAV_H + SUBNAV_H + 20;

  function updateActive() {
    let active = sections[0];
    sections.forEach(({ tab, target }) => {
      if (target.getBoundingClientRect().top <= OFFSET + 10) active = { tab, target };
    });
    tabs.forEach(t => t.classList.remove('active'));
    active.tab.classList.add('active');
  }

  window.addEventListener('scroll', updateActive, { passive: true });
  updateActive();
});

/* ── CAROUSEL ────────────────────────────────────────────────────── */
/* Para añadir imágenes: duplica un <div class="carousel-slide"> en  */
/* el HTML y añade un <button class="carousel-dot"> en carousel-dots */
document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('.carousel-wrap').forEach(wrap => {
    const track   = wrap.querySelector('.carousel-track');
    const slides  = wrap.querySelectorAll('.carousel-slide');
    const dots    = wrap.querySelectorAll('.carousel-dot');
    const counter = wrap.querySelector('.carousel-counter');
    const total   = slides.length;
    if (!total) return;

    let current = 0;

    function goTo(n) {
      current = (n + total) % total;
      track.style.transform = `translateX(-${current * 100}%)`;
      dots.forEach((d, i) => d.classList.toggle('active', i === current));
      if (counter) counter.textContent = `${current + 1} / ${total}`;
    }

    wrap.querySelector('.carousel-btn-prev')?.addEventListener('click', () => goTo(current - 1));
    wrap.querySelector('.carousel-btn-next')?.addEventListener('click', () => goTo(current + 1));
    dots.forEach((d, i) => d.addEventListener('click', () => goTo(i)));

    let startX = 0;
    track.addEventListener('pointerdown', e => { startX = e.clientX; });
    track.addEventListener('pointerup',   e => {
      const diff = startX - e.clientX;
      if (Math.abs(diff) > 40) goTo(diff > 0 ? current + 1 : current - 1);
    });

    goTo(0);
  });
});

/* ── SCROLL REVEAL ───────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', function () {
  const els = document.querySelectorAll(
    '.experience-item, .skill-category, .gallery-item, .project-card, .feature-item, .tiles-grid, .callout, .video-item'
  );
  els.forEach(el => el.classList.add('reveal'));

  const io = new IntersectionObserver(
    entries => entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); }
    }),
    { threshold: 0.1 }
  );
  els.forEach(el => io.observe(el));
});
