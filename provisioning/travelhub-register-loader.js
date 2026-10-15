/* =============================================================================
 * TravelHub - register the page-load extension (browser console / REST)
 * =============================================================================
 *
 * WHY
 *   Fixes "the SharePoint page shows for a moment before Travel Hub appears"
 *   on refresh. The "TravelHubLoader" Application Customizer (in the same
 *   travel-hub.sppkg as the web part) is loaded by SharePoint with the page
 *   shell - before the page canvas and its web parts - and immediately hides
 *   SharePoint's chrome and shows the Travel Hub splash until the app is on
 *   screen. See src/extensions/travelHubLoader.
 *
 * WHEN
 *   Once per site, AFTER deploying the new travel-hub.sppkg (version 1.0.0.15
 *   or later) to the App Catalog. Safe to re-run: it updates the existing
 *   registration instead of adding a second one.
 *
 * HOW TO RUN
 *   1. Open the Travel Hub site (Site Owner rights), F12 -> Console.
 *   2. Check CONFIG below (PAGES = the pages that host the Travel Hub web part;
 *      empty = only pages where this browser has already seen the web part
 *      render. Site Contents, lists and other pages are never affected).
 *   3. Paste the ENTIRE file and press Enter.
 *   To remove it again: set CONFIG.REMOVE = true and run again.
 * ========================================================================== */

(async function registerTravelHubLoader() {
  'use strict';

  const CONFIG = {
    TARGET_WEB_URL: 'https://theredsea.sharepoint.com/sites/TravelHub',
    // Page file names (or server-relative URL endings) that host Travel Hub,
    // e.g. ['Home.aspx', 'TravelHub.aspx']. Empty = pages this browser has
    // already seen the web part render on (needs package 1.0.0.16+).
    PAGES: ["TravelHubHome.aspx"],
    // Seconds before the splash is removed even if the app has not appeared.
    MAX_WAIT_SECONDS: 12,
    REMOVE: false
  };

  // Must match src/extensions/travelHubLoader/TravelHubLoaderApplicationCustomizer.manifest.json "id".
  const COMPONENT_ID = 'f089ed79-379f-46bf-82c3-eb2655e641a8';
  const TITLE = 'TravelHubLoader';

  const webUrl = CONFIG.TARGET_WEB_URL.replace(/\/$/, '');
  const log = (...a) => console.log('%c[TravelHub]', 'color:#b89c66;font-weight:bold', ...a);

  const ctx = await fetch(webUrl + '/_api/contextinfo', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { Accept: 'application/json;odata=verbose' }
  });
  if (!ctx.ok) throw new Error('contextinfo failed: HTTP ' + ctx.status + ' - is TARGET_WEB_URL right?');
  const digest = (await ctx.json()).d.GetContextWebInformation.FormDigestValue;
  const headers = {
    Accept: 'application/json;odata=verbose',
    'Content-Type': 'application/json;odata=verbose',
    'X-RequestDigest': digest
  };

  const existingRes = await fetch(
    webUrl + `/_api/web/UserCustomActions?$filter=ClientSideComponentId eq guid'${COMPONENT_ID}'&$select=Id,Title`,
    { credentials: 'same-origin', headers: { Accept: 'application/json;odata=verbose' } }
  );
  const existing = (await existingRes.json()).d.results;

  if (CONFIG.REMOVE) {
    for (const action of existing) {
      await fetch(webUrl + `/_api/web/UserCustomActions('${action.Id}')`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: Object.assign({ 'X-HTTP-Method': 'DELETE', 'IF-MATCH': '*' }, headers)
      });
    }
    log(`Removed ${existing.length} registration(s).`);
    return;
  }

  const body = {
    __metadata: { type: 'SP.UserCustomAction' },
    Title: TITLE,
    Location: 'ClientSideExtension.ApplicationCustomizer',
    ClientSideComponentId: COMPONENT_ID,
    ClientSideComponentProperties: JSON.stringify({ pages: CONFIG.PAGES, maxWaitSeconds: CONFIG.MAX_WAIT_SECONDS })
  };

  if (existing.length > 0) {
    const res = await fetch(webUrl + `/_api/web/UserCustomActions('${existing[0].Id}')`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: Object.assign({ 'X-HTTP-Method': 'MERGE', 'IF-MATCH': '*' }, headers),
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error('update failed: HTTP ' + res.status + ' ' + (await res.text()));
    log('%cUpdated the existing TravelHubLoader registration. ✔', 'color:#107c41;font-weight:bold');
  } else {
    const res = await fetch(webUrl + '/_api/web/UserCustomActions', {
      method: 'POST',
      credentials: 'same-origin',
      headers,
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error('register failed: HTTP ' + res.status + ' ' + (await res.text()));
    log('%cTravelHubLoader registered. ✔ Refresh a Travel Hub page to see it.', 'color:#107c41;font-weight:bold');
  }
})();
