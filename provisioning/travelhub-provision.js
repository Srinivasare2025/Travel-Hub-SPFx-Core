/* =============================================================================
 * TravelHub - SharePoint provisioning (browser console / REST)
 * =============================================================================
 *
 * WHAT IT DOES
 *   Creates every list, library, field (with choice options), the lookup
 *   columns, and the seed TH_SiteConfiguration rows the TravelHub SPFx web part
 *   needs - using only the SharePoint REST API and fetch(). No PowerShell, no
 *   PnP, no modules.
 *
 * HOW TO RUN
 *   1. Sign in to the TARGET site in the browser. It MUST be the exact site
 *      where the lists should live, e.g.
 *        https://theredsea.sharepoint.com/sites/TravelHub
 *      You need Site Owner / "Manage Lists" rights there.
 *   2. F12 -> Console.
 *   3. Set CONFIG.TARGET_WEB_URL below if the auto-detected value is wrong.
 *   4. Paste the ENTIRE file, press Enter.
 *   5. Read the SUMMARY block at the end. It is idempotent - safe to re-run.
 *
 * ABOUT THE CONSOLE OUTPUT
 *   Existence checks use $filter queries that return HTTP 200, so a clean run
 *   produces almost no red errors. Anything that actually failed is listed under
 *   "ISSUES" in the summary and prefixed with "  ! " while running.
 *
 * NOT DONE HERE (tenant-specific / destructive - do by hand)
 *   - Breaking permission inheritance on TH_QuickPulseResponses and
 *     TH_DepartmentTravelSpend and creating the "TravelHub Pulse Admins" /
 *     "TravelHub Spend Viewers" groups. See breakInheritanceExample() at the end.
 * ========================================================================== */

(async function provisionTravelHub() {
  'use strict';

  /* ----------------------------- CONFIG ---------------------------------- */
  const CONFIG = {
    // The site to provision. Auto-detected from the page; OVERRIDE if wrong.
    TARGET_WEB_URL: "https://theredsea.sharepoint.com/sites/TravelHub",
      //(typeof _spPageContextInfo !== 'undefined' && _spPageContextInfo.webAbsoluteUrl) ||
      //window.location.origin,
    CREATE_LIBRARIES: true,
    SEED_CONFIG: true,
    DRY_RUN: false,
    THROTTLE_MS: 120
  };

  const webUrl = CONFIG.TARGET_WEB_URL.replace(/\/$/, '');
  const log = (...a) => console.log('%c[TravelHub]', 'color:#b89c66;font-weight:bold', ...a);
  const warn = (...a) => console.warn('[TravelHub]', ...a);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const issues = [];
  const tally = { listsCreated: 0, listsExisting: 0, fieldsCreated: 0, fieldsExisting: 0, seeded: 0, seedExisting: 0 };

  /* ------------------------- REST plumbing ------------------------------ */
  let digest = '';

  async function refreshDigest() {
    const res = await fetch(webUrl + '/_api/contextinfo', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { Accept: 'application/json;odata=verbose' }
    });
    if (!res.ok) throw new Error('contextinfo failed: HTTP ' + res.status + ' at ' + webUrl);
    const j = await res.json();
    digest = j.d.GetContextWebInformation.FormDigestValue;
  }

  async function spGet(url) {
    return fetch(webUrl + url, {
      credentials: 'same-origin',
      headers: { Accept: 'application/json;odata=verbose' }
    });
  }

  async function spGetJson(url) {
    const res = await spGet(url);
    if (!res.ok) {
      let detail = '';
      try { detail = (await res.json()).error.message.value; } catch (e) { detail = res.statusText; }
      throw new Error('GET ' + url + ' -> HTTP ' + res.status + ' - ' + detail);
    }
    return (await res.json()).d;
  }

  async function spWrite(url, body, extraHeaders, attempt) {
    attempt = attempt || 1;
    if (CONFIG.DRY_RUN) { log('DRY_RUN write ->', url); return { dryRun: true }; }

    const headers = Object.assign(
      {
        Accept: 'application/json;odata=verbose',
        'Content-Type': 'application/json;odata=verbose',
        'X-RequestDigest': digest
      },
      extraHeaders || {}
    );
    const res = await fetch(webUrl + url, {
      method: 'POST',
      credentials: 'same-origin',
      headers,
      body: typeof body === 'string' ? body : JSON.stringify(body)
    });

    if ((res.status === 429 || res.status === 503) && attempt <= 5) {
      const ra = parseInt(res.headers.get('Retry-After') || '0', 10);
      const wait = ra > 0 ? ra * 1000 : attempt * 2000;
      warn('Throttled (HTTP ' + res.status + '); waiting ' + wait + 'ms.');
      await sleep(wait);
      return spWrite(url, body, extraHeaders, attempt + 1);
    }
    if (res.status === 403 && attempt <= 2) {
      await refreshDigest();
      return spWrite(url, body, extraHeaders, attempt + 1);
    }
    if (!res.ok) {
      let detail = '';
      try { detail = (await res.json()).error.message.value; } catch (e) { detail = await res.text(); }
      throw new Error('HTTP ' + res.status + ' - ' + detail);
    }
    await sleep(CONFIG.THROTTLE_MS);
    return res;
  }

  /* --------------------------- XML helpers ------------------------------ */
  const escXml = (s) =>
    String(s).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));

  const attrs = (name, extra) =>
    `DisplayName='${escXml(name)}' Name='${escXml(name)}' StaticName='${escXml(name)}'${extra ? ' ' + extra : ''}`;

  const F = {
    text: (n, o = {}) =>
      `<Field Type='Text' ${attrs(n, `MaxLength='255'${o.indexed ? " Indexed='TRUE'" : ''}${o.required ? " Required='TRUE'" : ''}`)} />`,
    note: (n, lines = 6) =>
      `<Field Type='Note' ${attrs(n, `NumLines='${lines}' RichText='FALSE' AppendOnly='FALSE'`)} />`,
    number: (n, o = {}) => {
      const min = o.min != null ? ` Min='${o.min}'` : '';
      const max = o.max != null ? ` Max='${o.max}'` : '';
      const dec = o.decimals != null ? ` Decimals='${o.decimals}'` : '';
      const body = o.default != null ? `<Default>${o.default}</Default>` : '';
      return `<Field Type='Number' ${attrs(n, `${min}${max}${dec}${o.indexed ? " Indexed='TRUE'" : ''}`)}>${body}</Field>`;
    },
    // Plain 2-decimal number; the ISO code lives in a separate text column.
    currency: (n) => `<Field Type='Number' ${attrs(n, "Decimals='2'")} />`,
    bool: (n, def = false) => `<Field Type='Boolean' ${attrs(n)}><Default>${def ? 1 : 0}</Default></Field>`,
    date: (n, withTime = false) => `<Field Type='DateTime' ${attrs(n, `Format='${withTime ? 'DateTime' : 'DateOnly'}'`)} />`,
    url: (n) => `<Field Type='URL' ${attrs(n, "Format='Hyperlink'")} />`,
    choice: (n, choices, def) =>
      `<Field Type='Choice' ${attrs(n, "Format='Dropdown'")}>` +
      `<CHOICES>${choices.map((c) => `<CHOICE>${escXml(c)}</CHOICE>`).join('')}</CHOICES>` +
      `${def != null ? `<Default>${escXml(def)}</Default>` : ''}</Field>`,
    lookup: (n, targetListId) =>
      `<Field Type='Lookup' ${attrs(n)} List='{${String(targetListId).replace(/[{}]/g, '')}}' ShowField='Title' />`
  };

  // AddToAllContentTypes(4) | AddFieldInternalNameHint(8) | AddFieldToDefaultView(16)
  const ADD_FIELD_OPTIONS = 28;

  /* --------------------------- SCHEMA ---------------------------------- */
  const LISTS = [
    {
      title: 'TH_SiteConfiguration',
      description: 'TravelHub configuration key/value store. Title = the config key.',
      titleLabel: 'Key',
      fields: [
        { name: 'ConfigValue', xml: F.note('ConfigValue', 4) },
        { name: 'ValueType', xml: F.choice('ValueType', ['string', 'number', 'boolean', 'json'], 'string') },
        {
          name: 'Category',
          xml: F.choice('Category', [
            'Brand', 'Hero', 'Services', 'Updates', 'Testimonials', 'QuickPulse',
            'Spend', 'Team', 'Footer', 'Dates', 'Sections', 'ViewAll', 'FeatureFlags'
          ])
        },
        { name: 'IsActive', xml: F.bool('IsActive', true) },
        { name: 'Notes', xml: F.note('Notes', 3) }
      ]
    },
    {
      title: 'TH_HeroBanners',
      description: 'Hero carousel slides.',
      fields: [
        { name: 'Description', xml: F.note('Description', 4) },
        { name: 'MediaType', xml: F.choice('MediaType', ['Image', 'Video'], 'Image') },
        { name: 'ImageUrl', xml: F.url('ImageUrl') },
        { name: 'MobileImageUrl', xml: F.url('MobileImageUrl') },
        { name: 'VideoUrl', xml: F.url('VideoUrl') },
        { name: 'AccessibilityText', xml: F.text('AccessibilityText') },
        { name: 'DisplayOrder', xml: F.number('DisplayOrder', { default: 0 }) },
        { name: 'AutoPlay', xml: F.bool('AutoPlay', true) },
        // Image slides only - video slides advance on their own `ended` event instead
        // (HeroBannerService.ts), so this ceiling only needs to cover a reasonable
        // image dwell time, not a video's length.
        { name: 'DurationSeconds', xml: F.number('DurationSeconds', { default: 6, min: 3, max: 600 }) },
        { name: 'IsActive', xml: F.bool('IsActive', true) },
        { name: 'StartDate', xml: F.date('StartDate', true) },
        { name: 'EndDate', xml: F.date('EndDate', true) }
      ]
    },
    {
      title: 'TH_TravelServices',
      description: 'Explore Our Travel Services cards.',
      fields: [
        { name: 'Description', xml: F.note('Description', 4) },
        { name: 'ImageUrl', xml: F.url('ImageUrl') },
        { name: 'Icon', xml: F.text('Icon') },
        { name: 'IconBackgroundColor', xml: F.text('IconBackgroundColor') },
        { name: 'LinkUrl', xml: F.url('LinkUrl') },
        { name: 'LinkType', xml: F.choice('LinkType', ['Internal', 'External'], 'Internal') },
        { name: 'LinkText', xml: F.text('LinkText') },
        { name: 'OpenInNewTab', xml: F.bool('OpenInNewTab', false) },
        { name: 'DisplayOrder', xml: F.number('DisplayOrder', { default: 0 }) },
        { name: 'IsActive', xml: F.bool('IsActive', true) },
        { name: 'StartDate', xml: F.date('StartDate', true) },
        { name: 'EndDate', xml: F.date('EndDate', true) }
      ]
    },
    {
      title: 'TH_TravelNews',
      description: 'Travel News & Articles.',
      fields: [
        { name: 'Description', xml: F.note('Description', 4) },
        { name: 'ImageUrl', xml: F.url('ImageUrl') },
        { name: 'PublishDate', xml: F.date('PublishDate', false) },
        { name: 'LinkType', xml: F.choice('LinkType', ['Internal', 'External', 'OnPremReference'], 'Internal') },
        { name: 'TargetUrl', xml: F.url('TargetUrl') },
        { name: 'Category', xml: F.text('Category') },
        { name: 'IsFeatured', xml: F.bool('IsFeatured', false) },
        { name: 'OpenInNewTab', xml: F.bool('OpenInNewTab', false) },
        { name: 'DisplayOrder', xml: F.number('DisplayOrder', { default: 0 }) },
        { name: 'IsActive', xml: F.bool('IsActive', true) }
      ]
    },
    {
      title: 'TH_TravelEvents',
      description: 'Upcoming Events.',
      fields: [
        { name: 'Description', xml: F.note('Description', 4) },
        { name: 'EventDate', xml: F.date('EventDate', false) },
        { name: 'StartTime', xml: F.text('StartTime') },
        { name: 'EndTime', xml: F.text('EndTime') },
        { name: 'Location', xml: F.text('Location') },
        { name: 'Category', xml: F.text('Category') },
        { name: 'ImageUrl', xml: F.url('ImageUrl') },
        { name: 'RegistrationUrl', xml: F.url('RegistrationUrl') },
        { name: 'DisplayOrder', xml: F.number('DisplayOrder', { default: 0 }) },
        { name: 'IsActive', xml: F.bool('IsActive', true) }
      ]
    },
    {
      title: 'TH_TravelTips',
      description: 'Travel Tips & Insights.',
      fields: [
        { name: 'Description', xml: F.note('Description', 3) },
        { name: 'Icon', xml: F.text('Icon') },
        { name: 'Category', xml: F.text('Category') },
        { name: 'LinkUrl', xml: F.url('LinkUrl') },
        { name: 'DisplayOrder', xml: F.number('DisplayOrder', { default: 0 }) },
        { name: 'IsActive', xml: F.bool('IsActive', true) }
      ]
    },
    {
      title: 'TH_QuickPulseQuestions',
      description: 'Quick Pulse questions. Title = the question text.',
      titleLabel: 'Question',
      fields: [
        { name: 'IsActive', xml: F.bool('IsActive', true) },
        { name: 'StartDate', xml: F.date('StartDate', true) },
        { name: 'EndDate', xml: F.date('EndDate', true) },
        { name: 'AllowComments', xml: F.bool('AllowComments', true) },
        { name: 'OneResponsePerUser', xml: F.bool('OneResponsePerUser', true) }
      ]
    },
    {
      title: 'TH_QuickPulseOptions',
      description: 'Quick Pulse answer options. Title = option label.',
      fields: [
        { name: 'Icon', xml: F.text('Icon') },
        { name: 'OptionValue', xml: F.number('OptionValue', { min: 0, max: 100 }) },
        { name: 'DisplayOrder', xml: F.number('DisplayOrder', { default: 0 }) },
        { name: 'IsActive', xml: F.bool('IsActive', true) }
      ]
    },
    {
      title: 'TH_QuickPulseResponses',
      description: 'Quick Pulse responses. RESTRICT PERMISSIONS after provisioning.',
      fields: [
        { name: 'ResponseValue', xml: F.number('ResponseValue', { min: 0, max: 100 }) },
        { name: 'Comments', xml: F.note('Comments', 4) },
        { name: 'RespondentUpn', xml: F.text('RespondentUpn', { indexed: true }) },
        { name: 'SubmittedDate', xml: F.date('SubmittedDate', true) }
      ]
    },
    {
      title: 'TH_TravelerTestimonials',
      description: 'What our travellers say. Title = person name.',
      titleLabel: 'Person Name',
      fields: [
        { name: 'ProfileImage', xml: F.url('ProfileImage') },
        { name: 'Rating', xml: F.number('Rating', { min: 1, max: 5 }) },
        { name: 'Comment', xml: F.note('Comment', 4) },
        { name: 'Designation', xml: F.text('Designation') },
        { name: 'Department', xml: F.text('Department') },
        { name: 'Location', xml: F.text('Location') },
        { name: 'PersonInfoLine', xml: F.text('PersonInfoLine') },
        { name: 'DisplayOrder', xml: F.number('DisplayOrder', { default: 0 }) },
        { name: 'IsActive', xml: F.bool('IsActive', true) }
      ]
    },
    {
      title: 'TH_DepartmentTravelSpend',
      description: 'Department travel spend. RESTRICT PERMISSIONS after provisioning.',
      titleLabel: 'Department',
      fields: [
        { name: 'Period', xml: F.text('Period') },
        { name: 'Currency', xml: F.text('Currency') },
        { name: 'TotalSpend', xml: F.currency('TotalSpend') },
        { name: 'AirSpend', xml: F.currency('AirSpend') },
        { name: 'HotelSpend', xml: F.currency('HotelSpend') },
        { name: 'GroundTransportSpend', xml: F.currency('GroundTransportSpend') },
        { name: 'BookingSpend', xml: F.currency('BookingSpend') },
        { name: 'DashboardUrl', xml: F.url('DashboardUrl') },
        { name: 'IsActive', xml: F.bool('IsActive', true) }
      ]
    },
    {
      title: 'TH_GreenTravel',
      description: 'Green Travel content block (one active record).',
      fields: [
        { name: 'Description', xml: F.note('Description', 4) },
        { name: 'Points', xml: F.note('Points', 6) },
        { name: 'ImageUrl', xml: F.url('ImageUrl') },
        { name: 'LinkUrl', xml: F.url('LinkUrl') },
        { name: 'LinkText', xml: F.text('LinkText') },
        { name: 'IsActive', xml: F.bool('IsActive', true) }
      ]
    },
    {
      title: 'TH_TravelTeam',
      description: 'Meet the Travel Team. Title = member name.',
      titleLabel: 'Name',
      fields: [
        { name: 'Designation', xml: F.text('Designation') },
        { name: 'Department', xml: F.text('Department') },
        { name: 'Specialization', xml: F.text('Specialization') },
        { name: 'ProfileImage', xml: F.url('ProfileImage') },
        { name: 'Email', xml: F.text('Email') },
        { name: 'Phone', xml: F.text('Phone') },
        { name: 'Location', xml: F.text('Location') },
        { name: 'DisplayOrder', xml: F.number('DisplayOrder', { default: 0 }) },
        { name: 'IsActive', xml: F.bool('IsActive', true) }
      ]
    },
    {
      title: 'TH_FooterColumns',
      description: 'Footer columns.',
      fields: [
        { name: 'DisplayOrder', xml: F.number('DisplayOrder', { default: 0 }) },
        { name: 'IsActive', xml: F.bool('IsActive', true) }
      ]
    },
    {
      title: 'TH_FooterLinks',
      description: 'Footer links.',
      fields: [
        { name: 'Url', xml: F.url('Url') },
        { name: 'Icon', xml: F.text('Icon') },
        { name: 'OpenInNewTab', xml: F.bool('OpenInNewTab', false) },
        { name: 'DisplayOrder', xml: F.number('DisplayOrder', { default: 0 }) },
        { name: 'IsActive', xml: F.bool('IsActive', true) }
      ]
    },
    {
      // Admin-added tabs only. The hub's Help Desk / Travel Care / Our
      // Services tabs are always present and come from the hero quick-link
      // config + the services section anchor (GlobalNavigationService.ts) -
      // they don't need a row here.
      title: 'TH_GlobalNavigation',
      description: 'Extra global navigation tabs, shown above the hero banner.',
      fields: [
        { name: 'Url', xml: F.url('Url') },
        // 'App' = an existing destination inside this SharePoint/Teams app - opens in the same tab.
        // 'External' = always opens in a new tab.
        { name: 'Kind', xml: F.choice('Kind', ['App', 'External'], 'App') },
        { name: 'DisplayOrder', xml: F.number('DisplayOrder', { default: 0 }) },
        { name: 'IsActive', xml: F.bool('IsActive', true) }
      ]
    }
  ];

  const LOOKUPS = [
    { list: 'TH_QuickPulseOptions', name: 'QuestionId', target: 'TH_QuickPulseQuestions' },
    { list: 'TH_QuickPulseResponses', name: 'QuestionId', target: 'TH_QuickPulseQuestions' },
    { list: 'TH_FooterLinks', name: 'ColumnId', target: 'TH_FooterColumns' }
  ];

  const LIBRARIES = ['Travel Hub Images', 'Travel Hub Documents', 'Travel Hub Videos'];

  const CONFIG_SEED = [
    ['brand.name', 'RSG', 'string'],
    ['layout.fullBleed', 'true', 'boolean'],
    // 'sky' | 'cream' | 'dark' - see docs/CONFIGURATION.md "Theme".
    ['theme.canvas', 'sky', 'string'],
    ['hero.autoPlay', 'true', 'boolean'],
    ['hero.intervalSeconds', '6', 'number'],
    ['hero.supportingMessage', 'Travel Care - Your Partner in Every Journey', 'string'],
    ['hero.quickLinks.layout', 'inline', 'string'],
    ['hero.quickLink.helpDesk.title', 'Travel Services Help Desk', 'string'],
    ['hero.quickLink.helpDesk.description', 'General travel guidance and non-urgent assistance', 'string'],
    ['hero.quickLink.helpDesk.url', '#', 'string'],
    ['hero.quickLink.helpDesk.type', 'page', 'string'],
    ['hero.quickLink.helpDesk.openInNewTab', 'true', 'boolean'],
    ['hero.quickLink.travelCare.title', 'Travel Care 24/7', 'string'],
    ['hero.quickLink.travelCare.description', 'Urgent support anytime, anywhere', 'string'],
    // Demo value - replace with your Travel Care poster image (e.g. a file in
    // the "Travel Hub Images" library). type=image opens it raw for QR scanning.
    ['hero.quickLink.travelCare.url', 'https://picsum.photos/seed/travelcare-poster/1000/1400', 'string'],
    ['hero.quickLink.travelCare.type', 'image', 'string'],
    ['hero.quickLink.travelCare.badgeText', '24/7', 'string'],
    ['hero.quickLink.travelCare.openInNewTab', 'true', 'boolean'],
    ['services.desktopVisibleCards', '4', 'number'],
    ['services.tabletVisibleCards', '2', 'number'],
    ['services.mobileVisibleCards', '1', 'number'],
    ['services.defaultLinkText', 'Learn More', 'string'],
    ['services.autoPlay', 'true', 'boolean'],
    ['services.intervalSeconds', '5', 'number'],
    ['updates.news.count', '4', 'number'],
    // Business rule: Upcoming Events shows at most 3 on the hub page - the
    // rest live behind "View All" (viewAll.events).
    ['updates.events.count', '3', 'number'],
    ['updates.tips.count', '7', 'number'],
    ['viewAll.news.text', 'View All', 'string'],
    ['viewAll.news.url', '#', 'string'],
    ['viewAll.events.text', 'View All', 'string'],
    ['viewAll.events.url', '#', 'string'],
    ['viewAll.tips.text', 'View All', 'string'],
    ['viewAll.tips.url', '#', 'string'],
    ['testimonials.autoPlay', 'true', 'boolean'],
    ['testimonials.intervalSeconds', '8', 'number'],
    ['testimonials.desktopVisibleCards', '3', 'number'],
    ['testimonials.tabletVisibleCards', '2', 'number'],
    ['testimonials.mobileVisibleCards', '1', 'number'],
    ['testimonials.personInfoTemplate', '{designation} - {location}', 'string'],
    ['viewAll.testimonials.text', 'View All Stories', 'string'],
    ['viewAll.testimonials.url', '#', 'string'],
    ['quickPulse.showAggregateResults', 'false', 'boolean'],
    ['quickPulse.confirmationMessage', 'Thanks - your feedback has been recorded.', 'string'],
    ['quickPulse.pulseAdminGroup', 'TravelHub Pulse Admins', 'string'],
    ['spend.viewerGroup', 'TravelHub Spend Viewers', 'string'],
    ['spend.source', 'sharepoint', 'string'],
    ['spend.dashboardUrl', '#', 'string'],
    ['team.landingPageCount', '4', 'number'],
    ['team.viewAllText', 'View All Team Members', 'string'],
    ['team.viewAllUrl', '#', 'string'],
    ['footer.showQrCode', 'false', 'boolean'],
    ['footer.qrCodeUrl', '#', 'string'],
    ['footer.legalText', '(c) {year} {brand}. All rights reserved.', 'string'],
    ['footer.lastUpdatedText', '', 'string'],
    ['dates.locale', 'en-GB', 'string'],
    ['dates.showHijri', 'false', 'boolean'],
    ['dates.hijriLocale', 'ar-SA-u-ca-islamic-umalqura', 'string'],
    ['sections.hero.isVisible', 'true', 'boolean'],
    ['sections.travelServices.isVisible', 'true', 'boolean'],
    ['sections.travelUpdates.isVisible', 'true', 'boolean'],
    ['sections.travelerEngagement.isVisible', 'true', 'boolean'],
    ['sections.travelInsights.isVisible', 'true', 'boolean'],
    ['sections.travelTeam.isVisible', 'true', 'boolean'],
    ['sections.footer.isVisible', 'true', 'boolean'],
    ['featureFlags.heroVideo', 'true', 'boolean'],
    ['featureFlags.newsOnPremLinks', 'true', 'boolean'],
    ['featureFlags.rtl', 'false', 'boolean']
  ];

  /* ---------------------- helpers (quiet) ----------------------------- */
  const esc = (s) => String(s).replace(/'/g, "''");

  // Returns the list Id (string) if it exists, else null. Always HTTP 200.
  async function findList(title) {
    const d = await spGetJson(`/_api/web/lists?$select=Id,Title&$top=1&$filter=Title eq '${esc(title)}'`);
    return d.results.length ? d.results[0].Id : null;
  }

  async function createList(title, description, template) {
    await spWrite('/_api/web/lists', {
      __metadata: { type: 'SP.List' },
      BaseTemplate: template,
      Title: title,
      Description: description || ''
    });
  }

  // Set<string> of every InternalName + Title on a list. Assumes the list exists.
  async function getFieldNames(title) {
    const d = await spGetJson(
      `/_api/web/lists/getbytitle('${esc(title)}')/fields?$select=InternalName,Title&$top=500`
    );
    const set = new Set();
    d.results.forEach((f) => { set.add(f.InternalName); set.add(f.Title); });
    return set;
  }

  async function createFieldXml(title, xml) {
    await spWrite(`/_api/web/lists/getbytitle('${esc(title)}')/fields/createfieldasxml`, {
      parameters: {
        __metadata: { type: 'SP.XmlSchemaFieldCreationInformation' },
        SchemaXml: xml,
        Options: ADD_FIELD_OPTIONS
      }
    });
  }

  async function relabelTitle(title, label) {
    try {
      const d = await spGetJson(
        `/_api/web/lists/getbytitle('${esc(title)}')/fields/getbyinternalnameortitle('Title')`
      );
      if (d.Title === label) return;
      await spWrite(
        `/_api/web/lists/getbytitle('${esc(title)}')/fields/getbyinternalnameortitle('Title')`,
        { __metadata: { type: d.__metadata.type }, Title: label },
        { 'X-HTTP-Method': 'MERGE', 'IF-MATCH': '*' }
      );
    } catch (e) {
      issues.push(`rename Title on ${title}: ${e.message}`);
    }
  }

  /* ----------------------------- RUN ---------------------------------- */
  console.group('%cTravelHub provisioning', 'color:#04253c;font-weight:bold;font-size:13px');
  log('Target web :', webUrl);
  log('Options    :', JSON.stringify(CONFIG));
  if (CONFIG.DRY_RUN) warn('DRY_RUN is ON - nothing will be written.');

  try {
    await refreshDigest();
    log('Digest acquired. Verifying the site is reachable...');
    await spGetJson('/_api/web?$select=Title,ServerRelativeUrl').then((w) =>
      log('Connected to web:', w.Title, '(' + w.ServerRelativeUrl + ')')
    );

    /* 1. Lists */
    log('\n-- Step 1: lists --------------------------------');
    for (const def of LISTS) {
      try {
        if (await findList(def.title)) {
          tally.listsExisting++;
          log(`=  ${def.title}`);
        } else {
          await createList(def.title, def.description, 100);
          await sleep(500);
          const id = await findList(def.title);
          if (!id) throw new Error('created but not found on re-check');
          tally.listsCreated++;
          log(`+  ${def.title}`);
        }
        if (def.titleLabel) await relabelTitle(def.title, def.titleLabel);
      } catch (e) {
        issues.push(`list ${def.title}: ${e.message}`);
        warn(`  ! list ${def.title}: ${e.message}`);
      }
    }

    /* 2. Libraries */
    if (CONFIG.CREATE_LIBRARIES) {
      log('\n-- Step 2: libraries ----------------------------');
      for (const lib of LIBRARIES) {
        try {
          if (await findList(lib)) { log(`=  ${lib}`); }
          else { await createList(lib, 'TravelHub assets', 101); await sleep(400); log(`+  ${lib}`); }
        } catch (e) {
          issues.push(`library ${lib}: ${e.message}`);
          warn(`  ! library ${lib}: ${e.message}`);
        }
      }
    }

    /* 3. Fields */
    log('\n-- Step 3: fields ------------------------------');
    for (const def of LISTS) {
      let existing;
      try {
        existing = await getFieldNames(def.title);
      } catch (e) {
        issues.push(`${def.title}: cannot read fields (${e.message}) - list missing? skipped.`);
        warn(`  ! ${def.title}: ${e.message}`);
        continue;
      }
      let added = 0;
      let skip = 0;
      for (const f of def.fields) {
        if (existing.has(f.name)) { skip++; tally.fieldsExisting++; continue; }
        try {
          await createFieldXml(def.title, f.xml);
          added++;
          tally.fieldsCreated++;
        } catch (e) {
          issues.push(`${def.title}.${f.name}: ${e.message}`);
          warn(`  ! ${def.title}.${f.name}: ${e.message}`);
        }
      }
      log(`   ${def.title}: +${added} added, ${skip} existing`);
    }

    /* 4. Lookup fields */
    log('\n-- Step 4: lookup fields -----------------------');
    for (const lk of LOOKUPS) {
      try {
        const existing = await getFieldNames(lk.list);
        if (existing.has(lk.name)) { log(`=  ${lk.list}.${lk.name}`); tally.fieldsExisting++; continue; }
        const targetId = await findList(lk.target);
        if (!targetId) throw new Error(`target list ${lk.target} not found`);
        await createFieldXml(lk.list, F.lookup(lk.name, targetId));
        tally.fieldsCreated++;
        log(`+  ${lk.list}.${lk.name} -> ${lk.target}`);
      } catch (e) {
        issues.push(`lookup ${lk.list}.${lk.name}: ${e.message}`);
        warn(`  ! lookup ${lk.list}.${lk.name}: ${e.message}`);
      }
    }

    /* 5. Seed configuration */
    if (CONFIG.SEED_CONFIG) {
      log('\n-- Step 5: seed TH_SiteConfiguration -----------');
      try {
        const meta = await spGetJson(
          `/_api/web/lists/getbytitle('TH_SiteConfiguration')?$select=ListItemEntityTypeFullName`
        );
        const entityType = meta.ListItemEntityTypeFullName;
        const current = await spGetJson(
          `/_api/web/lists/getbytitle('TH_SiteConfiguration')/items?$select=Title&$top=500`
        );
        const have = new Set(current.results.map((r) => r.Title));
        for (const [key, value, type] of CONFIG_SEED) {
          if (have.has(key)) { tally.seedExisting++; continue; }
          try {
            await spWrite(`/_api/web/lists/getbytitle('TH_SiteConfiguration')/items`, {
              __metadata: { type: entityType },
              Title: key,
              ConfigValue: value,
              ValueType: type,
              IsActive: true
            });
            tally.seeded++;
          } catch (e) {
            issues.push(`seed ${key}: ${e.message}`);
            warn(`  ! seed ${key}: ${e.message}`);
          }
        }
        log(`   seeded ${tally.seeded}, already present ${tally.seedExisting}`);
      } catch (e) {
        issues.push(`seed step: ${e.message}`);
        warn(`  ! seed step: ${e.message}`);
      }
    }

    /* SUMMARY */
    log('\n================ SUMMARY ================');
    log(`Lists      : ${tally.listsCreated} created, ${tally.listsExisting} already existed`);
    log(`Fields     : ${tally.fieldsCreated} created, ${tally.fieldsExisting} already existed`);
    if (CONFIG.SEED_CONFIG) log(`Config rows: ${tally.seeded} seeded, ${tally.seedExisting} already existed`);
    if (issues.length === 0) {
      log('%cNo issues. Provisioning complete. ✔', 'color:#107c41;font-weight:bold');
    } else {
      warn(`%c${issues.length} issue(s):`, 'color:#a4262c;font-weight:bold');
      issues.forEach((e) => warn('   • ' + e));
    }
    log('\nNext: upload images to "Travel Hub Images", populate the TH_* lists,');
    log('restrict TH_QuickPulseResponses / TH_DepartmentTravelSpend, add the web part.');
  } catch (fatal) {
    console.error('%c[TravelHub] FATAL - nothing further ran:', 'color:#a4262c;font-weight:bold', fatal);
    console.error('Check that CONFIG.TARGET_WEB_URL is the exact site URL and that you have Manage Lists rights.');
  } finally {
    console.groupEnd();
  }

  /* ---------------------------------------------------------------------
   * OPTIONAL - run manually. Breaks inheritance on one restricted list and
   * grants Read to one SharePoint group only.
   *
   * window.breakInheritanceExample = async function (listTitle, groupName) {
   *   await refreshDigest();
   *   await spWrite(`/_api/web/lists/getbytitle('${listTitle}')/breakroleinheritance(copyRoleAssignments=false,clearSubscopes=true)`);
   *   const g = await spGetJson(`/_api/web/sitegroups/getbyname('${groupName}')?$select=Id`);
   *   await spWrite(`/_api/web/lists/getbytitle('${listTitle}')/roleassignments/addroleassignment(principalid=${g.Id},roledefid=1073741826)`); // 1073741826 = Read
   * };
   * // e.g. breakInheritanceExample('TH_DepartmentTravelSpend', 'TravelHub Spend Viewers');
   * ------------------------------------------------------------------- */
})();
