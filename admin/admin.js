(function () {
  requestAnimationFrame(function () { document.body.classList.add('is-loaded'); });

  var API = '/.netlify/functions/';

  // Raw fetch + JSON parse, without throwing on non-2xx — callers that need
  // to inspect the error body (setup, login) use this directly; api() below
  // wraps it for the common "just give me the data or throw" case.
  function apiRaw(path, options) {
    return fetch(API + path, Object.assign({ credentials: 'same-origin', cache: 'no-store' }, options || {})).then(function (res) {
      return res.json().then(function (data) { return { ok: res.ok, data: data }; });
    });
  }

  function api(path, options) {
    return apiRaw(path, options).then(function (result) {
      if (!result.ok) throw new Error(result.data.error || 'Fehler bei der Anfrage.');
      return result.data;
    });
  }

  var authLoading = document.getElementById('auth-loading');
  var loginScreen = document.getElementById('login-screen');
  var setupScreen = document.getElementById('setup-screen');
  var appEl = document.getElementById('admin-app');
  var loginForm = document.getElementById('login-form');
  var loginError = document.getElementById('login-error');
  var setupForm = document.getElementById('setup-form');
  var setupError = document.getElementById('setup-error');

  function hideAllAuthScreens() {
    authLoading.hidden = true;
    loginScreen.hidden = true;
    setupScreen.hidden = true;
    appEl.hidden = true;
  }

  function showApp() {
    hideAllAuthScreens();
    appEl.hidden = false;
    initContentTab();
    initBookingsTab();
    initAvailabilityTab();
    initInsightsTab();
    initAccountTab();
  }

  function showLogin() {
    hideAllAuthScreens();
    loginScreen.hidden = false;
  }

  function showSetup() {
    hideAllAuthScreens();
    setupScreen.hidden = false;
  }

  // First: is a password even configured yet? If not, this is a brand new
  // site — offer first-time setup instead of a login form. This whole flow
  // lives on our own site/backend, no external dashboard involved.
  api('setup-status').then(function (status) {
    if (!status.configured) {
      showSetup();
      return;
    }
    return api('admin-me').then(function (data) {
      if (data.authenticated) showApp(); else showLogin();
    });
  }).catch(showLogin);

  setupForm.addEventListener('submit', function (e) {
    e.preventDefault();
    setupError.hidden = true;
    var password = document.getElementById('setup-password').value;
    var confirmPassword = document.getElementById('setup-password-confirm').value;
    apiRaw('setup-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: password, confirmPassword: confirmPassword }),
    }).then(function (result) {
      if (result.ok) {
        showApp();
        return;
      }
      // Most likely cause: a password already exists (e.g. someone already
      // finished setup in another tab/click) — send them to the login
      // screen instead of leaving them stuck here.
      setupError.innerHTML = (result.data.error || 'Einrichtung fehlgeschlagen.') +
        ' <a href="#" id="setup-go-to-login">Zum Login</a>';
      setupError.hidden = false;
      var link = document.getElementById('setup-go-to-login');
      if (link) link.addEventListener('click', function (ev) { ev.preventDefault(); showLogin(); });
    }).catch(function () {
      setupError.textContent = 'Server nicht erreichbar.';
      setupError.hidden = false;
    });
  });

  loginForm.addEventListener('submit', function (e) {
    e.preventDefault();
    loginError.hidden = true;
    var password = document.getElementById('login-password').value;
    apiRaw('login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: password }),
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

  // ---------- Account (Passwort ändern) ----------
  var accountInitialized = false;
  function initAccountTab() {
    if (accountInitialized) return;
    accountInitialized = true;
    var status = document.getElementById('change-password-status');
    document.getElementById('change-password-save').addEventListener('click', function () {
      var current = document.getElementById('current-password').value;
      var next = document.getElementById('new-password').value;
      var confirm = document.getElementById('new-password-confirm').value;
      if (!next || next.length < 8) {
        status.textContent = 'Neues Passwort muss mindestens 8 Zeichen haben.';
        status.className = 'admin-status is-error';
        return;
      }
      if (next !== confirm) {
        status.textContent = 'Die neuen Passwörter stimmen nicht überein.';
        status.className = 'admin-status is-error';
        return;
      }
      status.textContent = 'Speichert …';
      status.className = 'admin-status';
      api('change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: current, newPassword: next, confirmPassword: confirm }),
      }).then(function () {
        status.textContent = 'Passwort geändert.';
        status.className = 'admin-status';
        document.getElementById('change-password-form').reset();
      }).catch(function (err) {
        status.textContent = err.message;
        status.className = 'admin-status is-error';
      });
    });
  }

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

  // ---------- Bookings calendar (week view, navigable) ----------
  var CAL_START_HOUR = 7;
  var CAL_END_HOUR = 20;
  var CAL_HOUR_HEIGHT = 50; // px
  var WEEKDAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
  var currentWeekStart = mondayOf(new Date());
  var calSlotMinutes = 60;
  var bookingsInitialized = false;

  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function toDateStr(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function toDisplay(d) { return pad2(d.getDate()) + '.' + pad2(d.getMonth() + 1) + '.' + d.getFullYear(); }
  function mondayOf(d) {
    var date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    var day = date.getDay();
    var diff = day === 0 ? -6 : 1 - day;
    date.setDate(date.getDate() + diff);
    return date;
  }
  function addDaysLocal(d, n) {
    var copy = new Date(d);
    copy.setDate(copy.getDate() + n);
    return copy;
  }
  function isoWeekNumber(d) {
    var date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    var dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    var yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  }

  function renderCalendarShell() {
    var grid = document.getElementById('cal-grid');
    var todayStr = toDateStr(new Date());
    var totalHeight = (CAL_END_HOUR - CAL_START_HOUR) * CAL_HOUR_HEIGHT;
    var html = '<div class="cal-corner"></div>';

    for (var i = 0; i < 7; i++) {
      var d = addDaysLocal(currentWeekStart, i);
      var isToday = toDateStr(d) === todayStr;
      html += '<div class="cal-col-head' + (isToday ? ' is-today' : '') + '">' + WEEKDAY_LABELS[i] + '<br>' + toDisplay(d).slice(0, 5) + '</div>';
    }

    html += '<div class="cal-time-col" style="height:' + totalHeight + 'px;">';
    for (var h = CAL_START_HOUR; h <= CAL_END_HOUR; h++) {
      html += '<span class="cal-time-label" style="top:' + ((h - CAL_START_HOUR) * CAL_HOUR_HEIGHT) + 'px;">' + pad2(h) + ':00</span>';
    }
    html += '</div>';

    for (var j = 0; j < 7; j++) {
      html += '<div class="cal-day-col" data-day-index="' + j + '" style="height:' + totalHeight + 'px; --hour-h:' + CAL_HOUR_HEIGHT + 'px;"></div>';
    }

    grid.innerHTML = html;

    var weekEnd = addDaysLocal(currentWeekStart, 6);
    document.getElementById('cal-week-label').textContent =
      'KW' + isoWeekNumber(currentWeekStart) + ': ' + toDisplay(currentWeekStart) + ' – ' + toDisplay(weekEnd);
  }

  function closeCalPopover() {
    var existing = document.querySelector('.cal-popover');
    if (existing) existing.remove();
  }

  function loadCalendarWeek() {
    renderCalendarShell();
    closeCalPopover();
    var from = toDateStr(currentWeekStart);
    var to = toDateStr(addDaysLocal(currentWeekStart, 6));

    var tasks = [api('admin-bookings?from=' + from + '&to=' + to)];
    var absences = [];
    tasks.push(api('admin-availability').then(function (a) {
      calSlotMinutes = a.slotMinutes || 60;
      absences = a.absences || [];
    }).catch(function () {}));

    Promise.all(tasks).then(function (results) {
      absences.forEach(function (a) {
        var dayIndex = Math.round((new Date(a.date + 'T00:00:00') - currentWeekStart) / 86400000);
        if (dayIndex < 0 || dayIndex > 6) return;
        var col = document.querySelector('.cal-day-col[data-day-index="' + dayIndex + '"]');
        if (!col) return;

        if (a.allDay) {
          col.classList.add('is-blocked');
          var label = document.createElement('div');
          label.className = 'cal-blocked-label';
          label.textContent = a.reason ? 'Abwesend: ' + a.reason : 'Abwesend';
          col.appendChild(label);
        } else {
          var startParts = a.start.split(':').map(Number);
          var endParts = a.end.split(':').map(Number);
          var startMin = (startParts[0] - CAL_START_HOUR) * 60 + startParts[1];
          var endMin = (endParts[0] - CAL_START_HOUR) * 60 + endParts[1];
          var abBlock = document.createElement('div');
          abBlock.className = 'cal-absence-block';
          abBlock.style.top = Math.max(0, (startMin / 60) * CAL_HOUR_HEIGHT) + 'px';
          abBlock.style.height = Math.max(14, ((endMin - startMin) / 60) * CAL_HOUR_HEIGHT) + 'px';
          abBlock.textContent = a.reason || 'Abwesend';
          abBlock.title = a.start + '–' + a.end + (a.reason ? ' · ' + a.reason : '');
          col.appendChild(abBlock);
        }
      });

      var bookings = results[0].bookings || [];
      bookings.forEach(function (b) {
        var dayIndex = Math.round((new Date(b.date + 'T00:00:00') - currentWeekStart) / 86400000);
        if (dayIndex < 0 || dayIndex > 6) return;
        var col = document.querySelector('.cal-day-col[data-day-index="' + dayIndex + '"]');
        if (!col) return;

        var timeParts = b.time.split(':').map(Number);
        var minutesFromStart = (timeParts[0] - CAL_START_HOUR) * 60 + timeParts[1];
        var top = (minutesFromStart / 60) * CAL_HOUR_HEIGHT;
        var height = Math.max(20, (calSlotMinutes / 60) * CAL_HOUR_HEIGHT - 2);

        var block = document.createElement('div');
        block.className = 'cal-block';
        block.style.top = top + 'px';
        block.style.height = height + 'px';
        block.innerHTML = '<strong>' + b.time + '</strong>' + escapeHtml(b.name);
        block.addEventListener('click', function (ev) {
          ev.stopPropagation();
          showBookingPopover(block, b);
        });
        col.appendChild(block);
      });
    });
  }

  function showBookingPopover(anchorEl, booking) {
    closeCalPopover();
    var pop = document.createElement('div');
    pop.className = 'cal-popover';
    var msg = booking.message ? '<div class="msg">„' + escapeHtml(booking.message) + '“</div>' : '';
    var phoneLine = booking.phone ? '<br><a href="tel:' + escapeHtml(booking.phone) + '">' + escapeHtml(booking.phone) + '</a>' : '';
    pop.innerHTML =
      '<button class="close-btn" type="button">×</button>' +
      '<div class="when">' + booking.date + ' · ' + booking.time + ' Uhr</div>' +
      '<div>' + escapeHtml(booking.name) + '<br><a href="mailto:' + escapeHtml(booking.email) + '">' + escapeHtml(booking.email) + '</a>' + phoneLine + '</div>' +
      msg +
      '<div class="cal-popover-view">' +
      '<button class="cancel-btn" type="button">Termin absagen</button>' +
      '</div>' +
      '<div class="cal-popover-cancel-form" hidden>' +
      '<label for="cancel-reason">Begründung (optional, nur für dich sichtbar)</label>' +
      '<textarea id="cancel-reason" rows="3" placeholder="z.B. Kundin hat abgesagt, Krankheit, …"></textarea>' +
      '<div class="cal-popover-cancel-actions">' +
      '<button class="cancel-confirm-btn" type="button">Absage bestätigen</button>' +
      '<button class="cancel-back-btn" type="button">Zurück</button>' +
      '</div>' +
      '</div>';

    document.getElementById('cal-grid').appendChild(pop);
    var anchorRect = anchorEl.getBoundingClientRect();
    var gridRect = document.getElementById('cal-grid').getBoundingClientRect();
    pop.style.top = (anchorRect.top - gridRect.top) + 'px';
    pop.style.left = Math.min(anchorRect.left - gridRect.left, gridRect.width - 270) + 'px';

    pop.querySelector('.close-btn').addEventListener('click', closeCalPopover);
    pop.querySelector('.cancel-btn').addEventListener('click', function () {
      pop.querySelector('.cal-popover-view').hidden = true;
      pop.querySelector('.cal-popover-cancel-form').hidden = false;
      pop.querySelector('#cancel-reason').focus();
    });
    pop.querySelector('.cancel-back-btn').addEventListener('click', function () {
      pop.querySelector('.cal-popover-cancel-form').hidden = true;
      pop.querySelector('.cal-popover-view').hidden = false;
    });
    pop.querySelector('.cancel-confirm-btn').addEventListener('click', function () {
      var reason = pop.querySelector('#cancel-reason').value.trim();
      api('admin-cancel-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: booking.date, id: booking.id, reason: reason }),
      }).then(function () {
        loadCalendarWeek();
        loadCancellationsLog();
      });
    });
  }

  function loadCancellationsLog() {
    var list = document.getElementById('cancellations-list');
    if (!list) return;
    api('admin-cancellations').then(function (data) {
      var items = data.cancellations || [];
      if (!items.length) {
        list.innerHTML = '<p class="admin-list-empty">Noch keine Absagen.</p>';
        return;
      }
      list.innerHTML = items.map(function (c) {
        var reason = c.reason ? '<div class="reason">Grund: ' + escapeHtml(c.reason) + '</div>' : '';
        return '<div class="cancel-log-row"><div class="when">' + c.date + ' · ' + c.time + ' Uhr — ' + escapeHtml(c.name) + '</div>' + reason + '</div>';
      }).join('');
    });
  }

  // ---------- Block time (Ferien / Abwesenheit) ----------
  function makeId() {
    if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
    return 'a' + Date.now() + Math.random().toString(16).slice(2);
  }

  function initBlockTimeForm() {
    var btn = document.getElementById('block-time-btn');
    var form = document.getElementById('block-time-form');
    var status = document.getElementById('block-status');
    var allDayCheckbox = document.getElementById('block-all-day');
    var timeRangeWrap = document.getElementById('block-time-range');

    btn.addEventListener('click', function () {
      form.hidden = !form.hidden;
      if (!form.hidden) {
        var fromInput = document.getElementById('block-from');
        var toInput = document.getElementById('block-to');
        if (!fromInput.value) fromInput.value = toDateStr(new Date());
        if (!toInput.value) toInput.value = fromInput.value;
      }
    });
    allDayCheckbox.addEventListener('change', function () {
      timeRangeWrap.hidden = allDayCheckbox.checked;
    });
    document.getElementById('block-cancel').addEventListener('click', function () {
      form.hidden = true;
      status.textContent = '';
    });
    document.getElementById('block-save').addEventListener('click', function () {
      var from = document.getElementById('block-from').value;
      var to = document.getElementById('block-to').value;
      var allDay = allDayCheckbox.checked;
      var start = document.getElementById('block-start').value;
      var end = document.getElementById('block-end').value;
      var reason = document.getElementById('block-reason').value.trim();

      if (!from || !to) {
        status.textContent = 'Bitte Von- und Bis-Datum wählen.';
        status.className = 'admin-status is-error';
        return;
      }
      if (!allDay && (!start || !end || start >= end)) {
        status.textContent = 'Bitte eine gültige Start- und Endzeit wählen (Ende nach Start).';
        status.className = 'admin-status is-error';
        return;
      }
      if (to < from) { var tmp = from; from = to; to = tmp; }

      var newEntries = [];
      var cursor = new Date(from + 'T00:00:00');
      var endDate = new Date(to + 'T00:00:00');
      while (cursor <= endDate) {
        var entry = { id: makeId(), date: toDateStr(cursor), allDay: allDay };
        if (!allDay) { entry.start = start; entry.end = end; }
        if (reason) entry.reason = reason;
        newEntries.push(entry);
        cursor.setDate(cursor.getDate() + 1);
      }

      status.textContent = 'Speichert …';
      status.className = 'admin-status';
      api('admin-availability').then(function (avail) {
        avail.absences = (avail.absences || []).concat(newEntries);
        return api('admin-availability', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(avail),
        });
      }).then(function () {
        status.textContent = 'Eingetragen (' + newEntries.length + ' Tag' + (newEntries.length === 1 ? '' : 'e') + ').';
        form.hidden = true;
        document.getElementById('block-reason').value = '';
        loadCalendarWeek();
        loadAbsencesList();
      }).catch(function (err) {
        status.textContent = err.message;
        status.className = 'admin-status is-error';
      });
    });
  }

  function loadAbsencesList() {
    var list = document.getElementById('absences-list');
    if (!list) return;
    list.innerHTML = '<p class="admin-list-empty">Lädt …</p>';
    api('admin-availability').then(function (avail) {
      var absences = (avail.absences || []).slice().sort(function (a, b) {
        return (a.date + (a.start || '')).localeCompare(b.date + (b.start || ''));
      });
      if (!absences.length) {
        list.innerHTML = '<p class="admin-list-empty">Keine Abwesenheiten eingetragen.</p>';
        return;
      }
      list.innerHTML = '';
      absences.forEach(function (a) {
        var row = document.createElement('div');
        row.className = 'booking-card';
        var timeLabel = a.allDay ? 'Ganzer Tag' : (a.start + '–' + a.end + ' Uhr');
        var reasonHtml = a.reason ? ' — ' + escapeHtml(a.reason) : '';
        row.innerHTML = '<div><div class="when">' + a.date + '</div><div class="who">' + timeLabel + reasonHtml + '</div></div>';
        var delBtn = document.createElement('button');
        delBtn.className = 'cancel-btn';
        delBtn.textContent = 'Löschen';
        delBtn.addEventListener('click', function () {
          api('admin-availability').then(function (current) {
            current.absences = (current.absences || []).filter(function (x) { return x.id !== a.id; });
            return api('admin-availability', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(current),
            });
          }).then(function () {
            loadAbsencesList();
            loadCalendarWeek();
          });
        });
        row.appendChild(delBtn);
        list.appendChild(row);
      });
    });
  }

  function initBookingsTab() {
    document.getElementById('cal-prev').addEventListener('click', function () {
      currentWeekStart = addDaysLocal(currentWeekStart, -7);
      loadCalendarWeek();
    });
    document.getElementById('cal-next').addEventListener('click', function () {
      currentWeekStart = addDaysLocal(currentWeekStart, 7);
      loadCalendarWeek();
    });
    document.getElementById('cal-today').addEventListener('click', function () {
      currentWeekStart = mondayOf(new Date());
      loadCalendarWeek();
    });
    initBlockTimeForm();
    loadCancellationsLog();
    loadAbsencesList();
    if (bookingsInitialized) return;
    bookingsInitialized = true;
    loadCalendarWeek();
  }

  // Small helper for the Insights tab's "kommende Termine" stat.
  function loadUpcomingCount() {
    var today = toDateStr(new Date());
    var to = toDateStr(addDaysLocal(new Date(), 90));
    return api('admin-bookings?from=' + today + '&to=' + to).then(function (data) {
      return (data.bookings || []).length;
    });
  }

  // ---------- Availability ----------
  var WEEKDAYS = [['mon', 'Montag'], ['tue', 'Dienstag'], ['wed', 'Mittwoch'], ['thu', 'Donnerstag'], ['fri', 'Freitag'], ['sat', 'Samstag'], ['sun', 'Sonntag']];
  var availabilityInitialized = false;

  var lastLoadedAvailability = null;

  function renderAvailabilityFields(avail) {
    lastLoadedAvailability = avail;
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
      status.textContent = 'Speichert …';
      status.className = 'admin-status';
      // Fetch the current absences fresh (they may have changed on the
      // Termine tab since this form was last loaded) instead of trusting
      // a possibly-stale cached copy.
      api('admin-availability').then(function (fresh) {
        var payload = {
          slotMinutes: parseInt(document.getElementById('avail-slot-minutes').value, 10),
          weeksAhead: parseInt(document.getElementById('avail-weeks-ahead').value, 10),
          weekly: weekly,
          absences: fresh.absences || [],
        };
        return api('admin-availability', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
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

    loadUpcomingCount().then(function (count) {
      document.getElementById('stat-upcoming').textContent = count;
    });
  }

  function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

})();
