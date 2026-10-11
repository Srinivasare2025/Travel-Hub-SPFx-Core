/* eslint-disable */
/**
 * Builds provisioning/travelhub-add-pages.js from travelhub-sample-data.js.
 *
 *   node provisioning/tools/build-add-pages.js
 *
 * The add-pages script must use exactly the page content already prepared in
 * travelhub-sample-data.js, so instead of a hand-made copy (which would drift)
 * this copies the REST helpers, the section/card helpers and the page
 * seeders out of that file and wraps them in a small "add only these pages"
 * runner. Re-run it whenever travelhub-sample-data.js changes.
 *
 * It fails (and writes nothing) if a marker it cuts at has moved, or if the
 * copied code uses a name that is only defined in a part it didn't copy.
 */
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'travelhub-sample-data.js');
const OUT = path.join(__dirname, '..', 'travelhub-add-pages.js');
const src = fs.readFileSync(SRC, 'utf8').replace(/\r\n/g, '\n');

function between(startMarker, endMarker) {
  const a = src.indexOf(startMarker);
  if (a < 0) throw new Error('start marker not found: ' + startMarker);
  const b = src.indexOf(endMarker, a + startMarker.length);
  if (b < 0) throw new Error('end marker not found: ' + endMarker);
  return src.slice(a, b);
}

const parts = [
  // REST plumbing + small helpers (link, img, addDays …).
  between('  /* ------------------------- REST plumbing ------------------------------ */', '  /* ----------------------------- DATA --------------------------------- */'),
  // TH_PolicySections / TH_PolicyCards / TH_PolicyTables helpers.
  between('  // --- Policy content-model helpers', '  // -------------------------------------------------------------------\n  // The 6 "Explore Policy Information"'),
  // Brand colour names used by the page seeders.
  between('  // IconColor values are RSG brand colour NAMES', '  const COMMON_SUBPAGE_FIELDS'),
  // Deletes one page and everything under it (REPLACE_EXISTING only).
  between('  // Deletes ONE policy page and everything under it', '  // -------------------------------------------------------------------\n  // Business Travel (home'),
  // Every MORE_PAGE_SEEDERS page, catering pages, TH_Offers seed, service links.
  between('  // -------------------------------------------------------------------\n  // Business Travel (home', '  async function seedMorePages()')
];
const body = parts.join('\n');

// Safety net: no name used here may be defined only in the parts left out.
const defined = new Set();
// Top-level names of the script's IIFE (indented exactly two spaces).
const defRe = /^ {2}(?:async\s+)?(?:function\s+([A-Za-z_$][\w$]*)|const\s+([A-Za-z_$][\w$]*)\s*=)/gm;
let m;
while ((m = defRe.exec(src)) !== null) defined.add(m[1] || m[2]);
const definedHere = new Set();
const bodyDefRe = new RegExp(defRe.source, 'gm');
while ((m = bodyDefRe.exec(body)) !== null) definedHere.add(m[1] || m[2]);
const RUNNER_DEFINED = new Set(['CONFIG', 'webUrl', 'log', 'warn', 'sleep', 'issues', 'created', 'deleted', 'digest']);
const missing = [...defined].filter((name) => !definedHere.has(name) && !RUNNER_DEFINED.has(name) && new RegExp('\\b' + name.replace('$', '\\$') + '\\b').test(body));
if (missing.length) throw new Error('copied code uses names defined outside the copied parts: ' + missing.join(', '));

const header = `/* =============================================================================
 * TravelHub - ADD SELECTED PAGES (browser console / REST)
 * =============================================================================
 *
 * GENERATED from travelhub-sample-data.js by provisioning/tools/build-add-pages.js
 * - do not edit the page content here; edit travelhub-sample-data.js and run
 *   \`node provisioning/tools/build-add-pages.js\` again.
 *
 * Adds the prepared sample content for ONLY the pages listed in CONFIG.PAGES:
 *
 *   'Personal Travel Offers'  -> personal-travel-offers
 *   'Meetings & Events'       -> meetings-events
 *   'SAP Concur'              -> sap-concur + its 4 sub-pages
 *   'Catering Services'       -> catering-services + Mövenpick and Marriott menus
 *   'Family Relocation'       -> family-relocation
 *   'Employee Relocation'     -> employee-relocation
 *   'Business Travel'         -> business-travel (the Business Travel home page)
 *
 * SAFE BY DEFAULT - content that already exists is not changed:
 *   - A page that already exists WITH sections is SKIPPED (left as it is).
 *     Set REPLACE_EXISTING: true to delete and re-create just those pages
 *     instead (their edits are then lost).
 *   - A page row that exists but has NO sections (an empty shell, e.g. added
 *     by hand or left by a failed run) is filled with the sample content.
 *   - If a page fails part-way, the half-built page is removed again and the
 *     error is listed in the SUMMARY - fix it and simply run again.
 *   - No other page, section, card or list is touched.
 *   - TH_Offers (offer cards, explore tiles, partnered hotels used by Personal
 *     Travel Offers and Meetings & Events) is filled only when it is EMPTY.
 *   - TH_TravelServices.PageSlug is set only on rows where it is still empty.
 *
 * HOW TO RUN
 *   1. Run travelhub-provision.js first (lists, columns and choices must exist).
 *   2. Open a page on the target site, F12 -> Console.
 *   3. Check CONFIG below (site URL, which pages), paste the whole file, Enter.
 *   4. Read the SUMMARY at the end, then refresh the Travel Hub page.
 * ========================================================================== */

(async function addTravelHubPages() {
  'use strict';

  const CONFIG = {
    TARGET_WEB_URL: "https://theredsea.sharepoint.com/sites/TravelHub",
    // Remove the pages you don't want to add.
    PAGES: ['Personal Travel Offers', 'Meetings & Events', 'SAP Concur', 'Catering Services', 'Family Relocation', 'Employee Relocation'],
    // false = skip a page that already has sections (empty pages are always filled);
    // true = delete and re-create every listed page.
    REPLACE_EXISTING: false,
    // Fill TH_Offers when it has no items (needed by Personal Travel Offers / Meetings & Events).
    SEED_OFFERS_IF_EMPTY: true,
    // Placeholder photos / PDFs (picsum.photos etc.); false = leave image columns empty.
    USE_PLACEHOLDER_IMAGES: true,
    THROTTLE_MS: 120
  };

  const PAGE_GROUPS = {
    'personal travel offers': ['personal-travel-offers'],
    'meetings & events': ['meetings-events'],
    'meeting & events': ['meetings-events'],
    'sap concur': ['sap-concur', 'sap-concur-plan-book', 'sap-concur-review-approve', 'sap-concur-claim-expense', 'sap-concur-mobile'],
    'catering services': ['catering-services', 'catering-services-movenpick', 'catering-services-marriott'],
    'family relocation': ['family-relocation'],
    'family relocations': ['family-relocation'],
    'employee relocation': ['employee-relocation'],
    'employee relocations': ['employee-relocation'],
    'business travel': ['business-travel']
  };

  const webUrl = CONFIG.TARGET_WEB_URL.replace(/\\/$/, '');
  const log = (...a) => console.log('%c[TravelHub add pages]', 'color:#b89c67;font-weight:bold', ...a);
  const warn = (...a) => console.warn('[TravelHub add pages]', ...a);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const issues = [];
  let created = 0;
  let deleted = 0;

`;

const runner = `
  /* ----------------------------- RUN ---------------------------------- */
  console.group('%cTravelHub - add selected pages', 'color:#04253c;font-weight:bold;font-size:13px');
  log('Target web :', webUrl);
  log('Pages      :', CONFIG.PAGES.join(', '));
  log('Mode       :', CONFIG.REPLACE_EXISTING ? 'REPLACE existing pages' : 'skip pages that already have content (empty pages are filled)');
  try {
    await refreshDigest();

    // Pre-flight: the newer lists/columns these pages use must be provisioned.
    try {
      await spGetJson("/_api/web/lists/getbytitle('TH_PolicySections')/fields/getbyinternalnameortitle('OfferCollection')?$select=Id");
      await spGetJson("/_api/web/lists/getbytitle('TH_PolicyCards')/fields/getbyinternalnameortitle('PopupContent')?$select=Id");
      await spGetJson("/_api/web/lists/getbytitle('TH_Offers')?$select=Id");
      await spGetJson("/_api/web/lists/getbytitle('TH_PolicyPages')/fields/getbyinternalnameortitle('ClosingBannerImageUrl')?$select=Id");
      await spGetJson("/_api/web/lists/getbytitle('TH_PolicyPages')/fields/getbyinternalnameortitle('HeroHighlights')?$select=Id");
    } catch (e) {
      throw new Error('This site is missing lists/columns these pages need - run travelhub-provision.js first. (' + e.message + ')');
    }

    const wanted = [];
    for (const name of CONFIG.PAGES) {
      const slugs = PAGE_GROUPS[String(name).trim().toLowerCase()];
      if (!slugs) {
        issues.push('unknown page name "' + name + '" - use one of: ' + Object.keys(PAGE_GROUPS).join(', '));
        continue;
      }
      slugs.forEach((s) => { if (wanted.indexOf(s) < 0) wanted.push(s); });
    }

    const pages = await spGetJson("/_api/web/lists/getbytitle('TH_PolicyPages')/items?$select=Id,Title,Slug&$top=1000");
    const existing = {}; // slug -> [page ids]
    pages.results.forEach((pg) => {
      pageTitleById[pg.Id] = pg.Title;
      const s = String(pg.Slug || '').trim().toLowerCase();
      if (s) (existing[s] = existing[s] || []).push(pg.Id);
    });
    // How many sections a page has - 0 = an empty shell that can safely be filled.
    const sectionCount = async (pageIds) => {
      const filter = pageIds.map((id) => 'PageIdId eq ' + id).join(' or ');
      const d = await spGetJson("/_api/web/lists/getbytitle('TH_PolicySections')/items?$select=Id&$top=1&$filter=" + encodeURIComponent(filter));
      return d.results.length;
    };

    log('\\n-- Pages ---------------------------------------');
    for (const slug of wanted) {
      let seeding = false;
      try {
        if (existing[slug]) {
          const hasContent = (await sectionCount(existing[slug])) > 0;
          if (hasContent && !CONFIG.REPLACE_EXISTING) {
            log('=  ' + slug + ' already has content - not touched (REPLACE_EXISTING: true re-creates it)');
            continue;
          }
          const removed = await deletePolicyPage(slug);
          log('-  ' + slug + (hasContent ? ' replaced' : ' was an empty page row - filling it') + ' (' + removed + ' old page row removed)');
        }
        seeding = true;
        await MORE_PAGE_SEEDERS[slug]();
        log('+  ' + slug + ' added');
      } catch (e) {
        issues.push(slug + ': ' + e.message);
        warn('  ! ' + slug + ': ' + e.message);
        if (seeding) {
          // Don't leave a half-built page behind - the next run starts clean.
          try {
            await deletePolicyPage(slug);
            warn('    (the half-built ' + slug + ' page was removed again - fix the error above and run the script again)');
          } catch (cleanup) {
            warn('    could not remove the half-built page: ' + cleanup.message);
          }
        }
      }
    }

    if (CONFIG.SEED_OFFERS_IF_EMPTY && wanted.some((s) => s === 'personal-travel-offers' || s === 'meetings-events')) {
      log('\\n-- TH_Offers ------------------------------------');
      try {
        if ((await getTitles('TH_Offers')).length === 0) {
          await seedOffers();
          log('+  TH_Offers filled (featured offers, explore tiles, partnered hotels)');
        } else {
          log('=  TH_Offers already has items - not touched');
        }
      } catch (e) {
        issues.push('TH_Offers: ' + e.message);
        warn('  ! TH_Offers: ' + e.message);
      }
    }

    try {
      await linkServicePages();
    } catch (e) {
      issues.push('TH_TravelServices.PageSlug: ' + e.message);
      warn('  ! TH_TravelServices.PageSlug: ' + e.message);
    }

    log('\\n================ SUMMARY ================');
    log('Created ' + created + ' item(s)' + (deleted ? ', deleted ' + deleted : '') + '.');
    if (issues.length === 0) {
      log('%cDone. Refresh the Travel Hub page. ✔', 'color:#00946e;font-weight:bold');
    } else {
      warn(issues.length + ' issue(s):');
      issues.forEach((i) => warn('   • ' + i));
    }
  } catch (fatal) {
    console.error('%c[TravelHub add pages] FATAL:', 'color:#852e2c;font-weight:bold', fatal);
  } finally {
    console.groupEnd();
  }
})();
`;

fs.writeFileSync(OUT, header + body + runner.replace(/\n/g, '\n'));
console.log('Wrote ' + path.relative(process.cwd(), OUT) + ' (' + fs.statSync(OUT).size + ' bytes)');
