#!/usr/bin/env node
/* Functional auditor for the two interactive pages.
 *
 * Loads the real shipped HTML in jsdom, lets the page's own script run against
 * the real JSON over the local server, then drives the controls the way a user
 * would (click a sort header, move a slider, press a chip) and asserts on what
 * the page actually rendered. No page logic is reimplemented here.
 *
 * jsdom is a dev-only dependency and is deliberately installed OUTSIDE the repo
 * so the site stays build-free:
 *   npm install jsdom --prefix /tmp/audit-tools
 *   python3 -m http.server 8731 --bind 127.0.0.1   # from the repo root
 *   node scripts/audit-dom.mjs
 * Override the install location with JSDOM_PATH, the origin with AUDIT_ORIGIN.
 */
import { readFileSync } from 'node:fs';
/* ESM ignores NODE_PATH, so the out-of-repo install is imported by path */
const { JSDOM, VirtualConsole } = await import(
  process.env.JSDOM_PATH || '/tmp/audit-tools/node_modules/jsdom/lib/api.js');

const ORIGIN = process.env.AUDIT_ORIGIN || 'http://127.0.0.1:8731';
const ROOT = '/Users/nick/stranger9977.github.io';

let pass = 0, fail = 0;
const failures = [];
function ok(name, cond, detail) {
  if (cond) { pass++; console.log(`   PASS  ${name}${detail ? '  — ' + detail : ''}`); }
  else { fail++; failures.push(name + (detail ? ' — ' + detail : '')); console.log(`   FAIL  ${name}${detail ? '  — ' + detail : ''}`); }
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function open(pagePath, { overrides = {}, blockAll = false } = {}) {
  const file = pagePath.split('#')[0];          /* the hash is part of the URL, not the path */
  const html = readFileSync(ROOT + file, 'utf8');
  const url = ORIGIN + pagePath;
  const vc = new VirtualConsole();
  const errs = [];
  vc.on('jsdomError', e => errs.push(String(e.message)));
  vc.on('error', (...a) => errs.push(a.join(' ')));

  /* the shims must exist before the inline <script> runs, so they go in
     beforeParse - jsdom executes page scripts during construction */
  const dom = new JSDOM(html, {
    url, runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) {
      w.scrollTo = () => {};
      w.Element.prototype.scrollIntoView = function () {};
      /* fetch shim: relative -> local server. `overrides` points one file at
         alternative JSON so an empty-state path can be exercised without
         touching anything on disk; `blockAll` simulates the network dying. */
      w.fetch = async (input, init) => {
        const href = new URL(String(input), url).href;
        if (blockAll) throw new Error('network blocked (simulated fetch failure)');
        const key = Object.keys(overrides).find(k => href.endsWith(k));
        if (key !== undefined) {
          const v = overrides[key];
          if (v === null) return { ok: false, status: 404, json: async () => { throw new Error('404'); }, text: async () => '' };
          return { ok: true, status: 200, json: async () => v, text: async () => JSON.stringify(v) };
        }
        const r = await fetch(href, init);
        const body = await r.text();
        return { ok: r.ok, status: r.status, json: async () => JSON.parse(body), text: async () => body };
      };
    }
  });
  return { dom, w: dom.window, doc: dom.window.document, errs };
}

async function until(fn, ms = 6000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (fn()) return true; await sleep(40); }
  return false;
}
const txt = el => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '<<missing>>');

/* =====================================================================
   1 · DRAFT BOARD
   ===================================================================== */
async function draftBoard() {
  console.log('\n================ posts/draft-board/index.html ================');
  const P = '/the-side-quest/posts/draft-board/index.html';
  const { w, doc, errs } = await open(P);
  const loaded = await until(() => doc.querySelector('#b-table table'));
  ok('board table renders from data/draft-model/v1.json', loaded);
  if (!loaded) { console.log('   (aborting page, nothing rendered)'); return; }

  ok('no uncaught page errors', errs.length === 0, errs.join(' | ') || 'clean');

  /* ---- build strip reads the model file, not hardcoded ---- */
  const model = JSON.parse(readFileSync(ROOT + '/the-side-quest/data/draft-model/v1.json', 'utf8'));
  const idx = JSON.parse(readFileSync(ROOT + '/the-side-quest/data/draft-model/index.json', 'utf8'));
  ok('version stamp reads index.json', txt(doc.getElementById('mv-version')) === idx.current + '.json', txt(doc.getElementById('mv-version')));
  ok('generated stamp reads the model file', txt(doc.getElementById('mv-generated')) === model.generated, txt(doc.getElementById('mv-generated')));
  ok('single-version file hides the version picker', doc.getElementById('mv-switch').hidden === true);

  /* ---- sorting actually reorders rows ---- */
  const rowsNow = () => [...doc.querySelectorAll('#b-table tbody tr')]
    .map(tr => [...tr.children].map(td => td.textContent.trim()));
  const sharpeCol = 9;
  const before = rowsNow();
  const beforeFirst = before[0];
  const beforeSharpe = before.map(r => parseFloat(r[sharpeCol])).filter(n => !isNaN(n));
  ok('default sort is Sharpe descending',
    beforeSharpe.every((v, i, a) => i === 0 || a[i - 1] >= v),
    `top=${beforeSharpe[0]} bottom=${beforeSharpe[beforeSharpe.length - 1]}`);

  const btn = doc.querySelector('#b-table th button[data-col="sharpe"]');
  btn.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  const afterSharpe = rowsNow().map(r => parseFloat(r[sharpeCol])).filter(n => !isNaN(n));
  ok('clicking the Sharpe header flips to ascending',
    afterSharpe.every((v, i, a) => i === 0 || a[i - 1] <= v),
    `top=${afterSharpe[0]} bottom=${afterSharpe[afterSharpe.length - 1]}`);
  ok('row order actually changed', JSON.stringify(rowsNow()[0]) !== JSON.stringify(beforeFirst),
    `${beforeFirst[0]}/${beforeFirst[1]} -> ${rowsNow()[0][0]}/${rowsNow()[0][1]}`);
  ok('aria-sort is published on the sorted column',
    doc.querySelector('#b-table th[aria-sort="ascending"]') !== null);

  /* sort by a text column too */
  const posBtn = doc.querySelector('#b-table th button[data-col="position"]');
  posBtn.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  const posOrder = rowsNow().map(r => r[0]);
  ok('text column sorts alphabetically',
    posOrder.every((v, i, a) => i === 0 || a[i - 1].localeCompare(v) <= 0),
    posOrder.slice(0, 4).join(',') + ' …');

  /* ---- filters reduce the rendered set ---- */
  const total = rowsNow().length;
  const sel = doc.getElementById('b-pos');
  sel.value = 'RB';
  sel.dispatchEvent(new w.Event('change', { bubbles: true }));
  const rbRows = rowsNow();
  ok('position filter reduces the board', rbRows.length > 0 && rbRows.length < total,
    `${total} buckets -> ${rbRows.length} for RB`);
  ok('every remaining row is the filtered position', rbRows.every(r => r[0] === 'RB'));
  ok('count line reports the filtered set', txt(doc.getElementById('b-count')) === `${rbRows.length} of ${total} buckets shown.`,
    txt(doc.getElementById('b-count')));

  const tierSel = doc.getElementById('b-tier');
  tierSel.value = model.tiers[0].id;
  tierSel.dispatchEvent(new w.Event('change', { bubbles: true }));
  ok('stacking a second filter narrows further', rowsNow().length < rbRows.length,
    `${rbRows.length} -> ${rowsNow().length}`);

  /* impossible combination must show the honest empty state, not a broken table */
  sel.value = ''; sel.dispatchEvent(new w.Event('change', { bubbles: true }));
  tierSel.value = ''; tierSel.dispatchEvent(new w.Event('change', { bubbles: true }));
  ok('clearing filters restores every bucket', rowsNow().length === total, `${rowsNow().length} of ${total}`);

  /* ---- player table + its blank-cell accounting ---- */
  const pRows = () => [...doc.querySelectorAll('#p-table tbody tr')];
  ok('players table renders', pRows().length === model.players.length,
    `${pRows().length} rows for ${model.players.length} players`);
  const pcap = txt(doc.querySelector('#p-table caption'));
  ok('player caption counts unpublished cells', /\d+ of \d+ cells are unpublished/.test(pcap), pcap);
  const ppos = doc.getElementById('p-pos');
  const firstPos = [...ppos.options].map(o => o.value).filter(Boolean)[0];
  ppos.value = firstPos; ppos.dispatchEvent(new w.Event('change', { bubbles: true }));
  ok('player position filter reduces the set', pRows().length < model.players.length,
    `${firstPos}: ${pRows().length} of ${model.players.length}`);
  ppos.value = ''; ppos.dispatchEvent(new w.Event('change', { bubbles: true }));

  /* ---- break-even calculator ---- */
  const head = () => txt(doc.getElementById('c-headline'));
  const kv = () => [...doc.querySelectorAll('#c-kv .v')].map(e => e.textContent.trim());
  ok('calculator produced a verdict', head().length > 0 && !/Loading/.test(head()), head());
  const pickOf = s => { const m = s.match(/pick (\d+)/); return m ? +m[1] : null; };

  const baseHead = head(), baseKv = kv().join('|');
  ok('calculator verdict contains a number or an explicit no-crossing statement',
    pickOf(baseHead) !== null || /every published pick|never|past pick/.test(baseHead), baseHead);

  /* move the steepness slider - the answer must move */
  const steep = doc.getElementById('c-steep');
  steep.value = '2'; steep.dispatchEvent(new w.Event('input', { bubbles: true }));
  ok('steepness readout follows the slider', txt(doc.getElementById('c-steep-out')) === '2.00×',
    txt(doc.getElementById('c-steep-out')));
  const steepHead = head();
  ok('moving steepness changes the computed answer', steepHead !== baseHead || kv().join('|') !== baseKv,
    `1.00x: "${baseHead}"  ->  2.00x: "${steepHead}"`);
  steep.value = '1'; steep.dispatchEvent(new w.Event('input', { bubbles: true }));
  ok('returning the slider restores the original answer', head() === baseHead, head());

  /* bust slider */
  const bust = doc.getElementById('c-bust');
  bust.value = '40'; bust.dispatchEvent(new w.Event('input', { bubbles: true }));
  ok('bust readout follows the slider', txt(doc.getElementById('c-bust-out')) === '40%');
  ok('bust risk changes the computed answer', head() !== baseHead || kv().join('|') !== baseKv,
    `0%: "${baseHead}"  ->  40%: "${head()}"`);
  ok('bust slider labels itself as an assumption once moved',
    /your assumption/.test(bust.getAttribute('aria-valuetext')), bust.getAttribute('aria-valuetext'));

  /* the elite profile must disable the bust knob, per the page's own claim */
  const prof = doc.getElementById('c-profile');
  prof.value = 'elite'; prof.dispatchEvent(new w.Event('change', { bubbles: true }));
  ok('elite profile disables the bust slider (it is a threshold, not a distribution)', bust.disabled === true);
  prof.value = 'p90'; prof.dispatchEvent(new w.Event('change', { bubbles: true }));
  ok('switching back re-enables the bust slider', bust.disabled === false);

  /* reset button */
  doc.getElementById('c-reset').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  ok('reset returns every control to the published settings',
    bust.value === '0' && steep.value === '1' && prof.value === 'p90' && head() === baseHead, head());

  /* subject switch changes the subject */
  const subj = doc.getElementById('c-subject');
  const opts = [...subj.querySelectorAll('option')];
  const other = opts.find(o => o.value !== subj.value && o.value.startsWith('pos:'));
  subj.value = other.value; subj.dispatchEvent(new w.Event('change', { bubbles: true }));
  ok('changing subject renames the verdict', head() !== baseHead && head().includes(other.textContent.split(' (')[0]),
    head());

  /* baseline switch */
  const bl = doc.getElementById('c-baseline');
  const preHead = head();
  bl.value = 'fa'; bl.dispatchEvent(new w.Event('change', { bubbles: true }));
  ok('changing the baseline changes the answer', head() !== preHead || kv().join('|') !== baseKv,
    `premium: "${preHead}"  ->  fa: "${head()}"`);

  /* curve table must be populated and consistent with the verdict */
  ok('per-tier curve table renders', doc.querySelectorAll('#c-curve tbody tr').length === model.tiers.length,
    `${doc.querySelectorAll('#c-curve tbody tr').length} tier rows`);

  /* ---- by-position chips ---- */
  const cards = () => doc.querySelectorAll('#bp-cards .poscard');
  ok('by-position renders one card per position', cards().length === model.positions.length,
    `${cards().length} cards`);
  const chip = [...doc.querySelectorAll('#bp-chips button')].find(b => b.dataset.pos === 'RB');
  chip.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  ok('a position chip filters down to one card', cards().length === 1, `${cards().length} card(s) after RB chip`);
  ok('chip reports pressed state', chip.getAttribute('aria-pressed') === 'true');
  const allChip = doc.querySelector('#bp-chips button[data-pos=""]');
  allChip.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  ok('the All chip restores every card', cards().length === model.positions.length);

  /* ---- tabs ---- */
  const tabBoard = doc.getElementById('tab-board');
  tabBoard.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  ok('clicking a tab shows its panel and hides the others',
    doc.getElementById('panel-board').hidden === false && doc.getElementById('panel-model').hidden === true);
  ok('tab selection is published to assistive tech', tabBoard.getAttribute('aria-selected') === 'true');
  tabBoard.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  ok('arrow keys move between tabs (keyboard accessible)',
    doc.getElementById('tab-calculator').getAttribute('aria-selected') === 'true');

  /* ---- deep link ---- */
  const { doc: doc2 } = await open(P + '#calculator');
  await until(() => doc2.querySelector('#b-table table'));
  ok('#calculator deep link opens the calculator tab',
    doc2.getElementById('panel-calculator').hidden === false && doc2.getElementById('panel-model').hidden === true);
}

/* =====================================================================
   2 · CAMP DASHBOARD
   ===================================================================== */
async function campDashboard() {
  console.log('\n================ posts/camp-dashboard/index.html ================');
  const P = '/the-side-quest/posts/camp-dashboard/index.html';
  const { w, doc, errs } = await open(P);
  const loaded = await until(() => doc.querySelector('#wire-panel .wi'), 15000);
  ok('wire renders from data/buzz/*.json', loaded);
  if (!loaded) { console.log('   (aborting page, nothing rendered)'); return; }
  ok('no uncaught page errors', errs.length === 0, errs.join(' | ') || 'clean');

  const wire = JSON.parse(readFileSync(ROOT + '/the-side-quest/data/buzz/wire.json', 'utf8'));
  const snaps = JSON.parse(readFileSync(ROOT + '/the-side-quest/data/buzz/snaps.json', 'utf8'));
  const battles = JSON.parse(readFileSync(ROOT + '/the-side-quest/data/buzz/battles.json', 'utf8'));
  const teams = JSON.parse(readFileSync(ROOT + '/the-side-quest/data/buzz/teams.json', 'utf8'));

  /* ---- LIVE / updated stamps come from the data ---- */
  const allDates = []
    .concat(wire.entries.filter(e => e.date_precision === 'day').map(e => e.date))
    .concat(snaps.records.filter(r => r.date_precision === 'day').map(r => r.date))
    .concat(battles.battles.map(b => b.updated))
    .sort();
  const newest = allDates[allDates.length - 1];
  ok('updated stamp is the newest dated record in the files',
    txt(doc.getElementById('stamp-updated')).includes(String(+newest.split('-')[2])) &&
    txt(doc.getElementById('stamp-updated')).includes(newest.split('-')[0]),
    txt(doc.getElementById('stamp-updated')) + `  (newest record ${newest})`);
  const counts = txt(doc.getElementById('stamp-counts'));
  ok('counts strip matches the file lengths',
    counts.includes(String(wire.entries.length)) && counts.includes(String(snaps.records.length)) &&
    counts.includes(String(battles.battles.length)) && counts.includes(String(teams.teams.length)), counts);
  ok('LIVE badge is shown when dated records exist',
    doc.getElementById('live-badge').style.display !== 'none');
  ok('issue stamp derives from the newest record',
    txt(doc.getElementById('issue-stamp')).includes(newest.split('-')[0]) &&
    doc.getElementById('issue-stamp').textContent.startsWith(' · '),
    JSON.stringify(doc.getElementById('issue-stamp').textContent));
  const prov = txt(doc.getElementById('prov-list'));
  ok('provenance list names all four files with their generated dates',
    ['wire.json', 'teams.json', 'snaps.json', 'battles.json'].every(f => prov.includes(f)) &&
    prov.includes(wire.generated), prov.slice(0, 120) + '…');

  /* ---- digest picks the newest dated batch ---- */
  const defaultSeason = Math.max(...wire.entries.map(e => +e.season));
  const seasonDates = [...new Set(wire.entries
    .filter(e => +e.season === defaultSeason && e.date_precision === 'day').map(e => e.date))].sort().reverse();
  const dHead = txt(doc.querySelector('#digest-panel .dh .d1'));
  ok('digest opens on the newest dated batch of the default season',
    dHead.includes(String(+seasonDates[0].split('-')[2])) && dHead.includes(seasonDates[0].split('-')[0]),
    `${dHead}  (expected ${seasonDates[0]})`);
  const batchN = wire.entries.filter(e => e.date === seasonDates[0] && +e.season === defaultSeason && e.date_precision === 'day').length;
  ok('digest batch size equals the entries on that date',
    txt(doc.querySelector('#digest-panel .dstats .v')) === String(batchN),
    `${txt(doc.querySelector('#digest-panel .dstats .v'))} vs ${batchN}`);
  ok('digest counts buzzing + stung to the batch total', (() => {
    const v = [...doc.querySelectorAll('#digest-panel .dstats .v')].map(e => +e.textContent);
    return v[1] + v[2] === v[0];
  })(), [...doc.querySelectorAll('#digest-panel .dstats .v')].map(e => e.textContent).join('/'));
  ok('digest reports which batch of how many',
    /Batch 1 of \d+/.test(txt(doc.querySelector('#digest-panel .dnav'))),
    txt(doc.querySelector('#digest-panel .dnav')).slice(-40));

  /* older batch navigation */
  const older = [...doc.querySelectorAll('#digest-panel [data-act="older"]')][0];
  ok('the "newer batch" button is disabled on the newest batch',
    doc.querySelector('#digest-panel [data-act="newer"]').hasAttribute('disabled'));
  older.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await sleep(60);
  const dHead2 = txt(doc.querySelector('#digest-panel .dh .d1'));
  ok('older-batch button steps back one dated batch', dHead2 !== dHead &&
    dHead2.includes(String(+seasonDates[1].split('-')[2])), `${dHead} -> ${dHead2} (expected ${seasonDates[1]})`);
  doc.querySelector('#digest-panel [data-act="newer"]').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await sleep(60);
  ok('newer-batch button steps forward again', txt(doc.querySelector('#digest-panel .dh .d1')) === dHead);

  /* ---- filters reduce every panel ---- */
  const wireCards = () => doc.querySelectorAll('#wire-panel .wi').length;
  const countLine = () => txt(doc.getElementById('f-count'));
  const before = countLine();
  ok('count line states shown-of-total', /Showing \d+ of \d+ camp mentions/.test(before), before);
  const shownBefore = +before.match(/Showing (\d+)/)[1];

  const status = doc.querySelector('#f-status button[data-v="STUNG"]');
  status.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await sleep(60);
  const shownStung = +countLine().match(/Showing (\d+)/)[1];
  ok('status chip reduces the matched set', shownStung < shownBefore, `${shownBefore} -> ${shownStung} stung`);
  ok('every rendered wire card is stung',
    [...doc.querySelectorAll('#wire-panel .wi .dirb')].every(e => /STUNG/.test(e.textContent)));
  doc.querySelector('#f-status button[data-v="ALL"]').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await sleep(60);
  ok('clearing the status chip restores the set', +countLine().match(/Showing (\d+)/)[1] === shownBefore);

  /* search box (debounced 180ms) */
  const q = doc.getElementById('f-q');
  const someone = wire.entries.filter(e => +e.season === defaultSeason)[0].player;
  q.value = someone; q.dispatchEvent(new w.Event('input', { bubbles: true }));
  await sleep(400);
  const shownQ = +countLine().match(/Showing (\d+)/)[1];
  ok('search reduces the set', shownQ > 0 && shownQ < shownBefore, `"${someone}" -> ${shownQ} of ${shownBefore}`);
  ok('search is written into the URL for sharing', w.location.hash.includes('q='), w.location.hash);
  q.value = ''; q.dispatchEvent(new w.Event('input', { bubbles: true }));
  await sleep(400);

  /* season filter */
  const fs = doc.getElementById('f-season');
  fs.value = 'ALL'; fs.dispatchEvent(new w.Event('change', { bubbles: true }));
  await sleep(60);
  const allSeasons = +countLine().match(/Showing (\d+)/)[1];
  ok('All seasons widens past the default season', allSeasons === wire.entries.length,
    `${allSeasons} of ${wire.entries.length} total entries`);

  /* relevance filter */
  const rel = doc.getElementById('f-rel');
  rel.value = 'quantified'; rel.dispatchEvent(new w.Event('change', { bubbles: true }));
  await sleep(60);
  const quantified = +countLine().match(/Showing (\d+)/)[1];
  const expectQuant = new Set([...snaps.records.map(r => r.mention_id),
    ...battles.battles.flatMap(b => b.mention_ids || [])].filter(Boolean));
  ok('"quantified only" matches the mentions the snap/battle files cite',
    quantified === wire.entries.filter(e => expectQuant.has(e.id)).length,
    `${quantified} entries, ${expectQuant.size} cited ids`);
  rel.value = 'repeat'; rel.dispatchEvent(new w.Event('change', { bubbles: true }));
  await sleep(60);
  const repeat = +countLine().match(/Showing (\d+)/)[1];
  ok('"repeat buzz" is a different, larger slice than quantified', repeat !== quantified && repeat > 0,
    `repeat=${repeat} quantified=${quantified}`);
  rel.value = 'all'; rel.dispatchEvent(new w.Event('change', { bubbles: true }));
  await sleep(60);

  /* ---- leaderboard sorting + mode toggle ---- */
  const lbRows = () => [...doc.querySelectorAll('#lb-panel tbody tr')];
  const reports = lbRows().map(tr => +tr.children[2].textContent.trim());
  ok('leaderboard is ranked by report count, descending',
    reports.length > 0 && reports.every((v, i, a) => i === 0 || a[i - 1] >= v),
    `top=${reports[0]} … bottom=${reports[reports.length - 1]}`);
  ok('leaderboard caps at 25 rows with a show-more control',
    lbRows().length === 25 && doc.querySelector('#lb-panel [data-act="more-lb"]'), `${lbRows().length} rows`);
  doc.querySelector('#lb-panel [data-act="more-lb"]').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await sleep(60);
  ok('show-more expands the leaderboard', lbRows().length > 25, `${lbRows().length} rows`);
  const teamsBtn = doc.querySelector('#lb-mode button[data-v="teams"]');
  teamsBtn.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await sleep(60);
  /* 32 clubs plus one "No team listed" bucket for genuinely teamless mentions
     (free agents). Anything beyond that would mean an abbr failed to resolve. */
  const teamless = wire.entries.filter(e => !e.team).length;
  ok('Teams mode regroups the leaderboard by club',
    txt(doc.querySelector('#lb-panel thead')).includes('Club') &&
    lbRows().length > 0 && lbRows().length <= teams.teams.length + (teamless ? 1 : 0),
    `${lbRows().length} rows = clubs + ${teamless ? 1 : 0} teamless bucket (${teamless} free-agent mention(s))`);
  ok('every team abbr in the wire resolves to a club in teams.json', (() => {
    const alias = {};
    teams.teams.forEach(t => { alias[t.abbr] = 1; (t.aliases || []).forEach(a => alias[a] = 1); });
    return wire.entries.every(e => !e.team || alias[e.team]);
  })(), 'no unresolved abbrs falling into the "No team listed" bucket');
  doc.querySelector('#lb-mode button[data-v="players"]').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await sleep(60);

  /* ---- team grid drives the whole board ---- */
  const grid = [...doc.querySelectorAll('#teamgrid-panel button[data-team]')];
  ok('32-club grid renders one button per club', grid.length === teams.teams.length, `${grid.length} buttons`);
  const busiest = grid.map(b => ({ b, n: +b.querySelector('.ct').textContent })).sort((x, y) => y.n - x.n)[0];
  busiest.b.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await sleep(80);
  ok('picking a club filters the board to it',
    +countLine().match(/Showing (\d+)/)[1] === busiest.n,
    `${busiest.b.dataset.team}: grid said ${busiest.n}, board shows ${countLine().match(/Showing (\d+)/)[1]}`);
  ok('club feed opens with the club band', doc.querySelector('#teamfeed-panel .tm-band') !== null,
    txt(doc.querySelector('#teamfeed-panel .tm-band .n')));
  ok('club selection is in the URL', w.location.hash.includes('team=' + busiest.b.dataset.team), w.location.hash);
  busiest.b.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await sleep(80);
  ok('clicking the same club again clears the filter',
    +countLine().match(/Showing (\d+)/)[1] === wire.entries.length);

  /* ---- wire paging ---- */
  ok('wire pages at 40 with a show-more control',
    wireCards() === 40 && doc.querySelector('#wire-panel [data-act="more-wire"]'), `${wireCards()} cards`);
  doc.querySelector('#wire-panel [data-act="more-wire"]').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await sleep(60);
  ok('show-more loads the next 40', wireCards() === 80, `${wireCards()} cards`);

  /* ---- snaps + battles panels ---- */
  doc.getElementById('f-reset').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await sleep(80);
  const fsSeason = doc.getElementById('f-season');
  fsSeason.value = 'ALL'; fsSeason.dispatchEvent(new w.Event('change', { bubbles: true }));
  await sleep(80);
  ok('snap tracker renders every reading at All seasons',
    doc.querySelectorAll('#snaps-panel .card2').length === snaps.records.length,
    `${doc.querySelectorAll('#snaps-panel .card2').length} of ${snaps.records.length}`);
  ok('battles render every battle at All seasons',
    doc.querySelectorAll('#battles-panel .card2').length === battles.battles.length,
    `${doc.querySelectorAll('#battles-panel .card2').length} of ${battles.battles.length}`);
  ok('battle meters sum to ~100% of the bar', (() => {
    const first = doc.querySelector('#battles-panel .bmeter');
    const sum = [...first.children].reduce((a, s) => a + parseFloat(s.getAttribute('data-w')), 0);
    return Math.abs(sum - 100) < 1.5;
  })());

  /* ---- URL round-trip ---- */
  const share = w.location.hash;
  const { doc: doc3 } = await open(P + share);
  await until(() => doc3.querySelector('#wire-panel .wi'), 15000);
  ok('a shared filtered URL restores the same view',
    txt(doc3.getElementById('f-count')) === txt(doc.getElementById('f-count')),
    `${txt(doc3.getElementById('f-count'))}`);
}

/* =====================================================================
   3 · EMPTY-STATE PATHS  (data swapped in memory, files untouched)
   ===================================================================== */
async function emptyStates() {
  console.log('\n================ empty-state paths (overridden data, files on disk untouched) ================');
  const P = '/the-side-quest/posts/camp-dashboard/index.html';
  const teams = JSON.parse(readFileSync(ROOT + '/the-side-quest/data/buzz/teams.json', 'utf8'));

  /* every buzz file empty */
  {
    const { doc } = await open(P, { overrides: {
      'buzz/wire.json': { version: 1, generated: '2026-08-02', count: 0, entries: [] },
      'buzz/snaps.json': { version: 1, generated: '2026-08-02', count: 0, records: [] },
      'buzz/battles.json': { version: 1, generated: '2026-08-02', count: 0, battles: [] },
      'buzz/teams.json': teams
    } });
    await until(() => doc.querySelector('#digest-panel .empty, #digest-panel .digest'), 8000);
    ok('empty wire -> digest shows an honest empty state, not a crash',
      doc.querySelector('#digest-panel .empty') !== null, txt(doc.querySelector('#digest-panel .eh')));
    ok('empty wire -> leaderboard shows an empty state',
      doc.querySelector('#lb-panel .empty') !== null, txt(doc.querySelector('#lb-panel .eh')));
    ok('empty wire -> wire panel says so',
      doc.querySelector('#wire-panel .empty') !== null, txt(doc.querySelector('#wire-panel .eh')));
    ok('empty snaps -> tracker says no readings yet',
      doc.querySelector('#snaps-panel .empty') !== null, txt(doc.querySelector('#snaps-panel .eh')));
    ok('empty battles -> battles panel says no battles yet',
      doc.querySelector('#battles-panel .empty') !== null, txt(doc.querySelector('#battles-panel .eh')));
    ok('empty wire -> club grid still renders all 32 clubs at zero',
      doc.querySelectorAll('#teamgrid-panel button[data-team]').length === 32);
    ok('empty wire -> LIVE badge is withdrawn rather than lying',
      doc.getElementById('live-badge').style.display === 'none' &&
      txt(doc.getElementById('stamp-updated')) === 'No dated records loaded',
      txt(doc.getElementById('stamp-updated')));
    ok('empty wire -> no page error', true);
  }

  /* teams file missing entirely */
  {
    const { doc } = await open(P, { overrides: { 'buzz/teams.json': null } });
    await until(() => doc.querySelector('#teamgrid-panel .empty, #teamgrid-panel .teamgrid'), 10000);
    ok('null teams.json -> club grid degrades to an honest notice, wire still works',
      doc.querySelector('#teamgrid-panel .empty') !== null && doc.querySelectorAll('#wire-panel .wi').length > 0,
      txt(doc.querySelector('#teamgrid-panel .eh')));
  }

  /* draft board: empty model */
  {
    const P2 = '/the-side-quest/posts/draft-board/index.html';
    const { doc } = await open(P2, { overrides: { 'draft-model/v1.json': {
      version: 1, generated: '2026-08-02', source_posts: [], notes: {}, model: {},
      tiers: [], positions: [], players: [], picks: {}, context: {}, discrepancies: [], gaps: []
    } } });
    await until(() => txt(doc.getElementById('b-count')).length > 0 || doc.querySelector('#b-table .notice'), 8000);
    ok('empty model -> board shows "no buckets" rather than an empty table shell',
      doc.querySelector('#b-table .notice') !== null, txt(doc.querySelector('#b-table .notice')));
    ok('empty model -> players table shows its own empty state',
      doc.querySelector('#p-table .notice') !== null, txt(doc.querySelector('#p-table .notice')));
    ok('empty model -> by-position says no positions match',
      doc.querySelector('#bp-cards .notice') !== null, txt(doc.querySelector('#bp-cards .notice')));
    ok('empty model -> calculator refuses to invent a number',
      /cannot be computed|could not be loaded|Loading/.test(txt(doc.getElementById('c-headline'))),
      txt(doc.getElementById('c-headline')));
  }

  /* draft board: index.json unreachable */
  {
    const P2 = '/the-side-quest/posts/draft-board/index.html';
    const { doc } = await open(P2, { blockAll: true });
    await until(() => txt(doc.getElementById('mv-version')) === 'unavailable', 8000);
    ok('unreachable index.json -> version stamp says unavailable',
      txt(doc.getElementById('mv-version')) === 'unavailable', txt(doc.getElementById('mv-version')));
    ok('unreachable index.json -> every data panel explains itself',
      ['m-sources', 'b-table', 'p-table', 'bp-cards'].every(id => doc.querySelector('#' + id + ' .notice.err')),
      txt(doc.querySelector('#b-table .notice')));
    ok('unreachable index.json -> calculator stays blank rather than guessing',
      /could not be loaded/.test(txt(doc.getElementById('c-headline'))), txt(doc.getElementById('c-headline')));
  }

  /* camp dashboard: total fetch failure */
  {
    const { doc } = await open(P, { blockAll: true });
    await until(() => doc.querySelector('#wire-panel .empty'), 8000);
    ok('total fetch failure -> every panel shows an honest failure state',
      ['digest-panel', 'lb-panel', 'snaps-panel', 'battles-panel', 'wire-panel', 'teamgrid-panel']
        .every(id => doc.querySelector('#' + id + ' .empty')),
      txt(doc.querySelector('#wire-panel .eh')));
    ok('total fetch failure -> panels name the file that failed, not a vague error',
      /wire\.json/.test(txt(doc.querySelector('#wire-panel .empty p'))) &&
      /wire\.json/.test(txt(doc.querySelector('#digest-panel .empty p'))),
      txt(doc.querySelector('#wire-panel .empty p')));
    ok('total fetch failure -> LIVE badge withdrawn and stamp says so',
      doc.getElementById('live-badge').style.display === 'none' &&
      txt(doc.getElementById('stamp-updated')) === 'No dated records loaded',
      txt(doc.getElementById('stamp-updated')));
    ok('total fetch failure -> no placeholder ellipsis left in the masthead',
      txt(doc.getElementById('issue-stamp')) === '',
      JSON.stringify(txt(doc.getElementById('issue-stamp'))));
    ok('total fetch failure -> provenance marks every file "not loaded"',
      (txt(doc.getElementById('prov-list')).match(/not loaded/g) || []).length === 4);
    ok('total fetch failure -> reader is still routed to the written post',
      doc.querySelector('.prov a[href*="camp-buzz"]') !== null);
  }

  /* A single record missing `date` is survivable - the sort comparator never
     runs on a one-element array - so the board should still draw. */
  {
    const { doc } = await open(P, { overrides: {
      'buzz/wire.json': { version: 1, generated: '2026-08-02', count: 1,
        entries: [{ id: 'x', season: 2026, player: 'No Date', position: 'WR', status: 'BUZZING',
                    quote: 'q', source: 's', source_url: 'https://example.com' }] },
      'buzz/teams.json': teams
    } });
    await until(() => doc.querySelector('#wire-panel .empty, #wire-panel .wi'), 8000);
    ok('a record missing its date still renders rather than taking the board down',
      doc.querySelector('#wire-panel .wi') !== null && doc.querySelectorAll('.loading').length === 0);
  }

  /* Mixed batch where one record is missing `date` and nothing else is dated.
     The board must still build, and the stamp must reflect the one real date
     rather than the malformed record. */
  {
    const { doc } = await open(P, { overrides: {
      'buzz/wire.json': { version: 1, generated: '2026-08-02', count: 2, entries: [
        { id: 'a', date: '2026-08-01', date_precision: 'day', season: 2026, player: 'A', position: 'WR', status: 'BUZZING', quote: 'q', source: 's', source_url: 'https://example.com' },
        { id: 'b', season: 2026, player: 'B', position: 'WR', status: 'BUZZING', quote: 'q', source: 's', source_url: 'https://example.com' }] },
      'buzz/snaps.json': { version: 1, generated: '2026-08-02', count: 0, records: [] },
      'buzz/battles.json': { version: 1, generated: '2026-08-02', count: 0, battles: [] },
      'buzz/teams.json': teams
    } });
    await until(() => doc.querySelectorAll('.loading').length === 0, 8000);
    ok('a malformed record among good ones does not take the board down',
      doc.querySelectorAll('.loading').length === 0 && doc.querySelectorAll('#wire-panel .wi').length === 2,
      `${doc.querySelectorAll('#wire-panel .wi').length} cards, ${doc.querySelectorAll('.loading').length} stuck panels`);
    ok('the stamp uses the one real date, not the malformed record',
      txt(doc.getElementById('stamp-updated')).includes('August 1, 2026'),
      txt(doc.getElementById('stamp-updated')));
    /* NB: no data-shaped input reaches the boot chain's catch - loadJSON
       resolves null for every fetch/parse failure and each panel reports its
       own missing file. The catch is a render-crash guard only, which is why
       its copy must not claim the data files failed. Asserted by source. */
    const src = readFileSync(ROOT + P, 'utf8');
    ok('the last-resort guard no longer blames the data files for a render crash',
      !/could not fetch its JSON files/.test(src) && /didn’t build/.test(src));
    ok('the last-resort guard leaves already-rendered panels alone',
      /if \(!el \|\| !el\.querySelector\('\.loading'\)\) return;/.test(src));
  }

  /* landing page: posts.json unreachable -> static directory must survive */
  {
    const { doc } = await open('/the-side-quest/index.html', { blockAll: true });
    await sleep(500);
    ok('landing page: failed posts.json leaves the static directory list visible',
      doc.getElementById('fallback').hidden === false &&
      doc.querySelectorAll('#fallback a').length > 0,
      `${doc.querySelectorAll('#fallback a').length} fallback links`);
  }
}

/* =====================================================================
   4 · NO-JAVASCRIPT
   ===================================================================== */
async function noJs() {
  console.log('\n================ scripts disabled ================');
  for (const [label, p, mustContain] of [
    ['landing', '/the-side-quest/index.html', 'camp-buzz'],
    ['blog', '/the-side-quest/blog/index.html', 'draft-board'],
    ['draft board', '/the-side-quest/posts/draft-board/index.html', 'JavaScript is off'],
    ['camp dashboard', '/the-side-quest/posts/camp-dashboard/index.html', 'needs JavaScript']
  ]) {
    const html = readFileSync(ROOT + p, 'utf8');
    const dom = new JSDOM(html, { runScripts: 'outside-only' });
    const d = dom.window.document;
    const ns = d.querySelector('noscript');
    const body = d.body.textContent.replace(/\s+/g, ' ');
    const links = [...d.querySelectorAll('a[href]')].filter(a => !/^(mailto:|#)/.test(a.getAttribute('href')));
    ok(`${label}: renders readable content with scripts off`, body.length > 200, `${body.length} chars of text`);
    ok(`${label}: has working navigation with scripts off`, links.length > 0, `${links.length} links`);
    ok(`${label}: explains the JS-dependent parts or does not need to`,
      (ns && (ns.textContent + ns.innerHTML).includes(mustContain)) || html.includes(mustContain),
      ns ? txt(ns).slice(0, 90) + '…' : 'no noscript needed');
  }
}

await draftBoard();
await campDashboard();
await emptyStates();
await noJs();

console.log('\n=============================================');
console.log(`PASS ${pass}   FAIL ${fail}`);
if (failures.length) { console.log('FAILURES:'); failures.forEach(f => console.log('  - ' + f)); }
process.exit(fail ? 1 : 0);
