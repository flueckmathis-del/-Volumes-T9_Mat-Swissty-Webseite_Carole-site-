// Sektionen (js/sections.js) werden erst NACH DOMContentLoaded asynchron
// nachgeladen und in #page-sections eingefügt. Reveal-Animationen und die
// "Header transparent über Foto-Hero"-Logik hängen an Elementen, die zu
// diesem Zeitpunkt noch gar nicht existieren — deshalb als wiederverwendbare
// Funktionen exportiert, damit sections.js sie nach dem Rendern erneut
// aufrufen kann.
function cbInitHeroPhotoHeader() {
  var header = document.querySelector('.site-header');
  var heroPhoto = document.querySelector('.hero-photo');
  if (header && heroPhoto && !header.classList.contains('has-hero-photo')) {
    header.classList.add('has-hero-photo');
    var updateHeaderState = function () {
      if (window.scrollY < heroPhoto.offsetHeight - 80) {
        header.classList.add('at-top');
      } else {
        header.classList.remove('at-top');
      }
    };
    updateHeaderState();
    window.addEventListener('scroll', updateHeaderState, { passive: true });
  }
}

function cbInitReveal(root) {
  var revealTargets = (root || document).querySelectorAll('[data-reveal]:not(.cb-reveal-bound), [data-reveal-group]:not(.cb-reveal-bound)');
  if (!revealTargets.length) return;
  if ('IntersectionObserver' in window) {
    if (!cbInitReveal._observer) {
      cbInitReveal._observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            cbInitReveal._observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
    }
    revealTargets.forEach(function (el) {
      el.classList.add('cb-reveal-bound');
      cbInitReveal._observer.observe(el);
    });
  } else {
    revealTargets.forEach(function (el) {
      el.classList.add('cb-reveal-bound', 'is-visible');
    });
  }
}

window.CBMain = { initReveal: cbInitReveal, initHeroPhotoHeader: cbInitHeroPhotoHeader };

document.addEventListener('DOMContentLoaded', function () {
  // Sanftes Einblenden der Seite.
  requestAnimationFrame(function () {
    document.body.classList.add('is-loaded');
  });

  var toggle = document.querySelector('.nav-toggle');
  var nav = document.querySelector('.main-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      nav.classList.toggle('open');
      toggle.classList.toggle('open');
    });
  }

  cbInitHeroPhotoHeader();
  cbInitReveal(document);

  // "Nach oben"-Button.
  var backToTop = document.createElement('button');
  backToTop.className = 'back-to-top';
  backToTop.setAttribute('aria-label', 'Nach oben scrollen');
  backToTop.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></svg>';
  document.body.appendChild(backToTop);
  backToTop.addEventListener('click', function () {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  var updateBackToTop = function () {
    if (window.scrollY > 700) {
      backToTop.classList.add('visible');
    } else {
      backToTop.classList.remove('visible');
    }
  };
  updateBackToTop();
  window.addEventListener('scroll', updateBackToTop, { passive: true });

  // Anonyme Seitenaufruf-Statistik (keine Cookies, keine personenbezogenen
  // Daten) — nur Seitenname + Datum werden gezählt, sichtbar unter /admin.
  var pageName = location.pathname.split('/').pop() || 'index.html';
  fetch('/.netlify/functions/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ page: pageName }),
  }).catch(function () {});
});
