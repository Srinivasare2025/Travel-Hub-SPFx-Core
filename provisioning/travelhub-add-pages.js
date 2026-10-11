/* =============================================================================
 * TravelHub - ADD SELECTED PAGES (browser console / REST)
 * =============================================================================
 *
 * GENERATED from travelhub-sample-data.js by provisioning/tools/build-add-pages.js
 * - do not edit the page content here; edit travelhub-sample-data.js and run
 *   `node provisioning/tools/build-add-pages.js` again.
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

  const webUrl = CONFIG.TARGET_WEB_URL.replace(/\/$/, '');
  const log = (...a) => console.log('%c[TravelHub add pages]', 'color:#b89c67;font-weight:bold', ...a);
  const warn = (...a) => console.warn('[TravelHub add pages]', ...a);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const issues = [];
  let created = 0;
  let deleted = 0;

  /* ------------------------- REST plumbing ------------------------------ */
  let digest = '';
  const typeCache = {};
  // TH_PolicyPages Id -> Title, so untitled sections get a readable internal name.
  const pageTitleById = {};

  async function refreshDigest() {
    const res = await fetch(webUrl + '/_api/contextinfo', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { Accept: 'application/json;odata=verbose' }
    });
    if (!res.ok) throw new Error('contextinfo HTTP ' + res.status + ' at ' + webUrl);
    digest = (await res.json()).d.GetContextWebInformation.FormDigestValue;
  }

  async function spGetJson(url) {
    const res = await fetch(webUrl + url, {
      credentials: 'same-origin',
      headers: { Accept: 'application/json;odata=verbose' }
    });
    if (!res.ok) {
      let d = res.statusText;
      try { d = (await res.json()).error.message.value; } catch (e) {}
      throw new Error('GET ' + url + ' -> HTTP ' + res.status + ' - ' + d);
    }
    return (await res.json()).d;
  }

  async function spSend(method, url, body, extraHeaders, attempt) {
    attempt = attempt || 1;
    const headers = Object.assign(
      {
        Accept: 'application/json;odata=verbose',
        'Content-Type': 'application/json;odata=verbose',
        'X-RequestDigest': digest
      },
      method !== 'POST' ? { 'X-HTTP-Method': method, 'IF-MATCH': '*' } : {},
      extraHeaders || {}
    );
    const res = await fetch(webUrl + url, {
      method: 'POST',
      credentials: 'same-origin',
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
    if ((res.status === 429 || res.status === 503) && attempt <= 5) {
      const ra = parseInt(res.headers.get('Retry-After') || '0', 10);
      await sleep(ra > 0 ? ra * 1000 : attempt * 2000);
      return spSend(method, url, body, extraHeaders, attempt + 1);
    }
    if (res.status === 403 && attempt <= 2) {
      await refreshDigest();
      return spSend(method, url, body, extraHeaders, attempt + 1);
    }
    if (!res.ok) {
      let d = '';
      try { d = (await res.json()).error.message.value; } catch (e) { d = await res.text(); }
      throw new Error('HTTP ' + res.status + ' - ' + d);
    }
    await sleep(CONFIG.THROTTLE_MS);
    return res;
  }

  const esc = (s) => String(s).replace(/'/g, "''");

  async function entityType(list) {
    if (!typeCache[list]) {
      const d = await spGetJson(`/_api/web/lists/getbytitle('${esc(list)}')?$select=ListItemEntityTypeFullName`);
      typeCache[list] = d.ListItemEntityTypeFullName;
    }
    return typeCache[list];
  }

  async function addItem(list, data) {
    const type = await entityType(list);
    const clean = { __metadata: { type } };
    Object.keys(data).forEach((k) => {
      if (data[k] !== null && data[k] !== undefined) clean[k] = data[k];
    });
    const res = await spSend('POST', `/_api/web/lists/getbytitle('${esc(list)}')/items`, clean);
    created++;
    const id = (await res.json()).d.Id;
    if (list === 'TH_PolicyPages') pageTitleById[id] = data.Title;
    return id;
  }

  async function getTitles(list) {
    const d = await spGetJson(`/_api/web/lists/getbytitle('${esc(list)}')/items?$select=Title&$top=1000`);
    return d.results.map((r) => r.Title);
  }

  async function clearList(list) {
    const d = await spGetJson(`/_api/web/lists/getbytitle('${esc(list)}')/items?$select=Id&$top=1000&$orderby=Id desc`);
    for (const it of d.results) {
      await spSend('DELETE', `/_api/web/lists/getbytitle('${esc(list)}')/items(${it.Id})`);
      deleted++;
    }
  }

  /* --------------------------- helpers --------------------------------- */
  // SP.FieldUrlValue for Hyperlink columns. `'#'` is used throughout this
  // file as a "no real destination yet" placeholder - SharePoint's URL field
  // rejects it server-side ("HTTP 400 - Invalid URL: #."), so it's treated
  // the same as no URL at all (field omitted) rather than sent as-is.
  const link = (url, desc) =>
    url && url !== '#' ? { __metadata: { type: 'SP.FieldUrlValue' }, Url: url, Description: desc || url } : null;

  const P = CONFIG.USE_PLACEHOLDER_IMAGES;
  const img = (seed, w, h) => (P ? `https://picsum.photos/seed/${seed}/${w || 800}/${h || 500}` : '');
  const avatar = (n) => (P ? `https://i.pravatar.cc/240?img=${n}` : '');

  const today = new Date();
  const addDays = (n) => {
    const d = new Date(today);
    d.setDate(d.getDate() + n);
    d.setHours(9, 0, 0, 0);
    return d.toISOString();
  };


  // --- Policy content-model helpers -----------------------------------
  // TH_PolicySections is the ordered content block a page is built from;
  // TH_PolicyCards/TH_PolicyTables (+TH_PolicyTableRows)/TH_PolicyTabs hang
  // off a section (or a tab within it) depending on the section's Layout.
  // See PolicyService.ts / PolicyCardSections.tsx.
  // A section with no visible heading still gets an internal Title (with
  // HideTitle = Yes) so it is identifiable in the SectionId lookup when a
  // content editor edits one of its cards - a blank lookup option can clear
  // the card's SectionId on save and make the card disappear.
  async function addPolicySection(pageId, opts) {
    return addItem('TH_PolicySections', {
      Title: opts.title || `${pageTitleById[pageId] || 'Page ' + pageId} - ${opts.layout} ${opts.order}`,
      HideTitle: !opts.title,
      PageIdId: pageId,
      Subtitle: opts.subtitle || null,
      Layout: opts.layout,
      CardVariant: opts.cardVariant || null,
      Body: Array.isArray(opts.body) ? opts.body.join('\n') : (opts.body || null),
      Icon: opts.icon || null,
      ImageUrl: opts.imageUrl ? link(opts.imageUrl) : null,
      // Optional presentation options (travelhub-provision.js adds these columns).
      TabIdId: opts.tabId || null,
      Columns: opts.columns || null,
      CardStyle: opts.cardStyle || null,
      TintCards: opts.tintCards ? true : null,
      SectionStyle: opts.sectionStyle || null,
      Theme: opts.theme || null,
      Width: opts.width || null,
      LinkText: opts.linkText || null,
      LinkUrl: opts.linkUrl ? link(opts.linkUrl) : null,
      TargetSlug: opts.targetSlug || null,
      // Show TH_Offers items of this Collection as the section's cards.
      OfferCollection: opts.offerCollection || null,
      DisplayOrder: opts.order,
      IsActive: true
    });
  }

  async function addPolicyTab(sectionId, label, order, extra) {
    return addItem('TH_PolicyTabs', Object.assign({
      Title: label,
      SectionIdId: sectionId,
      DisplayOrder: order,
      IsActive: true
    }, extra ? { Icon: extra.icon || null, Subtitle: extra.subtitle || null, Description: extra.description || null } : {}));
  }

  // parentField is 'PageIdId' | 'SectionIdId' | 'TabIdId'.
  async function addPolicyCards(parentField, parentId, cards) {
    let order = 1;
    for (const c of cards) {
      const row = {
        Title: c.title || `[${c.kind} ${order}]`,
        Kind: c.kind,
        Number: c.number != null ? c.number : null,
        Icon: c.icon || null,
        IconColor: c.iconColor || null,
        Description: c.description || null,
        SubPoints: c.subPoints ? c.subPoints.join('\n') : null,
        TargetSlug: c.targetSlug || null,
        LinkUrl: c.linkUrl ? link(c.linkUrl) : null,
        LinkText: c.linkText || null,
        OpenInNewTab: c.openInNewTab ? true : null,
        ImageUrl: c.imageUrl ? link(c.imageUrl) : null,
        Subtitle: c.subtitle || null,
        Badge: c.badge || null,
        Value: c.value || null,
        ValueLabel: c.valueLabel || null,
        ValueNote: c.valueNote || null,
        // In-app popup files, one per line `Label | URL [| image|pdf]` (travelhub-provision.js adds the column).
        PopupContent: c.popup ? c.popup.join('\n') : null,
        DisplayOrder: order++,
        IsActive: true
      };
      row[parentField] = parentId;
      await addItem('TH_PolicyCards', row);
    }
  }

  async function addPolicyTables(parentField, parentId, tables) {
    let order = 1;
    for (const t of tables) {
      const row = {
        Title: t.title || null,
        ColumnHeaders: t.headers.join('\n'),
        DisplayOrder: order++,
        IsActive: true
      };
      row[parentField] = parentId;
      const tableId = await addItem('TH_PolicyTables', row);
      let rOrder = 1;
      for (const r of t.rows) {
        await addItem('TH_PolicyTableRows', { TableIdId: tableId, CellValues: r.join('\n'), DisplayOrder: rOrder++ });
      }
    }
  }


  // IconColor values are RSG brand colour NAMES (src/common/utils/color.ts):
  // Navy Blue, Gold, Crystal Waters, Blue Lagoon, Blooming Nature, Majestic
  // Mountains, Thriving Corals, Sandy Dunes, Volcanic Ash, Pearl Bush.
  const C = { blue: 'Blue Lagoon', green: 'Blooming Nature', amber: 'Sandy Dunes', red: 'Thriving Corals', purple: 'Majestic Mountains', teal: 'Blue Lagoon', pink: 'Thriving Corals' };


  // Deletes ONE policy page and everything under it (sections, tabs,
  // sections nested in its tabs, cards, tables, table rows). Used by
  // CONFIG.RESEED_SLUGS - no other page or list is touched.
  async function deletePolicyPage(slug) {
    const ids = async (list, filter) =>
      (await spGetJson(`/_api/web/lists/getbytitle('${esc(list)}')/items?$select=Id&$top=1000&$filter=${encodeURIComponent(filter)}`)).results.map((r) => r.Id);
    const anyOf = (field, values) => values.map((v) => `${field} eq ${v}`).join(' or ');
    const del = async (list, idList) => {
      for (const id of idList) {
        await spSend('DELETE', `/_api/web/lists/getbytitle('${esc(list)}')/items(${id})`);
        deleted++;
      }
    };
    const pageIds = await ids('TH_PolicyPages', `Slug eq '${esc(slug)}'`);
    for (const pageId of pageIds) {
      const sectionIds = await ids('TH_PolicySections', `PageIdId eq ${pageId}`);
      const tabIds = sectionIds.length ? await ids('TH_PolicyTabs', anyOf('SectionIdId', sectionIds)) : [];
      const nested = tabIds.length ? await ids('TH_PolicySections', anyOf('TabIdId', tabIds)) : [];
      const allSections = Array.from(new Set(sectionIds.concat(nested)));
      const parentFilter = [anyOf('SectionIdId', allSections), anyOf('TabIdId', tabIds)].filter((f) => f).join(' or ');
      const cardIds = await ids('TH_PolicyCards', `PageIdId eq ${pageId}` + (parentFilter ? ` or ${parentFilter}` : ''));
      const tableIds = parentFilter ? await ids('TH_PolicyTables', parentFilter) : [];
      const rowIds = tableIds.length ? await ids('TH_PolicyTableRows', anyOf('TableIdId', tableIds)) : [];
      await del('TH_PolicyTableRows', rowIds);
      await del('TH_PolicyTables', tableIds);
      await del('TH_PolicyCards', cardIds);
      await del('TH_PolicySections', nested);
      await del('TH_PolicyTabs', tabIds);
      await del('TH_PolicySections', sectionIds);
      await del('TH_PolicyPages', [pageId]);
    }
    return pageIds.length;
  }


  // -------------------------------------------------------------------
  // Business Travel (home + Employee / Family Relocation), Personal Travel
  // Offers, Meetings & Events, SAP Concur (+ 4 sub-pages) - laid out as in
  // the "Business Travel Policy - Home _2 Sub Pages", "Personal_Travel_
  // Offers_and_Meetings_Events" and "SAP_Concur_Primary_Card" mockups.
  // Same lists and rules as the Travel Policy pages - see
  // docs/POLICY-CONTENT-GUIDE.md. Each page is its own seeder (by Slug) so it
  // can be re-seeded alone with CONFIG.RESEED_SLUGS.
  // -------------------------------------------------------------------
  const qr = (data) => (P ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(data)}` : '');
  // Placeholder PDFs for popup content (City Guide). With placeholders off,
  // they point at files you upload to the "Travel Hub Documents" library.
  const SAMPLE_PDF_1 = P ? 'https://pdfobject.com/pdf/sample.pdf' : encodeURI(webUrl + '/Travel Hub Documents/City Guide - Riyadh.pdf');
  const SAMPLE_PDF_2 = P ? 'https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf' : encodeURI(webUrl + '/Travel Hub Documents/City Guide - Jeddah.pdf');
  const CONCUR_URL = 'https://www.concursolutions.com';
  const NAVY = 'Navy Blue';

  async function addPage(order, fields) {
    return addItem('TH_PolicyPages', Object.assign({ DisplayOrder: order, IsActive: true, HeroStyle: 'Light' }, fields));
  }

  const TRAVEL_HUB_CLOSING = {
    ClosingBannerTitle: 'Travel Hub',
    ClosingBannerDescription: 'Together for a more connected world.',
    ClosingBadges: ['People First', 'Responsible Travel', 'Extraordinary Destinations', 'Lasting Impact'].join('\n'),
    ClosingBannerImageUrl: link(img('closing-banner-2', 1600, 400))
  };
  const RELOCATION_CLOSING = {
    ClosingBannerTitle: 'People move the world forward.',
    ClosingBannerDescription: 'We make the journey smoother. A more connected and sustainable tomorrow.',
    ClosingBadges: ['Our People', 'Our Planet', 'Our Future'].join('\n'),
    ClosingBannerImageUrl: link(img('closing-banner-3', 1600, 400))
  };

  // Shared "Need help" parts used by the SAP Concur pages.
  const concurSupportCards = [
    { kind: 'Info', title: 'SAP Concur Support (System Help Desk)', icon: 'Headset', description: 'For technical issues and system access support. helpdesk.ksaobt@travelats.com' },
    { kind: 'Info', title: 'Travel Services (RSG Travel Team)', icon: 'Mail', description: 'For travel program guidance, policy related queries and general assistance. TravelServices@RedSeaGlobal.com' },
    { kind: 'Info', title: 'Travel Care 24/7 Support', imageUrl: qr('RSG Travel Care'), description: 'Business Travel & Personal Travel. Scan to connect with RSG Travel Care.', subPoints: ['@Phone|+966 11 413 6112', '@Mail|RSGTravel@travelats.com', '@Chat|+966 53 853 5697'] }
  ];

  const MORE_PAGE_SEEDERS = {
    // --- Business Travel (home) ---------------------------------------------
    // A TH_PolicyPages row with Slug 'business-travel' replaces the original
    // Business Travel screen (BusinessTravelPageScreen.tsx).
    'business-travel': async () => {
      const pageId = await addPage(20, {
        Title: 'Business Travel', Slug: 'business-travel',
        HeroIcon: 'Airplane', HeroEyebrow: 'Business Travel', HeroTitle: 'Business Travel',
        HeroSubtitle: 'Plan. Request. Travel. With Confidence.',
        HeroDescription: 'Everything you need to arrange your work-related travel, in one place.',
        HeroImageUrl: link(img('bt-hero', 1600, 500)), HeroTagline: 'People Closer\nA Brighter Tomorrow',
        ClosingBannerTitle: 'Travel with Purpose',
        ClosingBannerDescription: 'Connecting people. Supporting communities. A more sustainable tomorrow.',
        ClosingBadges: ['Our People', 'Our Planet', 'Our Future'].join('\n'),
        ClosingBannerImageUrl: link(img('closing-banner-4', 1600, 400))
      });
      const strip = await addPolicySection(pageId, { layout: 'Split', order: 1, sectionStyle: 'Card' });
      await addPolicyCards('SectionIdId', strip, [
        { kind: 'Info', title: 'Right process', icon: 'Settings', description: 'For your travel need' },
        { kind: 'Info', title: 'Clear guidance', icon: 'Page', description: 'At every step' },
        { kind: 'Info', title: 'Dedicated support', icon: 'People', description: 'When you need it' }
      ]);
      const mobility = await addPolicySection(pageId, {
        layout: 'ImageCards', order: 2, title: 'Business Travel & Mobility', cardStyle: 'ImageTop', columns: 5,
        subtitle: 'Find your travel need and follow the right process, channel and support.',
        body: '@Info|These trips are paid by the company and are subject to RSG policy and approvals.'
      });
      await addPolicyCards('SectionIdId', mobility, [
        { kind: 'Highlight', title: 'Business Travel', icon: 'Airplane', iconColor: NAVY, imageUrl: img('bt-card-1', 600, 380), description: 'Site travel, meetings, factory visits, training, events and conferences.', subPoints: ['@System|Through SAP Concur'], linkText: 'View', targetSlug: 'travel-policy' },
        { kind: 'Highlight', title: 'Business Assignment', icon: 'Suitcase', iconColor: NAVY, imageUrl: img('bt-card-2', 600, 380), description: 'Travel for approved business assignments.', subPoints: ['@System|Through SAP Concur'], linkText: 'View', targetSlug: 'travel-entitlement' },
        { kind: 'Highlight', title: 'Employee Relocation', icon: 'MapPin', iconColor: NAVY, imageUrl: img('bt-card-3', 600, 380), description: 'Relocating between Riyadh Headquarters and Project Site? Explore your travel entitlement, shipping assistance and mobilization requirements.', subPoints: ['@System|Through SAP Concur'], linkText: 'View', targetSlug: 'employee-relocation' },
        { kind: 'Highlight', title: 'Family Relocation', icon: 'People', iconColor: 'Majestic Mountains', imageUrl: img('bt-card-4', 600, 380), description: 'Explore relocation benefits available for eligible new joiners and accompanying dependents.', subPoints: ['@Mail|Offline: onboarding@RedSeaGlobal.com'], linkText: 'View', targetSlug: 'family-relocation' },
        { kind: 'Highlight', title: 'Consultants | Guests Travel', icon: 'People', iconColor: 'Majestic Mountains', imageUrl: img('bt-card-5', 600, 380), description: 'Travel for consultants and external guests.', subPoints: ['@Mail|Offline: rsgtravel@travelats.com'] }
      ]);
      const concurFlow = await addPolicySection(pageId, {
        layout: 'ProcessSteps', order: 3, title: 'SAP Concur Workflow Cycle', cardStyle: 'Stacked', width: 'Half', sectionStyle: 'Card',
        subtitle: 'For Business Travel, Business Assignment and Employee Relocation'
      });
      await addPolicyCards('SectionIdId', concurFlow, [
        ['Identify travel need', 'Page'], ['Raise request in SAP Concur', 'System'], ['Manager / required approval', 'CheckMark'],
        ['Travel arrangement', 'Airplane'], ['Confirmation', 'Page'], ['Travel', 'Suitcase'], ['Expense claim', 'ReceiptCheck']
      ].map(([title, icon], i) => ({ kind: 'HelpStep', number: i + 1, icon, iconColor: C.blue, title })));
      const offline = await addPolicySection(pageId, {
        layout: 'ProcessSteps', order: 4, title: 'Offline Travel Process', cardStyle: 'Stacked', width: 'Half', sectionStyle: 'Tinted', theme: 'Blooming Nature',
        subtitle: 'For Family Relocation, Consultants | Guests Travel'
      });
      await addPolicyCards('SectionIdId', offline, [
        { kind: 'HelpStep', number: 1, icon: 'Mail', iconColor: C.green, title: 'Send email to RSG Travel Desk', description: 'rsgtravel@travelats.com' },
        { kind: 'HelpStep', number: 2, icon: 'People', iconColor: C.green, title: 'Travel Desk provides proposals' },
        { kind: 'HelpStep', number: 3, icon: 'CheckMark', iconColor: C.green, title: 'Obtain required approvals' },
        { kind: 'HelpStep', number: 4, icon: 'Ticket', iconColor: C.green, title: 'Travel Desk confirms services' }
      ]);
      const classTable = await addPolicySection(pageId, {
        layout: 'Table', order: 5, title: 'Flight Ticket Class – Know Your Travel Entitlement', width: 'TwoThirds', sectionStyle: 'Card',
        subtitle: 'Your permitted travel class depends on your job grade and flight duration.'
      });
      await addPolicyTables('SectionIdId', classTable, [
        { headers: ['Suitcase::Job Grade', 'Clock::Flights up to 6 hours', 'Clock::Flights over 6 hours'], rows: [
          ['Grades 12 – 14', 'Business Class', 'Business Class'],
          ['Grades 1 – 11', 'Economy Class', 'Business Class']
        ] }
      ]);
      await addPolicySection(pageId, {
        layout: 'Feature', order: 6, title: 'Travel via Red Sea International (RSI) / Al Wajh (EJH)', width: 'OneThird', imageUrl: img('bt-rsi', 500, 400),
        body: ['@CheckMark|Grade 14 – Business Class', '@CheckMark|Grades 1 – 13 – Economy Class']
      });
      const notes = await addPolicySection(pageId, { layout: 'Split', order: 7, sectionStyle: 'Card' });
      await addPolicyCards('SectionIdId', notes, [
        { kind: 'Info', icon: 'Info', iconColor: C.blue, description: 'Business class for Associate Director and below is permitted only if the flight time is more than 6 hours. If the eligible class is not available, you may book the next available class with required approvals as per policy.' },
        { kind: 'Info', icon: 'Suitcase', iconColor: C.blue, description: 'Employees are entitled to carry excess baggage up to the limit specified by the airline. Any additional charges for excess baggage will be borne by the employee, unless otherwise approved by RSG, in line with policy.' }
      ]);
      const highlights = await addPolicySection(pageId, {
        layout: 'ImageCards', order: 8, title: 'Key Business Travel Policy Highlights', cardStyle: 'ImageTile', columns: 5,
        subtitle: 'Understand the key policy information to plan your trip with confidence.',
        linkText: 'View Full Travel Policy', targetSlug: 'travel-policy'
      });
      await addPolicyCards('SectionIdId', highlights, [
        ['Plan Before You Travel', 'Airplane', 'travel-planning-approvals'], ['Air Travel Entitlement', 'Airplane', 'travel-entitlement'],
        ['Accommodation Entitlement', 'Hotel', 'travel-entitlement'], ['Daily Transportation Allowance', 'Car', 'travel-entitlement'],
        ['Daily Allowance', 'Money', 'travel-entitlement'], ['Exceeding Accommodation Cap Limits', 'CityNext', 'travel-policy'],
        ['Cancellations & No-Shows', 'Cancel', 'travel-policy'], ['Cancellation Process', 'Sync', 'travel-policy'],
        ['Additional Entitlement', 'Add', 'travel-entitlement'], ['Expenses', 'ReceiptCheck', 'expenses']
      ].map(([title, icon, targetSlug]) => ({ kind: 'Info', title, icon, iconColor: C.blue, targetSlug })));
      const site = await addPolicySection(pageId, {
        layout: 'ImageCards', order: 9, title: 'Accommodation & Site Services', cardStyle: 'ImageLeft', columns: 2, width: 'TwoThirds',
        subtitle: 'Support services for your stay and travel at Red Sea and AMAALA.'
      });
      await addPolicyCards('SectionIdId', site, [
        { kind: 'Info', title: 'Turtle Bay Accommodation', icon: 'Hotel', iconColor: NAVY, imageUrl: img('bt-turtle', 500, 300), description: 'How to request and book Turtle Bay accommodation.', linkUrl: 'https://www.redseaglobal.com', openInNewTab: true },
        { kind: 'Info', title: 'Red Sea & AMAALA Site Services', icon: 'Car', iconColor: 'Majestic Mountains', imageUrl: img('bt-site', 500, 300), description: 'Transportation, fleet management and access permits.', linkUrl: 'https://www.redseaglobal.com', openInNewTab: true }
      ]);
      const quick = await addPolicySection(pageId, {
        layout: 'ImageCards', order: 10, title: 'Quick Actions', cardStyle: 'ImageLeft', columns: 1, width: 'OneThird',
        subtitle: 'Common resources to help you get started.'
      });
      await addPolicyCards('SectionIdId', quick, [
        { kind: 'Info', title: 'Access SAP Concur', icon: 'System', iconColor: C.blue, description: 'Book, manage, view your trips and claim your expense.', linkUrl: CONCUR_URL, openInNewTab: true },
        { kind: 'Info', title: 'Employee Handbook', icon: 'Library', iconColor: NAVY, description: 'Explore employee & family relocation useful information and resources.', linkUrl: 'https://www.redseaglobal.com', openInNewTab: true }
      ]);
      const help = await addPolicySection(pageId, {
        layout: 'Split', order: 11, title: 'Need Help?', icon: 'Headset', subtitle: "We're here to support your travel needs.", sectionStyle: 'Tinted', theme: 'Crystal Waters'
      });
      await addPolicyCards('SectionIdId', help, [
        { kind: 'Info', title: 'Business Travel', imageUrl: qr('RSG Business Travel Care'), description: 'Scan to connect with RSG Travel Care.' },
        { kind: 'Info', title: 'Travel Care 24/7', icon: 'Headset', description: 'For urgent travel support, changes or assistance during your trip.' },
        { kind: 'Info', title: 'Contact Travel Services', icon: 'Mail', description: 'For travel guidance, support, changes or general travel queries. TravelServices@RedSeaGlobal.com' }
      ]);
    },

    // --- Employee Relocation --------------------------------------------------
    'employee-relocation': async () => {
      const pageId = await addPage(21, Object.assign({
        Title: 'Employee Relocation', Slug: 'employee-relocation', ParentSlug: 'business-travel', ParentTitle: 'Business Travel',
        HeroIcon: 'Home', HeroEyebrow: 'Business Travel', HeroTitle: 'Employee Relocation',
        HeroSubtitle: 'Riyadh Headquarters ↔ Project Site',
        HeroDescription: "New location. New opportunities. We're with you all the way.",
        HeroImageUrl: link(img('policy-employee-relocation-hero', 1600, 500)), HeroTagline: 'Same Team\nNew Horizons'
      }, RELOCATION_CLOSING));
      const strip = await addPolicySection(pageId, { layout: 'Split', order: 1, sectionStyle: 'Card' });
      await addPolicyCards('SectionIdId', strip, [
        { kind: 'Info', title: 'Guidance', icon: 'People', description: 'From your HRBP' },
        { kind: 'Info', title: 'Simpler Travel', icon: 'Airplane', description: 'Book via SAP Concur' },
        { kind: 'Info', title: 'Support', icon: 'Package', description: 'Shipping assistance' },
        { kind: 'Info', title: 'Smooth Arrival', icon: 'Car', description: 'Transportation arrangements' }
      ]);
      await addPolicySection(pageId, {
        layout: 'Feature', order: 2, title: 'Job Mobility', icon: 'People', width: 'Half', theme: 'Crystal Waters',
        body: 'In the event of a relocation between Riyadh Headquarters and Project Site, your HRBP will be your primary point of contact and will guide you through your relocation journey.'
      });
      await addPolicySection(pageId, {
        layout: 'Feature', order: 3, title: 'Site Allowance', icon: 'Money', width: 'Half', theme: 'Blooming Nature',
        body: 'To support with the cost of flying to your loved ones, all site-based colleagues whose point of origin is not Umluj, Dhiba or Al Wajh cities, will receive the Site Allowance, a cash allowance paid monthly.'
      });
      await addPolicySection(pageId, {
        layout: 'Feature', order: 4, title: 'Flight Tickets', icon: 'Airplane', width: 'Half', theme: 'Crystal Waters',
        body: [
          'Once the mobilization date is confirmed, relocating employees need to book their relocation flight ticket through SAP Concur.',
          '!!In case of unavailability of the eligible travel class, the employee can be upgraded to Business Class, subject to HR approval.'
        ]
      });
      await addPolicySection(pageId, {
        layout: 'Feature', order: 5, title: 'Employee Relocation – Flight Ticket Class', width: 'Half',
        subtitle: 'Entitlement for direct flight bookings via RSI/EJH',
        body: [
          '##Grade|Entitlement',
          'C-Level|Business Class ticket',
          'Executive Director / Group Head|Business Class ticket',
          'Senior Director / Director|Economy Class ticket',
          'Associate Director / Senior Manager|Economy Class ticket',
          'Manager and below|Economy Class ticket',
          '@Airplane|Travel Via Red Sea International (RSI) / Al Wajh (EJH)|Book your relocation travel to and from site via Red Sea International (RSI) or Al Wajh (EJH) as per the above entitlements.'
        ]
      });
      const shipping = await addPolicySection(pageId, {
        layout: 'Feature', order: 6, title: 'Shipping Assistance', icon: 'Package', theme: 'Majestic Mountains', imageUrl: img('reloc-boxes', 600, 400),
        body: [
          'The Company will provide Shipping Assistance to cover the cost of freight of your personal items from Headquarters to Project Site or vice versa up to SAR 25,000 based on submission of actual paid receipts that includes your name, date, location, and total paid amount, along with a copy of the bank transaction as a proof of payment. Cash payments will not be accepted.',
          'You will arrange for your shipment directly with your preferred shipping partner and submit your receipts through SAP SuccessFactors for reimbursement.'
        ]
      });
      await addPolicyCards('SectionIdId', shipping, [{ kind: 'Info', title: '[Shipping cap]', icon: 'Package', iconColor: C.blue, valueLabel: 'Up to', value: 'SAR 25,000', valueNote: 'Shipping Assistance' }]);
      const transport = await addPolicySection(pageId, {
        layout: 'Feature', order: 7, title: 'Transportation', icon: 'Car', theme: 'Blooming Nature', imageUrl: img('reloc-van', 600, 400),
        body: [
          'The Facilities Management team will arrange the airport pick-up to the assigned accommodation drop-off. Note that Airport pick up and drop off from and to Yanbu or Al Wajh should be requested through Base Camp Helpdesk accessible via ITHelpDesk, a minimum of 48 hours prior to the arrival or departure date. Alternatively, you may also place your request at BCS@RedSeaGlobal.com.',
          '!!Note that personal cars are welcomed on-site.'
        ]
      });
      await addPolicyCards('SectionIdId', transport, [{ kind: 'Info', title: '[Pick-up notice]', icon: 'Airplane', iconColor: C.green, value: '48 hours', valueNote: 'Prior request for Yanbu / Al Wajh pick up & drop off' }]);
      const assets = await addPolicySection(pageId, {
        layout: 'Feature', order: 8, title: 'Work Assets Transportation', icon: 'System', theme: 'Majestic Mountains', imageUrl: img('reloc-assets', 600, 400),
        body: "Relocating employees' work assets such as monitor and docking station will be shipped to site by our Administration team. They will provide you with boxes to pack the required items which will take two to three days to reach the site."
      });
      await addPolicyCards('SectionIdId', assets, [{ kind: 'Info', title: '[Delivery time]', icon: 'Package', iconColor: 'Majestic Mountains', value: '2–3 days', valueNote: 'Delivery time to site' }]);
      await addPolicySection(pageId, {
        layout: 'Feature', order: 9, title: 'Effective Date', icon: 'Calendar', theme: 'Crystal Waters',
        body: 'The effective date for the relocation will be considered as the day of arrival to site or to our Riyadh offices and will reflect on SAP SuccessFactors.'
      });
      const more = await addPolicySection(pageId, { layout: 'ImageCards', order: 10, cardStyle: 'ImageLeft', columns: 2 });
      await addPolicyCards('SectionIdId', more, [
        { kind: 'Info', title: 'More Details', icon: 'Library', iconColor: NAVY, subtitle: 'Employee Handbook', linkUrl: 'https://www.redseaglobal.com', openInNewTab: true },
        { kind: 'Info', title: 'Contact HR Support', icon: 'Headset', iconColor: NAVY, subtitle: 'Onboard – onboarding@RedSeaGlobal.com', linkUrl: 'mailto:onboarding@RedSeaGlobal.com' }
      ]);
    },

    // --- Family Relocation ------------------------------------------------------
    'family-relocation': async () => {
      const pageId = await addPage(22, Object.assign({
        Title: 'Family Relocation', Slug: 'family-relocation', ParentSlug: 'business-travel', ParentTitle: 'Business Travel',
        HeroIcon: 'Family', HeroEyebrow: 'Business Travel', HeroTitle: 'Family Relocation',
        HeroSubtitle: 'A Smooth Move for You and Your Family',
        HeroDescription: "New beginnings. Greater opportunities. We're with you all the way.",
        HeroImageUrl: link(img('policy-family-relocation-hero', 1600, 500)), HeroTagline: 'New Home\nNew Opportunities\nA Brighter Tomorrow'
      }, RELOCATION_CLOSING));
      const strip = await addPolicySection(pageId, { layout: 'Split', order: 1, sectionStyle: 'Card' });
      await addPolicyCards('SectionIdId', strip, [
        { kind: 'Info', title: 'For You', icon: 'People', description: 'and Your Family' },
        { kind: 'Info', title: 'Travel Support', icon: 'Airplane', description: 'When You Need It' },
        { kind: 'Info', title: 'Assistance with', icon: 'Package', description: 'Your Belongings' },
        { kind: 'Info', title: 'Settle In', icon: 'Home', description: 'with Confidence' }
      ]);
      const types = await addPolicySection(pageId, {
        layout: 'Feature', order: 2, title: 'Types of Relocation', icon: 'Sync', theme: 'Majestic Mountains', imageUrl: img('reloc-map', 600, 360),
        body: 'We have two types of relocations:'
      });
      await addPolicyCards('SectionIdId', types, [
        { kind: 'Info', title: 'Domestic', icon: 'Home', iconColor: C.blue, description: 'Relocation of a new hire moving within KSA.' },
        { kind: 'Info', title: 'International', icon: 'Globe', iconColor: C.blue, description: 'Relocation of a new hire moving from outside KSA.' }
      ]);
      await addPolicySection(pageId, {
        layout: 'Feature', order: 3, title: 'Flight Tickets', icon: 'Airplane', theme: 'Blooming Nature', imageUrl: img('reloc-plane', 600, 400),
        body: [
          'We provide flight tickets for new joiners and accompanying dependents eligible for domestic and international relocation, from the nearest airport from the point of origin (home country or current place of work) to their relocation destination in the Kingdom as follows:',
          '##Grade|Class of Travel',
          'C-Level to Director|Business Class',
          'Associate Director and below|Economy Class'
        ]
      });
      await addPolicySection(pageId, {
        layout: 'Feature', order: 4, title: 'Shipping Assistance', icon: 'Package', theme: 'Majestic Mountains', imageUrl: img('reloc-belongings', 600, 500),
        body: [
          'All domestic and international new joiners relocating from outside their employment location will benefit from a Shipping Assistance to cover the cost of freight of personal items from their point of origin (home country or current place of work) to their employment location upon joining as follows:',
          '##Relocation Type|Maximum Shipping Assistance Allowance',
          'Domestic|SAR 25,000',
          'International|SAR 75,000',
          '- You will be eligible for reimbursement of expenses related to the shipment of your personal effects and household goods. Any additional costs incurred beyond the Maximum Shipping Assistance Allowance will be borne by the employee.',
          '- The Shipping Assistance will be paid to eligible employees after arrival and upon the submission of actual receipts via SAP SuccessFactors. You will have the option to claim your Shipping Assistance benefit within the first nine months of your joining date and upon the submission of actual receipts and bank transaction as a proof of payment, and upon completion of the shipment(s). Pro-format invoices and cash payment will not be accepted.'
        ]
      });
      await addPolicySection(pageId, {
        layout: 'Feature', order: 5, title: 'Temporary Accommodation', icon: 'Hotel', theme: 'Blue Lagoon', imageUrl: img('reloc-room', 600, 360),
        body: [
          '- We will provide temporary accommodation assistance to new joiners and their accompanying eligible dependents from their first employment day, for a maximum of 30 nights.',
          '- Employees and accompanying dependents relocating from Project Site to Riyadh will be provided with accommodation up to two weeks.'
        ]
      });
      await addPolicySection(pageId, {
        layout: 'Feature', order: 6, title: 'Important Notes', icon: 'Warning', theme: 'Majestic Mountains',
        body: [
          '- New joiners hired from Riyadh and joining our Riyadh Headquarters do not qualify for relocation. Similarly, new joiners to be located at site and hired from Umluj, Dhiba or Al Wajh do not qualify for relocation either.',
          '- Foreign currency transaction fees are not included in any benefits provided.'
        ]
      });
      const more = await addPolicySection(pageId, { layout: 'ImageCards', order: 7, cardStyle: 'ImageLeft', columns: 2 });
      await addPolicyCards('SectionIdId', more, [
        { kind: 'Info', title: 'More Details', icon: 'Library', iconColor: NAVY, subtitle: 'Employee Handbook - Employee Guide | PDF', linkUrl: 'https://www.redseaglobal.com', openInNewTab: true },
        { kind: 'Info', title: 'Contact HR Support', icon: 'Headset', iconColor: NAVY, subtitle: 'Onboard - onboarding@RedSeaGlobal.com', linkUrl: 'mailto:onboarding@RedSeaGlobal.com' }
      ]);
    },

    // --- Personal Travel Offers ------------------------------------------------------
    'personal-travel-offers': async () => {
      const pageId = await addPage(30, {
        Title: 'Personal Travel Offers', Slug: 'personal-travel-offers',
        HeroEyebrow: 'Personal Travel Offers', HeroTitle: 'Personal Travel Offers',
        HeroDescription: 'Exclusive travel offers, experiences and benefits for you and your family — curated with our trusted partners.',
        HeroImageUrl: link(img('pto-hero', 1600, 500)), HeroTagline: 'Explore\nRelax\nExperience\nTogether'
      });
      // Cards = TH_Offers items with Collection "Featured Personal Offers"
      // (seedOffers below) - each opens its own details screen.
      await addPolicySection(pageId, {
        layout: 'ImageCards', order: 1, title: 'Featured Personal Travel Offers', cardStyle: 'ImageTop', columns: 5,
        subtitle: 'Handpicked deals and seasonal offers from our trusted travel partners.',
        linkText: 'View All Offers', linkUrl: 'https://www.redseaglobal.com', offerCollection: 'Featured Personal Offers'
      });
      // Cards = TH_Offers "Explore Personal Offers" - each opens its attached
      // images / PDFs in the popup viewer.
      await addPolicySection(pageId, {
        layout: 'ImageCards', order: 2, title: 'Explore Our Personal Travel Offers', cardStyle: 'ImageTile', columns: 5,
        body: '@GiftCard|Exclusive offers from our trusted partners just for you and your family.', offerCollection: 'Explore Personal Offers'
      });
      const staff = await addPolicySection(pageId, {
        layout: 'ImageCards', order: 3, title: 'RSG Staff Offers – Visit Our Destinations', cardStyle: 'ImageBanner', columns: 2,
        subtitle: "Exclusive offers for Red Sea'ers at our destinations."
      });
      await addPolicyCards('SectionIdId', staff, [
        { kind: 'Info', title: 'Visit Red Sea', imageUrl: img('pto-redsea', 900, 400), linkUrl: 'https://www.visitredsea.com', openInNewTab: true },
        { kind: 'Info', title: 'AMAALA', imageUrl: img('pto-amaala', 900, 400), linkUrl: 'https://www.visitredsea.com', openInNewTab: true }
      ]);
      const care = await addPolicySection(pageId, {
        layout: 'Split', order: 4, title: 'Personal Travel Care', icon: 'Headset', sectionStyle: 'Tinted', theme: 'Crystal Waters'
      });
      await addPolicyCards('SectionIdId', care, [
        { kind: 'Info', title: 'Planning a personal trip or need assistance?', description: 'Connect with Personal Travel Care for support with your personal travel requirements and available offers.' },
        { kind: 'Info', title: '[Contacts]', subPoints: ['@Phone|Call +966 11 413 6116', '@Chat|WhatsApp +966 55 255 3618', '@Mail|Email holidays.ksa@travelats.com'] },
        { kind: 'Info', title: 'Personal Travel Care', imageUrl: qr('https://wa.me/966552553618'), description: 'Scan the QR code to connect with us on WhatsApp.' }
      ]);
    },

    // --- Meetings & Events --------------------------------------------------------------
    'meetings-events': async () => {
      const pageId = await addPage(31, {
        Title: 'Meetings & Events', Slug: 'meetings-events',
        HeroEyebrow: 'Meetings & Events', HeroTitle: 'Meetings & Events',
        HeroDescription: "Explore RSG's internal meeting facilities at KAFD and external meeting and event spaces available through our partnered hotels in KSA and internationally.",
        HeroImageUrl: link(img('me-hero', 1600, 500)), HeroTagline: 'Connect\nCollaborate\nCreate Extraordinary Places'
      });
      const kafd = await addPolicySection(pageId, { layout: 'ImageCards', order: 1, cardStyle: 'ImageBanner', columns: 1, width: 'TwoThirds' });
      await addPolicyCards('SectionIdId', kafd, [{
        kind: 'Info', title: 'Meeting Rooms at KAFD Offices', badge: 'KAFD Offices, Riyadh', imageUrl: img('me-kafd', 1100, 500),
        description: 'Modern and flexible meeting spaces at our RSG Riyadh HQ in KAFD, designed for internal meetings, workshops and collaborative sessions.',
        linkText: 'Book a meeting room or Multiple purpose area', linkUrl: 'https://outlook.office.com/calendar', openInNewTab: true
      }]);
      await addPolicySection(pageId, {
        layout: 'Feature', order: 2, title: 'Key Facilities', width: 'OneThird',
        body: [
          '@Mail|Modern meeting rooms', '@Group|Multiple purpose areas', '@Video|Advanced AV and conferencing facilities', '@CheckMark|High-speed Wi-Fi',
          '@CheckMark|Customisable room layouts', '@CheckMark|Catering options available', '@People|Suitable for meetings, workshops and social events.'
        ]
      });
      const hotelNote = '@Coffee|One Coffee Break & Lunch Included\n@People|Starting From (per participant)';
      // Cards = TH_Offers "Riyadh Partnered Hotels" / "Jeddah Partnered Hotels"
      // (seedOffers below). "View Gallery" opens each hotel's attached photos /
      // PDF in the popup, or its LinkUrl when it has no attachments.
      await addPolicySection(pageId, {
        layout: 'ImageCards', order: 3, title: 'Riyadh Partnered Hotels', cardStyle: 'ImageTop', columns: 6, sectionStyle: 'Card',
        subtitle: 'Host your meetings, workshops, trainings and events at our partnered hotels in Riyadh.', body: hotelNote,
        offerCollection: 'Riyadh Partnered Hotels'
      });
      await addPolicySection(pageId, {
        layout: 'ImageCards', order: 4, title: 'Jeddah Partnered Hotels', cardStyle: 'ImageTop', columns: 5, sectionStyle: 'Card',
        subtitle: 'Host your meetings, workshops, trainings and events at our partnered hotels in Jeddah.', body: hotelNote,
        offerCollection: 'Jeddah Partnered Hotels'
      });
      const sites = await addPolicySection(pageId, { layout: 'ImageCards', order: 5, cardStyle: 'ImageBanner', columns: 2 });
      await addPolicyCards('SectionIdId', sites, [
        { kind: 'Info', title: 'Red Sea Site Meeting Rooms', badge: 'Red Sea Site', imageUrl: img('me-rs', 900, 420), description: 'Well-equipped meeting spaces at our Red Sea site for internal and external meetings, trainings and events.', linkText: 'Book Now', linkUrl: 'https://outlook.office.com/calendar', openInNewTab: true },
        { kind: 'Info', title: 'Amaala Meeting Rooms', badge: 'Amaala', imageUrl: img('me-amaala', 900, 420), description: 'Modern meeting spaces in Amaala for business meetings, workshops, trainings and events.', linkText: 'Book Now', linkUrl: 'https://outlook.office.com/calendar', openInNewTab: true }
      ]);
      await addPolicySection(pageId, {
        layout: 'Callout', order: 6, icon: 'Info',
        body: 'Above rates are based on minimum 20 participants. For large groups, special rates can be offered. **Please contact the travel desk.**'
      });
      const booking = await addPolicySection(pageId, {
        layout: 'ProcessSteps', order: 7, title: 'External Meeting Room Booking Process', cardStyle: 'Stacked', sectionStyle: 'Card',
        subtitle: 'A simple and efficient process to book meeting rooms at our partnered hotels.'
      });
      await addPolicyCards('SectionIdId', booking, [
        { kind: 'HelpStep', number: 1, icon: 'Page', iconColor: C.blue, title: 'Submit Request to Travel Desk', description: 'Share your meeting requirements with the Travel Desk. rsgtravel@travelats.com' },
        { kind: 'HelpStep', number: 2, icon: 'Search', iconColor: C.blue, title: 'Hotel Coordination', description: 'The Travel Desk will coordinate with the selected hotel.' },
        { kind: 'HelpStep', number: 3, icon: 'Calendar', iconColor: C.blue, title: 'Check Availability', description: 'The hotel will confirm meeting room availability and options.' },
        { kind: 'HelpStep', number: 4, icon: 'Page', iconColor: C.blue, title: 'Receive Proposal', description: 'You will receive suitable options, pricing and details for your review.' },
        { kind: 'HelpStep', number: 5, icon: 'CheckMark', iconColor: C.blue, title: 'Confirmation', description: 'Once approved, the Travel Desk will confirm the booking with the hotel.' }
      ]);
      const setups = await addPolicySection(pageId, {
        layout: 'ImageCards', order: 8, title: 'Types of Meeting Room Setup', cardStyle: 'ImageTop', columns: 5,
        subtitle: 'Choose the setup that best suits your meeting, workshop, training or event.'
      });
      await addPolicyCards('SectionIdId', setups, [
        ['Boardroom', 'Ideal for executive meetings and discussions.'], ['U-Shape', 'Great for interactive sessions and training.'],
        ['Classroom', 'Suitable for trainings, workshops and presentations.'], ['Theatre', 'Perfect for large audiences and conferences.'],
        ['Banquet', 'Ideal for corporate events, networking and social gatherings.']
      ].map(([title, description], i) => ({ kind: 'Info', title, description, imageUrl: img('me-setup-' + i, 500, 300) })));
    },

    // --- SAP Concur ---------------------------------------------------------------------------
    'sap-concur': async () => {
      const pageId = await addPage(40, Object.assign({
        Title: 'SAP Concur', Slug: 'sap-concur',
        HeroEyebrow: 'Smarter travel. Simpler work.', HeroTitle: 'SAP Concur',
        HeroSubtitle: 'Your RSG Business Travel Journey. Simple. Compliant. Connected.',
        HeroDescription: 'Request, book, travel, manage expenses and approvals — all in one place, with the power of Joule, your AI assistant.',
        HeroImageUrl: link(img('sap-hero', 1600, 500)), HeroTagline: 'People\nPlaces\nA Brighter Tomorrow',
        HeroLinkText: 'Access SAP Concur', HeroLinkUrl: link(CONCUR_URL),
        HeroLink2Text: 'New to SAP Concur? Start Here', HeroLink2TargetSlug: 'sap-concur-plan-book'
      }, TRAVEL_HUB_CLOSING));
      const search = await addPolicySection(pageId, {
        layout: 'Search', order: 1, subtitle: 'How can we help you with SAP Concur?', body: 'Quick links:',
        linkUrl: 'https://help.sap.com/docs/search?q={query}'
      });
      await addPolicyCards('SectionIdId', search, [
        { kind: 'LinkItem', title: 'Book a flight', targetSlug: 'sap-concur-plan-book' },
        { kind: 'LinkItem', title: 'Submit an expense', targetSlug: 'sap-concur-claim-expense' },
        { kind: 'LinkItem', title: 'Concur mobile', targetSlug: 'sap-concur-mobile' },
        { kind: 'LinkItem', title: 'Joule', linkUrl: 'https://www.sap.com/products/artificial-intelligence/ai-assistant.html', openInNewTab: true }
      ]);
      const todo = await addPolicySection(pageId, {
        layout: 'ImageCards', order: 2, title: 'What would you like to do today?', columns: 4,
        subtitle: 'Quick access to the most common tasks in SAP Concur.'
      });
      await addPolicyCards('SectionIdId', todo, [
        { kind: 'Info', title: 'Plan & Book Travel', icon: 'Airplane', iconColor: NAVY, description: 'Create a travel request and book your business trip.', linkText: 'Get Started', targetSlug: 'sap-concur-plan-book' },
        { kind: 'Info', title: 'Review & Approve', icon: 'DocumentApproval', iconColor: NAVY, description: 'Approve travel requests and expense claims.', linkText: 'Get Started', targetSlug: 'sap-concur-review-approve' },
        { kind: 'Info', title: 'Claim Expenses', icon: 'ReceiptCheck', iconColor: NAVY, description: 'Create, complete and submit your business expenses.', linkText: 'Get Started', targetSlug: 'sap-concur-claim-expense' },
        { kind: 'Info', title: 'Use Concur Mobile', icon: 'CellPhone', iconColor: NAVY, description: 'Manage travel, receipts and expenses on the go.', linkText: 'Get Started', targetSlug: 'sap-concur-mobile' }
      ]);
      const start = await addPolicySection(pageId, {
        layout: 'ProcessSteps', order: 3, title: 'New to SAP Concur? Start Here', cardStyle: 'Stacked', width: 'Half', sectionStyle: 'Card',
        subtitle: 'Follow these simple steps to get set up and ready to go.'
      });
      await addPolicyCards('SectionIdId', start, [
        ['Access SAP Concur', 'Signin', 'Sign in with your RSG credentials.'], ['Complete Your Profile', 'Contact', 'Update your personal and travel details.'],
        ['Understand the RSG Travel Process', 'Airplane', 'Learn how request, approval and booking work at RSG.'], ['Set Up Concur Mobile', 'CellPhone', 'Take your travel and expense tools with you.'],
        ['Create Your First Travel Request', 'CheckMark', "You're ready to go!"]
      ].map(([title, icon, description], i) => ({ kind: 'HelpStep', number: i + 1, icon, iconColor: NAVY, title, description })));
      const journey = await addPolicySection(pageId, {
        layout: 'ProcessSteps', order: 4, title: 'Your RSG Travel Journey in SAP Concur', cardStyle: 'Stacked', width: 'Half', sectionStyle: 'Card',
        subtitle: 'From request to reimbursement — all connected.'
      });
      await addPolicyCards('SectionIdId', journey, [
        ['Request', 'Page', 'Create a travel request with business purpose'], ['Approval', 'Contact', 'Line manager approval (as per DOA)'],
        ['Booking', 'Airplane', 'Book via Concur (in policy)'], ['Travel', 'Suitcase', 'Take your trip with confidence'],
        ['Expense', 'ReceiptCheck', 'Submit expenses with receipts'], ['Reimbursement', 'Money', 'Track your claim to payment']
      ].map(([title, icon, description]) => ({ kind: 'HelpStep', icon, iconColor: C.blue, title, description })));
      const joule = await addPolicySection(pageId, {
        layout: 'Feature', order: 5, title: 'Discover Joule — Your AI Assistant in SAP Concur', icon: 'Robot', cardStyle: 'ImageLeft', sectionStyle: 'Tinted', theme: 'Majestic Mountains',
        subtitle: 'Smarter travel. Faster answers. Built for the way you work at RSG.', imageUrl: img('sap-joule', 600, 420),
        linkText: 'Learn More About Joule', linkUrl: 'https://www.sap.com/products/artificial-intelligence/ai-assistant.html'
      });
      await addPolicyCards('SectionIdId', joule, [
        { kind: 'Info', title: 'Get Answers', icon: 'Chat', iconColor: 'Majestic Mountains', description: 'Ask questions and get instant help on travel, expenses and policy.' },
        { kind: 'Info', title: 'Plan & Book', icon: 'Airplane', iconColor: 'Majestic Mountains', description: 'Use natural language to find policy-aligned travel options.' },
        { kind: 'Info', title: 'Manage Your Trip', icon: 'Clock', iconColor: 'Majestic Mountains', description: 'Get help with eligible trip changes and updates.' },
        { kind: 'Info', title: 'Understand Policy', icon: 'Shield', iconColor: 'Majestic Mountains', description: 'Ask RSG travel and expense policy questions in simple language.' }
      ]);
      const faq = await addPolicySection(pageId, {
        layout: 'Faq', order: 6, title: 'Most Asked Questions', width: 'Half', sectionStyle: 'Card',
        subtitle: 'Quick answers to common queries raised with our support team.'
      });
      await addPolicyCards('SectionIdId', faq, [
        ['Creating a Travel Request', 'In SAP Concur, open Requests → New Request, enter your trip details and business purpose, then submit for approval.'],
        ['Booking a Multi-City Trip', 'After your request is approved, choose Multi-City in the flight search and add each leg of your journey.'],
        ['Approving a Travel Request', 'Open Approvals in SAP Concur, review the request details and compliance status, then Approve or Send Back with comments.'],
        ['Submitting an Expense Claim', 'Create an expense report, add your expenses with receipts, then submit within 30 business days after the trip.'],
        ['Linking Expenses to a Business Trip', 'When creating the expense report, select the approved travel request so the costs are linked to the trip.'],
        ['Tracking Request and Expense Status', 'The status of each request and report is shown in SAP Concur, and you are notified by email at each stage.']
      ].map(([title, description]) => ({ kind: 'Info', title, description })));
      const glance = await addPolicySection(pageId, {
        layout: 'CardsGrid', cardVariant: 'Highlight', order: 7, title: 'Travel Policy at a Glance', width: 'Half', columns: 2, cardStyle: 'IconHeader',
        subtitle: 'Travel smarter, stay compliant.', linkText: 'View Full Travel Policy', targetSlug: 'travel-policy'
      });
      await addPolicyCards('SectionIdId', glance, [
        { kind: 'Highlight', title: 'Advance Booking', icon: 'Calendar', iconColor: C.blue, description: 'GCC: ≥ 5 business days | ROW: ≥ 10 days | Conferences: ≥ 30 days' },
        { kind: 'Highlight', title: 'Travel Class Entitlement', icon: 'Suitcase', iconColor: C.blue, description: 'KSA: G1–13 Economy (G12–13 Business if no economy). International: as per grade policy.' },
        { kind: 'Highlight', title: 'Accommodation Caps', icon: 'Hotel', iconColor: C.blue, description: 'KSA: G12 ≤ SAR 1,000 | G13 ≤ SAR 1,250 | G14 ≤ SAR 1,500' },
        { kind: 'Highlight', title: 'Expense Requirements', icon: 'ReceiptCheck', iconColor: C.blue, description: 'Receipts, eligible expenses and policy compliance.' }
      ]);
      const support = await addPolicySection(pageId, {
        layout: 'Split', order: 8, title: 'Need Support?', subtitle: "We're here to help.", sectionStyle: 'Tinted', theme: 'Crystal Waters'
      });
      await addPolicyCards('SectionIdId', support, concurSupportCards);
    }
  };

  // SAP Concur sub-pages ("What would you like to do today?").
  const sapSubPage = (slug, order, icon, title, subtitle, fields) => addPage(order, Object.assign({
    Title: title, Slug: slug, ParentSlug: 'sap-concur', ParentTitle: 'SAP Concur',
    HeroIcon: icon, HeroEyebrow: 'SAP Concur', HeroTitle: title, HeroSubtitle: subtitle,
    HeroDescription: 'Smoother journeys. Brighter tomorrow.', HeroImageUrl: link(img(slug + '-hero', 1600, 500)),
    HeroTagline: 'The Red Sea\nAwaits', HeroLinkText: 'Access SAP Concur', HeroLinkUrl: link(CONCUR_URL)
  }, TRAVEL_HUB_CLOSING, fields || {}));

  Object.assign(MORE_PAGE_SEEDERS, {
    'sap-concur-plan-book': async () => {
      const pageId = await sapSubPage('sap-concur-plan-book', 41, 'Airplane', 'Plan & Book Travel', 'Create a travel request and book your business trip in a few simple steps.');
      const how = await addPolicySection(pageId, {
        layout: 'ProcessSteps', order: 1, title: 'How It Works', cardStyle: 'Stacked', width: 'TwoThirds', sectionStyle: 'Card',
        subtitle: 'From request to confirmed itinerary — all in one place.'
      });
      await addPolicyCards('SectionIdId', how, [
        ['Create Travel Request', 'Page', 'Enter your trip details and business purpose in SAP Concur.'],
        ['Submit for Approval', 'Contact', 'Your line manager reviews and approves (as per DOA).'],
        ['Request Approved', 'CheckMark', "You'll receive a notification once approved."],
        ['Search & Book', 'Airplane', 'Book flights, hotels and other travel services (within policy).'],
        ['Booking Confirmed', 'Suitcase', 'Receive your itinerary and confirmation details.']
      ].map(([title, icon, description], i) => ({ kind: 'HelpStep', number: i + 1, icon, iconColor: NAVY, title, description })));
      await addPolicySection(pageId, {
        layout: 'Feature', order: 2, title: 'Ready to book?', width: 'OneThird',
        body: ['Open SAP Concur and get started.', '!!Tip:|Check your travel entitlement and policy before booking to avoid delays.'],
        linkText: 'Access SAP Concur', linkUrl: CONCUR_URL
      });
      const guides = await addPolicySection(pageId, {
        layout: 'ImageCards', order: 3, title: 'What Would You Like to Do?', cardStyle: 'ImageLeft', columns: 3,
        subtitle: 'Choose a guide for step-by-step instructions.'
      });
      await addPolicyCards('SectionIdId', guides, [
        ['Create a Travel Request', 'Airplane'], ['Book a Flight', 'Airplane'], ['Book a Hotel', 'Hotel'],
        ['Book a Multi-City Trip', 'MapPin'], ['Change or Cancel a Trip', 'Calendar'], ['View Your Itinerary', 'Page']
      ].map(([title, icon]) => ({ kind: 'Info', title, icon, iconColor: NAVY, linkUrl: CONCUR_URL, openInNewTab: true })));
      const know = await addPolicySection(pageId, {
        layout: 'CardsGrid', cardVariant: 'Highlight', order: 4, title: 'Before You Book — Know Your Policy', columns: 4, cardStyle: 'IconHeader',
        subtitle: 'A quick reminder of key rules.'
      });
      await addPolicyCards('SectionIdId', know, [
        { kind: 'Highlight', title: 'Advance Booking', icon: 'Clock', iconColor: NAVY, subPoints: ['GCC: ≥ 5 business days', 'Rest of World: ≥ 10 business days', 'Conferences / Events: ≥ 30 business days'] },
        { kind: 'Highlight', title: 'Travel Class', icon: 'Airplane', iconColor: NAVY, description: 'View your entitlement based on your grade and destination.', linkText: 'View My Entitlement', targetSlug: 'travel-entitlement' },
        { kind: 'Highlight', title: 'Hotel Accommodation', icon: 'Hotel', iconColor: NAVY, description: 'Check the latest accommodation caps for KSA and international travel.', linkText: 'View Accommodation Cap', targetSlug: 'travel-entitlement' },
        { kind: 'Highlight', title: 'Changes & Cancellations', icon: 'Cancel', iconColor: NAVY, description: 'Understand the rules for changes, cancellations and no-shows.', linkText: 'View Guidance', targetSlug: 'travel-policy' }
      ]);
      const help = await addPolicySection(pageId, { layout: 'Split', order: 5, title: 'Need Help?', subtitle: 'Get the right support, at the right time.', sectionStyle: 'Tinted', theme: 'Crystal Waters' });
      await addPolicyCards('SectionIdId', help, concurSupportCards);
    },

    'sap-concur-review-approve': async () => {
      const pageId = await sapSubPage('sap-concur-review-approve', 42, 'DocumentApproval', 'Review & Approve', 'Make informed decisions, faster — with the help of Joule.');
      const how = await addPolicySection(pageId, {
        layout: 'ProcessSteps', order: 1, title: 'How It Works', cardStyle: 'Stacked', sectionStyle: 'Card',
        subtitle: 'Review and approve travel requests and expense reports in a few simple steps.'
      });
      await addPolicyCards('SectionIdId', how, [
        ['Sign In', 'Signin', 'Log in to SAP Concur and open the Approvals section.'],
        ['Review Details', 'Page', 'Open the request or expense report and review the key details, including purpose, dates, costs and supporting documents.'],
        ['Concur Compliance Status', 'Shield', 'SAP Concur automatically checks the request or expense against RSG travel policy and shows whether it is Compliant or Non-Compliant. Review any highlighted exceptions and the business justification.'],
        ['Get Insights with Joule', 'Robot', 'Use Joule, your AI assistant in SAP Concur, to quickly summarize requests, explain exceptions, or find key information.'],
        ['Approve or Send Back', 'Like', "After reviewing the details and Joule's insights, approve the request or send it back with comments if more information is needed."]
      ].map(([title, icon, description], i) => ({ kind: 'HelpStep', number: i + 1, icon, iconColor: NAVY, title, description })));
      await addPolicySection(pageId, {
        layout: 'Feature', order: 2, title: 'Tips for Approvers', icon: 'Lightbulb', width: 'OneThird', sectionStyle: 'Tinted', theme: 'Blooming Nature',
        body: ['@CheckMark|Use Joule to get a quick summary.', '@CheckMark|Focus on highlighted policy exceptions.', '@CheckMark|Add comments when sending back for clarification.', '@CheckMark|Approve requests regularly to keep travel plans on track.']
      });
      const help = await addPolicySection(pageId, {
        layout: 'Feature', order: 3, title: 'Need Help?', icon: 'Headset', width: 'OneThird', theme: 'Crystal Waters', body: 'Get the right support, at the right time.'
      });
      await addPolicyCards('SectionIdId', help, [
        { kind: 'Info', title: 'SAP Concur Support (System Help Desk)', icon: 'Mail', iconColor: NAVY, description: 'helpdesk.ksaobt@travelats.com' },
        { kind: 'Info', title: 'Approval Guidelines', icon: 'Library', iconColor: NAVY, description: 'Understand your role as an approver', targetSlug: 'compliance-responsibilities' }
      ]);
      await addPolicySection(pageId, {
        layout: 'Feature', order: 4, title: 'Meet Joule', icon: 'Robot', width: 'OneThird', sectionStyle: 'Tinted', theme: 'Majestic Mountains',
        subtitle: 'Your AI assistant in SAP Concur',
        body: ['@CheckMark|Get quick answers', '@CheckMark|Summarize requests', '@CheckMark|Understand policy exceptions', '@CheckMark|Save time, approve with confidence'],
        linkText: 'Learn More About Joule', linkUrl: 'https://www.sap.com/products/artificial-intelligence/ai-assistant.html'
      });
    },

    'sap-concur-claim-expense': async () => {
      const pageId = await sapSubPage('sap-concur-claim-expense', 43, 'Money', 'Claim & Expense', 'Expense claim made easy — just scan receipts & submit.');
      const how = await addPolicySection(pageId, {
        layout: 'ProcessSteps', order: 1, title: 'How It Works', cardStyle: 'Stacked', width: 'TwoThirds', sectionStyle: 'Card',
        subtitle: 'Submit your business travel expenses in a few simple steps.'
      });
      await addPolicyCards('SectionIdId', how, [
        ['Create Expense Report', 'Page', C.blue, 'Open Concur Mobile or desktop and create a new expense report.'],
        ['Add Expense', 'Add', C.green, 'Add your expenses (reimbursable items as mentioned in the travel policy).'],
        ['Scan & Attach Receipts', 'Camera', 'Thriving Corals', 'Use your mobile camera to scan and upload receipts (photos or PDF). Ensure the details are clear and readable.'],
        ['Submit', 'Send', 'Majestic Mountains', 'Review the details and submit your expense report.']
      ].map(([title, icon, color, description], i) => ({ kind: 'HelpStep', number: i + 1, icon, iconColor: color, title, description })));
      await addPolicySection(pageId, {
        layout: 'Feature', order: 2, title: 'Reimbursable Items', icon: 'Page', width: 'OneThird', theme: 'Crystal Waters',
        body: [
          'You can claim expenses for eligible items as mentioned in the RSG Travel Policy, including:',
          '@CheckMark|Flights', '@CheckMark|Hotels', '@CheckMark|Ground transportation', '@CheckMark|Meals (as per policy)',
          '@CheckMark|Business communication', '@CheckMark|Visa fees (business travel)', '@CheckMark|Other approved travel-related costs'
        ],
        linkText: 'View Full Travel Policy', targetSlug: 'expenses'
      });
      const track = await addPolicySection(pageId, {
        layout: 'ProcessSteps', order: 3, title: 'Track Your Expense Report', cardStyle: 'Stacked', width: 'TwoThirds', sectionStyle: 'Card',
        subtitle: 'Check the real-time status of your expense report in SAP Concur.'
      });
      await addPolicyCards('SectionIdId', track, [
        { kind: 'HelpStep', icon: 'CheckMark', iconColor: C.green, title: 'Submitted', description: 'Your expense report has been submitted successfully.' },
        { kind: 'HelpStep', icon: 'Search', iconColor: C.blue, title: 'Under Review', subtitle: 'Concur Audit Team', description: 'Your report is being reviewed by the Concur audit team.' },
        { kind: 'HelpStep', icon: 'CheckMark', iconColor: 'Sandy Dunes', title: 'Approved', description: 'Your expense report has been approved.' },
        { kind: 'HelpStep', icon: 'Database', iconColor: 'Majestic Mountains', title: 'Reimbursed', description: 'The reimbursement has been processed to your bank account.' }
      ]);
      await addPolicySection(pageId, {
        layout: 'Feature', order: 4, title: 'Helpful Tips', icon: 'Lightbulb', width: 'OneThird', sectionStyle: 'Tinted', theme: 'Blooming Nature',
        body: ['@CheckMark|Just scan receipts and submit.', '@CheckMark|Ensure receipts are clear and readable.', '@CheckMark|Add a short description for each expense.', '@CheckMark|Submit regularly to keep your travel plans on track.']
      });
      await addPolicySection(pageId, {
        layout: 'Callout', order: 5, icon: 'Megaphone', body: "You'll be notified at each stage through email and in the Concur app."
      });
      const help = await addPolicySection(pageId, { layout: 'Split', order: 6, title: 'Need Help?', icon: 'Robot', subtitle: 'Ask Joule or contact Travel Services.', sectionStyle: 'Tinted', theme: 'Majestic Mountains' });
      await addPolicyCards('SectionIdId', help, [
        { kind: 'Info', title: 'Ask Joule', icon: 'Robot', description: 'Your AI assistant in SAP Concur.', linkText: 'Ask Joule', linkUrl: CONCUR_URL, openInNewTab: true },
        { kind: 'Info', title: 'SAP Concur Support', icon: 'Mail', description: 'helpdesk.ksaobt@travelats.com' }
      ]);
    },

    'sap-concur-mobile': async () => {
      const pageId = await sapSubPage('sap-concur-mobile', 44, 'CellPhone', 'Use Concur Mobile', 'Your travel and expense tool — anytime, anywhere.');
      const uses = await addPolicySection(pageId, { layout: 'ImageCards', order: 1, columns: 4, width: 'TwoThirds' });
      await addPolicyCards('SectionIdId', uses, [
        ['Book Travel', 'Airplane', C.blue, 'Search and book flights, hotels and more.'],
        ['Submit Expenses', 'ReceiptCheck', C.green, 'Capture receipts and submit on the go.'],
        ['Get Approvals', 'CheckMark', 'Sandy Dunes', 'Stay informed and take action anytime.'],
        ['Manage Trips', 'Suitcase', 'Majestic Mountains', 'View itineraries, travel updates and more.']
      ].map(([title, icon, color, description]) => ({ kind: 'Info', title, icon, iconColor: color, description })));
      const why = await addPolicySection(pageId, { layout: 'Feature', order: 2, title: 'Why Use Concur Mobile?', width: 'OneThird' });
      await addPolicyCards('SectionIdId', why, [
        { kind: 'Info', title: 'Save time', icon: 'LightningBolt', iconColor: NAVY, description: 'Manage travel and expenses in one app.' },
        { kind: 'Info', title: 'Easy to use', icon: 'CellPhone', iconColor: NAVY, description: 'Simple and intuitive design.' },
        { kind: 'Info', title: 'Stay informed', icon: 'Ringer', iconColor: NAVY, description: 'Get real-time updates.' },
        { kind: 'Info', title: 'Secure', icon: 'Shield', iconColor: NAVY, description: 'Your data is protected.' }
      ]);
      const download = await addPolicySection(pageId, {
        layout: 'Split', order: 3, title: 'Download the SAP Concur App', width: 'TwoThirds', sectionStyle: 'Tinted', theme: 'Crystal Waters',
        subtitle: 'Scan the QR code or search "SAP Concur" in your app store.'
      });
      await addPolicyCards('SectionIdId', download, [
        { kind: 'Info', title: 'App Store', imageUrl: qr('https://apps.apple.com/app/sap-concur/id335023774'), description: 'Download on the App Store', linkText: 'Open', linkUrl: 'https://apps.apple.com/app/sap-concur/id335023774', openInNewTab: true },
        { kind: 'Info', title: 'Google Play', imageUrl: qr('https://play.google.com/store/apps/details?id=com.concur.breeze'), description: 'Get it on Google Play', linkText: 'Open', linkUrl: 'https://play.google.com/store/apps/details?id=com.concur.breeze', openInNewTab: true },
        { kind: 'Info', title: 'Travel Smarter On the Go', subPoints: ['@Clock|Anytime', '@MapPin|Anywhere', '@CellPhone|On Any Device'] }
      ]);
      await addPolicySection(pageId, {
        layout: 'Feature', order: 4, title: 'Need Help?', icon: 'Robot', width: 'OneThird', sectionStyle: 'Tinted', theme: 'Majestic Mountains',
        body: 'Contact Travel Services or ask Joule in Concur.', linkText: 'Ask Joule', linkUrl: CONCUR_URL
      });
    }
  });

  // -------------------------------------------------------------------
  // Catering Services (home) + Mövenpick and Marriott menu sub-pages, laid
  // out as in Catering_Services.pdf (01OCT2026) and its Content
  // Specification. Prices, menus and photos are all list content - see
  // docs/POLICY-CONTENT-GUIDE.md §13 for the PriceList / Gallery / ImageMenu
  // building blocks. Sub-page Slugs start with "catering-services-" so the
  // Catering Services nav tab stays highlighted on them.
  // -------------------------------------------------------------------
  const CATERING_EMAIL = 'TravelServices@RedSeaGlobal.com';
  const CATERING_VAT = 'Prices are in Saudi Riyal (SAR) and exclude applicable VAT.';
  // Placeholder - replace with the approved Helpdesk / request destination.
  const CATERING_BOOKING_URL = 'https://www.redseaglobal.com';
  const CATERING_MAROON = 'Majestic Mountains';
  const CATERING_GREEN = 'Blooming Nature';
  const CATERING_HELP = {
    NeedHelpTitle: 'Need Help? Contact Travel Services',
    NeedHelpDescription: 'Our team is here to assist you with catering options, menus and bookings.',
    NeedHelpEmail: CATERING_EMAIL
  };
  const CATERING_BOOKING_CTA = {
    CtaTitle: 'Need to Book Catering Services?',
    CtaDescription: 'Selected your preferred menu?',
    CtaPrimaryText: 'Book Catering Services',
    CtaPrimaryUrl: link(CATERING_BOOKING_URL)
  };
  const CATERING_HERO_TAGLINE = 'Great Food\nBrings\nPeople\nTogether';

  async function addCateringBookingProcess(pageId, order) {
    const steps = await addPolicySection(pageId, {
      layout: 'ProcessSteps', order, title: 'Catering Booking Process', cardStyle: 'Stacked',
      subtitle: 'A simple process to arrange catering for your meeting, workshop or event.'
    });
    await addPolicyCards('SectionIdId', steps, [
      ['Raise a request through Helpdesk', 'CalendarAgenda'],
      ['Proposals submitted by Corp. F&A Team', 'Group'],
      ['Raise a PR', 'ClipboardList'],
      ['Share the approved PO with Corp. F&A Team', 'Documentation'],
      ['Catering Services Confirmation', 'RingerSolid']
    ].map(([title, icon], i) => ({ kind: 'HelpStep', number: i + 1, icon, iconColor: C.blue, title })));
  }

  async function addCateringGallery(pageId, order, seed) {
    const gallery = await addPolicySection(pageId, {
      layout: 'Gallery', order, title: 'Catering Setup Gallery', icon: 'Camera', columns: 4,
      subtitle: 'See how our catering could look at the KAFD Office.'
    });
    await addPolicyCards('SectionIdId', gallery, [
      'Coffee break station', 'Finger food display', 'Buffet lunch setup', 'Meeting room catering'
    ].map((title, i) => ({ kind: 'Info', title, imageUrl: img(seed + '-gallery-' + i, 1200, 800) })));
  }

  // One popup gallery per partner (home page "Catering Setup Gallery" buttons).
  const cateringGalleryPopup = (seed, partner) =>
    [1, 2, 3, 4].map((n) => `${partner} setup ${n} | ${img(seed + '-gallery-' + (n - 1), 1200, 800)} | image`);

  // Menu card (ImageCards / ImageMenu): ribbon, price tag, items.
  const menuCard = (seed, badge, price, items, color) => ({
    kind: 'Info', title: '[' + badge + ']', badge, iconColor: color || CATERING_MAROON,
    imageUrl: img(seed, 700, 420), value: 'SAR ' + price, valueNote: 'per person', subPoints: items
  });

  Object.assign(MORE_PAGE_SEEDERS, {
    // --- Catering Services (home) ---------------------------------------------
    'catering-services': async () => {
      const pageId = await addPage(40, Object.assign({
        Title: 'Catering Services', Slug: 'catering-services',
        HeroEyebrow: 'Catering Services', HeroTitle: 'Catering Services',
        HeroDescription: 'Explore catering solutions for meetings, workshops and events at the KAFD Office, delivered through our trusted catering partners.',
        HeroImageUrl: link(img('catering-hero', 1600, 500)), HeroTagline: CATERING_HERO_TAGLINE,
        HeroHighlights: ['Diamond|Quality Catering Solutions', 'Group|Tailored for RSG Events', 'Ribbon|Trusted Partner Network'].join('\n')
      }, CATERING_HELP));

      // 1.2 Partner cards are informational - no "View Menus" link.
      const partners = await addPolicySection(pageId, {
        layout: 'ImageCards', order: 1, title: 'Our Catering Partners', cardStyle: 'ImageTop', columns: 3,
        subtitle: 'Exceptional catering experiences from our trusted partners at the KAFD Office.'
      });
      await addPolicyCards('SectionIdId', partners, [
        ['Mövenpick Hotel & Residences Riyadh', 'Premium catering for your meetings and events with a wide range of menu options.', 'cat-movenpick'],
        ['Marriott Riyadh', 'Inspired catering for corporate events with diverse menu options.', 'cat-marriott'],
        ['Mayyar Catering Services', 'Customized catering arrangements based on your event requirements. Catering is on demand.', 'cat-mayyar']
      ].map(([title, description, seed]) => ({ kind: 'Info', title, description, imageUrl: img(seed, 700, 420) })));

      // 1.3 Image/icon + title tiles, no arrows (no links).
      const experience = await addPolicySection(pageId, {
        layout: 'ImageCards', order: 2, title: 'Choose Your Catering Experience', cardStyle: 'ImageTile', columns: 5,
        body: 'A range of catering options to suit your meeting, workshop or event.'
      });
      await addPolicyCards('SectionIdId', experience, [
        ['Coffee Break', 'Coffee', 'Sandy Dunes'], ['Finger Food Lunch', 'Cake', 'Thriving Corals'], ['Coffee Break & Lunch', 'Breakfast', 'Majestic Mountains'],
        ['Healthy Options', 'Health', C.green], ['Buffet Lunch', 'EatDrink', C.blue]
      ].map(([title, icon, color], i) => ({ kind: 'Info', title, icon, iconColor: color, imageUrl: img('cat-exp-' + i, 500, 300) })));

      // 1.4 Starting-from prices per partner; each panel opens that partner's menus.
      const featured = await addPolicySection(pageId, {
        layout: 'PriceList', order: 3, title: 'Featured Menu Options – Starting From', columns: 2,
        body: 'Indicative starting prices. Rates vary by selected menu/package and applicable conditions.'
      });
      await addPolicyCards('SectionIdId', featured, [
        {
          kind: 'Info', title: 'Mövenpick Hotel & Residences Riyadh', iconColor: 'Thriving Corals', imageUrl: img('cat-movenpick', 600, 500),
          subPoints: ['Coffee|Coffee Break|SAR 120|per person', 'Cake|Finger Food Lunch|SAR 225|per person',
            'Breakfast|Coffee Break & Finger Food Lunch|SAR 225|per person', 'Health|Healthy Options|SAR 225|per person'],
          description: CATERING_VAT, linkText: 'View Mövenpick Menus', targetSlug: 'catering-services-movenpick'
        },
        {
          kind: 'Info', title: 'Marriott Riyadh', iconColor: 'Majestic Mountains', imageUrl: img('cat-marriott', 600, 500),
          subPoints: ['Coffee|Coffee Break|SAR 120|per person', 'Cake|Finger Food Lunch|SAR 225|per person',
            'Breakfast|Coffee Break & Finger Food Lunch|SAR 225|per person', 'EatDrink|Buffet Lunch|SAR 230|per person'],
          description: CATERING_VAT, linkText: 'View Marriott Menus', targetSlug: 'catering-services-marriott'
        }
      ]);

      // 1.5 One button per partner -> that partner's photos in a popup gallery.
      const gallery = await addPolicySection(pageId, {
        layout: 'ImageCards', order: 4, title: 'Catering Setup Gallery', cardStyle: 'ImageBanner', columns: 3,
        subtitle: 'See how our catering could look at the KAFD Office.'
      });
      await addPolicyCards('SectionIdId', gallery, [
        ['Mövenpick Setup Gallery', 'cat-movenpick', 'Mövenpick'],
        ['Marriott Setup Gallery', 'cat-marriott', 'Marriott'],
        ['Mayyar Setup Gallery', 'cat-mayyar', 'Mayyar']
      ].map(([title, seed, partner]) => ({ kind: 'Info', title, imageUrl: img(seed + '-gallery-0', 900, 420), popup: cateringGalleryPopup(seed, partner) })));

      await addCateringBookingProcess(pageId, 5);
    },

    // --- Mövenpick menu ------------------------------------------------------------
    'catering-services-movenpick': async () => {
      const pageId = await addPage(41, Object.assign({
        Title: 'Mövenpick Menu', Slug: 'catering-services-movenpick',
        ParentSlug: 'catering-services', ParentTitle: 'Catering Services',
        // HeroLogoUrl: link('<Mövenpick logo in Travel Hub Images>'),
        HeroEyebrow: 'Mövenpick Hotel & Residences Riyadh', HeroTitle: 'Catering Menus',
        HeroDescription: 'Premium catering for RSG meetings, workshops and events at the KAFD Office.',
        HeroImageUrl: link(img('cat-movenpick-hero', 1600, 500)), HeroTagline: CATERING_HERO_TAGLINE,
        HeroHighlights: ['Diamond|Premium Quality', 'EatDrink|Wide Range of Menu Options', 'Health|Fresh & Healthy Ingredients', 'Group|Tailored for RSG Events'].join('\n'),
        NoteBannerText: CATERING_VAT
      }, CATERING_BOOKING_CTA, CATERING_HELP));

      const coffeeItems = ['Mini Cold Sandwiches', 'Savory Shooters', 'Mini Croissants', 'Pastries', 'Hot Bites', 'Selection of Nuts', 'Sliced Fruits', 'Fresh Juices & Detox Water'];
      // 2.2 Coffee Break + Finger Food side by side (50/50), stacked on smaller screens.
      const coffee = await addPolicySection(pageId, {
        layout: 'ImageCards', order: 1, title: 'Coffee Break Menus', icon: 'Coffee', cardStyle: 'ImageMenu', columns: 2, width: 'Half', sectionStyle: 'Card'
      });
      await addPolicyCards('SectionIdId', coffee, [
        menuCard('cat-mov-menu-1', 'Menu 1', 120, coffeeItems),
        menuCard('cat-mov-menu-2', 'Menu 2', 150, coffeeItems)
      ]);
      const finger = await addPolicySection(pageId, {
        layout: 'ImageCards', order: 2, title: 'Lunch Menus – Finger Food', icon: 'EatDrink', cardStyle: 'ImageMenu', columns: 2, width: 'Half', sectionStyle: 'Card',
        subtitle: 'A variety of delicious bite-sized selections, perfect for working meetings and informal gatherings.'
      });
      await addPolicyCards('SectionIdId', finger, [
        menuCard('cat-mov-menu-3', 'Menu 3', 225, ['Mini Sandwiches', 'Mini Salads', 'Hot Snacks', 'Finger Food Selections', 'Pastries & Desserts', 'Sliced Fruits', 'Fresh Juices & Detox Water']),
        menuCard('cat-mov-menu-4', 'Menu 4 – Healthy', 225, ['Healthy Mini Sandwiches', 'Healthy Salads', 'Healthy Hot Snacks', 'Finger Food Selections', 'Healthy Pastries', 'Sliced Fruits', 'Fresh Juices & Detox Water'], CATERING_GREEN)
      ]);

      // 2.3 Main course: Menu 1 before Menu 2 - VIP Lunch (wide cards, photo left).
      const mainItems = ['Salads', 'Main Courses (Chicken, Beef, Fish, Vegetarian)', 'Rice Selections', 'Hot Side Dishes', 'Pastries & Desserts', 'Sliced Fruits', 'Fresh Juices & Detox Water'];
      const main = await addPolicySection(pageId, {
        layout: 'ImageCards', order: 3, title: 'Lunch Menus – Main Course', icon: 'Breakfast', cardStyle: 'ImageMenu', columns: 2, sectionStyle: 'Card',
        body: 'Complete lunch selections, from buffet to plated options, with international and local flavours.'
      });
      await addPolicyCards('SectionIdId', main, [
        menuCard('cat-mov-lunch-1', 'Menu 1 – Lunch', 250, mainItems),
        menuCard('cat-mov-lunch-2', 'Menu 2 – VIP Lunch', 275, mainItems)
      ]);

      // 2.4 Special add-ons (photo left, guest basis, price).
      const addons = await addPolicySection(pageId, {
        layout: 'ImageCards', order: 4, title: 'Special Add-ons', subtitle: 'Available upon request', icon: 'Starburst', cardStyle: 'ImageLeft', columns: 3,
        body: 'Enhance your event with our premium live stations.'
      });
      await addPolicyCards('SectionIdId', addons, [
        ['Ice Cream Cart', 'SAR 2,500'], ['Chocolate Station', 'SAR 2,500'], ['Sushi Station', 'SAR 6,000']
      ].map(([title, value], i) => ({
        kind: 'Info', title, subtitle: '30 to 40 guests daily', value, iconColor: CATERING_MAROON, imageUrl: img('cat-mov-addon-' + i, 400, 300)
      })));

      // 2.5 Menu highlights strip.
      const highlights = await addPolicySection(pageId, {
        layout: 'Split', order: 5, title: 'Menu Highlights', icon: 'Info', sectionStyle: 'Tinted', theme: 'Crystal Waters'
      });
      await addPolicyCards('SectionIdId', highlights, [
        ['Premium catering experience', 'Diamond'], ['Wide range of menu options', 'EatDrink'], ['Fresh and seasonal ingredients', 'Health'],
        ['Ideal for RSG meetings, workshops and events', 'Group'], ['Available at KAFD Office', 'MapPin']
      ].map(([title, icon]) => ({ kind: 'Info', title, icon, iconColor: C.blue })));

      // 2.6 Photos only - no arrows; each opens the gallery popup.
      await addCateringGallery(pageId, 6, 'cat-movenpick');
      await addCateringBookingProcess(pageId, 7);
    },

    // --- Marriott menu -------------------------------------------------------------
    'catering-services-marriott': async () => {
      const pageId = await addPage(42, Object.assign({
        Title: 'Marriott Menu', Slug: 'catering-services-marriott',
        ParentSlug: 'catering-services', ParentTitle: 'Catering Services',
        // HeroLogoUrl: link('<Marriott logo in Travel Hub Images>'),
        HeroEyebrow: 'Marriott Riyadh', HeroTitle: 'Catering Menus',
        HeroDescription: 'Exceptional catering for RSG meetings, workshops and events at the KAFD Office.',
        HeroImageUrl: link(img('cat-marriott-hero', 1600, 500)), HeroTagline: CATERING_HERO_TAGLINE,
        HeroHighlights: ['Diamond|Premium Quality', 'EatDrink|Wide Range of Menu Options', 'Health|Fresh & Seasonal Ingredients', 'Group|Tailored for RSG Events'].join('\n')
      }, CATERING_BOOKING_CTA, CATERING_HELP));

      // 3.2 First menu section.
      const finger = await addPolicySection(pageId, {
        layout: 'ImageCards', order: 1, title: 'Finger Food Menus', icon: 'EatDrink', cardStyle: 'ImageMenu', columns: 3, sectionStyle: 'Card',
        body: 'A selection of delicious bite-sized options, perfect for short meetings, working lunches and informal gatherings.'
      });
      await addPolicyCards('SectionIdId', finger, [
        menuCard('cat-mar-ff-1', 'Option 1', 160, ['Mini Sandwiches', 'Mini Wraps', 'Savory Bites', 'Mini Quiches', 'Pastries', 'Mini Desserts']),
        menuCard('cat-mar-ff-2', 'Option 2', 210, ['Premium Mini Sandwiches', 'Gourmet Savory Bites', 'Mini Wraps & Sliders', 'Pastries', 'Mini Desserts', 'Hot & Cold Beverages', 'International Selections']),
        menuCard('cat-mar-ff-3', 'Option 3', 240, ['Premium Mini Sandwiches', 'Gourmet Canapés', 'Hot Savory Bites', 'Pastries', 'Mini Desserts', 'Fresh Fruits', 'International Selections'])
      ]);

      // 3.3 Second section, with the single VAT statement under it.
      const combo = await addPolicySection(pageId, {
        layout: 'ImageCards', order: 2, title: 'Coffee Breaks & Finger Food Menus', icon: 'Coffee', cardStyle: 'ImageMenu', columns: 3, sectionStyle: 'Card',
        body: 'Combine refreshing coffee breaks with a selection of finger foods for a complete catering experience.'
      });
      await addPolicyCards('SectionIdId', combo, [
        menuCard('cat-mar-cb-1', 'Option 1', 200, ['Freshly Brewed Coffee & Tea', 'Selection of Juices', 'Mini Pastries & Croissants', 'Seasonal Fresh Fruits', 'Mini Sandwiches', 'Savory Bites', 'Mini Desserts']),
        menuCard('cat-mar-cb-2', 'Option 2', 250, ['Freshly Brewed Coffee & Tea', 'Assorted Juices & Detox Water', 'Pastries & Danish Selection', 'Seasonal Fresh Fruits', 'Mini Sandwiches', 'Gourmet Savory Bites', 'Mini Desserts', 'International Selections']),
        menuCard('cat-mar-cb-3', 'Option 3', 290, ['Freshly Brewed Coffee & Tea', 'Premium Juice Selection', 'Gourmet Pastries & Croissants', 'Seasonal Fresh Fruits', 'Premium Mini Sandwiches', 'Hot & Cold Savory Bites', 'Mini Desserts', 'International Selections'])
      ]);
      await addPolicySection(pageId, { layout: 'Callout', order: 3, icon: 'Info', body: CATERING_VAT });

      // 3.4 Third menu section.
      const buffetBase = ['Rice & Side Dishes', 'International & Local Selections', 'Bread Selection', 'Fresh Fruits', 'Juices & Water'];
      const buffet = await addPolicySection(pageId, {
        layout: 'ImageCards', order: 4, title: 'Buffet Lunch Menus', icon: 'Breakfast', cardStyle: 'ImageMenu', columns: 3, sectionStyle: 'Card',
        body: 'A wide range of international and local flavours, ideal for larger meetings, events and formal gatherings.'
      });
      await addPolicyCards('SectionIdId', buffet, [
        menuCard('cat-mar-bl-1', 'Option 1', 230, ['Salad Bar', 'Hot Main Courses (2–3 options)'].concat(buffetBase, ['Desserts'])),
        menuCard('cat-mar-bl-2', 'Option 2', 260, ['Salad Bar', 'Hot Main Courses (3–4 options)'].concat(buffetBase, ['Desserts'])),
        menuCard('cat-mar-bl-3', 'Option 3', 300, ['Premium Salad Bar', 'Hot Main Courses (4–5 options)'].concat(buffetBase, ['Premium Desserts']))
      ]);

      await addCateringGallery(pageId, 5, 'cat-marriott');
      await addCateringBookingProcess(pageId, 6);
    }
  });

  // -------------------------------------------------------------------
  // TH_Offers - list-maintained cards for Personal Travel Offers (Featured +
  // Explore tiles) and Meetings & Events (partnered hotels). Popup content
  // is uploaded as ITEM ATTACHMENTS (what editors do: open the item, "Add
  // attachments"); if an upload fails it falls back to PopupContent links.
  // -------------------------------------------------------------------
  // Uploads `url` as an attachment of TH_Offers item `itemId`; false on failure.
  async function attachFromUrl(itemId, fileName, url) {
    try {
      const file = await fetch(url, { mode: 'cors' });
      if (!file.ok) throw new Error('HTTP ' + file.status);
      const body = await file.arrayBuffer();
      const res = await fetch(webUrl + `/_api/web/lists/getbytitle('TH_Offers')/items(${itemId})/AttachmentFiles/add(FileName='${encodeURIComponent(esc(fileName))}')`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { Accept: 'application/json;odata=verbose', 'X-RequestDigest': digest },
        body
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      await sleep(CONFIG.THROTTLE_MS);
      return true;
    } catch (e) {
      warn(`  attachment ${fileName} on TH_Offers ${itemId} failed (${e.message}) - using a PopupContent link instead`);
      return false;
    }
  }

  // files: [fileName, url] - uploaded as attachments in this order (names start "1 - ", "2 - " to fix the order).
  async function addOffer(fields, files) {
    const id = await addItem('TH_Offers', Object.assign({ IsActive: true, ClickAction: 'Auto' }, fields));
    const fallback = [];
    let n = 1;
    for (const [name, url] of files || []) {
      if (!url) continue;
      const ext = /\.pdf$/i.test(url) ? '.pdf' : '.jpg';
      const fileName = `${n++} - ${name}${ext}`;
      if (!(await attachFromUrl(id, fileName, url))) fallback.push(`${name} | ${url}${ext === '.jpg' ? ' | image' : ''}`);
    }
    if (fallback.length) {
      const type = await entityType('TH_Offers');
      await spSend('MERGE', `/_api/web/lists/getbytitle('TH_Offers')/items(${id})`, { __metadata: { type }, PopupContent: fallback.join('\n') });
    }
    return id;
  }

  async function seedOffers() {
    const validTo = addDays(120).slice(0, 10) + 'T00:00:00Z';
    const OFFERS_LINK = 'https://www.redseaglobal.com';
    const featured = [
      ['Maldives', '5 Nights Holiday Package', 'Special Offer', 'SAR 5,999', 'per person', 'Maldives', 'Sun Siyam Resorts'],
      ['Istanbul', '4 Nights City Break', 'Exclusive Rate', 'SAR 3,499', 'per person', 'Istanbul, Türkiye', 'Turkish Airlines Holidays'],
      ['Dubai', '4 Nights Family Package', 'Family Offer', 'SAR 4,999', 'per family', 'Dubai, UAE', 'Emirates Holidays'],
      ['London', 'Airfare + Hotel Package', 'Special Fare', 'SAR 3,999', 'per person', 'London, UK', 'Saudia Holidays'],
      ['Baku', '4 Nights City Break', 'New Destination', 'SAR 2,999', 'per person', 'Baku, Azerbaijan', 'flynas Holidays']
    ];
    let order = 10;
    for (const [title, subtitle, badge, value, note, location, partner] of featured) {
      const seed = 'offer-' + title.toLowerCase();
      await addOffer({
        Title: title, Collection: 'Featured Personal Offers', Subtitle: subtitle, Badge: badge, IconColor: 'Thriving Corals',
        ImageUrl: link(img(seed, 900, 600)), ValueLabel: 'Starting From', Value: value, ValueNote: note,
        Partner: partner, Location: location, ValidTo: validTo,
        Summary: `${subtitle} in ${location} at an exclusive RSG employee rate.`,
        Details: [
          `Enjoy ${subtitle.toLowerCase()} in ${location}, arranged by ${partner} for RSG employees and their families.`,
          'Book through Personal Travel Care and quote your RSG employee ID to receive the special rate.',
          '- Flexible travel dates within the validity period',
          '- Prices subject to availability at the time of booking'
        ].join('\n'),
        Inclusions: ['Return economy airfare from Riyadh or Jeddah', 'Hotel accommodation with breakfast', 'Airport transfers', 'Travel insurance'].join('\n'),
        Terms: ['Offer valid for RSG employees and their immediate family members.', 'Rates are per person based on twin sharing unless stated otherwise.', 'Blackout dates may apply during peak seasons.'].join('\n'),
        LinkText: 'View Details', LinkUrl: link(OFFERS_LINK), CtaText: 'Book This Offer',
        ContactEmail: 'holidays.ksa@travelats.com', ContactPhone: '+966 11 413 6116', DisplayOrder: order
      }, [['Gallery 1', img(seed + '-g1', 1200, 800)], ['Gallery 2', img(seed + '-g2', 1200, 800)], ['Offer brochure', SAMPLE_PDF_2]]);
      order += 10;
    }

    // Explore tiles: icon + colour + photo; the popup content is the attachments.
    const poster = (s) => img(s, 1000, 1400);
    const explore = [
      ['Flights', 'Airplane', 'Blue Lagoon', [['Flight offers', poster('pto-flights')]]],
      ['Hotels', 'Hotel', 'Majestic Mountains', [['Riyadh hotels', poster('pto-hotels-1')], ['Jeddah hotels', poster('pto-hotels-2')], ['International hotels', poster('pto-hotels-3')]]],
      ['Car Rental', 'Car', 'Blooming Nature', [['Car rental offers', poster('pto-car')], ['Car rental terms', SAMPLE_PDF_1]]],
      ['Holiday Packages', 'Sunny', 'Thriving Corals', [['Holiday packages brochure', SAMPLE_PDF_2]]],
      ['Wellness Beyond Office', 'Health', 'Blooming Nature', [['Wellness partners', poster('pto-wellness-1')], ['Fitness offers', poster('pto-wellness-2')]]],
      ['F&B Offers', 'EatDrink', 'Thriving Corals', [['Restaurant offers', poster('pto-fnb-1')], ['Cafe offers', poster('pto-fnb-2')]]],
      ['Outlet Malls', 'Shop', 'Majestic Mountains', [['Outlet mall offers', poster('pto-outlet')]]],
      ['Visa Guidance', 'Certificate', 'Blue Lagoon', [['Visa Guidance', poster('pto-visa-poster')]]],
      ['International Driving License', 'Car', 'Sandy Dunes', [['International Driving License', poster('pto-idl-poster')]]],
      ['City Guide (Riyadh & Jeddah)', 'MapPin', 'Majestic Mountains', [['Riyadh City Guide', SAMPLE_PDF_1], ['Jeddah City Guide', SAMPLE_PDF_2]]]
    ];
    order = 10;
    for (const [title, icon, color, files] of explore) {
      await addOffer({
        Title: title, Collection: 'Explore Personal Offers', Icon: icon, IconColor: color,
        ImageUrl: link(img('pto-tile-' + order, 500, 300)), DisplayOrder: order
      }, files);
      order += 10;
    }

    // Partnered hotels: "View Gallery" -> attached photos (popup).
    const hotels = [
      ['Riyadh Partnered Hotels', [['W Riyadh - KAFD', 'SAR 450'], ['Atheel KAFD', 'SAR 350'], ['Sofitel Riyadh Hotel & Convention Centre', 'SAR 425'],
        ['Mövenpick Hotel and Residences Riyadh', 'SAR 350'], ['Executives Hotel - KAFD', 'SAR 280'], ['Crowne Plaza Riyadh RDC Hotel & Convention', 'SAR 300']]],
      ['Jeddah Partnered Hotels', [['Asila Jeddah', 'SAR 450'], ['Shangri-La Jeddah', 'SAR 350'], ['Crowne Plaza Jeddah Al Salam', 'SAR 300'],
        ['Hilton Jeddah', 'SAR 280'], ['Sheraton Jeddah', 'SAR 325']]]
    ];
    for (const [collection, rows] of hotels) {
      order = 10;
      for (const [title, value] of rows) {
        const seed = 'hotel-' + title.toLowerCase().replace(/[^a-z]+/g, '-');
        await addOffer({
          Title: title, Collection: collection, ImageUrl: link(img(seed, 500, 320)),
          ValueLabel: 'Starting From', Value: value, ValueNote: 'per participant', LinkText: 'View Gallery', DisplayOrder: order
        }, [['Meeting room', img(seed + '-1', 1200, 800)], ['Ballroom', img(seed + '-2', 1200, 800)], ['Catering setup', img(seed + '-3', 1200, 800)]]);
        order += 10;
      }
    }
  }

  // TH_TravelServices rows whose nav tab / card should open one of these pages.
  const SERVICE_PAGE_SLUGS = { 'personal travel offers': 'personal-travel-offers', 'personal travel': 'personal-travel-offers', 'sap concur': 'sap-concur', 'meeting & events': 'meetings-events', 'meetings & events': 'meetings-events', 'catering services': 'catering-services', 'catering service': 'catering-services' };

  // Sets TH_TravelServices.PageSlug on matching rows that don't have one yet.
  async function linkServicePages() {
    const d = await spGetJson("/_api/web/lists/getbytitle('TH_TravelServices')/items?$select=Id,Title,PageSlug&$top=200");
    const type = await entityType('TH_TravelServices');
    for (const row of d.results) {
      const slug = SERVICE_PAGE_SLUGS[String(row.Title || '').trim().toLowerCase()];
      if (!slug || row.PageSlug) continue;
      await spSend('MERGE', `/_api/web/lists/getbytitle('TH_TravelServices')/items(${row.Id})`, { __metadata: { type }, PageSlug: slug });
      log(`   TH_TravelServices "${row.Title}" -> PageSlug ${slug}`);
    }
  }


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

    log('\n-- Pages ---------------------------------------');
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
      log('\n-- TH_Offers ------------------------------------');
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

    log('\n================ SUMMARY ================');
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
