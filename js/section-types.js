// Registry der Baukasten-Sektionstypen: teilt Feld-Schema (für das
// Bearbeitungs-Panel in edit-mode.js) und Render-Funktion (für sections.js)
// aus einer einzigen Quelle, damit beide immer zueinander passen.
(function (global) {
  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function esc(str) { return escapeHtml(str); }

  function paragraphs(text) {
    return String(text || '')
      .split(/\n\s*\n/)
      .map(function (p) { return p.trim(); })
      .filter(Boolean)
      .map(function (p) { return '<p>' + esc(p).replace(/\n/g, '<br>') + '</p>'; })
      .join('');
  }

  function btn(label, href, outline) {
    if (!label) return '';
    return '<a href="' + esc(href || '#') + '" class="btn' + (outline ? ' btn-outline' : '') + '">' + esc(label) + '</a>';
  }

  var TYPES = {
    'hero-photo': {
      label: 'Foto-Hero',
      defaultData: function () {
        return {
          image: 'assets/hero-fruit-linen.jpg',
          eyebrow: 'CB — Bewusst essen. Gesund leben.',
          quote: '«Neue Sektion»',
          title: 'Neue Überschrift',
          text: 'Beschreibungstext …',
          cta_primary_label: 'Kontakt aufnehmen',
          cta_primary_href: 'kontakt.html',
          cta_secondary_label: '',
          cta_secondary_href: '',
        };
      },
      fields: [
        { key: 'image', label: 'Hintergrundbild', type: 'image' },
        { key: 'eyebrow', label: 'Eyebrow', type: 'text' },
        { key: 'quote', label: 'Zitat', type: 'text' },
        { key: 'title', label: 'Titel', type: 'text' },
        { key: 'text', label: 'Text', type: 'textarea' },
        { key: 'cta_primary_label', label: 'Button 1 Text', type: 'text' },
        { key: 'cta_primary_href', label: 'Button 1 Link', type: 'text' },
        { key: 'cta_secondary_label', label: 'Button 2 Text', type: 'text' },
        { key: 'cta_secondary_href', label: 'Button 2 Link', type: 'text' },
      ],
      render: function (d) {
        return (
          '<section class="hero-photo">' +
          '<img class="hero-photo-img" src="' + esc(d.image) + '" alt="">' +
          '<div class="hero-photo-overlay"></div>' +
          '<div class="wrap hero-photo-content">' +
          (d.eyebrow ? '<div class="eyebrow" data-reveal>' + esc(d.eyebrow) + '</div>' : '') +
          (d.quote ? '<p class="hero-quote" data-reveal>' + esc(d.quote) + '</p>' : '') +
          '<h1 data-reveal>' + esc(d.title) + '</h1>' +
          (d.text ? '<p data-reveal>' + esc(d.text) + '</p>' : '') +
          '<div class="cta-row" data-reveal>' + btn(d.cta_primary_label, d.cta_primary_href, false) + btn(d.cta_secondary_label, d.cta_secondary_href, true) + '</div>' +
          '</div></section>'
        );
      },
    },

    'text-hero': {
      label: 'Text-Hero (Seiten-Header)',
      defaultData: function () {
        return { eyebrow: 'Neue Seite', title: 'Neue Überschrift', text: 'Beschreibungstext …', emphasis: false };
      },
      fields: [
        { key: 'eyebrow', label: 'Eyebrow', type: 'text' },
        { key: 'title', label: 'Titel', type: 'text' },
        { key: 'text', label: 'Text', type: 'textarea' },
        { key: 'emphasis', label: 'Text als Zitat hervorheben', type: 'checkbox' },
      ],
      render: function (d) {
        return (
          '<section class="hero" style="padding-bottom:20px;">' +
          '<div class="wrap" style="display:block; max-width:760px;" data-reveal>' +
          '<div class="eyebrow">' + esc(d.eyebrow) + '</div>' +
          '<h1>' + esc(d.title) + '</h1>' +
          (d.text ? '<p class="' + (d.emphasis ? 'hero-quote' : '') + '">' + esc(d.text) + '</p>' : '') +
          '</div></section>'
        );
      },
    },

    'split-image-text': {
      label: 'Text + Bild',
      defaultData: function () {
        return {
          image: 'assets/portrait.png',
          side: 'left',
          eyebrow: '',
          title: 'Neue Überschrift',
          text: 'Text …',
          links: [{ label: 'Mehr erfahren →', href: '#', style: 'link' }],
        };
      },
      fields: [
        { key: 'image', label: 'Bild', type: 'image' },
        { key: 'side', label: 'Bild-Position', type: 'select', options: [{ value: 'left', label: 'Links' }, { value: 'right', label: 'Rechts' }] },
        { key: 'eyebrow', label: 'Eyebrow', type: 'text' },
        { key: 'title', label: 'Titel', type: 'text' },
        { key: 'text', label: 'Text (Absätze mit Leerzeile trennen)', type: 'textarea' },
        {
          key: 'links', label: 'Buttons/Links', type: 'items',
          itemFields: [
            { key: 'label', label: 'Text', type: 'text' },
            { key: 'href', label: 'Link', type: 'text' },
            { key: 'style', label: 'Stil', type: 'select', options: [{ value: 'link', label: 'Textlink' }, { value: 'btn', label: 'Button' }, { value: 'btn-outline', label: 'Button (Outline)' }] },
          ],
          defaultItem: function () { return { label: 'Mehr erfahren →', href: '#', style: 'link' }; },
        },
      ],
      render: function (d) {
        var img = '<div data-reveal style="position:relative; max-width:320px; margin:0 auto;">' +
          '<img src="' + esc(d.image) + '" alt="" style="border-radius:8px;">' +
          '</div>';
        var links = (d.links || []).map(function (l) {
          if (l.style === 'link') return '<a href="' + esc(l.href) + '">' + esc(l.label) + '</a>';
          return btn(l.label, l.href, l.style === 'btn-outline');
        }).join(' ');
        var hasButtons = (d.links || []).some(function (l) { return l.style !== 'link'; });
        var text = '<div data-reveal>' +
          (d.eyebrow ? '<div class="eyebrow">' + esc(d.eyebrow) + '</div>' : '') +
          '<h2>' + esc(d.title) + '</h2>' +
          paragraphs(d.text) +
          (hasButtons ? '<div class="cta-row">' + links + '</div>' : links) +
          '</div>';
        return (
          '<section class="alt"><div class="wrap about-grid">' +
          (d.side === 'right' ? text + img : img + text) +
          '</div></section>'
        );
      },
    },

    'card-grid': {
      label: 'Karten-Grid',
      defaultData: function () {
        return {
          eyebrow: '', title: 'Neue Überschrift',
          cards: [
            { title: 'Karte 1', text: 'Beschreibung …', link_label: '', link_href: '' },
            { title: 'Karte 2', text: 'Beschreibung …', link_label: '', link_href: '' },
          ],
        };
      },
      fields: [
        { key: 'eyebrow', label: 'Eyebrow', type: 'text' },
        { key: 'title', label: 'Titel', type: 'text' },
        {
          key: 'cards', label: 'Karten', type: 'items',
          itemFields: [
            { key: 'title', label: 'Titel', type: 'text' },
            { key: 'text', label: 'Text', type: 'textarea' },
            { key: 'link_label', label: 'Link-Text', type: 'text' },
            { key: 'link_href', label: 'Link-Ziel', type: 'text' },
          ],
          defaultItem: function () { return { title: 'Neue Karte', text: '', link_label: '', link_href: '' }; },
        },
      ],
      render: function (d) {
        var cards = (d.cards || []).map(function (c) {
          return '<div class="card">' +
            (c.title ? '<h3>' + esc(c.title) + '</h3>' : '') +
            (c.text ? '<p>' + esc(c.text) + '</p>' : '') +
            (c.link_label ? '<a href="' + esc(c.link_href) + '">' + esc(c.link_label) + '</a>' : '') +
            '</div>';
        }).join('');
        return (
          '<section><div class="wrap">' +
          ((d.eyebrow || d.title) ? '<div class="section-head" data-reveal>' + (d.eyebrow ? '<div class="eyebrow">' + esc(d.eyebrow) + '</div>' : '') + '<h2>' + esc(d.title) + '</h2></div>' : '') +
          '<div class="grid-3" data-reveal-group>' + cards + '</div>' +
          '</div></section>'
        );
      },
    },

    'cta-band': {
      label: 'CTA-Banner (Fotoband)',
      defaultData: function () {
        return { image: 'assets/basil-bowl.jpg', title: 'Bereit für den ersten Schritt?', text: 'Beschreibungstext …', button_label: 'Kontakt aufnehmen', button_href: 'kontakt.html' };
      },
      fields: [
        { key: 'image', label: 'Hintergrundbild', type: 'image' },
        { key: 'title', label: 'Titel', type: 'text' },
        { key: 'text', label: 'Text', type: 'textarea' },
        { key: 'button_label', label: 'Button-Text', type: 'text' },
        { key: 'button_href', label: 'Button-Ziel', type: 'text' },
      ],
      render: function (d) {
        return (
          '<section class="photo-band">' +
          '<img class="photo-band-img" src="' + esc(d.image) + '" alt="" aria-hidden="true">' +
          '<div class="photo-band-overlay"></div>' +
          '<div class="wrap" style="text-align:center; max-width:640px;" data-reveal>' +
          '<h2>' + esc(d.title) + '</h2>' +
          (d.text ? '<p>' + esc(d.text) + '</p>' : '') +
          btn(d.button_label, d.button_href, false) +
          '</div></section>'
        );
      },
    },

    'topic-list': {
      label: 'Themen-Liste',
      defaultData: function () {
        return { title: '', items: ['Thema 1', 'Thema 2'], footer_text: '' };
      },
      fields: [
        { key: 'title', label: 'Titel (optional)', type: 'text' },
        { key: 'items', label: 'Themen', type: 'strings', defaultItem: function () { return 'Neues Thema'; } },
        { key: 'footer_text', label: 'Text darunter (optional)', type: 'textarea' },
      ],
      render: function (d) {
        var items = (d.items || []).map(function (i) { return '<li>' + esc(i) + '</li>'; }).join('');
        return (
          '<section><div class="wrap" style="max-width:760px;" data-reveal>' +
          (d.title ? '<h2>' + esc(d.title) + '</h2>' : '') +
          '<ul class="topic-list">' + items + '</ul>' +
          (d.footer_text ? '<p>' + esc(d.footer_text) + '</p>' : '') +
          '</div></section>'
        );
      },
    },

    'pricing-table': {
      label: 'Preistabelle',
      defaultData: function () {
        return {
          title: 'Preise',
          rows: [{ label: 'Leistung', note: '', price: 'CHF 0.–', highlight: false }],
          note_below: '',
        };
      },
      fields: [
        { key: 'title', label: 'Titel', type: 'text' },
        {
          key: 'rows', label: 'Preiszeilen', type: 'items',
          itemFields: [
            { key: 'label', label: 'Leistung', type: 'text' },
            { key: 'note', label: 'Notiz (optional)', type: 'text' },
            { key: 'price', label: 'Preis', type: 'text' },
            { key: 'highlight', label: 'Als "Beliebt" markieren', type: 'checkbox' },
          ],
          defaultItem: function () { return { label: 'Neue Leistung', note: '', price: 'CHF 0.–', highlight: false }; },
        },
        { key: 'note_below', label: 'Hinweistext darunter (optional)', type: 'textarea' },
      ],
      render: function (d) {
        var rows = (d.rows || []).map(function (r) {
          var badge = r.highlight ? ' <span class="badge-popular">Beliebt</span>' : '';
          var note = '';
          if (r.note && r.note.indexOf('\n') !== -1) {
            note = '<ul class="price-note-list">' + r.note.split('\n').map(function (l) { return l.trim(); }).filter(Boolean).map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('') + '</ul>';
          } else if (r.note) {
            note = ' — <em>' + esc(r.note) + '</em>';
          }
          return '<tr' + (r.highlight ? ' class="row-highlight"' : '') + '><td>' + esc(r.label) + badge + note + '</td><td class="amount">' + esc(r.price) + '</td></tr>';
        }).join('');
        return (
          '<section class="alt"><div class="wrap" style="max-width:760px;" data-reveal>' +
          (d.title ? '<h2>' + esc(d.title) + '</h2>' : '') +
          '<div class="table-scroll"><table class="price-table"><tbody>' + rows + '</tbody></table></div>' +
          (d.note_below ? '<p style="margin-top:18px; font-size:0.92rem; font-style:italic; color:rgba(58,51,44,0.75);">' + esc(d.note_below) + '</p>' : '') +
          '</div></section>'
        );
      },
    },

    testimonial: {
      label: 'Zitat / Testimonial',
      defaultData: function () {
        return { quote: 'Ein tolles Zitat einer zufriedenen Kundin.', name: 'Name', role: '' };
      },
      fields: [
        { key: 'quote', label: 'Zitat', type: 'textarea' },
        { key: 'name', label: 'Name', type: 'text' },
        { key: 'role', label: 'Rolle/Zusatz (optional)', type: 'text' },
      ],
      render: function (d) {
        return (
          '<section class="alt"><div class="wrap" style="max-width:680px; text-align:center;" data-reveal>' +
          '<div class="card" style="text-align:left; border-top-color:var(--color-lavender);">' +
          '<p class="hero-quote" style="margin-bottom:14px;">«' + esc(d.quote) + '»</p>' +
          '<p style="margin:0; font-weight:700;">' + esc(d.name) + (d.role ? '<span style="font-weight:400; color:rgba(58,51,44,0.65);"> — ' + esc(d.role) + '</span>' : '') + '</p>' +
          '</div></div></section>'
        );
      },
    },

    gallery: {
      label: 'Bildergalerie',
      defaultData: function () {
        return { title: '', images: [] };
      },
      fields: [
        { key: 'title', label: 'Titel (optional)', type: 'text' },
        {
          key: 'images', label: 'Bilder', type: 'items',
          itemFields: [
            { key: 'src', label: 'Bild', type: 'image' },
            { key: 'alt', label: 'Alt-Text', type: 'text' },
          ],
          defaultItem: function () { return { src: 'assets/herbs-wood.jpg', alt: '' }; },
        },
      ],
      render: function (d) {
        var imgs = (d.images || []).map(function (i) {
          return '<div class="img-frame"><img src="' + esc(i.src) + '" alt="' + esc(i.alt) + '"></div>';
        }).join('');
        return (
          '<section><div class="wrap">' +
          (d.title ? '<div class="section-head" data-reveal><h2>' + esc(d.title) + '</h2></div>' : '') +
          '<div class="gallery-grid" data-reveal-group>' + imgs + '</div>' +
          '</div></section>'
        );
      },
    },
  };

  global.CB_SECTION_TYPES = TYPES;
  global.CB_SECTION_TYPE_ORDER = ['hero-photo', 'text-hero', 'split-image-text', 'card-grid', 'cta-band', 'topic-list', 'pricing-table', 'testimonial', 'gallery'];
  global.CB_escapeHtml = escapeHtml;
})(window);
