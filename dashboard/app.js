// Token Radar dashboard: renders window.RADAR, written by main.ts as data.js.
//
// Four views share one static page:
//   board  - every ranked row, sorted by implied value
//   detail - one protocol's numbers, model breakdown, calibration evidence and farm plan
//   filter - free text, category, chain, TVL floor, watchlist-only and sort
//   live   - token-bearing protocols at market cap, beside the category calibration table
//
// No fetch and no network: the data script is loaded beside the page. The farm
// steps are carried in the data, so the board, the detail view and board.json
// show the same plan. The page never re-derives a price.
(function () {
  'use strict';

  var R = window.RADAR;
  var root = document.body;
  if (!R || !Array.isArray(R.rows)) {
    root.innerHTML = '<main class="fatal"><h1>Token Launch Radar</h1><p>No radar data: data.js is missing or empty.</p></main>';
    return;
  }

  function $(id) { return document.getElementById(id); }
  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function usd(n) {
    return '$' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  function compact(n) {
    var abs = Math.abs(n);
    if (abs >= 1e12) return '$' + (n / 1e12).toFixed(2) + 'T';
    if (abs >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (abs >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (abs >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'K';
    return '$' + Math.round(n);
  }
  function pct(value) {
    if (value == null || !isFinite(value)) return '<span class="muted">—</span>';
    var cls = value > 0 ? 'up' : value < 0 ? 'down' : 'flat';
    return '<span class="delta ' + cls + '">' + (value > 0 ? '+' : '') + value.toFixed(2) + '%</span>';
  }
  function catName(value) { return value == null || value === '' ? 'Uncategorised' : value; }
  function sourceLabel() { return 'DefiLlama public protocols API'; }
  function fmtMultiple(value) { return value == null ? '—' : Number(value).toFixed(4); }

  var bySlug = Object.create(null);
  R.rows.forEach(function (row) { bySlug[row.slug] = row; });
  var calByCat = Object.create(null);
  (R.categories || []).forEach(function (cal) { calByCat[cal.category] = cal; });

  var globalCal = {
    category: 'All tokenized protocols',
    comps: R.model.global_comps,
    median_multiple: R.model.global_median,
    base_multiple: R.model.global_base,
    source: 'global',
    clamped: false
  };

  function calFor(row) {
    var key = row.category == null || row.category === '' ? 'Other' : row.category;
    var found = calByCat[key];
    if (found) return found;
    return {
      category: key,
      comps: globalCal.comps,
      median_multiple: globalCal.median_multiple,
      base_multiple: globalCal.base_multiple,
      source: 'global',
      clamped: false
    };
  }

  // ---- routing -----------------------------------------------------------

  var VIEWS = ['board', 'detail', 'filter', 'live'];

  function route() {
    var raw = location.hash.replace(/^#/, '');
    var mark = raw.indexOf('?');
    var path = mark >= 0 ? raw.slice(0, mark) : raw;
    var query = mark >= 0 ? raw.slice(mark + 1) : '';
    var parts = path.split('/');
    var view = VIEWS.indexOf(parts[0]) >= 0 ? parts[0] : 'board';
    var slug = parts.length > 1 && parts[1] ? decodeURIComponent(parts[1]) : null;
    return { view: view, slug: slug, params: new URLSearchParams(query) };
  }

  function setView(view) {
    VIEWS.forEach(function (name) {
      var el = $('view-' + name);
      if (el) el.hidden = name !== view;
    });
    document.querySelectorAll('.tabs a').forEach(function (link) {
      var on = link.getAttribute('data-view') === view;
      link.classList.toggle('active', on);
      if (on) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
  }

  // ---- shell: snapshot, KPIs, model card ---------------------------------

  function shell() {
    var calibrated = (R.categories || []).filter(function (cal) { return cal.source === 'category'; }).length;
    $('snapshot').innerHTML =
      '<span class="snap-label">Snapshot</span>' +
      '<strong>' + esc(R.as_of) + '</strong>' +
      '<span class="snap-sep">·</span>' +
      '<span>floor ' + compact(R.floor_usd) + '</span>' +
      '<span class="snap-sep">·</span>' +
      '<span>' + esc(sourceLabel()) + '</span>';

    var top = R.rows[0];
    var kpis = [
      ['Board rows', String(R.board_size)],
      ['Watchlist', String(R.watchlist_size)],
      ['Early finds', String(R.early_size)],
      ['Live comps', String(R.live_size)],
      ['Own medians', String(calibrated)],
      ['Top implied value', top ? compact(top.implied_value_usd) : '—']
    ];
    $('kpis').innerHTML = '<p class="eyebrow">At a glance</p><div class="kpi-grid">' +
      kpis.map(function (k) {
        return '<div class="kpi"><span>' + esc(k[0]) + '</span><strong>' + esc(k[1]) + '</strong></div>';
      }).join('') + '</div>';

    $('model-card').innerHTML =
      '<p class="eyebrow">The model</p>' +
      '<h3>TVL × category base × growth × maturity</h3>' +
      '<dl>' +
      '<div><dt>Base multiple</dt><dd>' + R.model.global_base.toFixed(4) + ' global<br><span>' + R.model.global_comps + ' tokenized comps</span></dd></div>' +
      '<div><dt>Category calibration</dt><dd>median mcap / TVL<br><span>3+ comps, clamped ' + R.model.base_floor.toFixed(2) + '–' + R.model.base_ceil.toFixed(2) + '</span></dd></div>' +
      '<div><dt>Growth</dt><dd>1 + 7d × ' + R.model.growth_weight.toFixed(2) + '<br><span>clamped ' + R.model.growth_floor + '% to +' + R.model.growth_cap + '%</span></dd></div>' +
      '<div><dt>Maturity</dt><dd>' + R.model.maturity_floor.toFixed(1) + ' + age × ' + R.model.maturity_range.toFixed(1) + '<br><span>capped at ' + R.model.maturity_days + ' days; unknown age ' + R.model.unknown_age_days + '</span></dd></div>' +
      '</dl>' +
      '<p class="version">' + esc(R.model_version) + '</p>';

    $('rail-source').textContent = 'Source: ' + sourceLabel() + '. Snapshot ' + R.as_of + '.';
  }

  // ---- rows --------------------------------------------------------------

  function rankHtml(rank) {
    return '<span class="rank' + (rank <= 3 ? ' top' : '') + '">' + rank + '</span>';
  }

  function chainsHtml(chains) {
    var shown = chains.slice(0, 2).join(', ');
    var extra = chains.length > 2 ? ' +' + (chains.length - 2) : '';
    return '<span class="chains" title="' + esc(chains.join(', ')) + '">' + esc(shown) + (extra ? '<span class="more">' + extra + '</span>' : '') + '</span>';
  }

  function rowsHtml(rows) {
    if (rows.length === 0) {
      return '<tr class="empty"><td colspan="8">No rows match these filters.</td></tr>';
    }
    return rows.map(function (row) {
      var comps = row.model.calibration === 'category'
        ? row.model.comps + ' comps'
        : 'global';
      return '<tr data-slug="' + esc(row.slug) + '" tabindex="0">' +
        '<td class="num">' + rankHtml(row.rank) + '</td>' +
        '<td><div class="name">' + esc(row.name) + (row.watchlist ? '<span class="pill watch tiny">watchlist</span>' : '') + '</div><span class="slug">' + esc(row.slug) + '</span></td>' +
        '<td><span class="cat">' + esc(catName(row.category)) + '</span></td>' +
        '<td>' + chainsHtml(row.chains) + '</td>' +
        '<td class="num">' + compact(row.tvl_usd) + '</td>' +
        '<td class="num">' + pct(row.change_7d) + '</td>' +
        '<td class="num"><span class="base" title="' + esc(comps + '; category median ' + fmtMultiple(row.model.category_multiple) + '; ' + row.model.calibration) + '">' + row.model.base_multiple.toFixed(4) + '</span><span class="comps">' + esc(comps) + '</span></td>' +
        '<td class="num"><strong class="implied">' + compact(row.implied_value_usd) + '</strong></td>' +
        '</tr>';
    }).join('');
  }

  function wireRows(id) {
    var body = $(id);
    body.addEventListener('click', function (event) {
      var tr = event.target.closest('tr[data-slug]');
      if (tr) location.hash = '#detail/' + encodeURIComponent(tr.getAttribute('data-slug'));
    });
    body.addEventListener('keydown', function (event) {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      var tr = event.target.closest('tr[data-slug]');
      if (!tr) return;
      event.preventDefault();
      location.hash = '#detail/' + encodeURIComponent(tr.getAttribute('data-slug'));
    });
  }

  // ---- board -------------------------------------------------------------

  function renderBoard() {
    $('board-lede').textContent =
      R.board_size + ' protocols: all ' + R.watchlist_size + ' on the watchlist plus ' + R.early_size +
      ' early pre-token subjects below the ' + compact(R.floor_usd) +
      ' floor. Rank 1 is the model’s highest implied launch value.';
    $('board-rows').innerHTML = rowsHtml(R.rows);
  }

  // ---- detail ------------------------------------------------------------

  function calibrationText(row, cal) {
    if (cal.source === 'category') {
      var clamped = cal.clamped ? ' The median was outside the band and was clamped to ' + cal.base_multiple.toFixed(4) + '.' : '';
      return 'Calibrated from ' + cal.comps + ' tokenized ' + esc(cal.category) + ' comp(s) in this snapshot: median market-cap / TVL ' +
        fmtMultiple(cal.median_multiple) + ', so the base multiple is ' + cal.base_multiple.toFixed(4) + '.' + clamped;
    }
    if (cal.comps === 0) {
      return 'The snapshot records no tokenized comp in ' + esc(cal.category) + ', so the model uses the global median market-cap / TVL of ' +
        fmtMultiple(globalCal.median_multiple) + ' over ' + globalCal.comps + ' comps, giving ' + cal.base_multiple.toFixed(4) + '.';
    }
    return esc(cal.category) + ' has only ' + cal.comps + ' tokenized comp(s) — fewer than the ' + R.model.min_comps +
      ' the model needs — so it uses the global median market-cap / TVL of ' + fmtMultiple(globalCal.median_multiple) +
      ' over ' + globalCal.comps + ' comps, giving ' + cal.base_multiple.toFixed(4) + '. The category’s own median is ' + fmtMultiple(cal.median_multiple) + '.';
  }

  function renderDetail(slug) {
    var row = (slug && bySlug[slug]) || R.rows[0];
    if (!row) {
      $('detail-body').innerHTML = '<p class="empty-state">The board is empty.</p>';
      return;
    }
    var cal = calFor(row);
    var at = R.rows.indexOf(row);
    var prev = at > 0 ? R.rows[at - 1] : null;
    var next = at >= 0 && at < R.rows.length - 1 ? R.rows[at + 1] : null;
    var sameCategory = (R.live || []).filter(function (live) { return live.category === row.category; }).slice(0, 5);
    var filterHref = '#filter' + (row.category ? '?category=' + encodeURIComponent(row.category) : '');

    var stats = [
      ['TVL', usd(row.tvl_usd)],
      ['7-day TVL change', row.change_7d == null ? 'not recorded' : (row.change_7d > 0 ? '+' : '') + row.change_7d.toFixed(2) + '%'],
      ['First tracked', row.listed_at == null ? 'not recorded' : row.listed_at],
      ['Age', row.age_days == null ? 'unknown (model uses ' + R.model.unknown_age_days + ' days)' : row.age_days + ' days'],
      ['Market cap', row.mcap_usd == null ? 'none recorded' : usd(row.mcap_usd)],
      ['CoinGecko id / symbol', row.gecko_id == null && row.symbol == null ? 'none recorded' : String(row.symbol || row.gecko_id)],
      ['Chains', row.chains.length ? row.chains.join(', ') : 'not recorded'],
      ['Status', row.watchlist ? 'on the watchlist' : 'early find below the floor']
    ];

    var marketRows = sameCategory.length
      ? '<table class="mini"><thead><tr><th>Live comparable</th><th class="num">Market cap</th><th class="num">mcap / TVL</th></tr></thead><tbody>' +
        sameCategory.map(function (live) {
          return '<tr><td>' + esc(live.name) + '</td><td class="num">' + (live.mcap_usd == null ? '—' : compact(live.mcap_usd)) + '</td><td class="num">' + fmtMultiple(live.multiple) + '</td></tr>';
        }).join('') + '</tbody></table>'
      : '<p class="muted small">No token-bearing protocol in this category appears in the live comparison.</p>';

    $('detail-body').innerHTML =
      '<div class="detail-top">' +
        '<div class="detail-title">' +
          '<p class="eyebrow">Detail · rank #' + row.rank + ' of ' + R.board_size + '</p>' +
          '<h2 id="detail-title">' + esc(row.name) + '</h2>' +
          '<p class="sub">' + esc(catName(row.category)) + ' · ' + esc(row.chains.join(', ') || 'no chain recorded') + ' ' +
            (row.watchlist ? '<span class="pill watch">watchlist</span>' : '<span class="pill">early find</span>') + '</p>' +
        '</div>' +
        '<div class="hero-value"><span>Implied launch value</span><strong>' + usd(row.implied_value_usd) + '</strong><span class="hero-sub">TVL ' + compact(row.tvl_usd) + ' · base ' + row.model.base_multiple.toFixed(4) + '</span></div>' +
      '</div>' +
      '<div class="detail-grid">' +
        '<section class="card formula"><p class="eyebrow">How the value is built</p>' +
          '<div class="formula-line">' +
            '<div><span>TVL</span><strong>' + compact(row.tvl_usd) + '</strong></div>' +
            '<b>×</b><div><span>Base</span><strong>' + row.model.base_multiple.toFixed(4) + '</strong><em>' + esc(cal.source === 'category' ? cal.category : 'global') + '</em></div>' +
            '<b>×</b><div><span>Growth</span><strong>' + row.model.growth_multiplier.toFixed(4) + '</strong><em>' + (row.change_7d == null ? 'no 7d' : (row.change_7d > 0 ? '+' : '') + row.change_7d.toFixed(2) + '%') + '</em></div>' +
            '<b>×</b><div><span>Maturity</span><strong>' + row.model.maturity_multiplier.toFixed(4) + '</strong><em>' + (row.age_days == null ? 'age unknown' : row.age_days + 'd') + '</em></div>' +
            '<b>=</b><div class="result"><span>Implied</span><strong>' + compact(row.implied_value_usd) + '</strong><em>rounded to $1</em></div>' +
          '</div>' +
          '<p class="note">Pre-token in this snapshot: the record carries no market cap, no CoinGecko id and no symbol. A protocol on the watchlist may still have a token its DefiLlama record does not carry; the radar ranks what the record shows.</p>' +
          '<p class="note dim-note">Constants: growth weight ' + R.model.growth_weight.toFixed(2) + ', clamped ' + R.model.growth_floor + '% to +' + R.model.growth_cap + '%; maturity ' + R.model.maturity_floor.toFixed(1) + ' + min(age, ' + R.model.maturity_days + ') / ' + R.model.maturity_days + ' × ' + R.model.maturity_range.toFixed(1) + ', unknown age ' + R.model.unknown_age_days + ' days; base floor ' + R.model.base_floor.toFixed(2) + ', cap ' + R.model.base_ceil.toFixed(2) + ', minimum ' + R.model.min_comps + ' comps.</p>' +
        '</section>' +
        '<section class="card calibration"><p class="eyebrow">Category calibration</p>' +
          '<div class="cal-numbers"><div><span>Comps</span><strong>' + cal.comps + '</strong></div><div><span>Median mcap</span><strong>' + fmtMultiple(cal.median_multiple) + '</strong></div><div><span>Base applied</span><strong>' + cal.base_multiple.toFixed(4) + '</strong></div></div>' +
          '<p class="note">' + calibrationText(row, cal) + '</p>' +
          '<a class="btn" href="' + esc(filterHref) + '">Filter this category</a>' +
        '</section>' +
      '</div>' +
      '<section class="card facts"><p class="eyebrow">Snapshot record</p><dl class="facts-grid">' +
        stats.map(function (s) { return '<div><dt>' + esc(s[0]) + '</dt><dd>' + esc(s[1]) + '</dd></div>'; }).join('') +
      '</dl></section>' +
      '<section class="card farm"><div class="farm-head"><div><p class="eyebrow">Farm plan</p><h3>Six steps, from the row’s own record</h3></div><span class="pill ghost">capital by TVL · hold by age · action by category</span></div>' +
        '<ol>' + row.farm_steps.map(function (step) { return '<li>' + esc(step) + '</li>'; }).join('') + '</ol>' +
      '</section>' +
      '<section class="card market"><p class="eyebrow">Same-category market check</p>' + marketRows + '</section>' +
      '<nav class="row-nav" aria-label="Adjacent ranks">' +
        (prev ? '<a class="btn" href="#detail/' + encodeURIComponent(prev.slug) + '">← #' + prev.rank + ' ' + esc(prev.name) + '</a>' : '<span></span>') +
        '<a class="btn ghost" href="#board">Back to the board</a>' +
        (next ? '<a class="btn" href="#detail/' + encodeURIComponent(next.slug) + '">#' + next.rank + ' ' + esc(next.name) + ' →</a>' : '<span></span>') +
      '</nav>';
  }

  // ---- filter ------------------------------------------------------------

  var filterReady = false;

  function readFilters() {
    return {
      q: $('f-q').value.trim(),
      cat: $('f-cat').value,
      chain: $('f-chain').value,
      min: Number($('f-min').value || 0),
      watch: $('f-watch').checked,
      sort: $('f-sort').value
    };
  }

  function filterSignature(f) {
    return [f.q, f.cat, f.chain, f.min, f.watch ? '1' : '0', f.sort].join('\u0001');
  }

  function applyFilterParams(params) {
    $('f-q').value = params.get('q') || '';
    $('f-cat').value = params.get('category') || '';
    $('f-chain').value = params.get('chain') || '';
    $('f-min').value = params.get('min') || '0';
    $('f-watch').checked = params.get('watch') === '1';
    $('f-sort').value = params.get('sort') || 'implied';
  }

  function comparator(sort) {
    return function (a, b) {
      if (sort === 'tvl') return b.tvl_usd - a.tvl_usd || a.rank - b.rank;
      if (sort === 'growth') return (b.change_7d == null ? -Infinity : b.change_7d) - (a.change_7d == null ? -Infinity : a.change_7d) || a.rank - b.rank;
      if (sort === 'age') return (b.age_days == null ? -1 : b.age_days) - (a.age_days == null ? -1 : a.age_days) || a.rank - b.rank;
      if (sort === 'name') {
        var an = a.name.toLowerCase();
        var bn = b.name.toLowerCase();
        return an < bn ? -1 : an > bn ? 1 : a.rank - b.rank;
      }
      return a.rank - b.rank;
    };
  }

  function filterRows(f) {
    var q = f.q.toLowerCase();
    return R.rows.filter(function (row) {
      if (q) {
        var hay = (row.name + ' ' + row.slug + ' ' + (row.category || '') + ' ' + row.chains.join(' ')).toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      if (f.cat && (row.category || '') !== f.cat) return false;
      if (f.chain && row.chains.indexOf(f.chain) < 0) return false;
      if (row.tvl_usd < f.min) return false;
      if (f.watch && !row.watchlist) return false;
      return true;
    }).sort(comparator(f.sort));
  }

  function syncFilterHash(f) {
    var params = new URLSearchParams();
    if (f.q) params.set('q', f.q);
    if (f.cat) params.set('category', f.cat);
    if (f.chain) params.set('chain', f.chain);
    if (f.min > 0) params.set('min', String(f.min));
    if (f.watch) params.set('watch', '1');
    if (f.sort !== 'implied') params.set('sort', f.sort);
    var hash = '#filter' + (params.toString() ? '?' + params.toString() : '');
    try { history.replaceState(null, '', hash); } catch (error) { /* file URLs may refuse */ }
  }

  function chipsHtml(f) {
    var chips = [];
    if (f.q) chips.push('Text: ' + f.q);
    if (f.cat) chips.push('Category: ' + catName(f.cat));
    if (f.chain) chips.push('Chain: ' + f.chain);
    if (f.min > 0) chips.push('TVL ≥ ' + compact(f.min));
    if (f.watch) chips.push('Watchlist only');
    if (f.sort !== 'implied') chips.push('Sorted by ' + $('f-sort').selectedOptions[0].textContent);
    if (!chips.length) return '<span class="muted small">No filters active. Every board row is shown.</span>';
    return chips.map(function (chip) { return '<span class="chip">' + esc(chip) + '</span>'; }).join('') +
      ' <button type="button" class="chip clear" id="clear-chips">Clear all</button>';
  }

  function renderFilter() {
    var f = readFilters();
    var rows = filterRows(f);
    $('filter-rows').innerHTML = rowsHtml(rows);
    $('filter-meta').innerHTML = '<strong>' + rows.length + '</strong> of ' + R.board_size + ' rows match.';
    $('filter-chips').innerHTML = chipsHtml(f);
    var clear = $('clear-chips');
    if (clear) clear.addEventListener('click', resetFilters);
  }

  function resetFilters() {
    $('f-q').value = '';
    $('f-cat').value = '';
    $('f-chain').value = '';
    $('f-min').value = '0';
    $('f-watch').checked = false;
    $('f-sort').value = 'implied';
    syncFilterHash(readFilters());
    renderFilter();
    $('f-q').focus();
  }

  function initFilter() {
    var categories = [];
    var chains = [];
    R.rows.forEach(function (row) {
      if (row.category && categories.indexOf(row.category) < 0) categories.push(row.category);
      row.chains.forEach(function (chain) { if (chains.indexOf(chain) < 0) chains.push(chain); });
    });
    categories.sort();
    chains.sort();
    categories.forEach(function (category) {
      var option = document.createElement('option');
      option.value = category;
      option.textContent = category;
      $('f-cat').appendChild(option);
    });
    chains.forEach(function (chain) {
      var option = document.createElement('option');
      option.value = chain;
      option.textContent = chain;
      $('f-chain').appendChild(option);
    });
    ['f-q', 'f-cat', 'f-chain', 'f-min', 'f-watch', 'f-sort'].forEach(function (id) {
      var el = $(id);
      el.addEventListener('input', function () { syncFilterHash(readFilters()); renderFilter(); });
      el.addEventListener('change', function () { syncFilterHash(readFilters()); renderFilter(); });
    });
    $('f-reset').addEventListener('click', resetFilters);
  }

  // ---- live --------------------------------------------------------------

  function renderLive() {
    $('live-rows').innerHTML = (R.live || []).map(function (live) {
      return '<tr><td><div class="name">' + esc(live.name) + '</div><span class="slug">' + esc(live.slug) + '</span></td>' +
        '<td><span class="cat">' + esc(catName(live.category)) + '</span></td>' +
        '<td class="num">' + compact(live.tvl_usd) + '</td>' +
        '<td class="num">' + (live.mcap_usd == null ? '—' : compact(live.mcap_usd)) + '</td>' +
        '<td class="num"><strong class="implied">' + fmtMultiple(live.multiple) + '</strong></td>' +
        '<td class="num">' + pct(live.change_7d) + '</td></tr>';
    }).join('');

    var rows = [{ category: globalCal.category, comps: globalCal.comps, median_multiple: globalCal.median_multiple, base_multiple: globalCal.base_multiple, source: 'global', clamped: false }]
      .concat((R.categories || []).slice().sort(function (a, b) { return b.comps - a.comps || b.base_multiple - a.base_multiple || (a.category < b.category ? -1 : 1); }));
    $('category-rows').innerHTML = rows.map(function (cal, index) {
      var width = Math.max(2, Math.min(100, (cal.base_multiple / R.model.base_ceil) * 100));
      var source = cal.source === 'category' ? 'own median' : 'global';
      return '<tr class="' + (index === 0 ? 'global-row' : '') + '"><td><span class="cat">' + esc(cal.category) + '</span>' + (cal.clamped ? ' <span class="pill tiny">clamped</span>' : '') + '</td>' +
        '<td class="num">' + cal.comps + '</td>' +
        '<td class="num">' + fmtMultiple(cal.median_multiple) + '</td>' +
        '<td class="num"><strong>' + cal.base_multiple.toFixed(4) + '</strong><span class="bar"><span style="width:' + width.toFixed(1) + '%"></span></span></td>' +
        '<td><span class="pill ghost tiny">' + source + '</span></td></tr>';
    }).join('');
  }

  // ---- render ------------------------------------------------------------

  function render() {
    var r = route();
    setView(r.view);
    if (r.view === 'board') renderBoard();
    else if (r.view === 'detail') renderDetail(r.slug);
    else if (r.view === 'filter') {
      if (!filterReady) { applyFilterParams(r.params); filterReady = true; }
      renderFilter();
    } else if (r.view === 'live') renderLive();
  }

  // ---- boot --------------------------------------------------------------

  shell();
  initFilter();
  wireRows('board-rows');
  wireRows('filter-rows');
  window.addEventListener('hashchange', render);
  render();
})();
