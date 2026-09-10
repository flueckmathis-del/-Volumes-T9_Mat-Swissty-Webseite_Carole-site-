(function () {
  var container = null;

  function renderSections(sections) {
    if (!container) return;
    container.innerHTML = '';
    sections.forEach(function (section) {
      var def = window.CB_SECTION_TYPES[section.type];
      if (!def) return; // unbekannter Typ (z.B. aus einer neueren Version) -> überspringen
      var wrap = document.createElement('div');
      try {
        wrap.innerHTML = def.render(section.data || {});
      } catch (err) {
        return;
      }
      var el = wrap.firstElementChild;
      if (!el) return;
      el.classList.add('cb-section');
      el.setAttribute('data-section-id', section.id);
      el.setAttribute('data-section-type', section.type);
      // Optionales Sprungmarken-Ziel (z.B. für Links wie "...html#alltag"),
      // unabhängig vom Sektionstyp — einfach als "anchor"-Feld in den Daten.
      if (section.data && section.data.anchor) el.id = section.data.anchor;
      container.appendChild(el);
    });
    if (window.CBMain) {
      window.CBMain.initHeroPhotoHeader();
      window.CBMain.initReveal(container);
    }
  }

  function load() {
    var page = document.body.getAttribute('data-content');
    if (!page || !container) return Promise.resolve([]);
    return fetch('/.netlify/functions/sections?page=' + encodeURIComponent(page), { cache: 'no-store' })
      .then(function (res) { return res.ok ? res.json() : { sections: [] }; })
      .then(function (data) {
        var sections = data.sections || [];
        renderSections(sections);
        // Sektionen kommen erst jetzt in den DOM — der Browser konnte einen
        // #anchor in der URL beim initialen Laden also noch nicht anspringen.
        if (location.hash) {
          var target = document.getElementById(location.hash.slice(1));
          // behavior:'instant' statt der CSS-weiten scroll-behavior:smooth —
          // ein initialer Sprung zur Sprungmarke soll wie beim nativen
          // Browser-Verhalten sofort passieren, nicht animiert.
          if (target) target.scrollIntoView({ behavior: 'instant', block: 'start' });
        }
        document.dispatchEvent(new CustomEvent('cms:sections-loaded', { detail: { page: page, sections: sections } }));
        return sections;
      })
      .catch(function () { return []; });
  }

  document.addEventListener('DOMContentLoaded', function () {
    container = document.getElementById('page-sections');
    load();
  });

  // Für edit-mode.js: nach Hinzufügen/Ändern/Löschen/Umsortieren einfach
  // neu laden, damit Baukasten-Rendering und Bearbeitungsmodus nie
  // auseinanderlaufen.
  window.CBSections = { reload: load };
})();
