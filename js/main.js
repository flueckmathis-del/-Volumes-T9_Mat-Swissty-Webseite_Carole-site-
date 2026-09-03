document.addEventListener('DOMContentLoaded', function () {
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.querySelector('.main-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      nav.classList.toggle('open');
    });
  }

  // Transparenter Header über dem Foto-Hero, wird beim Scrollen solide.
  var header = document.querySelector('.site-header');
  var heroPhoto = document.querySelector('.hero-photo');
  if (header && heroPhoto) {
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

  // Scroll-Reveal-Animationen.
  var revealTargets = document.querySelectorAll('[data-reveal], [data-reveal-group]');
  if (revealTargets.length) {
    if ('IntersectionObserver' in window) {
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
      revealTargets.forEach(function (el) { observer.observe(el); });
    } else {
      revealTargets.forEach(function (el) { el.classList.add('is-visible'); });
    }
  }
});
