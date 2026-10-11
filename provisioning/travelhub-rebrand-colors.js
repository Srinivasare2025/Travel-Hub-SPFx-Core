/* =============================================================================
 * TravelHub - REBRAND COLOURS (browser console / REST)
 * =============================================================================
 *
 * One-off migration to the RSG brand palette for content that ALREADY exists
 * on a site. It rewrites the colour values editors (or the sample-data
 * script) typed into list rows:
 *
 *   TH_PolicyCards.IconColor               #2563eb  -> "Blue Lagoon"
 *   TH_TravelServices.IconBackgroundColor  #04253c  -> "Navy Blue"
 *   TH_BusinessTravelSteps.BackgroundColor #b89c66  -> "Gold"
 *   TH_PolicySections.Theme                Blue     -> "Crystal Waters"
 *
 * Old values keep working without this script (the web part maps old Theme
 * names to brand colours, and any hex still renders) - running it makes the
 * lists show brand names, so future edits stay on-brand and a palette change
 * is a one-file code change (src/common/styles/_tokens.scss).
 *
 * A hex that isn't in the known list is mapped to the NEAREST brand colour.
 * Values that are already brand names / tokens are left alone.
 *
 * HOW TO RUN
 *   1. Run travelhub-provision.js first (adds the new Theme choices).
 *   2. Open a page on the site, F12 -> Console, paste this file, Enter.
 *   3. DRY_RUN (default true) only PRINTS the planned changes. Check them,
 *      set DRY_RUN: false and run again to apply.
 * ========================================================================== */

(async function rebrandTravelHubColours() {
  'use strict';

  const CONFIG = {
    TARGET_WEB_URL: 'https://theredsea.sharepoint.com/sites/TravelHub',
    DRY_RUN: true,
    THROTTLE_MS: 120
  };

  // Keep in step with src/common/utils/color.ts (BRAND_COLORS).
  const BRAND = [
    ['Navy Blue', '#04253c'], ['Gold', '#b89c67'], ['Crystal Waters', '#54c0e8'], ['Blue Lagoon', '#007481'],
    ['Blooming Nature', '#00946e'], ['Majestic Mountains', '#852e2c'], ['Thriving Corals', '#ff5c35'],
    ['Sandy Dunes', '#f4b223'], ['Volcanic Ash', '#6f7271'], ['Pearl Bush', '#f3efeb']
  ];
  // Colours used before the rebrand (mock-up palette) -> chosen brand colour.
  const KNOWN = {
    '#2563eb': 'Blue Lagoon', '#1d4ed8': 'Blue Lagoon', '#0d9488': 'Blue Lagoon', '#0f766e': 'Blue Lagoon', '#0e7490': 'Blue Lagoon',
    '#16a34a': 'Blooming Nature', '#15803d': 'Blooming Nature', '#166534': 'Blooming Nature', '#107c41': 'Blooming Nature', '#0b6a3a': 'Blooming Nature',
    '#d97706': 'Sandy Dunes', '#b45309': 'Sandy Dunes',
    '#dc2626': 'Thriving Corals', '#ea580c': 'Thriving Corals', '#c2410c': 'Thriving Corals', '#e11d48': 'Thriving Corals', '#db2777': 'Thriving Corals',
    '#7c3aed': 'Majestic Mountains', '#6d28d9': 'Majestic Mountains', '#be123c': 'Majestic Mountains', '#9f1239': 'Majestic Mountains', '#a4262c': 'Majestic Mountains',
    '#1e3a8a': 'Navy Blue', '#04253c': 'Navy Blue', '#0f2c4a': 'Navy Blue', '#081c32': 'Navy Blue',
    '#b89c66': 'Gold', '#c3a15e': 'Gold', '#b89c67': 'Gold', '#816630': 'Gold'
  };
  const THEMES = { blue: 'Crystal Waters', teal: 'Blue Lagoon', green: 'Blooming Nature', amber: 'Sandy Dunes', red: 'Thriving Corals', purple: 'Majestic Mountains' };

  const webUrl = CONFIG.TARGET_WEB_URL.replace(/\/$/, '');
  const log = (...a) => console.log('%c[TravelHub rebrand]', 'color:#b89c67;font-weight:bold', ...a);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const esc = (s) => String(s).replace(/'/g, "''");
  let digest = '';

  const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  function nearestBrand(hex) {
    const [r, g, b] = rgb(hex);
    let best = BRAND[0][0];
    let bestD = Infinity;
    BRAND.forEach(([name, h]) => {
      const [r2, g2, b2] = rgb(h);
      const d = (r - r2) ** 2 + (g - g2) ** 2 + (b - b2) ** 2;
      if (d < bestD) { bestD = d; best = name; }
    });
    return best;
  }
  function brandForColour(value) {
    let v = String(value || '').trim().toLowerCase();
    if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/.test(v)) return undefined; // empty, a brand name or a token - leave it
    if (v.length === 4) v = '#' + v[1] + v[1] + v[2] + v[2] + v[3] + v[3];
    return KNOWN[v] || nearestBrand(v);
  }

  async function api(method, url, body) {
    const res = await fetch(webUrl + url, {
      method: method === 'GET' ? 'GET' : 'POST',
      credentials: 'same-origin',
      headers: Object.assign(
        { Accept: 'application/json;odata=verbose' },
        method === 'GET' ? {} : { 'Content-Type': 'application/json;odata=verbose', 'X-RequestDigest': digest },
        method === 'MERGE' ? { 'X-HTTP-Method': 'MERGE', 'IF-MATCH': '*' } : {}
      ),
      body: body ? JSON.stringify(body) : undefined
    });
    if (!res.ok) throw new Error(method + ' ' + url + ' -> HTTP ' + res.status);
    return method === 'GET' || method === 'POST' ? (await res.json()).d : undefined;
  }

  async function migrate(list, field, mapValue) {
    let rows;
    try {
      rows = (await api('GET', `/_api/web/lists/getbytitle('${esc(list)}')/items?$select=Id,Title,${field}&$top=5000`)).results;
    } catch (e) {
      log(`!  ${list}.${field}: ${e.message} - skipped`);
      return 0;
    }
    const type = (await api('GET', `/_api/web/lists/getbytitle('${esc(list)}')?$select=ListItemEntityTypeFullName`)).ListItemEntityTypeFullName;
    let changed = 0;
    for (const row of rows) {
      const next = mapValue(row[field]);
      if (next === undefined || next === row[field]) continue;
      changed++;
      log(`${CONFIG.DRY_RUN ? '(dry run) ' : ''}${list} #${row.Id} "${row.Title}": ${field} ${row[field]} -> ${next}`);
      if (!CONFIG.DRY_RUN) {
        await api('MERGE', `/_api/web/lists/getbytitle('${esc(list)}')/items(${row.Id})`, { __metadata: { type }, [field]: next });
        await sleep(CONFIG.THROTTLE_MS);
      }
    }
    return changed;
  }

  console.group('%cTravelHub rebrand colours', 'color:#04253c;font-weight:bold');
  try {
    digest = (await api('POST', '/_api/contextinfo')).GetContextWebInformation.FormDigestValue;
    const counts = {
      'TH_PolicyCards.IconColor': await migrate('TH_PolicyCards', 'IconColor', brandForColour),
      'TH_TravelServices.IconBackgroundColor': await migrate('TH_TravelServices', 'IconBackgroundColor', brandForColour),
      'TH_BusinessTravelSteps.BackgroundColor': await migrate('TH_BusinessTravelSteps', 'BackgroundColor', brandForColour),
      'TH_Offers.IconColor': await migrate('TH_Offers', 'IconColor', brandForColour),
      'TH_PolicySections.Theme': await migrate('TH_PolicySections', 'Theme', (v) => THEMES[String(v || '').trim().toLowerCase()])
    };
    log('Summary:', counts);
    log(CONFIG.DRY_RUN ? 'DRY RUN - nothing was changed. Set DRY_RUN: false to apply.' : 'Done. Refresh the Travel Hub page.');
  } catch (e) {
    console.error('[TravelHub rebrand] FATAL:', e);
  } finally {
    console.groupEnd();
  }
})();
