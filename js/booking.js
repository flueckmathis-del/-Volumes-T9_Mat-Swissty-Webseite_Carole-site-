(function () {
  var form = document.getElementById('booking-form');
  if (!form) return;

  var dateInput = document.getElementById('booking-date');
  var slotsWrap = document.getElementById('booking-slots-wrap');
  var slotsEl = document.getElementById('booking-slots');
  var slotsEmpty = document.getElementById('booking-slots-empty');
  var detailsEl = document.getElementById('booking-details');
  var statusEl = document.getElementById('booking-status');
  var selectedTime = null;

  function todayStr() {
    return new Date().toISOString().slice(0, 10);
  }
  function maxDateStr() {
    var d = new Date();
    d.setDate(d.getDate() + 180);
    return d.toISOString().slice(0, 10);
  }
  dateInput.min = todayStr();
  dateInput.max = maxDateStr();

  function setStatus(text, isError) {
    statusEl.textContent = text || '';
    statusEl.style.color = isError ? '#B3432B' : '';
  }

  function renderSlots(slots) {
    slotsEl.innerHTML = '';
    selectedTime = null;
    detailsEl.hidden = true;
    if (!slots.length) {
      slotsEmpty.hidden = false;
      return;
    }
    slotsEmpty.hidden = true;
    slots.forEach(function (time) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'slot-btn';
      btn.textContent = time;
      btn.addEventListener('click', function () {
        selectedTime = time;
        slotsEl.querySelectorAll('.slot-btn').forEach(function (b) { b.classList.remove('selected'); });
        btn.classList.add('selected');
        detailsEl.hidden = false;
        setStatus('');
      });
      slotsEl.appendChild(btn);
    });
  }

  function loadSlots(date) {
    setStatus('Lade verfügbare Zeiten …');
    slotsWrap.hidden = true;
    detailsEl.hidden = true;
    fetch('/.netlify/functions/availability?date=' + encodeURIComponent(date))
      .then(function (res) { return res.json(); })
      .then(function (data) {
        setStatus('');
        slotsWrap.hidden = false;
        renderSlots(data.slots || []);
      })
      .catch(function () {
        setStatus('Verfügbare Zeiten konnten nicht geladen werden. Bitte versuch es später erneut oder schreib mir direkt eine E-Mail.', true);
      });
  }

  dateInput.addEventListener('change', function () {
    if (dateInput.value) loadSlots(dateInput.value);
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!dateInput.value || !selectedTime) {
      setStatus('Bitte Datum und Uhrzeit auswählen.', true);
      return;
    }
    var name = document.getElementById('name').value.trim();
    var email = document.getElementById('email').value.trim();
    var message = document.getElementById('message').value.trim();
    if (!name || !email) {
      setStatus('Bitte Name und E-Mail-Adresse angeben.', true);
      return;
    }

    var submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    setStatus('Termin wird gebucht …');

    fetch('/.netlify/functions/book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: dateInput.value, time: selectedTime, name: name, email: email, message: message }),
    })
      .then(function (res) {
        return res.json().then(function (data) { return { ok: res.ok, data: data }; });
      })
      .then(function (result) {
        submitBtn.disabled = false;
        if (result.ok) {
          form.innerHTML = '<p class="form-note" style="font-size:1rem; color:var(--color-sage);">Danke, ' + escapeHtml(name) + '! Dein Termin am ' + dateInput.value + ' um ' + selectedTime + ' Uhr ist gebucht. Du erhältst in Kürze eine Bestätigung von mir.</p>';
        } else {
          setStatus(result.data.error || 'Diese Zeit ist leider nicht mehr verfügbar.', true);
          loadSlots(dateInput.value);
        }
      })
      .catch(function () {
        submitBtn.disabled = false;
        setStatus('Die Buchung ist fehlgeschlagen. Bitte versuch es erneut oder schreib mir direkt eine E-Mail.', true);
      });
  });

  function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
})();
