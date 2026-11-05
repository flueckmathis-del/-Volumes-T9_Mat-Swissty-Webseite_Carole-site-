(function () {
  var params = new URLSearchParams(location.search);
  if (!params.has('cms_edit')) return;

  var API = '/.netlify/functions/';
  var esc = window.CB_escapeHtml || function (s) { return String(s); };

  // Übriggebliebene, seitenweite Felder (Header/Footer) — alles andere lebt
  // jetzt als Sektion in der SQL-Datenbank, siehe section-types.js/sections.js.
  var SETTINGS_KEYS = [
    'brand_name', 'brand_short', 'footer_tagline',
    'address_name', 'address_street', 'address_city', 'address_line',
    'phone_display', 'phone_link', 'email',
    'footer_legal_note', 'copyright',
  ];

  var ASSET_OPTIONS = [
    'assets/portrait.png',
    'assets/logo.png',
    'assets/bodyelements-logo.png',
    'assets/hero-fruit-linen.jpg',
    'assets/herbs-wood.jpg',
    'assets/basil-bowl.jpg',
  ];

  function apiRaw(path, options) {
    return fetch(API + path, Object.assign({ credentials: 'same-origin', cache: 'no-store' }, options || {})).then(function (res) {
      return res.json().then(function (data) { return { ok: res.ok, data: data }; });
    });
  }

  function api(path, options) {
    return apiRaw(path, options).then(function (result) {
      if (!result.ok) throw new Error((result.data && result.data.error) || 'Fehler.');
      return result.data;
    });
  }

  var isAuthed = false;
  var authChecked = false;
  var pendingSettings = null;
  var pendingSections = null;

  document.addEventListener('cms:content-loaded', function (e) {
    pendingSettings = e.detail;
    maybeInit();
  }, { once: true });

  document.addEventListener('cms:sections-loaded', function (e) {
    pendingSections = e.detail;
    maybeInitSections();
    // Sections werden bei jedem Reload neu gerendert (siehe sections.js) —
    // deshalb hier nicht { once: true }, sondern jedes Mal neu verdrahten.
  });

  api('admin-me').then(function (me) {
    isAuthed = !!me.authenticated;
    authChecked = true;
    maybeInit();
    maybeInitSections();
  }).catch(function () {
    authChecked = true;
  });

  function maybeInit() {
    if (authChecked && isAuthed && pendingSettings && !maybeInit._done) {
      maybeInit._done = true;
      initSettingsEditing(pendingSettings.data);
    }
  }

  function maybeInitSections() {
    if (authChecked && isAuthed && pendingSections) {
      initSectionEditing(pendingSections.page, pendingSections.sections);
    }
  }

  // ---------------------------------------------------------------------
  // Legacy: Header/Footer-Felder (settings.json), unverändert per Klick
  // bearbeitbar wie bisher.
  // ---------------------------------------------------------------------
  function initSettingsEditing(originalData) {
    var changes = {};
    var CONTENT_PAGE = document.body.getAttribute('data-content');
    var bar = buildToolbar();
    document.body.appendChild(bar);
    document.body.classList.add('cms-active');

    document.querySelectorAll('[data-k]').forEach(function (el) {
      var key = el.getAttribute('data-k');
      // Nicht-Settings-Felder gehören zur Seite (content/<seite>.json, z.B.
      // der Hausbesuch-Hinweis auf kontakt.html) — nur bearbeitbar, wenn die
      // Seite eine eigene Inhaltsdatei hat.
      if (SETTINGS_KEYS.indexOf(key) === -1 && !CONTENT_PAGE) return;
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

    // Labels mit data-k: "for" entfernen, sonst springt der Klick ins
    // Eingabefeld statt in den Label-Text.
    document.querySelectorAll('label[data-k]').forEach(function (el) {
      el.removeAttribute('for');
    });

    // Platzhalter-Texte (z.B. "Thema der Beratung" im Buchungsformular):
    // im Bearbeitungsmodus steht der Platzhalter als Text im Feld und kann
    // direkt überschrieben werden.
    if (CONTENT_PAGE) {
      var bookingDetails = document.getElementById('booking-details');
      if (bookingDetails) bookingDetails.hidden = false;
      document.querySelectorAll('[data-k-placeholder]').forEach(function (el) {
        var key = el.getAttribute('data-k-placeholder');
        var initial = el.getAttribute('placeholder') || '';
        el.value = initial;
        el.classList.add('cms-editable');
        el.title = 'Platzhalter-Text — hier direkt bearbeiten';
        el.addEventListener('focus', function () { el.classList.add('cms-focused'); });
        el.addEventListener('blur', function () {
          el.classList.remove('cms-focused');
          var val = el.value.trim();
          el.setAttribute('placeholder', val);
          var saved = originalData[key] !== undefined ? originalData[key] : initial;
          if (val !== String(saved)) {
            changes[key] = val;
            el.classList.add('cms-dirty');
          }
        });
      });
    }

    var saveBtn = bar.querySelector('.cms-save');
    var statusEl = bar.querySelector('.cms-status');

    saveBtn.addEventListener('click', function () {
      if (!Object.keys(changes).length) {
        statusEl.textContent = 'Keine Änderungen.';
        return;
      }
      statusEl.textContent = 'Speichert …';
      var byPage = {};
      Object.keys(changes).forEach(function (key) {
        var target = SETTINGS_KEYS.indexOf(key) !== -1 ? 'settings' : CONTENT_PAGE;
        (byPage[target] = byPage[target] || {})[key] = changes[key];
      });
      Promise.all(Object.keys(byPage).map(function (target) {
        return api('admin-content?page=' + encodeURIComponent(target)).then(function (current) {
          return api('admin-content', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ page: target, data: Object.assign({}, current, byPage[target]) }),
          });
        });
      })).then(function () {
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

  function buildToolbar() {
    var bar = document.createElement('div');
    bar.className = 'cms-toolbar';
    bar.innerHTML =
      '<span class="cms-toolbar-label">✎ Bearbeitungsmodus — Texte anklicken, Sektionen mit der Maus bearbeiten</span>' +
      '<span class="cms-status"></span>' +
      '<button type="button" class="cms-save">Speichern</button>';
    return bar;
  }

  // ---------------------------------------------------------------------
  // Neu: Sektion-Baukasten (Drag & Drop, Hinzufügen, Bearbeiten, Bilder)
  // ---------------------------------------------------------------------
  var dragSourceId = null;

  function initSectionEditing(page, sections) {
    var container = document.getElementById('page-sections');
    if (!container) return;
    container.classList.add('cms-sections-root');

    // Gap "+"-Buttons vor jeder Sektion und einer am Ende.
    var nodes = Array.prototype.slice.call(container.querySelectorAll('.cb-section'));
    nodes.forEach(function (el, index) {
      container.insertBefore(buildGapButton(page, sections, index), el);
      wireSection(page, el, sections[index]);
    });
    container.appendChild(buildGapButton(page, sections, nodes.length));
  }

  function buildGapButton(page, sections, insertAt) {
    var gap = document.createElement('div');
    gap.className = 'cms-gap';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cms-gap-btn';
    btn.textContent = '+ Sektion hinzufügen';
    btn.addEventListener('click', function () {
      openTemplateGallery(function (type) {
        var def = window.CB_SECTION_TYPES[type];
        var data = def.defaultData();
        // createSection schiebt nachfolgende Sektionen serverseitig atomar
        // eine Position weiter — kein zusätzlicher reorder-Aufruf nötig.
        api('admin-sections', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ page: page, type: type, data: data, position: insertAt }),
        }).then(function () {
          window.CBSections.reload();
        }).catch(function (err) {
          alert('Fehler: ' + err.message);
        });
      });
    });
    gap.appendChild(btn);
    return gap;
  }

  function openTemplateGallery(onPick) {
    closePopovers();
    var pop = document.createElement('div');
    pop.className = 'cms-popover cms-template-gallery';
    var order = window.CB_SECTION_TYPE_ORDER;
    pop.innerHTML = '<div class="cms-popover-title">Sektion wählen</div>';
    order.forEach(function (type) {
      var def = window.CB_SECTION_TYPES[type];
      var item = document.createElement('button');
      item.type = 'button';
      item.className = 'cms-template-item';
      item.textContent = def.label;
      item.addEventListener('click', function () {
        pop.remove();
        onPick(type);
      });
      pop.appendChild(item);
    });
    var close = document.createElement('button');
    close.type = 'button';
    close.className = 'cms-popover-cancel';
    close.textContent = 'Abbrechen';
    close.addEventListener('click', function () { pop.remove(); });
    pop.appendChild(close);
    document.body.appendChild(pop);
    centerPopover(pop);
  }

  // Schliesst nur Popover (Baustein-Galerie, Bildauswahl) — NICHT das
  // Bearbeiten-Panel: die Bildauswahl wird ja gerade aus dem offenen Panel
  // heraus geöffnet (Feld "Bild ändern") und darf es nicht mit wegräumen.
  function closePopovers() {
    document.querySelectorAll('.cms-popover').forEach(function (el) { el.remove(); });
  }

  function centerPopover(pop) {
    pop.style.position = 'fixed';
    pop.style.top = '50%';
    pop.style.left = '50%';
    pop.style.transform = 'translate(-50%, -50%)';
  }

  function wireSection(page, el, section) {
    el.setAttribute('draggable', 'true');

    var toolbar = document.createElement('div');
    toolbar.className = 'cms-section-toolbar';
    toolbar.innerHTML =
      '<span class="cms-drag-handle" title="Verschieben">⠿</span>' +
      '<span class="cms-section-label">' + esc((window.CB_SECTION_TYPES[section.type] || {}).label || section.type) + '</span>' +
      '<button type="button" class="cms-edit-btn">Bearbeiten</button>' +
      '<button type="button" class="cms-dup-btn">Duplizieren</button>' +
      '<button type="button" class="cms-del-btn">Löschen</button>';
    el.insertBefore(toolbar, el.firstChild);

    toolbar.querySelector('.cms-edit-btn').addEventListener('click', function () {
      openEditPanel(page, section);
    });
    toolbar.querySelector('.cms-dup-btn').addEventListener('click', function () {
      api('admin-sections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page: page, type: section.type, data: section.data, position: section.position + 1 }),
      }).then(function () { window.CBSections.reload(); }).catch(function (err) { alert('Fehler: ' + err.message); });
    });
    toolbar.querySelector('.cms-del-btn').addEventListener('click', function () {
      if (!confirm('Diese Sektion wirklich löschen?')) return;
      api('admin-sections?page=' + encodeURIComponent(page) + '&id=' + section.id, { method: 'DELETE' })
        .then(function () { window.CBSections.reload(); })
        .catch(function (err) { alert('Fehler: ' + err.message); });
    });

    el.addEventListener('dragstart', function (ev) {
      dragSourceId = section.id;
      ev.dataTransfer.effectAllowed = 'move';
      el.classList.add('cms-dragging');
    });
    el.addEventListener('dragend', function () {
      el.classList.remove('cms-dragging');
    });
    el.addEventListener('dragover', function (ev) {
      ev.preventDefault();
      ev.dataTransfer.dropEffect = 'move';
      el.classList.add('cms-drop-target');
    });
    el.addEventListener('dragleave', function () {
      el.classList.remove('cms-drop-target');
    });
    el.addEventListener('drop', function (ev) {
      ev.preventDefault();
      el.classList.remove('cms-drop-target');
      if (dragSourceId === null || dragSourceId === section.id) return;
      var container = document.getElementById('page-sections');
      var ids = Array.prototype.slice.call(container.querySelectorAll('.cb-section')).map(function (n) {
        return n.getAttribute('data-section-id');
      });
      var from = ids.indexOf(dragSourceId);
      var to = ids.indexOf(section.id);
      if (from === -1 || to === -1) return;
      ids.splice(to, 0, ids.splice(from, 1)[0]);
      api('admin-sections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reorder', page: page, orderedIds: ids }),
      }).then(function () { window.CBSections.reload(); }).catch(function (err) { alert('Fehler: ' + err.message); });
    });
  }

  // ---------------------------------------------------------------------
  // Bearbeitungs-Panel: baut ein Formular aus dem Feld-Schema des Typs.
  // ---------------------------------------------------------------------
  function openEditPanel(page, section) {
    closePopovers();
    document.querySelectorAll('.cms-panel').forEach(function (el) { el.remove(); });
    var def = window.CB_SECTION_TYPES[section.type];
    if (!def) return;
    var data = JSON.parse(JSON.stringify(section.data || {}));

    var panel = document.createElement('div');
    panel.className = 'cms-panel';
    panel.innerHTML =
      '<div class="cms-panel-header"><h3>' + esc(def.label) + ' bearbeiten</h3><button type="button" class="cms-panel-close">✕</button></div>' +
      '<div class="cms-panel-body"></div>' +
      '<div class="cms-panel-footer"><span class="cms-panel-status"></span><button type="button" class="cms-panel-apply">Übernehmen</button></div>';
    document.body.appendChild(panel);

    var body = panel.querySelector('.cms-panel-body');
    def.fields.forEach(function (field) {
      body.appendChild(buildFieldRow(field, data));
    });

    panel.querySelector('.cms-panel-close').addEventListener('click', function () { panel.remove(); });

    panel.querySelector('.cms-panel-apply').addEventListener('click', function () {
      var statusEl = panel.querySelector('.cms-panel-status');
      statusEl.textContent = 'Speichert …';
      api('admin-sections', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page: page, id: section.id, data: data }),
      }).then(function () {
        panel.remove();
        window.CBSections.reload();
      }).catch(function (err) {
        statusEl.textContent = 'Fehler: ' + err.message;
      });
    });
  }

  // Formatierungsleiste für Textfelder: setzt Markierungen um die Auswahl,
  // die section-types.js (inlineFormat) beim Anzeigen in HTML umwandelt.
  var FORMAT_BUTTONS = [
    { label: '<b>Fett</b>', open: '**', close: '**' },
    { label: '<span style="font-size:0.8em">Klein</span>', open: '[klein]', close: '[/klein]' },
    { label: '<span style="font-size:1.1em">Gross</span>', open: '[gross]', close: '[/gross]' },
    { label: '<span style="font-size:1.3em">Sehr gross</span>', open: '[sehrgross]', close: '[/sehrgross]' },
  ];
  var FORMAT_MARKERS_RE = /\*\*|\[\/?(?:klein|gross|sehrgross)\]/g;

  function buildFormatBar(input) {
    var bar = document.createElement('div');
    bar.className = 'cms-format-bar';

    function apply(fn) {
      var start = input.selectionStart, end = input.selectionEnd, v = input.value;
      var r = fn(v.slice(0, start), v.slice(start, end), v.slice(end));
      input.value = r.before + r.middle + r.after;
      input.focus();
      input.setSelectionRange(r.before.length + (r.selStart || 0), r.before.length + (r.selEnd == null ? r.middle.length : r.selEnd));
      input.dispatchEvent(new Event('input'));
    }

    FORMAT_BUTTONS.forEach(function (b) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.innerHTML = b.label;
      btn.title = 'Markierten Text formatieren';
      btn.addEventListener('mousedown', function (e) { e.preventDefault(); }); // Auswahl behalten
      btn.addEventListener('click', function () {
        apply(function (before, sel, after) {
          // Ohne Auswahl Markierungen einfügen und Cursor dazwischen setzen.
          return { before: before, middle: b.open + sel + b.close, after: after, selStart: b.open.length, selEnd: b.open.length + sel.length };
        });
      });
      bar.appendChild(btn);
    });

    var clear = document.createElement('button');
    clear.type = 'button';
    clear.textContent = 'Formatierung entfernen';
    clear.title = 'Formatierung im markierten Text (oder im ganzen Feld) entfernen';
    clear.addEventListener('mousedown', function (e) { e.preventDefault(); });
    clear.addEventListener('click', function () {
      apply(function (before, sel, after) {
        if (!sel) return { before: '', middle: (before + after).replace(FORMAT_MARKERS_RE, ''), after: '', selStart: 0, selEnd: 0 };
        return { before: before, middle: sel.replace(FORMAT_MARKERS_RE, ''), after: after };
      });
    });
    bar.appendChild(clear);

    var hint = document.createElement('div');
    hint.className = 'cms-format-hint';
    hint.textContent = 'Text markieren, dann Format wählen. Enter = neue Zeile.';
    bar.appendChild(hint);
    return bar;
  }

  function buildFieldRow(field, data) {
    var row = document.createElement('div');
    row.className = 'cms-field';

    if (field.type === 'text' || field.type === 'textarea') {
      row.innerHTML = '<label>' + esc(field.label) + '</label>';
      var input = document.createElement(field.type === 'textarea' ? 'textarea' : 'input');
      if (field.type === 'textarea') input.rows = 4;
      input.value = data[field.key] || '';
      input.addEventListener('input', function () { data[field.key] = input.value; });
      if (field.type === 'textarea') row.appendChild(buildFormatBar(input));
      row.appendChild(input);
      return row;
    }

    if (field.type === 'checkbox') {
      var label = document.createElement('label');
      label.className = 'cms-checkbox-label';
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = !!data[field.key];
      cb.addEventListener('change', function () { data[field.key] = cb.checked; });
      label.appendChild(cb);
      label.appendChild(document.createTextNode(' ' + field.label));
      row.appendChild(label);
      return row;
    }

    if (field.type === 'select') {
      row.innerHTML = '<label>' + esc(field.label) + '</label>';
      var select = document.createElement('select');
      field.options.forEach(function (opt) {
        var o = document.createElement('option');
        o.value = opt.value;
        o.textContent = opt.label;
        if (data[field.key] === opt.value) o.selected = true;
        select.appendChild(o);
      });
      select.addEventListener('change', function () { data[field.key] = select.value; });
      row.appendChild(select);
      return row;
    }

    if (field.type === 'image') {
      row.innerHTML = '<label>' + esc(field.label) + '</label>';
      var preview = document.createElement('img');
      preview.className = 'cms-image-preview';
      preview.src = data[field.key] || '';
      var pickBtn = document.createElement('button');
      pickBtn.type = 'button';
      pickBtn.textContent = 'Bild ändern';
      pickBtn.addEventListener('click', function () {
        openAssetPicker(function (chosen) {
          data[field.key] = chosen;
          preview.src = chosen;
        });
      });
      row.appendChild(preview);
      row.appendChild(pickBtn);
      return row;
    }

    if (field.type === 'strings') {
      row.innerHTML = '<label>' + esc(field.label) + '</label>';
      var list = document.createElement('div');
      list.className = 'cms-item-list';
      if (!Array.isArray(data[field.key])) data[field.key] = [];
      function renderList() {
        list.innerHTML = '';
        data[field.key].forEach(function (value, idx) {
          var itemRow = document.createElement('div');
          itemRow.className = 'cms-item-row';
          var input = document.createElement('input');
          input.value = value;
          input.addEventListener('input', function () { data[field.key][idx] = input.value; });
          itemRow.appendChild(input);
          itemRow.appendChild(buildItemControls(data[field.key], idx, renderList));
          list.appendChild(itemRow);
        });
      }
      renderList();
      row.appendChild(list);
      row.appendChild(buildAddItemButton(function () {
        data[field.key].push(field.defaultItem ? field.defaultItem() : '');
        renderList();
      }));
      return row;
    }

    if (field.type === 'items') {
      row.innerHTML = '<label>' + esc(field.label) + '</label>';
      var itemsWrap = document.createElement('div');
      itemsWrap.className = 'cms-item-list';
      if (!Array.isArray(data[field.key])) data[field.key] = [];
      function renderItems() {
        itemsWrap.innerHTML = '';
        data[field.key].forEach(function (itemData, idx) {
          var box = document.createElement('div');
          box.className = 'cms-item-box';
          var header = document.createElement('div');
          header.className = 'cms-item-box-header';
          header.appendChild(buildItemControls(data[field.key], idx, renderItems));
          box.appendChild(header);
          field.itemFields.forEach(function (subField) {
            box.appendChild(buildFieldRow(subField, itemData));
          });
          itemsWrap.appendChild(box);
        });
      }
      renderItems();
      row.appendChild(itemsWrap);
      row.appendChild(buildAddItemButton(function () {
        data[field.key].push(field.defaultItem ? field.defaultItem() : {});
        renderItems();
      }));
      return row;
    }

    return row;
  }

  function buildAddItemButton(onAdd) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cms-add-item-btn';
    btn.textContent = '+ Hinzufügen';
    btn.addEventListener('click', onAdd);
    return btn;
  }

  function buildItemControls(arr, idx, rerender) {
    var controls = document.createElement('span');
    controls.className = 'cms-item-controls';

    var up = document.createElement('button');
    up.type = 'button';
    up.textContent = '↑';
    up.disabled = idx === 0;
    up.addEventListener('click', function () {
      var tmp = arr[idx - 1]; arr[idx - 1] = arr[idx]; arr[idx] = tmp;
      rerender();
    });

    var down = document.createElement('button');
    down.type = 'button';
    down.textContent = '↓';
    down.disabled = idx === arr.length - 1;
    down.addEventListener('click', function () {
      var tmp = arr[idx + 1]; arr[idx + 1] = arr[idx]; arr[idx] = tmp;
      rerender();
    });

    var remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = '✕';
    remove.addEventListener('click', function () {
      arr.splice(idx, 1);
      rerender();
    });

    controls.appendChild(up);
    controls.appendChild(down);
    controls.appendChild(remove);
    return controls;
  }

  // ---------------------------------------------------------------------
  // Bild-Auswahl: fest hinterlegte Assets + hochgeladene Bilder + Upload.
  // ---------------------------------------------------------------------
  function openAssetPicker(onChoose) {
    closePopovers();
    var pop = document.createElement('div');
    pop.className = 'cms-popover cms-asset-popover';
    pop.innerHTML = '<div class="cms-popover-title">Bild wählen</div><div class="cms-asset-grid"></div>';
    var grid = pop.querySelector('.cms-asset-grid');

    function addThumb(src) {
      var thumb = document.createElement('img');
      thumb.src = src;
      thumb.addEventListener('click', function () {
        onChoose(src);
        pop.remove();
      });
      grid.appendChild(thumb);
    }

    ASSET_OPTIONS.forEach(addThumb);

    api('admin-media').then(function (result) {
      (result.media || []).forEach(function (m) { addThumb('/.netlify/functions/media?id=' + m.id); });
    }).catch(function () {});

    var dropZone = document.createElement('div');
    dropZone.className = 'cms-dropzone';
    dropZone.textContent = 'Bild hierher ziehen oder klicken zum Hochladen (JPEG/PNG/WebP, max. 8 MB)';
    var fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/png,image/jpeg,image/webp';
    fileInput.style.display = 'none';

    function upload(file) {
      dropZone.textContent = 'Lädt hoch …';
      var form = new FormData();
      form.append('file', file);
      fetch(API + 'admin-media', { method: 'POST', credentials: 'same-origin', body: form })
        .then(function (res) { return res.json().then(function (d) { return { ok: res.ok, data: d }; }); })
        .then(function (result) {
          if (!result.ok) throw new Error(result.data.error || 'Upload fehlgeschlagen.');
          onChoose(result.data.url);
          pop.remove();
        }).catch(function (err) {
          dropZone.textContent = 'Fehler: ' + err.message;
        });
    }

    dropZone.addEventListener('click', function () { fileInput.click(); });
    fileInput.addEventListener('change', function () {
      if (fileInput.files && fileInput.files[0]) upload(fileInput.files[0]);
    });
    dropZone.addEventListener('dragover', function (ev) { ev.preventDefault(); dropZone.classList.add('cms-drop-target'); });
    dropZone.addEventListener('dragleave', function () { dropZone.classList.remove('cms-drop-target'); });
    dropZone.addEventListener('drop', function (ev) {
      ev.preventDefault();
      dropZone.classList.remove('cms-drop-target');
      if (ev.dataTransfer.files && ev.dataTransfer.files[0]) upload(ev.dataTransfer.files[0]);
    });

    pop.appendChild(dropZone);
    pop.appendChild(fileInput);

    var close = document.createElement('button');
    close.type = 'button';
    close.className = 'cms-popover-cancel';
    close.textContent = 'Abbrechen';
    close.addEventListener('click', function () { pop.remove(); });
    pop.appendChild(close);

    document.body.appendChild(pop);
    centerPopover(pop);
  }

  function injectStyles() {
    var style = document.createElement('style');
    style.textContent =
      '.cms-editable{outline:2px dashed transparent; outline-offset:3px; transition:outline-color .15s ease; cursor:text; border-radius:3px;}' +
      '.cms-editable:hover{outline-color:rgba(124,107,135,0.6);}' +
      '.cms-focused{outline-color:#826C4F !important; outline-style:solid !important; background:rgba(130,108,79,0.06);}' +
      '.cms-dirty{background:rgba(111,121,85,0.12);}' +
      // Oben statt unten: unten überdeckt die Netlify-Toolbar den Speichern-Button.
      '.cms-toolbar{position:fixed; left:0; right:0; top:0; height:56px; box-sizing:border-box; z-index:9999; background:#3A332C; color:#fff; padding:0 20px; display:flex; align-items:center; gap:16px; font-family:Karla,sans-serif; font-size:0.88rem; box-shadow:0 6px 20px rgba(0,0,0,0.2);}' +
      '.cms-toolbar-label{flex:1; min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;}' +
      'body.cms-active{padding-top:56px;}' +
      'body.cms-active .site-header{top:56px;}' +
      '.cms-save{background:#826C4F; color:#fff; border:none; padding:9px 20px; border-radius:5px; font-weight:700; cursor:pointer; font-family:Karla,sans-serif;}' +
      '.cms-save:hover{background:#6B5840;}' +
      '.cms-status{opacity:0.85;}' +

      '.cb-section{position:relative; outline:1px dashed transparent;}' +
      '.cb-section:hover{outline-color:rgba(124,107,135,0.5);}' +
      '.cb-section.cms-dragging{opacity:0.4;}' +
      '.cb-section.cms-drop-target{outline:2px solid #826C4F;}' +
      '.cms-section-toolbar{position:absolute; top:12px; right:6px; z-index:40; display:flex; align-items:center; gap:6px; background:rgba(58,51,44,0.92); color:#fff; padding:6px 10px; border-radius:6px; font-family:Karla,sans-serif; font-size:0.78rem; opacity:0; transition:opacity .15s ease; pointer-events:none;}' +
      '.cb-section:first-of-type .cms-section-toolbar{top:96px;}' +
      '.cb-section:hover .cms-section-toolbar{opacity:1; pointer-events:auto;}' +
      '.cms-drag-handle{cursor:grab; font-size:1rem;}' +
      '.cms-section-label{font-weight:700; opacity:0.85; margin-right:4px;}' +
      '.cms-section-toolbar button{background:rgba(255,255,255,0.15); color:#fff; border:none; border-radius:4px; padding:4px 8px; cursor:pointer; font-family:Karla,sans-serif; font-size:0.76rem;}' +
      '.cms-section-toolbar button:hover{background:rgba(255,255,255,0.3);}' +

      '.cms-gap{position:relative; height:0; display:flex; justify-content:center;}' +
      '.cms-gap-btn{position:relative; top:-13px; z-index:30; background:#826C4F; color:#fff; border:none; padding:6px 14px; border-radius:999px; font-size:0.78rem; font-weight:700; cursor:pointer; opacity:0; transition:opacity .15s ease; font-family:Karla,sans-serif;}' +
      '.cms-gap:hover .cms-gap-btn, .cms-gap-btn:focus{opacity:1;}' +

      '.cms-popover{background:#fff; border:1px solid rgba(0,0,0,0.15); border-radius:10px; padding:16px; box-shadow:0 20px 50px rgba(0,0,0,0.3); z-index:10000; max-width:420px; max-height:80vh; overflow:auto; font-family:Karla,sans-serif;}' +
      '.cms-popover-title{font-weight:700; margin-bottom:10px;}' +
      '.cms-template-item{display:block; width:100%; text-align:left; background:rgba(130,108,79,0.08); border:none; border-radius:6px; padding:10px 12px; margin-bottom:6px; cursor:pointer; font-family:Karla,sans-serif;}' +
      '.cms-template-item:hover{background:rgba(130,108,79,0.2);}' +
      '.cms-popover-cancel{display:block; width:100%; margin-top:8px; background:none; border:1px solid rgba(0,0,0,0.15); border-radius:4px; padding:8px; cursor:pointer;}' +
      '.cms-asset-grid{display:flex; gap:8px; flex-wrap:wrap; margin-bottom:10px;}' +
      '.cms-asset-grid img{width:70px; height:70px; object-fit:cover; border-radius:4px; cursor:pointer; border:2px solid transparent;}' +
      '.cms-asset-grid img:hover{border-color:#826C4F;}' +
      '.cms-dropzone{border:2px dashed rgba(58,51,44,0.3); border-radius:8px; padding:16px; text-align:center; font-size:0.82rem; color:rgba(58,51,44,0.7); cursor:pointer; margin-bottom:6px;}' +
      '.cms-dropzone.cms-drop-target{border-color:#826C4F; background:rgba(130,108,79,0.06);}' +

      '.cms-panel{position:fixed; top:0; right:0; bottom:0; width:380px; max-width:92vw; background:#fff; z-index:10000; box-shadow:-10px 0 40px rgba(0,0,0,0.25); display:flex; flex-direction:column; font-family:Karla,sans-serif;}' +
      '.cms-panel-header{display:flex; align-items:center; justify-content:space-between; padding:16px 18px; border-bottom:1px solid rgba(0,0,0,0.08);}' +
      '.cms-panel-header h3{margin:0; font-size:1.05rem;}' +
      '.cms-panel-close{background:none; border:none; font-size:1.1rem; cursor:pointer;}' +
      '.cms-panel-body{flex:1; overflow:auto; padding:16px 18px;}' +
      // Button links: unten rechts liegt das "Powered by Netlify"-Badge darüber.
      '.cms-panel-footer{padding:14px 18px; border-top:1px solid rgba(0,0,0,0.08); display:flex; flex-direction:row-reverse; align-items:center; justify-content:flex-end; gap:12px;}' +
      '.cms-panel-apply{background:#826C4F; color:#fff; border:none; padding:9px 18px; border-radius:5px; font-weight:700; cursor:pointer;}' +
      '.cms-panel-apply:hover{background:#6B5840;}' +
      '.cms-field{margin-bottom:16px;}' +
      '.cms-format-bar{display:flex; flex-wrap:wrap; gap:4px; margin-bottom:6px;}' +
      '.cms-format-bar button{background:rgba(130,108,79,0.1); color:#3A332C; border:1px solid rgba(58,51,44,0.15); border-radius:4px; padding:3px 8px; cursor:pointer; font-family:Karla,sans-serif; font-size:0.78rem; line-height:1.3;}' +
      '.cms-format-bar button:hover{background:rgba(130,108,79,0.22);}' +
      '.cms-format-hint{flex-basis:100%; font-size:0.72rem; color:rgba(58,51,44,0.6);}' +
      '.cms-field label{display:block; font-weight:700; font-size:0.82rem; margin-bottom:6px;}' +
      '.cms-field input[type=text], .cms-field input:not([type]), .cms-field textarea, .cms-field select{width:100%; font-family:Karla,sans-serif; font-size:0.92rem; padding:8px 10px; border:1.5px solid rgba(58,51,44,0.2); border-radius:5px;}' +
      '.cms-checkbox-label{display:flex; align-items:center; gap:8px; font-weight:400;}' +
      '.cms-image-preview{width:100%; max-height:120px; object-fit:cover; border-radius:6px; margin-bottom:8px; background:rgba(0,0,0,0.05);}' +
      '.cms-item-list{display:flex; flex-direction:column; gap:8px; margin-bottom:8px;}' +
      '.cms-item-row{display:flex; gap:6px; align-items:center;}' +
      '.cms-item-row input{flex:1;}' +
      '.cms-item-box{border:1px solid rgba(0,0,0,0.1); border-radius:6px; padding:10px; background:rgba(0,0,0,0.02);}' +
      '.cms-item-box-header{display:flex; justify-content:flex-end; margin-bottom:6px;}' +
      '.cms-item-controls button{background:rgba(0,0,0,0.06); border:none; border-radius:4px; padding:3px 7px; margin-left:4px; cursor:pointer;}' +
      '.cms-item-controls button:disabled{opacity:0.3; cursor:default;}' +
      '.cms-add-item-btn{background:rgba(130,108,79,0.1); border:1px dashed rgba(130,108,79,0.4); border-radius:5px; padding:7px 12px; cursor:pointer; font-family:Karla,sans-serif;}';
    document.head.appendChild(style);
  }

  injectStyles();
})();
