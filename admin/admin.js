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
    var blockedDates = [];
    tasks.push(api('admin-availability').then(function (a) {
      calSlotMinutes = a.slotMinutes || 60;
      blockedDates = a.blockedDates || [];
    }).catch(function () {}));

    Promise.all(tasks).then(function (results) {
      blockedDates.forEach(function (dateStr) {
        var dayIndex = Math.round((new Date(dateStr + 'T00:00:00') - currentWeekStart) / 86400000);
        if (dayIndex < 0 || dayIndex > 6) return;
        var col = document.querySelector('.cal-day-col[data-day-index="' + dayIndex + '"]');
        if (!col) return;
        col.classList.add('is-blocked');
        var label = document.createElement('div');
        label.className = 'cal-blocked-label';
        label.textContent = 'Abwesend';
        col.appendChild(label);
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
  function initBlockTimeForm() {
    var btn = document.getElementById('block-time-btn');
    var form = document.getElementById('block-time-form');
    var status = document.getElementById('block-status');

    btn.addEventListener('click', function () {
      form.hidden = !form.hidden;
      if (!form.hidden) {
        var fromInput = document.getElementById('block-from');
        var toInput = document.getElementById('block-to');
        if (!fromInput.value) fromInput.value = toDateStr(new Date());
        if (!toInput.value) toInput.value = fromInput.value;
      }
    });
    document.getElementById('block-cancel').addEventListener('click', function () {
      form.hidden = true;
      status.textContent = '';
    });
    document.getElementById('block-save').addEventListener('click', function () {
      var from = document.getElementById('block-from').value;
      var to = document.getElementById('block-to').value;
      if (!from || !to) {
        status.textContent = 'Bitte Von- und Bis-Datum wählen.';
        status.className = 'admin-status is-error';
        return;
      }
      if (to < from) { var tmp = from; from = to; to = tmp; }

      var newDates = [];
      var cursor = new Date(from + 'T00:00:00');
      var end = new Date(to + 'T00:00:00');
      while (cursor <= end) {
        newDates.push(toDateStr(cursor));
        cursor.setDate(cursor.getDate() + 1);
      }

      status.textContent = 'Speichert …';
      status.className = 'admin-status';
      api('admin-availability').then(function (avail) {
        var set = {};
        (avail.blockedDates || []).forEach(function (d) { set[d] = true; });
        newDates.forEach(function (d) { set[d] = true; });
        avail.blockedDates = Object.keys(set).sort();
        return api('admin-availability', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(avail),
        });
      }).then(function () {
        status.textContent = 'Eingetragen (' + newDates.length + ' Tag' + (newDates.length === 1 ? '' : 'e') + ').';
        form.hidden = true;
        loadCalendarWeek();
      }).catch(function (err) {
        status.textContent = err.message;
        status.className = 'admin-status is-error';
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

    loadUpcomingCount().then(function (count) {
      document.getElementById('stat-upcoming').textContent = count;
    });
  }

  function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
})();
