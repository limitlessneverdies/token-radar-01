// Token Radar dashboard: renders window.RADAR (written by main.ts as data.js).
// Board table, click a row for its detail + farm plan, filter by text or
// category, watchlist-only toggle, and a live-token comparison table.
// The farm plan is generated here from the row's own record, with the
// same rules as lib/model.ts (capital by TVL band, hold by age,
// action by category) — the page and the board agree on the plan.
(function () {
  var R = window.RADAR;
  var rowsEl = document.getElementById('rows');
  var liveEl = document.getElementById('live-rows');
  var detailEl = document.getElementById('detail');
  var qEl = document.getElementById('q');
  var catEl = document.getElementById('cat');
  var watchEl = document.getElementById('watch');
  var summaryEl = document.getElementById('summary');
  if (!R) { summaryEl.textContent = 'No radar data.'; return; }

  function money(n) { return '$' + Math.round(n).toLocaleString('en-US'); }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function capitalFor(tvl) { return tvl >= 5e9 ? 250 : tvl >= 1e9 ? 150 : tvl >= 1e8 ? 100 : 50; }
  function holdFor(age) { if (age == null) return 30; if (age < 180) return 60; if (age < 365) return 45; return 30; }
  function actionFor(row, capital, chain) {
    var c = (row.category || '').toLowerCase(), name = row.name;
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0) return 'Supply $' + capital + ' of USDC to ' + name + ' on ' + chain + ' and keep the position open.';
    if (c.indexOf('dex') >= 0 || c.indexOf('yield') >= 0) return 'Provide $' + capital + ' of liquidity to ' + name + "'s main pool on " + chain + ' and keep the position open.';
    if (c.indexOf('bridge') >= 0) return 'Bridge $' + capital + ' of USDC to ' + chain + ' through ' + name + ' and use the bridged funds in its app.';
    if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0) return 'Stake $' + capital + " of the chain's staking asset through " + name + ' and keep the receipt.';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0) return 'Deposit $' + capital + ' of USDC as margin on ' + name + ' and open one small hedge.';
    if (c.indexOf('stable') >= 0) return 'Mint or deposit $' + capital + ' of the stable asset through ' + name + ' on ' + chain + '.';
    if (c.indexOf('rwa') >= 0) return 'Mint $' + capital + " of the protocol's yield asset on " + chain + ' and hold it.';
    return 'Deposit $' + capital + ' of USDC into ' + name + ' on ' + chain + ' and keep the position open.';
  }
  function farmSteps(row) {
    var chain = row.chains && row.chains.length ? row.chains[0] : 'its main chain';
    var capital = capitalFor(row.tvl_usd), hold = holdFor(row.age_days);
    return [
      'Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline. Cost: under $3 of gas for the first transaction. Time: 5 minutes.',
      actionFor(row, capital, chain) + ' Cost: $' + capital + ' of capital and about $' + (capital >= 150 ? 8 : 4) + ' of gas. Time: 15 minutes to set up.',
      'Make one qualifying action each week, such as a deposit, a borrow, a swap or a vote. Cost: about $2 of gas a week. Time: 10 minutes a week.',
      'Hold the position for at least ' + hold + ' days so the activity is counted in more than one snapshot. Cost: the $' + capital + ' stays in the position. Time: ' + hold + ' days.',
      "Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes. Cost: no fee to check, and never pay to claim. Time: 10 minutes.",
      'Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it. Cost: nothing but the log. Time: 5 minutes.'
    ];
  }
  function showDetail(row) {
    var base = row.tvl_usd > 0 ? row.implied_value_usd / (row.tvl_usd * row.growth_multiplier * row.maturity_multiplier) : 0;
    var steps = farmSteps(row).map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('');
    detailEl.innerHTML = '<h2>#' + row.rank + ' ' + esc(row.name) + '</h2>' +
      '<p>' + esc(row.category || 'No category') + ' · ' + esc(row.chains.join(', ')) + ' · TVL ' + money(row.tvl_usd) +
      ' · 7d ' + (row.change_7d == null ? '—' : row.change_7d + '%') +
      ' · Listed ' + esc(row.listed_at || 'unknown') + ' (' + (row.age_days == null ? 'age unknown' : row.age_days + ' days') + ')</p>' +
      '<p><strong>Implied value ' + money(row.implied_value_usd) + '</strong> = TVL × base ' + base.toFixed(4) +
      ' (median market-cap / TVL of tokenized ' + esc(row.category || 'protocols') + ' in this snapshot) × growth ' + row.growth_multiplier +
      ' × maturity ' + row.maturity_multiplier + '. Pre-token in this snapshot: no market cap, no CoinGecko id, no symbol recorded.</p>' +
      '<h3>Farm plan</h3><ol>' + steps + '</ol>';
  }
  function render() {
    var q = qEl.value.toLowerCase(), cat = catEl.value, watch = watchEl.checked;
    var shown = R.rows.filter(function (r) {
      var hay = (r.name + ' ' + (r.category || '') + ' ' + r.chains.join(' ')).toLowerCase();
      if (q && hay.indexOf(q) < 0) return false;
      if (cat && r.category !== cat) return false;
      if (watch && r.rank > R.watchlist_size) return false;
      return true;
    });
    rowsEl.innerHTML = shown.map(function (r) {
      return '<tr data-slug="' + esc(r.slug) + '"><td>' + r.rank + '</td><td>' + esc(r.name) + '</td><td>' + esc(r.category || '') + '</td><td>' + esc(r.chains.join(', ')) + '</td><td class="num">' + money(r.tvl_usd) + '</td><td class="num">' + (r.change_7d == null ? '—' : r.change_7d + '%') + '</td><td class="num">' + money(r.implied_value_usd) + '</td><td class="num">' + (r.tvl_usd > 0 ? (r.implied_value_usd / (r.tvl_usd * r.growth_multiplier * r.maturity_multiplier)).toFixed(3) : '—') + '</td></tr>';
    }).join('');
    rowsEl.querySelectorAll('tr').forEach(function (tr) {
      tr.addEventListener('click', function () {
        var row = R.rows.find(function (r) { return r.slug === tr.getAttribute('data-slug'); });
        if (row) showDetail(row);
      });
    });
    summaryEl.textContent = R.board_size + ' protocols ranked (' + R.watchlist_size + ' on the watchlist, ' + R.early_size + ' early finds below the $' + R.floor_usd.toLocaleString('en-US') + ' floor), ' + R.live_size + ' live tokens set aside. Snapshot ' + R.as_of + ' · ' + R.source + ' · model ' + R.model_version + '. Showing ' + shown.length + ' rows.';
  }
  var cats = Array.from(new Set(R.rows.map(function (r) { return r.category; }).filter(Boolean))).sort();
  cats.forEach(function (c) { var o = document.createElement('option'); o.value = c; o.textContent = c; catEl.appendChild(o); });
  liveEl.innerHTML = R.live.map(function (p) {
    return '<tr><td>' + esc(p.name) + '</td><td>' + esc(p.category || '') + '</td><td class="num">' + money(p.tvl_usd) + '</td><td class="num">' + (p.mcap_usd == null ? '—' : money(p.mcap_usd)) + '</td><td class="num">' + (p.change_7d == null ? '—' : p.change_7d + '%') + '</td></tr>';
  }).join('');
  qEl.addEventListener('input', render);
  catEl.addEventListener('change', render);
  watchEl.addEventListener('change', render);
  render();
  if (R.rows.length) showDetail(R.rows[0]);
})();
