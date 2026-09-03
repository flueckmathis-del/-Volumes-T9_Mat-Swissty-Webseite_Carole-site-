(function () {
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function applyValues(root, data) {
    root.querySelectorAll('[data-k]').forEach(function (el) {
      var key = el.getAttribute('data-k');
      var value = data[key];
      if (value === undefined || value === null) return;
      el.textContent = value;
    });
    root.querySelectorAll('[data-k-href]').forEach(function (el) {
      var key = el.getAttribute('data-k-href');
      var value = data[key];
      if (value === undefined || value === null) return;
      el.setAttribute('href', value);
    });
    root.querySelectorAll('[data-k-mailto]').forEach(function (el) {
      var key = el.getAttribute('data-k-mailto');
      var value = data[key];
      if (value === undefined || value === null) return;
      el.setAttribute('href', 'mailto:' + value);
    });
    root.querySelectorAll('[data-k-tel]').forEach(function (el) {
      var key = el.getAttribute('data-k-tel');
      var value = data[key];
      if (value === undefined || value === null) return;
      el.setAttribute('href', 'tel:' + value);
    });
    root.querySelectorAll('[data-k-src]').forEach(function (el) {
      var key = el.getAttribute('data-k-src');
      var value = data[key];
      if (value === undefined || value === null) return;
      el.setAttribute('src', value);
    });
  }

  function renderTopicList(el, items) {
    if (!items) return;
    el.innerHTML = items.map(function (item) {
      return '<li>' + escapeHtml(item) + '</li>';
    }).join('');
  }

  function renderPricingRows(el, rows) {
    if (!rows) return;
    el.innerHTML = rows.map(function (row) {
      var label = escapeHtml(row.label || '');
      var note = row.note ? ' — <em>' + escapeHtml(row.note) + '</em>' : '';
      var price = escapeHtml(row.price || '');
      return '<tr><td>' + label + note + '</td><td class="amount">' + price + '</td></tr>';
    }).join('');
  }

  function renderLists(root, data) {
    var topicsEl = root.querySelector('[data-list="topics"]');
    if (topicsEl) renderTopicList(topicsEl, data.topics);

    var alltagTopicsEl = root.querySelector('[data-list="alltag_topics"]');
    if (alltagTopicsEl) renderTopicList(alltagTopicsEl, data.alltag_topics);

    var pricingEl = root.querySelector('[data-list="pricing"]');
    if (pricingEl) renderPricingRows(pricingEl, data.pricing);
  }

  function loadJson(path) {
    return fetch(path, { cache: 'no-store' }).then(function (res) {
      if (!res.ok) throw new Error('Failed to load ' + path);
      return res.json();
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var page = document.body.getAttribute('data-content');
    var requests = [loadJson('content/settings.json').catch(function () { return {}; })];
    if (page) {
      requests.push(loadJson('content/' + page + '.json').catch(function () { return {}; }));
    }

    Promise.all(requests).then(function (results) {
      var merged = Object.assign({}, results[0], results[1] || {});
      applyValues(document, merged);
      renderLists(document, merged);
    });
  });
})();
