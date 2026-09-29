/* =============================================================================
 * TravelHub - one-off REPAIR: untitled policy sections + orphaned cards
 * =============================================================================
 *
 * WHY: TH_PolicyCards / TH_PolicyTables / TH_PolicyTabs pick their parent
 * section through a `SectionId` lookup that displays the section's Title.
 * Sections created without a Title (e.g. the Annual Flight Ticket Benefits
 * rules grid) show as a BLANK option in the SharePoint edit form, and saving
 * a card there (e.g. after changing its Icon or SubPoints) can clear its
 * SectionId - the card then disappears from the page.
 *
 * WHAT IT DOES
 *   1. Every TH_PolicySections row with an empty Title gets an internal Title
 *      "<Page title> - <Layout> <DisplayOrder>" and HideTitle = Yes, so it is
 *      identifiable in the lookup but still shows NO heading on the page.
 *   2. Lists every TH_PolicyCards / TH_PolicyTables row that has no parent
 *      at all (PageId, SectionId and TabId all empty) - these are the cards
 *      that "disappeared". Re-select their SectionId in the list form (the
 *      section now has a name), then refresh the page.
 *   Nothing is deleted. Rows that already have a Title are not touched.
 *
 * PREREQUISITE: re-run travelhub-provision.js first (adds the HideTitle column).
 *
 * HOW TO RUN: open a page on the target site, F12 -> Console, check
 * CONFIG.TARGET_WEB_URL, paste this whole file, press Enter.
 * Set CONFIG.DRY_RUN = false to actually write step 1 (default: report only).
 * ========================================================================== */

(async function fixTravelHubSectionTitles() {
  'use strict';

  const CONFIG = {
    TARGET_WEB_URL: 'https://theredsea.sharepoint.com/sites/TravelHub',
    DRY_RUN: true
  };

  const webUrl = CONFIG.TARGET_WEB_URL.replace(/\/$/, '');
  const log = (...a) => console.log('%c[TravelHub fix]', 'color:#816630;font-weight:bold', ...a);

  async function getJson(url) {
    const res = await fetch(webUrl + url, { credentials: 'same-origin', headers: { Accept: 'application/json;odata=verbose' } });
    if (!res.ok) throw new Error('GET ' + url + ' -> HTTP ' + res.status);
    return (await res.json()).d;
  }

  async function digest() {
    const res = await fetch(webUrl + '/_api/contextinfo', { method: 'POST', credentials: 'same-origin', headers: { Accept: 'application/json;odata=verbose' } });
    return (await res.json()).d.GetContextWebInformation.FormDigestValue;
  }

  const items = (list, select) => getJson(`/_api/web/lists/getbytitle('${list}')/items?$select=${select}&$top=2000`).then((d) => d.results);

  try {
    const fields = await getJson("/_api/web/lists/getbytitle('TH_PolicySections')/fields?$select=InternalName&$filter=InternalName eq 'HideTitle'");
    if (fields.results.length === 0) {
      throw new Error('TH_PolicySections.HideTitle is missing - re-run travelhub-provision.js first.');
    }

    const pages = await items('TH_PolicyPages', 'Id,Title');
    const pageTitle = {};
    pages.forEach((p) => { pageTitle[p.Id] = p.Title; });

    const sections = await items('TH_PolicySections', 'Id,Title,PageIdId,Layout,DisplayOrder');
    const untitled = sections.filter((s) => !s.Title || !String(s.Title).trim());
    log(`Step 1: ${untitled.length} untitled section(s)${CONFIG.DRY_RUN ? ' (DRY RUN - nothing written)' : ''}`);

    const type = (await getJson("/_api/web/lists/getbytitle('TH_PolicySections')?$select=ListItemEntityTypeFullName")).ListItemEntityTypeFullName;
    const token = CONFIG.DRY_RUN ? '' : await digest();
    for (const s of untitled) {
      const title = `${pageTitle[s.PageIdId] || 'Page ' + s.PageIdId} - ${s.Layout || 'Section'} ${s.DisplayOrder != null ? s.DisplayOrder : s.Id}`;
      log(`   section ${s.Id} -> "${title}" (HideTitle = Yes)`);
      if (CONFIG.DRY_RUN) continue;
      const res = await fetch(`${webUrl}/_api/web/lists/getbytitle('TH_PolicySections')/items(${s.Id})`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          Accept: 'application/json;odata=verbose',
          'Content-Type': 'application/json;odata=verbose',
          'X-RequestDigest': token,
          'X-HTTP-Method': 'MERGE',
          'IF-MATCH': '*'
        },
        body: JSON.stringify({ __metadata: { type }, Title: title, HideTitle: true })
      });
      if (!res.ok) console.warn(`   ! section ${s.Id}: HTTP ${res.status}`);
    }

    const cards = await items('TH_PolicyCards', 'Id,Title,Kind,PageIdId,SectionIdId,TabIdId');
    const orphanCards = cards.filter((c) => !c.PageIdId && !c.SectionIdId && !c.TabIdId);
    const tables = await items('TH_PolicyTables', 'Id,Title,SectionIdId,TabIdId');
    const orphanTables = tables.filter((t) => !t.SectionIdId && !t.TabIdId);
    log(`Step 2: ${orphanCards.length} card(s) and ${orphanTables.length} table(s) with no parent - re-select their SectionId:`);
    if (orphanCards.length > 0) console.table(orphanCards.map((c) => ({ Id: c.Id, Title: c.Title, Kind: c.Kind })));
    if (orphanTables.length > 0) console.table(orphanTables.map((t) => ({ Id: t.Id, Title: t.Title })));
    log('Done.');
  } catch (e) {
    console.error('[TravelHub fix] FAILED:', e);
  }
})();
