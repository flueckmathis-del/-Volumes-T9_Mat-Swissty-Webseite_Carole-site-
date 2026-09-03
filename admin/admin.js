(function () {
  requestAnimationFrame(function () { document.body.classList.add('is-loaded'); });

  var API = '/.netlify/functions/';

  function api(path, options) {
    return fetch(API + path, Object.assign({ credentials: 'same-origin' }, options || {})).then(function (res) {
      return res.json().then(function (data) {
        if (!res.ok) throw new Error(data.error || 'Fehler bei der Anfrage.');
        return data;
      });
    });
  }

  var loginScreen = document.getElementById('login-screen');
  var appEl = document.getElementById('admin-app');
  var loginForm = document.getElementById('login-form');
  var loginError = document.getElementById('login-error');

  function showApp() {
    loginScreen.hidden = true;
    appEl.hidden = false;
    initContentTab();
    initBookingsTab();
    initAvailabilityTab();
    initInsightsTab();
  }

  function showLogin() {
    appEl.hidden = true;
    loginScreen.hidden = false;
  }

  api('admin-me').then(function (data) {
    if (data.authenticated) showApp(); else showLogin();
  }).catch(showLogin);

  loginForm.addEventListener('submit', function (e) {
    e.preventDefault();
    loginError.hidden = true;
    var password = document.getElementById('login-password').value;
    fetch(API + 'login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ password: password }),
    }).then(function (res) {
      return res.json().then(function (data) { return { ok: res.ok, data: data }; });
    }).then(function (result) {
      if (result.ok) {
        showApp();
      } else {
        loginError.textContent = result.data.error || 'Anmeldung fehlgeschlagen.';
        loginError.hidden = false;
      }
    }).catch(function () {
      loginError.textContent = 'Server nicht erreichbar.';
      loginError.hidden = false;
    });
  });

  document.getElementById('logout-btn').addEventListener('click', function () {
    api('logout', { method: 'POST' }).finally(showLogin);
  });

  // ---------- Tabs ----------
  document.querySelectorAll('.admin-tab').forEach(function (tab) {
    tab.addEventListener('click', function () {
      document.querySelectorAll('.admin-tab').forEach(function (t) { t.classList.remove('active'); });
      document.querySelectorAll('.admin-panel').forEach(function (p) { p.hidden = true; });
      tab.classList.add('active');
      document.getElementById('panel-' + tab.getAttribute('data-tab')).hidden = false;
    });
  });

  // ---------- Content: visual editor (sub-tabs + page picker) ----------
  document.querySelectorAll('.content-subtab').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.content-subtab').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      var target = btn.getAttribute('data-subtab');
      document.getElementById('content-visual').hidden = target !== 'visual';
      document.getElementById('content-advanced').hidden = target !== 'advanced';
    });
  });

  var visualFrame = document.getElementById('visual-frame');
  document.querySelectorAll('.page-pick-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.page-pick-btn').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      visualFrame.src = '../' + btn.getAttribute('data-page') + '?cms_edit=1';
    });
  });

  // ---------- Content editor (advanced / raw fields) ----------
  var contentForm = document.getElementById('content-form');
  var pageSelect = document.getElementById('content-page-select');
  var contentStatus = document.getElementById('content-status');
  var fieldTypes = {};

  function isLongString(v) {
    return v.length > 90 || v.indexOf('\n') !== -1;
  }

  function renderContentFields(data) {
    contentForm.innerHTML = '';
    fieldTypes = {};
    Object.keys(data).forEach(function (key) {
      var value = data[key];
      var wrap = document.createElement('div');
      wrap.className = 'admin-field';
      var label = document.createElement('label');
      label.textContent = key;
      label.setAttribute('for', 'field-' + key);
      wrap.appendChild(label);

      if (typeof value === 'string') {
        fieldTypes[key] = 'string';
        var input = isLongString(value) ? document.createElement('textarea') : document.createElement('input');
        if (input.tagName === 'INPUT') input.type = 'text';
        input.id = 'field-' + key;
        input.value = value;
        wrap.appendChild(input);
      } else if (Array.isArray(value) && value.every(function (v) { return typeof v === 'string'; })) {
        fieldTypes[key] = 'string[]';
        var ta = document.createElement('textarea');
        ta.id = 'field-' + key;
        ta.rows = Math.max(3, value.length);
        ta.value = value.join('\n');
        wrap.appendChild(ta);
      } else {
        fieldTypes[key] = 'json';
        wrap.classList.add('is-json');
        var jsonNote = document.createElement('div');
        jsonNote.className = 'admin-hint';
        jsonNote.style.marginBottom = '6px';
        jsonNote.textContent = 'Struktur als JSON — bitte nur bearbeiten, wenn du dich damit auskennst.';
        wrap.appendChild(jsonNote);
        var jta = document.createElement('textarea');
        jta.id = 'field-' + key;
        jta.value = JSON.stringify(value, null, 2);
        wrap.appendChild(jta);
      }
      contentForm.appendChild(wrap);
    });
  }

  function loadContentPage(page) {
    contentStatus.textContent = 'Lädt …';
    contentStatus.className = 'admin-status';
    api('admin-content?page=' + encodeURIComponent(page)).then(function (data) {
      contentStatus.textContent = '';
      renderContentFields(data);
    }).catch(function (err) {
      contentStatus.textContent = err.message;
      contentStatus.className = 'admin-status is-error';
    });
  }

  function initContentTab() {
    loadContentPage(pageSelect.value);
    pageSelect.addEventListener('change', function () { loadContentPage(pageSelect.value); });

    document.getElementById('content-save').addEventListener('click', function () {
      var data = {};
      var invalidJson = null;
      Object.keys(fieldTypes).forEach(function (key) {
        var el = document.getElementById('field-' + key);
        var type = fieldTypes[key];
        if (type === 'string') data[key] = el.value;
        else if (type === 'string[]') data[key] = el.value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
        else if (type === 'json') {
          try { data[key] = JSON.parse(el.value); } catch (e) { invalidJson = key; }
        }
      });
      if (invalidJson) {
        contentStatus.textContent = 'Ungültiges JSON im Feld "' + invalidJson + '".';
        contentStatus.className = 'admin-status is-error';
        return;
      }
      contentStatus.textContent = 'Speichert …';
      contentStatus.className = 'admin-status';
      api('admin-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page: pageSelect.value, data: data }),
      }).then(function () {
        contentStatus.textContent = 'Gespeichert — auf der Website sofort sichtbar.';
        contentStatus.className = 'admin-status';
      }).catch(function (err) {
        contentStatus.textContent = err.message;
        contentStatus.className = 'admin-status is-error';
      });
    });
  }

  // ---------- Bookings ----------
  var bookingsInitialized = false;
  function loadBookings() {
    var list = document.getElementById('bookings-list');
    list.innerHTML = '<p class="admin-list-empty">Lädt …</p>';
    return api('admin-bookings?days=90').then(function (data) {
      var bookings = data.bookings || [];
      if (!bookings.length) {
        list.innerHTML = '<p class="admin-list-empty">Keine kommenden Termine.</p>';
        return bookings;
      }
      list.innerHTML = '';
      bookings.forEach(function (b) {
        var card = document.createElement('div');
        card.className = 'booking-card';
        var msg = b.message ? '<div class="msg">' + escapeHtml(b.message) + '</div>' : '';
        card.innerHTML =
          '<div><div class="when">' + b.date + ' · ' + b.time + ' Uhr</div>' +
          '<div class="who">' + escapeHtml(b.name) + ' — <a href="mailto:' + escapeHtml(b.email) + '">' + escapeHtml(b.email) + '</a></div>' +
          msg + '</div>';
        var btn = document.createElement('button');
        btn.className = 'cancel-btn';
        btn.textContent = 'Absagen';
        btn.addEventListener('click', function () {
          if (!confirm('Termin am ' + b.date + ' um ' + b.time + ' Uhr wirklich absagen?')) return;
          api('admin-cancel-booking', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ date: b.date, id: b.id }),
          }).then(loadBookings);
        });
        card.appendChild(btn);
        list.appendChild(card);
      });
      return bookings;
    });
  }
  function initBookingsTab() {
    if (bookingsInitialized) return;
    bookingsInitialized = true;
    loadBookings();
  }

  // ---------- Availability ----------
  var WEEKDAYS = [['mon', 'Montag'], ['tue', 'Dienstag'], ['wed', 'Mittwoch'], ['thu', 'Donnerstag'], ['fri', 'Freitag'], ['sat', 'Samstag'], ['sun', 'Sonntag']];
  var availabilityInitialized = false;

  function renderAvailabilityFields(avail) {
    var wrap = document.getElementById('availability-fields');
    wrap.innerHTML = '';
    WEEKDAYS.forEach(function (pair) {
      var key = pair[0], label = pair[1];
      var row = document.createElement('div');
      row.className = 'avail-day-row';
      var l = document.createElement('label');
      l.textContent = label;
      l.setAttribute('for', 'avail-' + key);
      var input = document.createElement('input');
      input.type = 'text';
      input.id = 'avail-' + key;
      input.placeholder = 'z.B. 09:00-12:00, 14:00-17:00';
      input.value = (avail.weekly && avail.weekly[key] || []).join(', ');
      row.appendChild(l);
      row.appendChild(input);
      wrap.appendChild(row);
    });
    document.getElementById('avail-slot-minutes').value = avail.slotMinutes;
    document.getElementById('avail-weeks-ahead').value = avail.weeksAhead;
    document.getElementById('avail-blocked').value = (avail.blockedDates || []).join('\n');
  }

  function initAvailabilityTab() {
    if (availabilityInitialized) return;
    availabilityInitialized = true;
    var status = document.getElementById('availability-status');
    api('admin-availability').then(renderAvailabilityFields).catch(function (err) {
      status.textContent = err.message;
      status.className = 'admin-status is-error';
    });

    document.getElementById('availability-save').addEventListener('click', function () {
      var weekly = {};
      var rangeRe = /^\d{2}:\d{2}-\d{2}:\d{2}$/;
      var invalidRange = null;
      WEEKDAYS.forEach(function (pair) {
        var key = pair[0];
        var raw = document.getElementById('avail-' + key).value;
        var ranges = raw.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
        ranges.forEach(function (r) { if (!rangeRe.test(r)) invalidRange = r; });
        weekly[key] = ranges;
      });
      if (invalidRange) {
        status.textContent = 'Ungültiges Zeitformat: "' + invalidRange + '" (erwartet z.B. 09:00-12:00).';
        status.className = 'admin-status is-error';
        return;
      }
      var payload = {
        slotMinutes: parseInt(document.getElementById('avail-slot-minutes').value, 10),
        weeksAhead: parseInt(document.getElementById('avail-weeks-ahead').value, 10),
        weekly: weekly,
        blockedDates: document.getElementById('avail-blocked').value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean),
      };
      status.textContent = 'Speichert …';
      status.className = 'admin-status';
      api('admin-availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then(function () {
        status.textContent = 'Gespeichert.';
        status.className = 'admin-status';
      }).catch(function (err) {
        status.textContent = err.message;
        status.className = 'admin-status is-error';
      });
    });
  }

  // ---------- Insights ----------
  var insightsInitialized = false;
  function initInsightsTab() {
    if (insightsInitialized) return;
    insightsInitialized = true;

    api('admin-analytics?days=30').then(function (data) {
      document.getElementById('stat-total-views').textContent = data.total;
      var chart = document.getElementById('insights-chart');
      chart.innerHTML = '';
      var max = Math.max.apply(null, data.byDay.map(function (d) { return d.count; }).concat([1]));
      data.byDay.forEach(function (d) {
        var bar = document.createElement('div');
        bar.className = 'admin-chart-bar';
        bar.style.height = Math.max(2, Math.round((d.count / max) * 130)) + 'px';
        var dayLabel = d.date.slice(5);
        bar.title = d.date + ': ' + d.count;
        if (d.count > 0) {
          var labelEl = document.createElement('span');
          labelEl.className = 'bar-label';
          labelEl.textContent = d.count;
          bar.appendChild(labelEl);
        }
        chart.appendChild(bar);
      });

      var topWrap = document.getElementById('insights-top-pages');
      topWrap.innerHTML = '';
      if (!data.topPages.length) {
        topWrap.innerHTML = '<p class="admin-list-empty">Noch keine Daten.</p>';
      } else {
        data.topPages.forEach(function (p) {
          var row = document.createElement('div');
          row.className = 'top-page-row';
          row.innerHTML = '<span>' + escapeHtml(p.page) + '</span><span>' + p.count + '</span>';
          topWrap.appendChild(row);
        });
      }
    });

    loadBookings().then(function (bookings) {
      document.getElementById('stat-upcoming').textContent = bookings.length;
    });
  }

  function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
})();
