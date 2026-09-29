/* =============================================================================
 * TravelHub - DIAGNOSE (read-only, browser console)
 * =============================================================================
 * Answers "why don't I see the new layouts / pages?" by checking the three
 * things the new pages depend on - nothing is written or changed:
 *
 *   1. COLUMNS  - were the new list columns / choices provisioned?
 *                 (fix: re-run travelhub-provision.js)
 *   2. PAGES    - do the page rows exist, and do they use the new layouts,
 *                 or is it still the old content?
 *                 (fix: travelhub-sample-data.js with CONFIG.RESEED_SLUGS)
 *   3. SERVICES - do Personal Travel / SAP Concur / Meetings & Events have a
 *                 PageSlug so their tab opens the page?
 *                 (fix: RESEED also sets it; or type it in TH_TravelServices)
 *
 * HOW TO RUN: open any page on the Travel Hub site, F12 -> Console, check
 * TARGET_WEB_URL below, paste this whole file, press Enter.
 * ========================================================================== */

(async function diagnoseTravelHub() {
  'use strict';
  const TARGET_WEB_URL = 'https://theredsea.sharepoint.com/sites/TravelHub';

  const webUrl = TARGET_WEB_URL.replace(/\/$/, '');
  const ok = (...a) => console.log('%c  ✔', 'color:#107c41;font-weight:bold', ...a);
  const bad = (...a) => console.log('%c  ✘', 'color:#a4262c;font-weight:bold', ...a);
  const info = (...a) => console.log('%c[TravelHub diagnose]', 'color:#816630;font-weight:bold', ...a);
  const fixes = new Set();

  async function get(url) {
    const res = await fetch(webUrl + url, { credentials: 'same-origin', headers: { Accept: 'application/json;odata=verbose' } });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return (await res.json()).d;
  }
  const fields = async (list) => {
    const d = await get(`/_api/web/lists/getbytitle('${list}')/fields?$select=InternalName,Choices&$top=500`);
    const map = {};
    d.results.forEach((f) => { map[f.InternalName] = f; });
    return map;
  };
  const items = async (list, select, filter) =>
    (await get(`/_api/web/lists/getbytitle('${list}')/items?$select=${select}&$top=2000${filter ? '&$filter=' + encodeURIComponent(filter) : ''}`)).results;

  console.group('%cTravelHub diagnose', 'color:#081c32;font-weight:bold;font-size:13px');
  try {
    // ---------------------------------------------------------------- 1. COLUMNS
    info('1. Columns and choices');
    const expected = {
      TH_PolicySections: ['HideTitle', 'TabId', 'Columns', 'CardStyle', 'TintCards', 'SectionStyle', 'Theme', 'Width', 'LinkText', 'LinkUrl', 'TargetSlug'],
      TH_PolicyCards: ['ImageUrl', 'Subtitle', 'Badge', 'Value', 'ValueLabel', 'ValueNote', 'OpenInNewTab'],
      TH_PolicyPages: ['HeroEyebrow', 'HeroStyle', 'HeroLinkText', 'HeroLinkUrl', 'HeroLinkTargetSlug', 'HeroLink2Text', 'HeroLink2Url', 'HeroLink2TargetSlug'],
      TH_TravelServices: ['PageSlug']
    };
    let sectionFields = {};
    for (const list of Object.keys(expected)) {
      const f = await fields(list);
      if (list === 'TH_PolicySections') sectionFields = f;
      const missing = expected[list].filter((n) => !f[n]);
      if (missing.length) { bad(`${list} is missing: ${missing.join(', ')}`); fixes.add('RUN_PROVISION'); }
      else ok(`${list}: all new columns present`);
    }
    const needLayouts = ['Split', 'Checklist', 'Banner', 'ImageCards', 'Feature', 'Faq', 'Search'];
    const layoutChoices = (sectionFields.Layout && sectionFields.Layout.Choices && sectionFields.Layout.Choices.results) || [];
    const missingLayouts = needLayouts.filter((c) => layoutChoices.indexOf(c) < 0);
    if (missingLayouts.length) { bad(`TH_PolicySections.Layout choices missing: ${missingLayouts.join(', ')}`); fixes.add('RUN_PROVISION'); }
    else ok('Layout choices up to date');
    const cardStyleChoices = (sectionFields.CardStyle && sectionFields.CardStyle.Choices && sectionFields.CardStyle.Choices.results) || [];
    const missingStyles = ['IconHeader', 'IconMedia', 'Stacked', 'ImageTop', 'ImageLeft', 'ImageTile', 'ImageBanner'].filter((c) => cardStyleChoices.indexOf(c) < 0);
    if (sectionFields.CardStyle && missingStyles.length) { bad(`CardStyle choices missing: ${missingStyles.join(', ')}`); fixes.add('RUN_PROVISION'); }

    // ---------------------------------------------------------------- 2. PAGES
    info('2. Pages (old content vs new layouts)');
    const round1 = ['purpose-scope', 'guiding-principles', 'travel-planning-approvals', 'travel-entitlement', 'expenses', 'compliance-responsibilities'];
    const round2 = ['business-travel', 'employee-relocation', 'family-relocation', 'personal-travel-offers', 'meetings-events',
      'sap-concur', 'sap-concur-plan-book', 'sap-concur-review-approve', 'sap-concur-claim-expense', 'sap-concur-mobile'];
    const pages = await items('TH_PolicyPages', 'Id,Title,Slug,IsActive');
    const bySlug = {};
    pages.forEach((p) => { bySlug[String(p.Slug || '').toLowerCase()] = p; });
    const hasNew = !!sectionFields.SectionStyle;
    const sectionSelect = 'Id,PageIdId,Layout' + (hasNew ? ',SectionStyle,CardStyle,Width,TabIdId' : '');
    const sections = await items('TH_PolicySections', sectionSelect);
    const NEW_LAYOUTS = new Set(needLayouts);
    const reseed = [];
    for (const slug of round1.concat(round2)) {
      const p = bySlug[slug];
      if (!p) { bad(`${slug}: page row does NOT exist`); reseed.push(slug); continue; }
      if (!p.IsActive) { bad(`${slug}: page exists but IsActive = No`); continue; }
      const own = sections.filter((s) => s.PageIdId === p.Id);
      const modern = own.filter((s) => NEW_LAYOUTS.has(s.Layout) || (s.SectionStyle && s.SectionStyle !== 'Plain') ||
        (s.CardStyle && s.CardStyle !== 'Default') || (s.Width && s.Width !== 'Full') || s.TabIdId);
      if (modern.length === 0) { bad(`${slug}: ${own.length} section(s), all OLD-style content`); reseed.push(slug); }
      else ok(`${slug}: ${own.length} section(s), ${modern.length} using the new layouts/options`);
    }
    if (reseed.length) fixes.add('RESEED:' + JSON.stringify(reseed));

    // ---------------------------------------------------------------- 3. SERVICES
    info('3. Navigation (TH_TravelServices.PageSlug)');
    if (expected.TH_TravelServices.every(() => true)) {
      try {
        const services = await items('TH_TravelServices', 'Id,Title,PageSlug,IsActive');
        const want = { 'personal travel offers': 'personal-travel-offers', 'personal travel': 'personal-travel-offers', 'sap concur': 'sap-concur', 'meeting & events': 'meetings-events', 'meetings & events': 'meetings-events' };
        services.forEach((s) => {
          const key = String(s.Title || '').trim().toLowerCase();
          if (!want[key]) return;
          if (s.PageSlug) ok(`"${s.Title}" -> PageSlug ${s.PageSlug}${bySlug[s.PageSlug] ? '' : '  (!! no page with that Slug yet)'}`);
          else { bad(`"${s.Title}" has no PageSlug (its tab still opens the old service screen)`); fixes.add('PAGESLUG'); }
        });
      } catch (e) {
        bad('Could not read TH_TravelServices.PageSlug - column missing?'); fixes.add('RUN_PROVISION');
      }
    }
    if (!bySlug['business-travel']) bad('No "business-travel" page row -> the Business Travel tab shows the OLD screen');

    // ---------------------------------------------------------------- SUMMARY
    info('WHAT TO DO');
    if (fixes.size === 0) {
      ok('Lists look up to date. If pages still look old: check the App Catalog has the latest travel-hub.sppkg deployed, then hard-refresh (Ctrl+F5).');
    }
    if (fixes.has('RUN_PROVISION')) console.log('  1) Run provisioning/travelhub-provision.js (adds missing columns / choices; safe to re-run).');
    fixes.forEach((f) => {
      if (f.indexOf('RESEED:') === 0) {
        console.log('  2) In provisioning/travelhub-sample-data.js set\n       RESEED_SLUGS: ' + f.slice(7) +
          '\n     and run it (recreates ONLY these pages; also sets the services\' PageSlug).');
      }
    });
    if (fixes.has('PAGESLUG') && ![...fixes].some((f) => f.indexOf('RESEED:') === 0)) {
      console.log('  3) Set TH_TravelServices.PageSlug for those rows (or run the sample-data RESEED, which fills it).');
    }
  } catch (e) {
    console.error('[TravelHub diagnose] FAILED:', e);
  } finally {
    console.groupEnd();
  }
})();
