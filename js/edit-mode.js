(function () {
  var params = new URLSearchParams(location.search);
  if (!params.has('cms_edit')) return;

  var API = '/.netlify/functions/';
  var SETTINGS_KEYS = [
    'brand_name', 'brand_short', 'footer_tagline',
    'address_name', 'address_street', 'address_city', 'address_line',
    'phone_display', 'phone_link', 'email',
    'footer_legal_note', 'copyright',
  ];

  var ASSET_OPTIONS = [
    'assets/portrait.png',
    'assets/logo.png',
    'assets/hero-fruit-linen.jpg',
    'assets/herbs-wood.jpg',
    'assets/basil-bowl.jpg',
  ];

  function api(path, options) {
    return fetch(API + path, Object.assign({ credentials: 'same-origin' }, options || {})).then(function (res) {
      return res.json().then(function (data) {
        if (!res.ok) throw new Error(data.error || 'Fehler.');
        return data;
      });
    });
  }

  // Registered synchronously so the event can never fire before we're
  // listening; init() itself waits until the (async) auth check is also
  // done, whichever of the two finishes last.
  var pendingContent = null;
  var isAuthed = false;
  var authChecked = false;

  document.addEventListener('cms:content-loaded', function (e) {
    pendingContent = e.detail;
    maybeInit();
  }, { once: true });

  api('admin-me').then(function (me) {
    isAuthed = !!me.authenticated;
    authChecked = true;
    maybeInit();
  }).catch(function () {
    authChecked = true;
    maybeInit();
  });

  function maybeInit() {
    if (authChecked && isAuthed && pendingContent) {
      init(pendingContent.page, pendingContent.data);
    }
  }

  function init(pageKey, originalData) {
    var changes = {};

    injectStyles();
    var bar = buildToolbar();
    document.body.appendChild(bar);

    document.querySelectorAll('[data-k]').forEach(function (el) {
      var key = el.getAttribute('data-k');
      el.classList.add('cms-editable');
      el.setAttribute('contenteditable', 'true');
      el.setAttribute('spellcheck', 'false');
      el.addEventListener('focus', function () { el.classList.add('cms-focused'); });
      el.addEventListener('blur', function () {
        el.classList.remove('cms-focused');
        var val = el.textContent.trim();
        if (val !== String(originalData[key] || '')) {
          changes[key] = val;
          el.classList.add('cms-dirty');
        }
      });
    });

    document.querySelectorAll('[data-k-src]').forEach(function (imgEl) {
      var key = imgEl.getAttribute('data-k-src');
      imgEl.classList.add('cms-editable-img');
      imgEl.addEventListener('click', function (ev) {
        ev.preventDefault();
        openAssetPicker(imgEl, function (chosen) {
          imgEl.setAttribute('src', chosen);
          changes[key] = chosen;
          imgEl.classList.add('cms-dirty');
        });
      });
    });

    document.querySelectorAll('[data-list]').forEach(function (listEl) {
      var note = document.createElement('div');
      note.className = 'cms-list-note';
      note.textContent = 'Listen/Preise bitte im Admin-Tab „Inhalte → Erweitert“ bearbeiten.';
      listEl.parentNode.insertBefore(note, listEl.nextSibling);
    });

    var saveBtn = bar.querySelector('.cms-save');
    var statusEl = bar.querySelector('.cms-status');

    saveBtn.addEventListener('click', function () {
      var settingsChanges = {};
      var pageChanges = {};
      var any = false;
      Object.keys(changes).forEach(function (key) {
        any = true;
        if (SETTINGS_KEYS.indexOf(key) !== -1) settingsChanges[key] = changes[key];
        else pageChanges[key] = changes[key];
      });
      if (!any) {
        statusEl.textContent = 'Keine Änderungen.';
        return;
      }
      statusEl.textContent = 'Speichert …';

      var tasks = [];
      if (Object.keys(settingsChanges).length) {
        tasks.push(
          api('admin-content?page=settings').then(function (current) {
            return api('admin-content', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ page: 'settings', data: Object.assign({}, current, settingsChanges) }),
            });
          })
        );
      }
      if (pageKey && Object.keys(pageChanges).length) {
        tasks.push(
          api('admin-content?page=' + encodeURIComponent(pageKey)).then(function (current) {
            return api('admin-content', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ page: pageKey, data: Object.assign({}, current, pageChanges) }),
            });
          })
        );
      }

      Promise.all(tasks).then(function () {
        Object.assign(originalData, changes);
        changes = {};
        document.querySelectorAll('.cms-dirty').forEach(function (el) { el.classList.remove('cms-dirty'); });
        statusEl.textContent = 'Gespeichert ✓';
        setTimeout(function () { statusEl.textContent = ''; }, 2500);
      }).catch(function (err) {
        statusEl.textContent = 'Fehler: ' + err.message;
      });
    });
  }

  function openAssetPicker(imgEl, onChoose) {
    var existing = document.querySelector('.cms-asset-popover');
    if (existing) existing.remove();

    var pop = document.createElement('div');
    pop.className = 'cms-asset-popover';
    ASSET_OPTIONS.forEach(function (src) {
      var thumb = document.createElement('img');
      thumb.src = src;
      thumb.addEventListener('click', function () {
        onChoose(src);
        pop.remove();
      });
      pop.appendChild(thumb);
    });
    var close = document.createElement('button');
    close.textContent = 'Abbrechen';
    close.className = 'cms-asset-cancel';
    close.addEventListener('click', function () { pop.remove(); });
    pop.appendChild(close);

    document.body.appendChild(pop);
    var rect = imgEl.getBoundingClientRect();
    pop.style.top = (window.scrollY + rect.bottom + 8) + 'px';
    pop.style.left = (window.scrollX + rect.left) + 'px';
  }

  function buildToolbar() {
    var bar = document.createElement('div');
    bar.className = 'cms-toolbar';
    bar.innerHTML =
      '<span class="cms-toolbar-label">✎ Bearbeitungsmodus — klicke auf einen Text, um ihn zu ändern</span>' +
      '<span class="cms-status"></span>' +
      '<button type="button" class="cms-save">Speichern</button>';
    return bar;
  }

  function injectStyles() {
    var style = document.createElement('style');
    style.textContent =
      '.cms-editable{outline:2px dashed transparent; outline-offset:3px; transition:outline-color .15s ease; cursor:text; border-radius:3px;}' +
      '.cms-editable:hover{outline-color:rgba(124,107,135,0.6);}' +
      '.cms-focused{outline-color:#826C4F !important; outline-style:solid !important; background:rgba(130,108,79,0.06);}' +
      '.cms-dirty{background:rgba(111,121,85,0.12);}' +
      '.cms-editable-img{cursor:pointer; outline:2px dashed rgba(124,107,135,0.5); outline-offset:2px;}' +
      '.cms-list-note{font-size:0.78rem; font-style:italic; color:#826C4F; background:rgba(130,108,79,0.08); padding:6px 10px; border-radius:4px; margin:6px 0;}' +
      '.cms-toolbar{position:fixed; left:0; right:0; bottom:0; z-index:9999; background:#3A332C; color:#fff; padding:12px 20px; display:flex; align-items:center; gap:16px; font-family:Karla,sans-serif; font-size:0.88rem; box-shadow:0 -6px 20px rgba(0,0,0,0.2);}' +
      '.cms-toolbar-label{flex:1;}' +
      '.cms-save{background:#826C4F; color:#fff; border:none; padding:9px 20px; border-radius:5px; font-weight:700; cursor:pointer; font-family:Karla,sans-serif;}' +
      '.cms-save:hover{background:#6B5840;}' +
      '.cms-status{opacity:0.85;}' +
      '.cms-asset-popover{position:absolute; z-index:10000; background:#fff; border:1px solid rgba(0,0,0,0.15); border-radius:8px; padding:10px; display:flex; gap:8px; flex-wrap:wrap; max-width:320px; box-shadow:0 10px 30px rgba(0,0,0,0.2);}' +
      '.cms-asset-popover img{width:70px; height:70px; object-fit:cover; border-radius:4px; cursor:pointer; border:2px solid transparent;}' +
      '.cms-asset-popover img:hover{border-color:#826C4F;}' +
      '.cms-asset-cancel{flex-basis:100%; background:none; border:1px solid rgba(0,0,0,0.15); border-radius:4px; padding:6px; cursor:pointer;}';
    document.head.appendChild(style);
  }
})();
