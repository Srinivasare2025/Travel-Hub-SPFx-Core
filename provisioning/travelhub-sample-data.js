/* =============================================================================
 * TravelHub - SAMPLE DATA loader (browser console / REST)
 * =============================================================================
 *
 * Fills every TH_* list with realistic demo content that matches the Phase 1
 * mockup, so you can see the web part working and understand what each column
 * is for. Run travelhub-provision.js FIRST (lists + fields must already exist).
 *
 * HOW TO RUN
 *   1. Open a page on the target site, e.g.
 *        https://theredsea.sharepoint.com/sites/TravelHub
 *   2. F12 -> Console. Check CONFIG.TARGET_WEB_URL below matches your site
 *        (same value as travelhub-provision.js's own CONFIG.TARGET_WEB_URL).
 *   3. Paste the whole file, press Enter. Read the SUMMARY at the end.
 *
 * OPTIONS (CONFIG block below)
 *   RESET                  - delete ALL existing items in the TH_* content
 *                            lists before loading (default false). Use this to
 *                            re-load clean. It does NOT touch list structure.
 *   USE_PLACEHOLDER_IMAGES - use picsum.photos / pravatar.cc placeholder image
 *                            URLs (default true). Set false to leave image
 *                            columns blank and rely on the built-in fallbacks,
 *                            or edit IMAGES below to point at your own library.
 *
 * IDEMPOTENCY
 *   Without RESET, a list that already has items is skipped. With RESET, each
 *   TH_* content list is emptied first, then re-seeded.
 * ========================================================================== */

(async function loadTravelHubSampleData() {
  'use strict';

  /* ----------------------------- CONFIG ---------------------------------- */
  // Plain hardcoded string, same as travelhub-provision.js's own CONFIG -
  // no auto-detect. `window.location.origin` (the old fallback here) is
  // ALWAYS just the tenant root (scheme://host, e.g.
  // "https://theredsea.sharepoint.com") - it never includes a subsite path
  // like "/sites/TravelHub", so relying on it silently pointed every run at
  // the tenant root site instead of the target site. Edit this if your site
  // URL is different.
  const CONFIG = {
    TARGET_WEB_URL: "https://theredsea.sharepoint.com/sites/TravelHub",
    RESET: false,
    // Re-seed ONLY these Travel Policy pages on a site that already has data,
    // e.g. ['purpose-scope', 'guiding-principles', 'travel-planning-approvals',
    //       'travel-entitlement', 'expenses', 'compliance-responsibilities',
    //       'business-travel', 'employee-relocation', 'family-relocation',
    //       'personal-travel-offers', 'meetings-events', 'sap-concur',
    //       'sap-concur-plan-book', 'sap-concur-review-approve',
    //       'sap-concur-claim-expense', 'sap-concur-mobile'].
    // Also sets TH_TravelServices.PageSlug for Personal Travel Offers,
    // SAP Concur and Meeting(s) & Events when it is still empty.
    // Deletes each listed page (and its sections/tabs/cards/tables) and seeds
    // it again from this file; every other step and list is skipped.
    RESEED_SLUGS: [],
    USE_PLACEHOLDER_IMAGES: true,
    THROTTLE_MS: 120
  };

  const webUrl = CONFIG.TARGET_WEB_URL.replace(/\/$/, '');
  const log = (...a) => console.log('%c[TravelHub data]', 'color:#b89c66;font-weight:bold', ...a);
  const warn = (...a) => console.warn('[TravelHub data]', ...a);
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

  /* ----------------------------- DATA --------------------------------- */

  async function seedHero() {
    const rows = [
      {
        Title: 'Travel Hub',
        Description:
          'Everything you need to plan, manage, and experience travel with confidence - all in one place.',
        MediaType: 'Image',
        ImageUrl: link(img('travelhub-hero-1', 2000, 850)),
        MobileImageUrl: link(img('travelhub-hero-1m', 900, 1100)),
        AccessibilityText: 'Aerial view of an airport terminal at sunset',
        DisplayOrder: 1,
        AutoPlay: true,
        DurationSeconds: 6,
        IsActive: true
      },
      {
        Title: 'Plan smarter with SAP Concur',
        Description: 'Book, approve and expense your business travel in one connected workflow.',
        MediaType: 'Image',
        ImageUrl: link(img('travelhub-hero-2', 2000, 850)),
        AccessibilityText: 'Traveller reviewing an itinerary on a laptop',
        DisplayOrder: 2,
        AutoPlay: true,
        DurationSeconds: 6,
        IsActive: true
      },
      {
        Title: 'Travel Care, wherever you are',
        Description: '24/7 assistance for urgent travel situations - one call away.',
        MediaType: 'Image',
        ImageUrl: link(img('travelhub-hero-3', 2000, 850)),
        AccessibilityText: 'Support agent wearing a headset',
        DisplayOrder: 3,
        AutoPlay: true,
        DurationSeconds: 6,
        IsActive: true
      }
    ];
    for (const r of rows) await addItem('TH_HeroBanners', r);
  }

  async function seedServices() {
    const rows = [
      ['Business Travel', 'Book flights, hotels and ground transport in line with the travel policy.', 'Airplane', '#04253c', 'Learn More'],
      ['Personal Travel Offers', 'Exclusive leisure travel discounts for employees and their families.', 'Suitcase', '#b89c66', 'Explore Offers'],
      ['Travel Policy', 'Read the current travel policy, approval limits and per-diem rules.', 'DocumentApproval', '#04253c', 'View Policies'],
      ['SAP Concur', 'Sign in to Concur to raise requests, book trips and submit expenses.', 'Financial', '#0b6a3a', 'Open Concur'],
      ['Catering Services', 'Arrange catering for meetings, workshops and corporate events.', 'Cake', '#b89c66', 'Explore Services'],
      ['Meeting & Events', 'Plan and manage internal events, offsites and venue bookings.', 'Group', '#04253c', 'Learn More'],
      ['Expense Claim', 'Submit receipts, track reimbursements, and manage corporate card expenses seamlessly.', 'Receipt', '#04253c', 'Learn More']
    ];
    let order = 1;
    for (const [title, desc, icon, colour, cta] of rows) {
      const external = title === 'SAP Concur';
      await addItem('TH_TravelServices', {
        Title: title,
        // Opens the list-driven page (TH_PolicyPages Slug) from the nav tab and the card.
        PageSlug: { 'Personal Travel Offers': 'personal-travel-offers', 'SAP Concur': 'sap-concur', 'Meeting & Events': 'meetings-events' }[title] || null,
        Description: desc,
        ImageUrl: link(img('svc-' + order, 800, 500)),
        // The demo images are all cropped photography (`Cover`); a real SAP
        // Concur card usually uses their logo/wordmark image instead, which
        // needs `Contain` so the text isn't cropped - set that here if you
        // swap ImageUrl for a real logo.
        ImageFit: 'Cover',
        Icon: icon,
        IconBackgroundColor: colour,
        LinkUrl: link(external ? 'https://www.concursolutions.com' : '#'),
        LinkType: external ? 'External' : 'Internal',
        LinkText: cta,
        OpenInNewTab: external,
        DisplayOrder: order++,
        IsActive: true
      });
    }
  }

  async function seedBusinessTravel() {
    const steps = [
      ['Raise Request', 'Submit a travel request in SAP Concur with your trip details and business justification.', '--full-secondary'],
      ['Approval', 'Your manager reviews and approves the request in line with the travel policy.', '--full-primary'],
      ['Book', 'Book flights, hotels and ground transport through the approved booking tool.', '--full-secondary'],
      ['Travel', 'Travel with confidence - Travel Care support is available 24/7 while you are on the road.', '--full-primary'],
      ['Expense', 'Submit your expense report in Concur with receipts attached for reimbursement.', '--full-secondary']
    ];
    let stepOrder = 1;
    for (const [title, desc, colour] of steps) {
      await addItem('TH_BusinessTravelSteps', {
        Title: title,
        Description: desc,
        Number: stepOrder,
        BackgroundColor: colour,
        DisplayOrder: stepOrder++,
        IsActive: true
      });
    }

    const infoCards = [
      ['Policy reminders', 'A quick refresher on approval limits, per-diem rules and booking classes before you travel.', 'Info', undefined, 'View'],
      ['Useful Documents', 'Download travel request templates, expense forms and the mobile app guide.', 'KnowledgeArticle', undefined, 'View'],
      ['Need further help?', 'Reach the Travel Care team for support with requests, approvals or urgent changes.', 'Headset', undefined, 'View'],
      // Employee/Family Relocation - separate TH_PolicyPages rows (see
      // seedRelocationPages()), navigated to in-app via TargetSlug.
      ['Employee Relocation', 'Relocating between Riyadh Headquarters and a Project Site? Explore your travel entitlement, shipping assistance and mobilization requirements.', 'HomeSolid', 'employee-relocation', 'View'],
      ['Family Relocation', 'Explore relocation benefits available for eligible new joiners and accompanying dependents.', 'Family', 'family-relocation', 'View']
    ];
    let infoOrder = 1;
    for (const [title, desc, icon, targetSlug, linkText] of infoCards) {
      await addItem('TH_BusinessTravelInfoCards', {
        Title: title,
        Description: desc,
        Icon: icon,
        TargetSlug: targetSlug || null,
        LinkUrl: targetSlug ? null : link('#'),
        LinkText: linkText,
        OpenInNewTab: false,
        DisplayOrder: infoOrder++,
        IsActive: true
      });
    }
  }

  async function seedNews() {
    const rows = [
      {
        Title: 'Explore Saudi Arabia: new seasonal destinations for summer',
        Description:
          'Discover newly opened Red Sea and mountain destinations, plus booking tips for peak season leisure travel.',
        Category: 'Destinations',
        IsFeatured: true,
        LinkType: 'Internal',
        TargetUrl: link('#'),
        offsetDays: -3,
        order: 1
      },
      {
        Title: 'Updated advance-booking guidelines for business travel',
        Description: 'Flights should now be booked at least 14 days ahead to control cost and improve availability.',
        Category: 'Policy',
        LinkType: 'Internal',
        TargetUrl: link('#'),
        offsetDays: -12,
        order: 2
      },
      {
        Title: 'Global travel trends to watch this year',
        Description: 'Airfare outlook, sustainability expectations and what they mean for corporate travellers.',
        Category: 'Insights',
        LinkType: 'External',
        TargetUrl: link('https://www.gbta.org'),
        openNew: true,
        offsetDays: -25,
        order: 3
      },
      {
        Title: 'Archived: 2019 regional travel handbook',
        Description: 'Historical reference kept on the legacy portal - retained for audit purposes only.',
        Category: 'Reference',
        LinkType: 'OnPremReference',
        TargetUrl: link('https://sp2019.corp.local/sites/travel/Pages/handbook-2019.aspx'),
        openNew: true,
        offsetDays: -400,
        order: 4
      }
    ];
    for (const r of rows) {
      await addItem('TH_TravelNews', {
        Title: r.Title,
        Description: r.Description,
        ImageUrl: link(img('news-' + r.order, 1200, 675)),
        PublishDate: addDays(r.offsetDays),
        LinkType: r.LinkType,
        TargetUrl: r.TargetUrl,
        Category: r.Category,
        IsFeatured: !!r.IsFeatured,
        OpenInNewTab: !!r.openNew,
        DisplayOrder: r.order,
        IsActive: true
      });
    }
  }

  async function seedEvents() {
    const rows = [
      ['Flynas partner roadshow', 'Meet our airline partner and learn about new routes and corporate fares.', 'Partner Roadshow', 5, '10:00', '11:30', 'Auditorium A'],
      ['Summer Concur campaign launch', 'Kick-off session for the summer expense-compliance campaign.', 'Campaign', 12, '13:00', '14:00', 'Online (Teams)'],
      ['IHG hotels & resorts showcase', 'Preferred-hotel programme briefing and Q&A with the account team.', 'Supplier Showcase', 20, '11:00', '12:00', 'Meeting Room 3.4'],
      ['SAP Concur awareness session', 'Hands-on walkthrough of requests, bookings and mobile approvals.', 'Training', 33, '10:00', '12:00', 'Training Lab'],
      ['Travel photography contest - submissions close', 'Last day to submit your best trip photo for the staff contest.', 'Employee Engagement', 45, null, null, 'All locations']
    ];
    let order = 1;
    for (const [title, desc, cat, days, start, end, loc] of rows) {
      await addItem('TH_TravelEvents', {
        Title: title,
        Description: desc,
        Category: cat,
        EventDate: addDays(days),
        StartTime: start,
        EndTime: end,
        Location: loc,
        ImageUrl: link(img('evt-' + order, 400, 400)),
        RegistrationUrl: link('#'),
        DisplayOrder: order++,
        IsActive: true
      });
    }
  }

  async function seedTips() {
    const rows = [
      ['Book early to access better options and competitive rates', 'CompassNW'],
      ['Review the travel policy before submitting your request', 'DocumentApproval'],
      ['Check passport and visa validity - at least six months', 'ContactCard'],
      ['Download and use the SAP Concur mobile app', 'CellPhone'],
      ['Keep all receipts for a smooth expense report', 'Receipt'],
      ['Save Travel Care contact details before you depart', 'Ringer'],
      ['Always book through approved channels', 'CheckMark']
    ];
    let order = 1;
    for (const [title, icon] of rows) {
      await addItem('TH_TravelTips', {
        Title: title,
        Icon: icon,
        Category: 'General',
        LinkUrl: link('#'),
        DisplayOrder: order++,
        IsActive: true
      });
    }
  }

  async function seedQuickPulse() {
    const qId = await addItem('TH_QuickPulseQuestions', {
      Title: 'How would you rate your overall travel experience with RSG Travel Services?',
      IsActive: true,
      AllowComments: true,
      OneResponsePerUser: true
    });
    const options = [
      ['Very Difficult', 'EmojiDisappointed', 1],
      ['Difficult', 'Sad', 2],
      ['Neutral', 'EmojiNeutral', 3],
      ['Easy', 'Emoji', 4],
      ['Very Easy', 'Emoji2', 5]
    ];
    let order = 1;
    for (const [title, icon, value] of options) {
      await addItem('TH_QuickPulseOptions', {
        Title: title,
        QuestionIdId: qId, // lookup column "QuestionId" -> REST field "QuestionIdId"
        Icon: icon,
        OptionValue: value,
        DisplayOrder: order++,
        IsActive: true
      });
    }
  }

  async function seedTestimonials() {
    // [name, rating, comment, category, designation, department, location, avatar]
    const rows = [
      ['Khalid Alattas', 5, 'The request-to-booking flow was quick and the Travel Care team sorted a last-minute change within minutes.', 'Travel Care', 'Principal', 'Project Delivery', 'Jeddah', 11],
      ['Noura Alharbi', 5, 'Concur made expense submission painless and I especially value the proactive travel advisories.', 'SAP Concur', 'Analyst', 'Finance', 'Riyadh', 5],
      ['Faisal Bin Saeed', 4, 'The preferred-hotel programme saved my family money on a workation and the support was excellent.', 'Personal Travel', 'Operations Lead', 'Operations', 'Dammam', 12],
      ['Reem Al-Otaibi', 5, 'Business Travel handled a same-day itinerary change across two cities without a single hiccup.', 'Business Travel', 'Programme Manager', 'Corporate Affairs', 'Jeddah', 23],
      ['Yousef Al-Harbi', 4, 'Catering Services made our offsite workshop effortless — great food, on time, zero follow-up needed.', 'Catering Services', 'Coordinator', 'Meetings & Events', 'Riyadh', 34]
    ];
    let order = 1;
    for (const [name, rating, comment, category, desig, dept, loc, av] of rows) {
      await addItem('TH_TravelerTestimonials', {
        Title: name,
        ProfileImage: link(avatar(av)),
        Rating: rating,
        Comment: comment,
        Category: category,
        Designation: desig,
        Department: dept,
        Location: loc,
        DisplayOrder: order++,
        IsActive: true
      });
    }
  }

  async function seedSpend() {
    const rows = [
      ['Project Delivery', 'Q1 FY25', 'SAR', 1250000, 720000, 360000, 90000, 80000],
      ['Corporate Affairs', 'Q1 FY25', 'SAR', 480000, 300000, 120000, 35000, 25000],
      ['Finance', 'Q1 FY25', 'SAR', 210000, 130000, 55000, 15000, 10000]
    ];
    for (const [dept, period, ccy, total, air, hotel, ground, booking] of rows) {
      await addItem('TH_DepartmentTravelSpend', {
        Title: dept,
        Period: period,
        Currency: ccy,
        TotalSpend: total,
        AirSpend: air,
        HotelSpend: hotel,
        GroundTransportSpend: ground,
        BookingSpend: booking,
        DashboardUrl: link('https://app.powerbi.com'),
        IsActive: true
      });
    }
  }

  async function seedGreen() {
    await addItem('TH_GreenTravel', {
      Title: 'Small choices. Big impact.',
      Description:
        'Together we can reduce our travel carbon footprint and support a more sustainable future.',
      Points: [
        'Choose lower-carbon travel options where practical',
        'Combine trips and plan routes smartly',
        'Prefer sustainability-certified hotels and partners',
        'Reduce, reuse - and travel better'
      ].join('\n'),
      ImageUrl: link(img('green-travel', 1400, 1000)),
      LinkUrl: link('#'),
      LinkText: 'Explore the Green Travel poster',
      IsActive: true
    });
  }

  async function seedTeam() {
    const rows = [
      ['Omar Alfahmi', 'Director, Travel Services', 'Travel Services', 'Overall travel programme and supplier strategy', 'omar.alfahmi@example.com', '+966 12 000 0001', 'Jeddah', 21],
      ['Lina Altamimi', 'Business Travel Manager', 'Travel Services', 'Corporate bookings, policy and approvals', 'lina.altamimi@example.com', '+966 12 000 0002', 'Riyadh', 32],
      ['Mazen Aljhandi', 'Personal Travel & Engagement Manager', 'Travel Services', 'Employee offers, campaigns and engagement', 'mazen.aljhandi@example.com', '+966 12 000 0003', 'Jeddah', 15],
      ['Sara Bakhail', 'Travel Care Manager', 'Travel Services', '24/7 traveller assistance and emergency support', 'sara.bakhail@example.com', '+966 12 000 0004', 'Dammam', 24]
    ];
    let order = 1;
    for (const [name, desig, dept, spec, email, phone, loc, av] of rows) {
      await addItem('TH_TravelTeam', {
        Title: name,
        Designation: desig,
        Department: dept,
        Specialization: spec,
        ProfileImage: link(avatar(av)),
        Email: email,
        Phone: phone,
        Location: loc,
        DisplayOrder: order++,
        IsActive: true
      });
    }
  }

  // Admin-added EXTRA tabs only. The hub's built-in tabs - one per active
  // TH_TravelServices row (Business Travel, Personal Travel, SAP Concur,
  // Catering Services, Meetings & Events, ...), the Travel Policy landing
  // page, and Help Desk / Travel Care from hero.quickLink.* config - do not
  // need a row here; a "SAP Concur" row here would just duplicate the tab
  // TH_TravelServices already produces (GlobalNavigationService.ts).
  async function seedGlobalNav() {
    const items = [
      // ['Title', 'Url', 'App' | 'External']
      ['RSG Intranet', '#', 'App']
    ];
    let order = 1;
    for (const [title, url, kind] of items) {
      await addItem('TH_GlobalNavigation', {
        Title: title,
        Url: link(url),
        Kind: kind,
        DisplayOrder: order++,
        IsActive: true
      });
    }
  }

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

  // -------------------------------------------------------------------
  // The 6 "Explore Policy Information" sub-pages, laid out as in
  // RSG_Travel_Policy_Explore_Policy_Information_6_Subpages.pdf. Common
  // ending on every one: Ask Policy Assistant (SuggestedQuestions) -> Need
  // Help? (Contact Travel Services) -> Travel with Purpose (ClosingBanner).
  //
  // Each page is its own seeder (SUBPAGE_SEEDERS, keyed by Slug) so a single
  // page can be re-seeded on an existing site with CONFIG.RESEED_SLUGS.
  // Card colours below are IconColor values; with a section's TintCards =
  // Yes they also tint the card. Titles typed "1. …" get a number badge.
  // -------------------------------------------------------------------
  const C = { blue: '#2563eb', green: '#16a34a', amber: '#d97706', red: '#dc2626', purple: '#7c3aed', teal: '#0d9488', pink: '#e11d48' };

  const COMMON_SUBPAGE_FIELDS = {
    HeroStyle: 'Light',
    HeroEyebrow: 'Travel Policy',
    ParentSlug: 'travel-policy',
    ParentTitle: 'Travel Policy',
    ParentSectionLabel: 'Explore Policy Information',
    NeedHelpTitle: 'Need Help?',
    NeedHelpSupportLabel: 'Contact Travel Services',
    NeedHelpDescription: 'For policy related questions or support, contact the Travel Services team.',
    NeedHelpEmail: 'TravelServices@RedSeaGlobal.com',
    ClosingBannerTitle: 'Travel with Purpose',
    ClosingBannerDescription: 'Connecting people. Supporting communities. A more sustainable tomorrow.',
    ClosingBadges: ['Our People', 'Our Planet', 'Our Future'].join('\n')
  };

  async function addSubPage(order, fields) {
    return addItem('TH_PolicyPages', Object.assign({ DisplayOrder: order, IsActive: true }, COMMON_SUBPAGE_FIELDS, fields));
  }

  const SUBPAGE_SEEDERS = {
    // --- 1. Purpose & Scope ---------------------------------------------
    'purpose-scope': async () => {
      const pageId = await addSubPage(3, {
        Title: 'Purpose & Scope',
        Slug: 'purpose-scope',
        HeroIcon: 'Page',
        HeroTitle: 'Purpose & Scope',
        HeroSubtitle: 'Understand why the Business Travel and Business Assignment Policy exists and when each part of the policy applies.',
        HeroDescription: 'Know your journey. Understand the policy that applies to you.',
        HeroImageUrl: link(img('policy-purpose-hero', 1600, 500)),
        SuggestedQuestions: ['Which policy applies to me?', 'Can I combine business travel with vacation?', 'What expenses are covered?'].join('\n')
      });
      await addPolicySection(pageId, {
        layout: 'Paragraph', order: 1, title: 'Purpose', icon: 'BullseyeTarget', sectionStyle: 'Card', theme: 'Blue',
        body: [
          'The following policy guidelines specify conditions for travel arrangements and the reimbursement of expenses incurred while employees are traveling on company business.',
          'In order to be covered under the terms of this policy, expenses must be supported with valid documentation and approval, and must meet the requirement of being reasonable and necessary business travel-related expenses.'
        ]
      });
      const whichId = await addPolicySection(pageId, {
        layout: 'CardsGrid', cardVariant: 'Highlight', order: 2, title: 'Which Policy Applies to Your Travel?',
        subtitle: 'RSG has two policy frameworks depending on the nature and duration of your travel. Please identify the one that applies to you.',
        columns: 2, cardStyle: 'IconHeader', tintCards: true
      });
      await addPolicyCards('SectionIdId', whichId, [
        {
          kind: 'Highlight', title: 'Business Travel', icon: 'Airplane', iconColor: C.blue,
          subPoints: [
            "@Calendar|Less than 30 days|Business travel outside the employee's base working location for business meetings, conferences, events, training sessions, etc.",
            '!!Important:|Travel to project sites is not included under this Policy.'
          ]
        },
        {
          kind: 'Highlight', title: 'Business Assignment', icon: 'Suitcase', iconColor: C.green,
          subPoints: [
            '@Calendar|Exceeding 30 continuous calendar days|Any business assignment for business purposes for a period exceeding thirty (30) continuous calendar days.',
            '!!Up to 4 days of discontinuation of the business trip will not be counted as an interruption of the business trip.'
          ]
        }
      ]);
      await addPolicySection(pageId, {
        layout: 'Paragraph', order: 3, title: 'Business Travel + Annual Vacation', icon: 'Sunny', sectionStyle: 'Tinted', theme: 'Amber',
        body: "Business Travel shall not normally be combined with the employee's annual vacation. However, it can be allowed upon approval of the Group Chief Administrative Officer. In that case, the employee will be responsible for bearing the accommodation cost for the extended period and the cost of the return air ticket if the destination of the return flight differs from the business trip's destination."
      });
    },

    // --- 2. Guiding Principles -------------------------------------------
    'guiding-principles': async () => {
      const pageId = await addSubPage(4, {
        Title: 'Guiding Principles',
        Slug: 'guiding-principles',
        HeroIcon: 'CompassNW',
        HeroTitle: 'Guiding Principles',
        HeroSubtitle: 'The principles that guide responsible, consistent and effective business travel across RSG.',
        HeroDescription: 'Travel with purpose. Make responsible decisions. Represent RSG.',
        HeroImageUrl: link(img('policy-principles-hero', 1600, 500)),
        SuggestedQuestions: ['Do I need approval before travelling?', 'What does "no loss, no gain" mean?', 'When should I consider alternatives to travel?'].join('\n')
      });
      await addPolicySection(pageId, {
        layout: 'Paragraph', order: 1, title: 'Our Commitment', icon: 'BullseyeTarget', sectionStyle: 'Card', theme: 'Blue',
        body: 'Our guiding principles ensure that business travel at RSG is purposeful, responsible and aligned with our values. They help us make the right decisions, represent the company professionally and create value for our people, our business and our planet.'
      });
      // Title kept as "How We Approach Business Travel": that title also turns
      // on the icon-left header + coloured title underline (PolicyCardSections.tsx).
      const gridId = await addPolicySection(pageId, {
        layout: 'CardsGrid', cardVariant: 'Highlight', order: 2, title: 'How We Approach Business Travel',
        subtitle: 'These principles guide every business travel decision at RSG.',
        columns: 3, tintCards: true
      });
      await addPolicyCards('SectionIdId', gridId, [
        { kind: 'Highlight', title: 'Travel with a Business Purpose', icon: 'Suitcase', iconColor: C.blue, description: 'Business travel should be necessary to achieve company objectives, including face-to-face meetings, work requirements, training and projects.' },
        { kind: 'Highlight', title: 'Consider the Need to Travel', icon: 'Globe', iconColor: C.green, description: 'Balance the need for travel against cost, time and environmental impact. Where appropriate, consider alternatives such as phone, video or conferencing.' },
        { kind: 'Highlight', title: 'Obtain Approval Before Travel', icon: 'DocumentApproval', iconColor: C.amber, description: "All business trips require prior authorization from the employee's Manager before travel arrangements are made." },
        { kind: 'Highlight', title: 'Follow a Consistent Framework', icon: 'People', iconColor: C.pink, description: 'The policy provides the mandatory baseline standards for managing Business Travel and Business Assignments across the organization.' },
        { kind: 'Highlight', title: 'No Loss, No Gain', icon: 'Database', iconColor: C.purple, description: 'Business travel reimbursement follows the "no loss, no gain" principle - employees should neither personally gain nor incur a financial loss from approved business travel.' },
        { kind: 'Highlight', title: 'Travel Responsibly & Professionally', icon: 'Shield', iconColor: C.teal, description: 'Employees are expected to understand and follow the Travel Policy, minimize travel costs where reasonably possible, retain required invoices and documentation, and conduct themselves in accordance with RSG professional standards, values and Code of Conduct.' }
      ]);
      await addPolicySection(pageId, {
        layout: 'Paragraph', order: 3, title: 'Company-Determined Travel Arrangements', icon: 'Settings', sectionStyle: 'Tinted', theme: 'Amber',
        body: 'RSG reserves the right to determine appropriate transportation and accommodation arrangements based on the best interests of the company.'
      });
    },

    // --- 3. Travel Planning & Approvals -----------------------------------
    'travel-planning-approvals': async () => {
      const pageId = await addSubPage(5, {
        Title: 'Travel Planning & Approvals',
        Slug: 'travel-planning-approvals',
        HeroIcon: 'Calendar',
        HeroTitle: 'Travel Planning & Approvals',
        HeroSubtitle: 'Plan your business travel early and secure the required approvals before making travel arrangements.',
        HeroDescription: 'Plan ahead. Obtain approval. Travel with confidence.',
        HeroImageUrl: link(img('policy-planning-hero', 1600, 500)),
        SuggestedQuestions: ['How early should I submit my travel request?', 'Who approves my business trip?', 'What if I need an urgent travel change?'].join('\n')
      });
      await addPolicySection(pageId, {
        layout: 'Paragraph', order: 1, title: 'Our Commitment', icon: 'BullseyeTarget', sectionStyle: 'Card', theme: 'Blue',
        body: 'We aim to make travel planning simple, consistent and efficient, while ensuring the right approvals are in place, costs are optimized and employees are supported throughout their journey.'
      });
      // Two cards side by side - each holds its own intro, table and note in
      // SubPoints (see docs/POLICY-CONTENT-GUIDE.md §3c), instead of separate
      // TH_PolicyTables rows.
      const plansId = await addPolicySection(pageId, { layout: 'CardsGrid', cardVariant: 'Highlight', order: 2, columns: 2, cardStyle: 'IconHeader', tintCards: true });
      await addPolicyCards('SectionIdId', plansId, [
        {
          kind: 'Highlight', title: '1. Plan Before You Travel', iconColor: C.blue,
          description: "All business trips require prior authorization from the employee's Manager.",
          subPoints: [
            '~~To ensure adequate time for travel arrangements, employees shall submit travel requests as follows:',
            '##Travel Type|Submit Request',
            'MapPin::GCC Countries|At least 5 business days before travel',
            'Globe::Rest of the World|At least 10 business days before travel',
            'Group::International Conferences & Events|At least 30 days before travel',
            "!!Plan Early for Better Value:|Employees should request travel arrangements with RSG's travel agency as far in advance as possible in order to obtain the lowest possible cost/fare."
          ]
        },
        {
          kind: 'Highlight', title: '2. Urgent Changes to Travel Plans', iconColor: C.green,
          description: 'If you need to make urgent changes to an approved or planned trip, submit your request as early as possible:',
          subPoints: [
            '##Travel Type|Urgent Change Request',
            'MapPin::GCC Countries|At least 3 business days before travel',
            'Globe::Rest of the World|At least 5 business days before travel',
            'Group::International Conferences & Events|At least 15 days before travel',
            '!!Exception:|Travel-plan exceptions require approval from the Group Chief Administrative Officer (GCAO).'
          ]
        }
      ]);
      const beforeId = await addPolicySection(pageId, {
        layout: 'CardsGrid', cardVariant: 'Highlight', order: 3, title: '3. Before Making Travel Arrangements',
        subtitle: 'Ensure the following steps are completed before proceeding with your travel:',
        columns: 3, cardStyle: 'IconMedia', sectionStyle: 'Tinted', theme: 'Purple'
      });
      await addPolicyCards('SectionIdId', beforeId, [
        { kind: 'Highlight', title: 'Get Manager Approval', icon: 'AddFriend', iconColor: C.pink, description: 'Obtain prior authorization from your Manager before proceeding with business travel.' },
        { kind: 'Highlight', title: 'Check Visa Requirements', icon: 'Certificate', iconColor: C.purple, description: 'Employees are responsible for verifying applicable entry visa requirements. RSG will cover required visa documentation costs in accordance with the policy.' },
        { kind: 'Highlight', title: 'Use the Approved Travel Channel', icon: 'Airplane', iconColor: C.blue, description: 'Once approved, proceed with travel arrangements through the approved RSG travel process/channel.' }
      ]);
      await addPolicySection(pageId, {
        layout: 'Paragraph', order: 4, title: '4. Business Travel + Annual Vacation', icon: 'Sunny', sectionStyle: 'Tinted', theme: 'Amber',
        body: "Business travel shall not normally be combined with an employee's annual vacation. However, it may be permitted with approval from the Group Chief Administrative Officer (GCAO), subject to the applicable policy conditions."
      });
    },

    // --- 4. Travel Entitlement ---------------------------------------------
    'travel-entitlement': async () => {
      const pageId = await addSubPage(6, {
        Title: 'Travel Entitlement',
        Slug: 'travel-entitlement',
        HeroIcon: 'Suitcase',
        HeroTitle: 'Travel Entitlement',
        HeroSubtitle: 'Understand your travel entitlements based on job grade, travel duration and destination.',
        HeroDescription: 'Know your entitlement. Plan your journey with confidence.',
        HeroImageUrl: link(img('policy-entitlement-hero', 1600, 500)),
        SuggestedQuestions: [
          'What is my travel class entitlement?', 'What is my hotel accommodation cap?',
          'What are my daily and transportation allowances?', 'What is my assignment entitlement?'
        ].join('\n')
      });
      // Selector + info bar: the Tabs section itself; its own cards are the
      // "Not sure which category applies? | Need help deciding?" bar.
      const tabsId = await addPolicySection(pageId, {
        layout: 'Tabs', order: 1, title: 'Select Your Travel Type',
        subtitle: 'Choose the type of travel to view the applicable entitlements.', sectionStyle: 'Card'
      });
      const btTab = await addPolicyTab(tabsId, 'Business Travel', 1, {
        icon: 'Airplane', subtitle: 'Less than 30 days', description: 'Short-term travel for meetings, projects, training, events or business needs.'
      });
      const baTab = await addPolicyTab(tabsId, 'Business Assignment', 2, {
        icon: 'Suitcase', subtitle: 'More than 30 continuous days', description: 'Long-term assignments at a different location for work purposes.'
      });
      await addPolicyCards('SectionIdId', tabsId, [
        { kind: 'Info', title: 'Not sure which category applies?', icon: 'Info', iconColor: C.blue, description: 'If your travel is expected to be 30 days or more, it will be considered a Business Assignment. For less than 30 days, it is Business Travel.' },
        { kind: 'LinkItem', title: 'Need help deciding?', linkText: 'Contact Travel Services', linkUrl: 'mailto:TravelServices@RedSeaGlobal.com' }
      ]);

      // --- Tab 1: Business Travel (sections nested via TabId) ---
      const tab = (tabId) => ({ tabId });
      await addPolicySection(pageId, Object.assign(tab(btTab), {
        layout: 'Banner', order: 1, title: 'Business Travel Entitlements', subtitle: 'Less than 30 days', icon: 'Airplane', theme: 'Blue',
        body: ['Travel for today.', 'Opportunities for tomorrow.']
      }));
      const btGrid = await addPolicySection(pageId, Object.assign(tab(btTab), {
        layout: 'CardsGrid', cardVariant: 'Highlight', order: 2, columns: 4, cardStyle: 'IconHeader', tintCards: true
      }));
      const airTravel = (who) => [
        '==Standard Travel Class',
        '##Job Grade|< 6 flying hours (Zone 1)|> 6 flying hours (Zone 2)',
        'Grades 12 – 14|Business Class|Business Class',
        'Grades 1 – 11|Economy Class|Business Class',
        '~~If the eligible travel class is unavailable, an upgrade is subject to approval from the Group Head of People Strategy and Culture.',
        '==Airport-Specific Entitlement – RSI & EJH (Al Wajh)',
        '##Job Grade|Travel Class',
        'Grade 14|Business Class',
        'Grades 1 – 13|Economy Class',
        `~~For ${who} departing from or arriving at Red Sea International Airport (RSI) or EJH (Al Wajh), the airport-specific entitlement applies.`,
        '@Suitcase|Excess Baggage|Covered only when required for a business purpose and with prior Division Head approval.'
      ];
      await addPolicyCards('SectionIdId', btGrid, [
        { kind: 'Highlight', title: 'Air Travel Entitlement', icon: 'Airplane', iconColor: C.blue, subPoints: airTravel('business travel') },
        {
          kind: 'Highlight', title: 'Accommodation Entitlement', icon: 'Hotel', iconColor: C.green,
          description: 'Minimum standard: 4-star accommodation. Hotel lounge access is not covered.',
          subPoints: [
            '##Location|Grade 13|Grades 12 & Below',
            'Within KSA|SAR 1,800|SAR 1,000',
            'Outside KSA|SAR 2,250|SAR 1,500',
            '@CityNext|Corporate rates should be utilized through approved company travel providers.',
            '@EatDrink|Room and breakfast are excluded from the Daily Allowance.',
            '@Page|For accommodation above the applicable cap, raise an exception through SAP Concur, subject to the applicable approval authority.'
          ]
        },
        {
          kind: 'Highlight', title: 'Daily Transportation Allowance', icon: 'Car', iconColor: C.purple,
          subPoints: [
            '##Travel Location|Grades 13 – 14|Grades 1 – 12',
            'Outside KSA|SAR 750|SAR 500',
            'Within KSA|SAR 600|SAR 300',
            '@Car|Airport Transfer – Important Note|Job Grade 13 and below: airport transfer is reimbursable up to SAR 100 per trip for standard/economy car services through ride-sharing applications or taxis.',
            '~~Where possible, employees should share airport transfers.'
          ]
        },
        {
          kind: 'Highlight', title: 'Daily Allowance', icon: 'EatDrink', iconColor: C.amber,
          subPoints: [
            '##Travel Location|Grades 13 – 14|Grades 1 – 12',
            'Outside KSA|SAR 600|SAR 500',
            'Within KSA|SAR 500|SAR 400',
            '@Page|Daily Allowance|The Daily Allowance represents reimbursement of actual eligible expenses supported by receipts, within the applicable maximum limits. Hotel accommodation and breakfast are excluded.'
          ]
        }
      ]);
      await addPolicySection(pageId, Object.assign(tab(btTab), {
        layout: 'Paragraph', order: 3, title: 'Additional Entitlement – Extra Travel Day', icon: 'Calendar', sectionStyle: 'Card', theme: 'Blue',
        body: [
          'For international travel excluding GCC and domestic travel, one additional day may be added to the total travel duration.',
          'The employee may request the additional day before or after the business trip.'
        ]
      }));

      // --- Tab 2: Business Assignment ---
      await addPolicySection(pageId, Object.assign(tab(baTab), {
        layout: 'Banner', order: 1, title: 'Business Assignment Entitlements', subtitle: 'More than 30 continuous days', icon: 'Suitcase', theme: 'Green',
        body: ['Different locations,', 'Greater opportunities.']
      }));
      const baGrid = await addPolicySection(pageId, Object.assign(tab(baTab), {
        layout: 'CardsGrid', cardVariant: 'Highlight', order: 2, columns: 4, cardStyle: 'IconHeader', tintCards: true
      }));
      await addPolicyCards('SectionIdId', baGrid, [
        { kind: 'Highlight', title: 'Air Travel Entitlement', icon: 'Airplane', iconColor: C.blue, subPoints: airTravel('business assignments') },
        {
          kind: 'Highlight', title: 'Accommodation Entitlement', icon: 'Hotel', iconColor: C.green,
          subPoints: [
            '==Monthly Accommodation Limits',
            '##Location|Maximum (SAR)',
            'Within KSA|600',
            'Outside KSA|850',
            '@CityNext|Minimum standard: 4-star accommodation. Hotel lounge access is not covered.',
            '@Page|For accommodation exceeding the applicable cap: up to 25% – GCAO approval; above 25% – GCEO approval.',
            '@EatDrink|Room and breakfast are excluded from the Daily Cash Allowance.',
            '~~Corporate rates should be utilized through approved company travel providers.'
          ]
        },
        {
          kind: 'Highlight', title: 'Daily Cash Allowance', icon: 'Money', iconColor: C.purple,
          subPoints: [
            '##Job Grade|Daily Cash Allowance (SAR)',
            'Grades 12 – 14|400',
            'Grades 1 – 11|285',
            '@Database|No receipts are required.|The Daily Cash Allowance covers meals, local transportation and incidental expenses during the assignment.'
          ]
        },
        {
          kind: 'Highlight', title: 'Airport Transfer', icon: 'Car', iconColor: C.amber,
          description: 'Approved business assignment travelers are eligible for airport transfers.',
          subPoints: [
            '@Car|Job Grade 13 and below|Reimbursable up to SAR 100 per trip for standard/economy car services through ride-sharing applications or taxis.',
            '@People|Where possible, employees should share airport transfers.'
          ]
        }
      ]);
      const baInfo = await addPolicySection(pageId, Object.assign(tab(baTab), {
        layout: 'Split', order: 3, title: 'Important Assignment Information', icon: 'Info', sectionStyle: 'Tinted', theme: 'Green'
      }));
      await addPolicyCards('SectionIdId', baInfo, [
        { kind: 'Info', title: 'Assignment Duration', icon: 'Calendar', description: 'Applies when travel exceeds 30 continuous days.' },
        { kind: 'Info', title: 'Short Interruptions', icon: 'Page', description: 'Up to 4 days of discontinuation does not interrupt the assignment.' },
        { kind: 'Info', title: 'Cash Advance', icon: 'Money', description: "A cash advance of up to one month's allowance may be provided, subject to applicable requirements." },
        { kind: 'Info', title: 'Assignment Extensions', icon: 'Sync', description: 'Extensions require reapproval from the applicable authority.' }
      ]);
    },

    // --- 5. Expenses (Allowable & Non-Allowable) --------------------------
    expenses: async () => {
      const pageId = await addSubPage(7, {
        Title: 'Expenses (Allowable & Non-Allowable)',
        Slug: 'expenses',
        HeroIcon: 'ReceiptCheck',
        HeroTitle: 'Expenses (Allowable & Non-Allowable)',
        HeroSubtitle: 'Understand which business travel expenses are eligible for reimbursement and what documentation is required.',
        HeroDescription: 'Spend responsibly. Keep your receipts. Claim with confidence.',
        HeroImageUrl: link(img('policy-expenses-hero', 1600, 500)),
        SuggestedQuestions: ['Is this expense reimbursable?', 'What documents do I need for a business meal?', 'When must I submit my expense claim?'].join('\n')
      });
      const principles = await addPolicySection(pageId, {
        layout: 'Split', order: 1, title: '1. Expense Reimbursement Principles', sectionStyle: 'Tinted', theme: 'Blue'
      });
      await addPolicyCards('SectionIdId', principles, [
        { kind: 'Info', icon: 'BullseyeTarget', description: 'Business travel expenses must be reasonable, necessary and related to company business. Eligible expenses must be supported by the required documentation and approvals.' },
        { kind: 'Info', icon: 'Page', description: 'Employees are responsible for retaining invoices and supporting documents and submitting their expense claim through SAP Concur within 30 business days after completion of the trip.' }
      ]);
      const allowable = await addPolicySection(pageId, {
        layout: 'CardsGrid', cardVariant: 'Highlight', order: 2, title: '2. Allowable Expenses',
        subtitle: 'The following expenses are generally eligible for reimbursement, provided they are reasonable, necessary and supported by valid documentation.',
        columns: 4, cardStyle: 'IconHeader', tintCards: true, sectionStyle: 'Tinted', theme: 'Green'
      });
      await addPolicyCards('SectionIdId', allowable, [
        { kind: 'Highlight', title: 'Meals & Business Meals', icon: 'EatDrink', iconColor: C.blue, subPoints: ['Eligible meals within the applicable Daily Allowance limit.', 'For business meals, provide the invoice and attendee details, including company and title.'] },
        { kind: 'Highlight', title: 'Travel & Transportation', icon: 'Car', iconColor: C.green, subPoints: ['Taxi and eligible local transportation.', 'Car rental.', 'Parking and tolls.', 'Airport transfers in accordance with the applicable entitlement.'] },
        { kind: 'Highlight', title: 'Business & Connectivity', icon: 'System', iconColor: C.purple, subPoints: ['Registration and seminar fees.', 'Data roaming for the duration of the business trip.', 'Necessary business-office expenses such as photocopying, internet and package delivery.'] },
        { kind: 'Highlight', title: 'Other Eligible Expenses', icon: 'ShoppingCart', iconColor: C.amber, subPoints: ['Reasonable laundry/dry-cleaning for trips of 3 or more consecutive days.', 'Mineral water from the minibar.', 'Mandatory tipping, up to 10% of restaurant service.', 'Currency-conversion fees.', 'Other necessary expenses incurred for an official business purpose, with appropriate explanation/documentation.'] }
      ]);
      const nonAllowable = await addPolicySection(pageId, {
        layout: 'CardsGrid', cardVariant: 'Highlight', order: 3, title: '3. Non-Allowable Expenses',
        subtitle: 'The following expenses are not eligible for reimbursement.',
        columns: 4, cardStyle: 'IconHeader', tintCards: true, sectionStyle: 'Tinted', theme: 'Red'
      });
      await addPolicyCards('SectionIdId', nonAllowable, [
        { kind: 'Highlight', title: 'Personal & Lifestyle', icon: 'Cancel', iconColor: C.red, subPoints: ['Barber/hairdresser', 'Clothing', 'Health club/spa/lounge', 'Gum/candy', 'Cigarettes', 'Alcohol', 'Personal/vacation-day expenses'] },
        { kind: 'Highlight', title: 'Memberships & Personal Financial Costs', icon: 'People', iconColor: C.pink, subPoints: ['Airline club memberships', 'Airline upgrades', 'Annual personal credit-card fees'] },
        { kind: 'Highlight', title: 'Vehicle & Other Personal Costs', icon: 'Car', iconColor: C.red, subPoints: ['Car washes', 'Locksmith expenses', 'Cellular phone rental', 'Monthly cellular data-roaming charges'] },
        { kind: 'Highlight', title: 'Other', icon: 'More', iconColor: C.pink, subPoints: ['Charitable contributions', 'Excess baggage without sufficient business justification'] }
      ]);
      const claim = await addPolicySection(pageId, {
        layout: 'ProcessSteps', order: 4, title: '4. Before You Submit Your Claim',
        subtitle: 'Follow these steps to ensure a smooth and timely reimbursement process.', sectionStyle: 'Tinted', theme: 'Blue'
      });
      // Number AND Icon set -> icon in the badge, "1. Check Eligibility" title.
      await addPolicyCards('SectionIdId', claim, [
        { kind: 'HelpStep', number: 1, icon: 'Search', title: 'Check Eligibility', description: 'Ensure the expense is allowable under the policy.' },
        { kind: 'HelpStep', number: 2, icon: 'Page', title: 'Keep Documentation', description: 'Retain all required invoices and supporting documents.' },
        { kind: 'HelpStep', number: 3, icon: 'System', title: 'Submit in SAP Concur', description: 'Submit your expense claim with complete information.' },
        { kind: 'HelpStep', number: 4, icon: 'Contact', title: 'Manager Review', description: 'Approvers typically review and approve claims within 3 business days, while validating eligibility, receipts and reasonableness.' }
      ]);
      await addPolicySection(pageId, {
        layout: 'Callout', order: 5, icon: 'Calendar',
        body: 'Submit your expense claim within 30 business days after the end of your business trip.'
      });
      const reminder = await addPolicySection(pageId, {
        layout: 'Split', order: 6, title: 'Important Reminder', icon: 'Warning', sectionStyle: 'Tinted', theme: 'Amber'
      });
      await addPolicyCards('SectionIdId', reminder, [
        { kind: 'Info', title: 'Not sure whether an expense is allowable?', description: 'Check the policy before incurring the expense or use the Policy Assistant for guidance.' },
        { kind: 'Info', icon: 'Page', description: 'When in doubt, ask before you spend.' }
      ]);
    },

    // --- 6. Compliance & Responsibilities ----------------------------------
    'compliance-responsibilities': async () => {
      const pageId = await addSubPage(8, {
        Title: 'Compliance & Responsibilities',
        Slug: 'compliance-responsibilities',
        HeroIcon: 'Shield',
        HeroTitle: 'Compliance & Responsibilities',
        HeroSubtitle: 'Understand your responsibilities as a traveler or approver and help ensure every business trip complies with RSG policy.',
        HeroDescription: 'Know your responsibility. Follow the policy. Travel with accountability.',
        HeroImageUrl: link(img('policy-compliance-hero', 1600, 500)),
        SuggestedQuestions: ['What are my responsibilities as a traveler?', 'What should an approver check?', 'What happens if the Travel Policy is not followed?'].join('\n')
      });
      const shared = await addPolicySection(pageId, { layout: 'Split', order: 1, title: '1. Shared Responsibility', sectionStyle: 'Tinted', theme: 'Blue' });
      await addPolicyCards('SectionIdId', shared, [
        { kind: 'Info', icon: 'People', title: 'Travel policy compliance is a shared responsibility.', description: 'Employees and approvers are responsible for understanding the applicable policy requirements, ensuring appropriate approvals are obtained, and maintaining accurate supporting documentation.' },
        { kind: 'Info', icon: 'Globe', description: 'Compliant travel protects our people, our business and our reputation.' }
      ]);
      const roles = await addPolicySection(pageId, { layout: 'CardsGrid', cardVariant: 'Highlight', order: 2, columns: 2, cardStyle: 'IconHeader', tintCards: true });
      await addPolicyCards('SectionIdId', roles, [
        {
          kind: 'Highlight', title: '2. Employee Responsibilities', iconColor: C.green, description: 'As a traveler, you are responsible for:',
          subPoints: [
            '%%Traveler',
            '@CheckList|Confirm the need to travel and ensure the trip is necessary for business purposes.',
            '@DocumentApproval|Obtain approval before booking or making travel arrangements.',
            '@Page|Follow the Travel Policy and applicable travel entitlements.',
            '@Database|Manage costs responsibly and exercise reasonable judgment when incurring business travel expenses.',
            '@ReceiptCheck|Retain invoices, receipts and supporting documentation required for reimbursement and audit.',
            '@System|Submit expense claims through SAP Concur within 30 business days after completion of the trip, with appropriate explanations and supporting documents.'
          ]
        },
        {
          kind: 'Highlight', title: '3. Approver Responsibilities', iconColor: C.purple, description: 'As a manager/approver, you are responsible for:',
          subPoints: [
            '%%Manager / Approver',
            '@Search|Confirm the business necessity of the travel.',
            '@Page|Understand the applicable Travel Policy requirements and employee entitlement.',
            '@Shield|Ensure expenses are legitimate, reasonable and supported by appropriate documentation.',
            "@People|Review requests and claims with sufficient knowledge of the employee's business travel.",
            '@CheckMark|Validate policy compliance, eligibility and reasonableness before approval.',
            '@Clock|Review and approve expense claims normally within 3 business days.'
          ]
        }
      ]);
      const before = await addPolicySection(pageId, {
        layout: 'ProcessSteps', order: 3, title: '4. Compliance Starts Before Travel',
        subtitle: 'Follow these key steps to ensure a compliant and cost-effective trip.', sectionStyle: 'Tinted', theme: 'Blue'
      });
      await addPolicyCards('SectionIdId', before, [
        { kind: 'HelpStep', icon: 'Calendar', title: 'Plan Early', description: "Employees should request travel arrangements with RSG's travel agency as far in advance as possible in order to obtain the lowest possible cost/fare." },
        { kind: 'HelpStep', icon: 'Page', title: 'Obtain Approval', description: "All business trips require prior authorization from the employee's Manager." },
        { kind: 'HelpStep', icon: 'Airplane', title: 'Use Approved Travel Channels', description: 'Travel arrangements should be processed through the approved RSG travel process and channels.' }
      ]);
      const audit = await addPolicySection(pageId, { layout: 'Split', order: 4, title: '5. Audit & Accountability', sectionStyle: 'Tinted', theme: 'Amber' });
      await addPolicyCards('SectionIdId', audit, [
        {
          kind: 'Info', icon: 'DocumentSearch', title: 'Policy Compliance & Audit',
          description: 'RSG reserves the right to audit business travel requests, bookings, supporting documents and expense claims to ensure compliance with the applicable policy. Employees and approvers are responsible for policy compliance. Non-compliance may result in accountability and appropriate disciplinary action in accordance with RSG requirements.'
        },
        { kind: 'Info', icon: 'Shield', description: 'Do the right thing. Keep RSG moving forward.' }
      ]);
      await addPolicySection(pageId, {
        layout: 'Checklist', order: 5, title: '6. Before You Travel – Quick Compliance Check',
        subtitle: 'Run through this checklist before you make your travel arrangements.', sectionStyle: 'Tinted', theme: 'Green',
        body: ['Business need confirmed', 'Manager approval obtained', 'Policy entitlement checked', 'Travel requested through approved channel', 'Required documentation understood']
      });
    }
  };

  async function seedExploreSubPages() {
    for (const slug of Object.keys(SUBPAGE_SEEDERS)) {
      await SUBPAGE_SEEDERS[slug]();
    }
  }

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
  const CONCUR_URL = 'https://www.concursolutions.com';
  const NAVY = '#1e3a8a';

  async function addPage(order, fields) {
    return addItem('TH_PolicyPages', Object.assign({ DisplayOrder: order, IsActive: true, HeroStyle: 'Light' }, fields));
  }

  const TRAVEL_HUB_CLOSING = {
    ClosingBannerTitle: 'Travel Hub',
    ClosingBannerDescription: 'Together for a more connected world.',
    ClosingBadges: ['People First', 'Responsible Travel', 'Extraordinary Destinations', 'Lasting Impact'].join('\n')
  };
  const RELOCATION_CLOSING = {
    ClosingBannerTitle: 'People move the world forward.',
    ClosingBannerDescription: 'We make the journey smoother. A more connected and sustainable tomorrow.',
    ClosingBadges: ['Our People', 'Our Planet', 'Our Future'].join('\n')
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
        ClosingBadges: ['Our People', 'Our Planet', 'Our Future'].join('\n')
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
        { kind: 'Highlight', title: 'Family Relocation', icon: 'People', iconColor: '#be123c', imageUrl: img('bt-card-4', 600, 380), description: 'Explore relocation benefits available for eligible new joiners and accompanying dependents.', subPoints: ['@Mail|Offline: onboarding@RedSeaGlobal.com'], linkText: 'View', targetSlug: 'family-relocation' },
        { kind: 'Highlight', title: 'Consultants | Guests Travel', icon: 'People', iconColor: '#7c3aed', imageUrl: img('bt-card-5', 600, 380), description: 'Travel for consultants and external guests.', subPoints: ['@Mail|Offline: rsgtravel@travelats.com'] }
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
        layout: 'ProcessSteps', order: 4, title: 'Offline Travel Process', cardStyle: 'Stacked', width: 'Half', sectionStyle: 'Tinted', theme: 'Green',
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
        { kind: 'Info', title: 'Red Sea & AMAALA Site Services', icon: 'Car', iconColor: '#7c3aed', imageUrl: img('bt-site', 500, 300), description: 'Transportation, fleet management and access permits.', linkUrl: 'https://www.redseaglobal.com', openInNewTab: true }
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
        layout: 'Split', order: 11, title: 'Need Help?', icon: 'Headset', subtitle: "We're here to support your travel needs.", sectionStyle: 'Tinted', theme: 'Blue'
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
        layout: 'Feature', order: 2, title: 'Job Mobility', icon: 'People', width: 'Half', theme: 'Blue',
        body: 'In the event of a relocation between Riyadh Headquarters and Project Site, your HRBP will be your primary point of contact and will guide you through your relocation journey.'
      });
      await addPolicySection(pageId, {
        layout: 'Feature', order: 3, title: 'Site Allowance', icon: 'Money', width: 'Half', theme: 'Green',
        body: 'To support with the cost of flying to your loved ones, all site-based colleagues whose point of origin is not Umluj, Dhiba or Al Wajh cities, will receive the Site Allowance, a cash allowance paid monthly.'
      });
      await addPolicySection(pageId, {
        layout: 'Feature', order: 4, title: 'Flight Tickets', icon: 'Airplane', width: 'Half', theme: 'Blue',
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
        layout: 'Feature', order: 6, title: 'Shipping Assistance', icon: 'Package', theme: 'Purple', imageUrl: img('reloc-boxes', 600, 400),
        body: [
          'The Company will provide Shipping Assistance to cover the cost of freight of your personal items from Headquarters to Project Site or vice versa up to SAR 25,000 based on submission of actual paid receipts that includes your name, date, location, and total paid amount, along with a copy of the bank transaction as a proof of payment. Cash payments will not be accepted.',
          'You will arrange for your shipment directly with your preferred shipping partner and submit your receipts through SAP SuccessFactors for reimbursement.'
        ]
      });
      await addPolicyCards('SectionIdId', shipping, [{ kind: 'Info', title: '[Shipping cap]', icon: 'Package', iconColor: C.blue, valueLabel: 'Up to', value: 'SAR 25,000', valueNote: 'Shipping Assistance' }]);
      const transport = await addPolicySection(pageId, {
        layout: 'Feature', order: 7, title: 'Transportation', icon: 'Car', theme: 'Green', imageUrl: img('reloc-van', 600, 400),
        body: [
          'The Facilities Management team will arrange the airport pick-up to the assigned accommodation drop-off. Note that Airport pick up and drop off from and to Yanbu or Al Wajh should be requested through Base Camp Helpdesk accessible via ITHelpDesk, a minimum of 48 hours prior to the arrival or departure date. Alternatively, you may also place your request at BCS@RedSeaGlobal.com.',
          '!!Note that personal cars are welcomed on-site.'
        ]
      });
      await addPolicyCards('SectionIdId', transport, [{ kind: 'Info', title: '[Pick-up notice]', icon: 'Airplane', iconColor: C.green, value: '48 hours', valueNote: 'Prior request for Yanbu / Al Wajh pick up & drop off' }]);
      const assets = await addPolicySection(pageId, {
        layout: 'Feature', order: 8, title: 'Work Assets Transportation', icon: 'System', theme: 'Purple', imageUrl: img('reloc-assets', 600, 400),
        body: "Relocating employees' work assets such as monitor and docking station will be shipped to site by our Administration team. They will provide you with boxes to pack the required items which will take two to three days to reach the site."
      });
      await addPolicyCards('SectionIdId', assets, [{ kind: 'Info', title: '[Delivery time]', icon: 'Package', iconColor: '#7c3aed', value: '2–3 days', valueNote: 'Delivery time to site' }]);
      await addPolicySection(pageId, {
        layout: 'Feature', order: 9, title: 'Effective Date', icon: 'Calendar', theme: 'Blue',
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
        layout: 'Feature', order: 2, title: 'Types of Relocation', icon: 'Sync', theme: 'Purple', imageUrl: img('reloc-map', 600, 360),
        body: 'We have two types of relocations:'
      });
      await addPolicyCards('SectionIdId', types, [
        { kind: 'Info', title: 'Domestic', icon: 'Home', iconColor: C.blue, description: 'Relocation of a new hire moving within KSA.' },
        { kind: 'Info', title: 'International', icon: 'Globe', iconColor: C.blue, description: 'Relocation of a new hire moving from outside KSA.' }
      ]);
      await addPolicySection(pageId, {
        layout: 'Feature', order: 3, title: 'Flight Tickets', icon: 'Airplane', theme: 'Green', imageUrl: img('reloc-plane', 600, 400),
        body: [
          'We provide flight tickets for new joiners and accompanying dependents eligible for domestic and international relocation, from the nearest airport from the point of origin (home country or current place of work) to their relocation destination in the Kingdom as follows:',
          '##Grade|Class of Travel',
          'C-Level to Director|Business Class',
          'Associate Director and below|Economy Class'
        ]
      });
      await addPolicySection(pageId, {
        layout: 'Feature', order: 4, title: 'Shipping Assistance', icon: 'Package', theme: 'Purple', imageUrl: img('reloc-belongings', 600, 500),
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
        layout: 'Feature', order: 5, title: 'Temporary Accommodation', icon: 'Hotel', theme: 'Teal', imageUrl: img('reloc-room', 600, 360),
        body: [
          '- We will provide temporary accommodation assistance to new joiners and their accompanying eligible dependents from their first employment day, for a maximum of 30 nights.',
          '- Employees and accompanying dependents relocating from Project Site to Riyadh will be provided with accommodation up to two weeks.'
        ]
      });
      await addPolicySection(pageId, {
        layout: 'Feature', order: 6, title: 'Important Notes', icon: 'Warning', theme: 'Purple',
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
      const featured = await addPolicySection(pageId, {
        layout: 'ImageCards', order: 1, title: 'Featured Personal Travel Offers', cardStyle: 'ImageTop', columns: 5,
        subtitle: 'Handpicked deals and seasonal offers from our trusted travel partners.',
        linkText: 'View All Offers', linkUrl: 'https://www.redseaglobal.com'
      });
      await addPolicyCards('SectionIdId', featured, [
        ['Maldives', '5 Nights Holiday Package', 'Special Offer', 'SAR 5,999', 'per person'],
        ['Istanbul', '4 Nights City Break', 'Exclusive Rate', 'SAR 3,499', 'per person'],
        ['Dubai', '4 Nights Family Package', 'Family Offer', 'SAR 4,999', 'per family'],
        ['London', 'Airfare + Hotel Package', 'Special Fare', 'SAR 3,999', 'per person'],
        ['Baku', '4 Nights City Break', 'New Destination', 'SAR 2,999', 'per person']
      ].map(([title, subtitle, badge, value, note], i) => ({
        kind: 'Info', title, subtitle, badge, iconColor: '#dc2626', imageUrl: img('offer-' + i, 600, 400),
        valueLabel: 'Starting From', value, valueNote: note, linkText: 'View Details', linkUrl: 'https://www.redseaglobal.com', openInNewTab: true
      })));
      const explore = await addPolicySection(pageId, {
        layout: 'ImageCards', order: 2, title: 'Explore Our Personal Travel Offers', cardStyle: 'ImageTile', columns: 5,
        body: '@GiftCard|Exclusive offers from our trusted partners just for you and your family.'
      });
      await addPolicyCards('SectionIdId', explore, [
        ['Flights', 'Airplane', C.blue], ['Hotels', 'Hotel', '#7c3aed'], ['Car Rental', 'Car', C.green], ['Holiday Packages', 'Sunny', '#ea580c'],
        ['Wellness Beyond Office', 'Health', C.green], ['F&B Offers', 'EatDrink', '#dc2626'], ['Outlet Malls', 'Shop', '#db2777'],
        ['Visa Guidance', 'Certificate', C.blue], ['International Driving License', 'Car', '#b45309'], ['City Guide (Riyadh & Jeddah)', 'MapPin', '#7c3aed']
      ].map(([title, icon, color], i) => ({
        kind: 'Info', title, icon, iconColor: color, imageUrl: img('pto-tile-' + i, 500, 300), linkUrl: 'https://www.redseaglobal.com', openInNewTab: true
      })));
      const staff = await addPolicySection(pageId, {
        layout: 'ImageCards', order: 3, title: 'RSG Staff Offers – Visit Our Destinations', cardStyle: 'ImageBanner', columns: 2,
        subtitle: "Exclusive offers for Red Sea'ers at our destinations."
      });
      await addPolicyCards('SectionIdId', staff, [
        { kind: 'Info', title: 'Visit Red Sea', imageUrl: img('pto-redsea', 900, 400), linkUrl: 'https://www.visitredsea.com', openInNewTab: true },
        { kind: 'Info', title: 'AMAALA', imageUrl: img('pto-amaala', 900, 400), linkUrl: 'https://www.visitredsea.com', openInNewTab: true }
      ]);
      const care = await addPolicySection(pageId, {
        layout: 'Split', order: 4, title: 'Personal Travel Care', icon: 'Headset', sectionStyle: 'Tinted', theme: 'Blue'
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
      const riyadh = await addPolicySection(pageId, {
        layout: 'ImageCards', order: 3, title: 'Riyadh Partnered Hotels', cardStyle: 'ImageTop', columns: 6, sectionStyle: 'Card',
        subtitle: 'Host your meetings, workshops, trainings and events at our partnered hotels in Riyadh.', body: hotelNote
      });
      await addPolicyCards('SectionIdId', riyadh, [
        ['W Riyadh - KAFD', 'SAR 450'], ['Atheel KAFD', 'SAR 350'], ['Sofitel Riyadh Hotel & Convention Centre', 'SAR 425'],
        ['Mövenpick Hotel and Residences Riyadh', 'SAR 350'], ['Executives Hotel - KAFD', 'SAR 280'], ['Crowne Plaza Riyadh RDC Hotel & Convention', 'SAR 300']
      ].map(([title, value], i) => ({
        kind: 'Info', title, imageUrl: img('me-ruh-' + i, 500, 320), valueLabel: 'Starting From', value, valueNote: 'per participant',
        linkText: 'View Gallery', linkUrl: 'https://www.redseaglobal.com', openInNewTab: true
      })));
      const jeddah = await addPolicySection(pageId, {
        layout: 'ImageCards', order: 4, title: 'Jeddah Partnered Hotels', cardStyle: 'ImageTop', columns: 5, sectionStyle: 'Card',
        subtitle: 'Host your meetings, workshops, trainings and events at our partnered hotels in Jeddah.', body: hotelNote
      });
      await addPolicyCards('SectionIdId', jeddah, [
        ['Asila Jeddah', 'SAR 450'], ['Shangri-La Jeddah', 'SAR 350'], ['Crowne Plaza Jeddah Al Salam', 'SAR 300'], ['Hilton Jeddah', 'SAR 280'], ['Sheraton Jeddah', 'SAR 325']
      ].map(([title, value], i) => ({
        kind: 'Info', title, imageUrl: img('me-jed-' + i, 500, 320), valueLabel: 'Starting From', value, valueNote: 'per participant',
        linkText: 'View Gallery', linkUrl: 'https://www.redseaglobal.com', openInNewTab: true
      })));
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
        layout: 'Feature', order: 5, title: 'Discover Joule — Your AI Assistant in SAP Concur', icon: 'Robot', cardStyle: 'ImageLeft', sectionStyle: 'Tinted', theme: 'Purple',
        subtitle: 'Smarter travel. Faster answers. Built for the way you work at RSG.', imageUrl: img('sap-joule', 600, 420),
        linkText: 'Learn More About Joule', linkUrl: 'https://www.sap.com/products/artificial-intelligence/ai-assistant.html'
      });
      await addPolicyCards('SectionIdId', joule, [
        { kind: 'Info', title: 'Get Answers', icon: 'Chat', iconColor: '#7c3aed', description: 'Ask questions and get instant help on travel, expenses and policy.' },
        { kind: 'Info', title: 'Plan & Book', icon: 'Airplane', iconColor: '#7c3aed', description: 'Use natural language to find policy-aligned travel options.' },
        { kind: 'Info', title: 'Manage Your Trip', icon: 'Clock', iconColor: '#7c3aed', description: 'Get help with eligible trip changes and updates.' },
        { kind: 'Info', title: 'Understand Policy', icon: 'Shield', iconColor: '#7c3aed', description: 'Ask RSG travel and expense policy questions in simple language.' }
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
        layout: 'Split', order: 8, title: 'Need Support?', subtitle: "We're here to help.", sectionStyle: 'Tinted', theme: 'Blue'
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
      const help = await addPolicySection(pageId, { layout: 'Split', order: 5, title: 'Need Help?', subtitle: 'Get the right support, at the right time.', sectionStyle: 'Tinted', theme: 'Blue' });
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
        layout: 'Feature', order: 2, title: 'Tips for Approvers', icon: 'Lightbulb', width: 'OneThird', sectionStyle: 'Tinted', theme: 'Green',
        body: ['@CheckMark|Use Joule to get a quick summary.', '@CheckMark|Focus on highlighted policy exceptions.', '@CheckMark|Add comments when sending back for clarification.', '@CheckMark|Approve requests regularly to keep travel plans on track.']
      });
      const help = await addPolicySection(pageId, {
        layout: 'Feature', order: 3, title: 'Need Help?', icon: 'Headset', width: 'OneThird', theme: 'Blue', body: 'Get the right support, at the right time.'
      });
      await addPolicyCards('SectionIdId', help, [
        { kind: 'Info', title: 'SAP Concur Support (System Help Desk)', icon: 'Mail', iconColor: NAVY, description: 'helpdesk.ksaobt@travelats.com' },
        { kind: 'Info', title: 'Approval Guidelines', icon: 'Library', iconColor: NAVY, description: 'Understand your role as an approver', targetSlug: 'compliance-responsibilities' }
      ]);
      await addPolicySection(pageId, {
        layout: 'Feature', order: 4, title: 'Meet Joule', icon: 'Robot', width: 'OneThird', sectionStyle: 'Tinted', theme: 'Purple',
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
        ['Scan & Attach Receipts', 'Camera', '#ea580c', 'Use your mobile camera to scan and upload receipts (photos or PDF). Ensure the details are clear and readable.'],
        ['Submit', 'Send', '#7c3aed', 'Review the details and submit your expense report.']
      ].map(([title, icon, color, description], i) => ({ kind: 'HelpStep', number: i + 1, icon, iconColor: color, title, description })));
      await addPolicySection(pageId, {
        layout: 'Feature', order: 2, title: 'Reimbursable Items', icon: 'Page', width: 'OneThird', theme: 'Blue',
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
        { kind: 'HelpStep', icon: 'CheckMark', iconColor: '#d97706', title: 'Approved', description: 'Your expense report has been approved.' },
        { kind: 'HelpStep', icon: 'Database', iconColor: '#7c3aed', title: 'Reimbursed', description: 'The reimbursement has been processed to your bank account.' }
      ]);
      await addPolicySection(pageId, {
        layout: 'Feature', order: 4, title: 'Helpful Tips', icon: 'Lightbulb', width: 'OneThird', sectionStyle: 'Tinted', theme: 'Green',
        body: ['@CheckMark|Just scan receipts and submit.', '@CheckMark|Ensure receipts are clear and readable.', '@CheckMark|Add a short description for each expense.', '@CheckMark|Submit regularly to keep your travel plans on track.']
      });
      await addPolicySection(pageId, {
        layout: 'Callout', order: 5, icon: 'Megaphone', body: "You'll be notified at each stage through email and in the Concur app."
      });
      const help = await addPolicySection(pageId, { layout: 'Split', order: 6, title: 'Need Help?', icon: 'Robot', subtitle: 'Ask Joule or contact Travel Services.', sectionStyle: 'Tinted', theme: 'Purple' });
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
        ['Get Approvals', 'CheckMark', '#d97706', 'Stay informed and take action anytime.'],
        ['Manage Trips', 'Suitcase', '#7c3aed', 'View itineraries, travel updates and more.']
      ].map(([title, icon, color, description]) => ({ kind: 'Info', title, icon, iconColor: color, description })));
      const why = await addPolicySection(pageId, { layout: 'Feature', order: 2, title: 'Why Use Concur Mobile?', width: 'OneThird' });
      await addPolicyCards('SectionIdId', why, [
        { kind: 'Info', title: 'Save time', icon: 'LightningBolt', iconColor: NAVY, description: 'Manage travel and expenses in one app.' },
        { kind: 'Info', title: 'Easy to use', icon: 'CellPhone', iconColor: NAVY, description: 'Simple and intuitive design.' },
        { kind: 'Info', title: 'Stay informed', icon: 'Ringer', iconColor: NAVY, description: 'Get real-time updates.' },
        { kind: 'Info', title: 'Secure', icon: 'Shield', iconColor: NAVY, description: 'Your data is protected.' }
      ]);
      const download = await addPolicySection(pageId, {
        layout: 'Split', order: 3, title: 'Download the SAP Concur App', width: 'TwoThirds', sectionStyle: 'Tinted', theme: 'Blue',
        subtitle: 'Scan the QR code or search "SAP Concur" in your app store.'
      });
      await addPolicyCards('SectionIdId', download, [
        { kind: 'Info', title: 'App Store', imageUrl: qr('https://apps.apple.com/app/sap-concur/id335023774'), description: 'Download on the App Store', linkText: 'Open', linkUrl: 'https://apps.apple.com/app/sap-concur/id335023774', openInNewTab: true },
        { kind: 'Info', title: 'Google Play', imageUrl: qr('https://play.google.com/store/apps/details?id=com.concur.breeze'), description: 'Get it on Google Play', linkText: 'Open', linkUrl: 'https://play.google.com/store/apps/details?id=com.concur.breeze', openInNewTab: true },
        { kind: 'Info', title: 'Travel Smarter On the Go', subPoints: ['@Clock|Anytime', '@MapPin|Anywhere', '@CellPhone|On Any Device'] }
      ]);
      await addPolicySection(pageId, {
        layout: 'Feature', order: 4, title: 'Need Help?', icon: 'Robot', width: 'OneThird', sectionStyle: 'Tinted', theme: 'Purple',
        body: 'Contact Travel Services or ask Joule in Concur.', linkText: 'Ask Joule', linkUrl: CONCUR_URL
      });
    }
  });

  // TH_TravelServices rows whose nav tab / card should open one of these pages.
  const SERVICE_PAGE_SLUGS = { 'personal travel offers': 'personal-travel-offers', 'personal travel': 'personal-travel-offers', 'sap concur': 'sap-concur', 'meeting & events': 'meetings-events', 'meetings & events': 'meetings-events' };

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

  async function seedMorePages() {
    for (const slug of Object.keys(MORE_PAGE_SEEDERS)) {
      await MORE_PAGE_SEEDERS[slug]();
    }
  }

  // The Travel Policy landing page, the Annual Flight Ticket Benefits page,
  // and the 6 "Explore Policy Information" sub-pages - approved content
  // baselines from RSG_Travel_Policy_Pages_1_2_Content_Specifications.docx
  // and RSG_Explore_Policy_Information_6_Subpages_Content_Specification.docx.
  async function seedPolicyPages() {
    const landingId = await addItem('TH_PolicyPages', {
      Title: 'Travel Policy',
      Slug: 'travel-policy',
      HeroIcon: 'Page',
      HeroTitle: 'Travel Policy',
      HeroSubtitle: 'Clear guidelines for compliant, responsible and sustainable travel.',
      HeroDescription: 'Travel with purpose. Plan with confidence. Stay compliant.',
      HeroImageUrl: link(img('policy-hero', 1600, 500)),
      HeroTagline: 'Responsible Travel\nA Brighter Tomorrow',
      SuggestedQuestions: [
        'What is my travel class entitlement?',
        'How can I claim my business travel expenses?',
        'What is my hotel accommodation cap?',
        'What are my daily and transportation allowances?'
      ].join('\n'),
      NeedHelpTitle: 'Need Help?',
      NeedHelpSupportLabel: 'Contact Travel Services',
      NeedHelpDescription: 'For policy related questions and support.',
      NeedHelpEmail: 'TravelServices@RedSeaGlobal.com',
      DisplayOrder: 1,
      IsActive: true
    });

    const benefitsId = await addItem('TH_PolicyPages', {
      Title: 'Annual Flight Ticket Benefits',
      Slug: 'annual-flight-ticket-benefits',
      ParentSlug: 'travel-policy',
      ParentTitle: 'Travel Policy',
      HeroIcon: 'AirTickets',
      HeroTitle: 'Annual Flight Ticket Benefits',
      HeroSubtitle: 'Stay connected with what matters most.',
      HeroDescription: "Supporting you and your family's journey home.",
      HeroImageUrl: link(img('policy-benefits-hero', 1600, 500)),
      HeroTagline: 'People Closer\nA Brighter Tomorrow',
      InfoBannerText: 'This benefit is provided in accordance with the company policy and subject to the rules and conditions below.',
      NoteBannerText: 'These terms and conditions may be reviewed and modified in accordance with changes to the company policy.',
      CtaTitle: 'Ready to proceed?',
      CtaDescription: 'Review the complete benefit conditions before submitting your request.',
      CtaLinkText: 'Full Rules & Conditions',
      CtaLinkUrl: link('#'),
      CtaPrimaryText: 'Apply',
      CtaPrimaryUrl: link('#'),
      ClosingBannerTitle: 'Travel with Purpose',
      ClosingBannerDescription: 'Connecting people. Supporting communities. A more sustainable tomorrow.',
      ClosingBadges: ['Our People', 'Our Planet', 'Our Future'].join('\n'),
      NeedHelpTitle: 'Need Help?',
      NeedHelpSupportLabel: 'ASK HR',
      NeedHelpDescription: 'Follow the steps below to raise your request or get support.',
      // Content Specifications §3 "Important: Do not display the Travel Services
      // email in this Page 2 Need Help area." - intentionally no NeedHelpEmail here.
      DisplayOrder: 2,
      IsActive: true
    });

    // -------------------------------------------------------------------
    // Travel Policy landing page sections
    // -------------------------------------------------------------------
    const categorySectionId = await addPolicySection(landingId, { layout: 'CardsGrid', cardVariant: 'Category', order: 1 });
    await addPolicyCards('SectionIdId', categorySectionId, [
      {
        kind: 'Category', title: 'Business Travel Policy', icon: 'Airplane',
        description: 'Guidance for approved business travel of less than 30 days, covering travel arrangements, entitlements, expenses and reimbursement requirements.',
        // Reserved TargetSlug value - navigates to the dedicated Business
        // Travel hub screen (not a TH_PolicyPages row) - see
        // BUSINESS_TRAVEL_SLUG in PolicyCardSections.tsx.
        linkText: 'View Policy', targetSlug: 'business-travel'
      },
      {
        kind: 'Category', title: 'Business Assignment Policy', icon: 'Suitcase',
        description: 'Guidance for business assignments exceeding 30 continuous calendar days, covering preparation, allowances, accommodation and applicable entitlements.',
        linkText: 'View Policy', linkUrl: '#'
      },
      {
        kind: 'Category', title: 'Annual Flight Ticket Benefits', icon: 'AirTickets',
        description: 'With every service anniversary, employees can choose to use the company agency to book a flight ticket or request the benefit in cash.',
        linkText: 'View Rules and Conditions', targetSlug: 'annual-flight-ticket-benefits'
      }
    ]);

    const infoSectionId = await addPolicySection(landingId, {
      layout: 'CardsGrid', cardVariant: 'Info', order: 2,
      title: 'Explore Policy Information',
      subtitle: 'Select a topic to view detailed information, guidelines and examples.'
    });
    await addPolicyCards('SectionIdId', infoSectionId, [
      { kind: 'Info', title: 'Purpose & Scope', icon: 'Page', targetSlug: 'purpose-scope' },
      { kind: 'Info', title: 'Guiding Principles', icon: 'CompassNW', targetSlug: 'guiding-principles' },
      { kind: 'Info', title: 'Travel Planning & Approvals', icon: 'Calendar', targetSlug: 'travel-planning-approvals' },
      { kind: 'Info', title: 'Travel Entitlement', icon: 'Money', targetSlug: 'travel-entitlement' },
      { kind: 'Info', title: 'Expenses (Allowable & Non-Allowable)', icon: 'ReceiptCheck', targetSlug: 'expenses' },
      { kind: 'Info', title: 'Compliance & Responsibilities', icon: 'Shield', targetSlug: 'compliance-responsibilities' }
    ]);

    const highlightSectionId = await addPolicySection(landingId, {
      layout: 'CardsGrid', cardVariant: 'Highlight', order: 3,
      title: 'Key Policy Highlights',
      subtitle: 'Quick guidance on important rules to keep in mind.'
    });
    await addPolicyCards('SectionIdId', highlightSectionId, [
      {
        // First 2 SubPoints lines are the mini-table markup (see
        // parseHighlightSubPoints.ts): `##Header|Header` then `Cell|Cell`
        // rows, followed by a `!!Label|Text` callout for the policy note.
        kind: 'Highlight', title: 'Plan Before Your Travel', icon: 'Calendar',
        description: 'To ensure adequate time for travel arrangements, employees shall submit travel requests as follows:',
        subPoints: [
          '##Travel Type|Submit Request',
          'GCC Countries|At least 5 business days before travel',
          'Rest of the World|At least 10 business days before travel',
          'Conferences & Events|At least 30 days before travel',
          "!!Policy note:|Business travel shall not normally be combined with an employee's annual vacation. However, this may be permitted with the approval of the Group Chief Administrative Officer."
        ]
      },
      {
        kind: 'Highlight', title: 'Exceeding Accommodation Cap Limits', icon: 'Hotel',
        description: 'Accommodation above the applicable policy cap requires an approved exception.',
        subPoints: [
          '##Excess Over Cap|Required Approval',
          'Up to 25%|GCAO Approval',
          'Above 25%|GCEO Approval',
          'You may use your daily transportation allowance, or part of it, to increase the hotel cap, provided the overall daily transportation amount is not exceeded.',
          'Raise accommodation-cap exception requests through SAP Concur.'
        ]
      },
      {
        kind: 'Highlight', title: 'Cancellations & No-Shows', icon: 'Cancel',
        description: "Tickets and accommodation cannot be cancelled after booking confirmation, except in circumstances beyond the employee's control or when required for business purposes.",
        subPoints: [
          'In such cases, RSG will bear the cancellation charges, subject to DoA approval.',
          'If an employee cancels a booking for personal reasons, they must notify the Travel Desk and provide appropriate justification.',
          'Failure to notify the Travel Desk or provide appropriate justification may result in disciplinary action by RSG.'
        ]
      },
      {
        kind: 'Highlight', title: 'Cancellation Process', icon: 'Sync',
        subPoints: [
          '1. Inform your manager and raise a cancellation request in SAP Concur.',
          '2. Contact the Travel Desk to cancel your reservation at rsgtravel@travelats.com.',
          '3. Ensure you receive a cancellation confirmation.',
          '4. Retain records for audit purposes.'
        ]
      }
    ]);

    // -------------------------------------------------------------------
    // Annual Flight Ticket Benefits sections
    // -------------------------------------------------------------------
    const ruleColors = ['#b89c66', '#04253c', '#107c41', '#a4262c'];
    const rulesSectionId = await addPolicySection(benefitsId, { layout: 'NumberedSteps', order: 1 });
    let ruleOrder = 1;
    for (const [num, title, icon, desc, subPoints] of [
      [1, 'Probation Period Completion', 'CheckMark',
        'Employees must have successfully passed their probation period to be eligible for the annual flight ticket benefit. Earning the accrued ticket will be upon the service anniversary.', []],
      [2, 'Approved Annual Leave', 'CheckList',
        'The employee must have their annual leave approved before submitting the flight ticket booking request.', []],
      [3, 'Ticket Submission Deadline', 'CalendarAgenda',
        'Travel plans must be submitted at least 30 days before the date of the flight. For seasonal periods, it should be 90 days in advance after obtaining the approved annual leave.',
        [
          'Summer months: July, August and September',
          'New Year: 15 December - 15 January',
          '10 days prior to and after Eid Al-Fitr and Eid Al-Adha (including Eid break)',
          'A week before and after National Day and Founding Day'
        ]],
      [4, 'Eligible Routes', 'Airplane',
        "Only flights between the employee's home country (point of origin) and Riyadh (nearest international airport). Tickets from site will not be covered within the booked route. Maximum one stop is allowed with a reasonable layover time.", []],
      [5, 'Dependents', 'People',
        "The benefit extends to dependents as per the company's policy. Dependents' flight tickets must follow the same point-of-origin and work-location route criteria. Employee SF profile should be updated with applicable backup documents.", []],
      [6, 'Flight Tickets Cancellation / Rescheduling', 'EventDeclined',
        'Employee and their eligible dependents must comply with the airfare and contract terms and conditions for travel. The company will not cover the cost if the issued ticket has been rescheduled or canceled.', []],
      [7, 'Non-Eligibility', 'Blocked', '',
        [
          'Terminated or resigned employees.',
          'Employees on long unpaid leave.',
          'Employees or dependents travelling outside of approved routes.',
          'Employees on a business trip.',
          "Employees cannot use their dependents' ticket for their own booking."
        ]],
      [8, 'Recovery', 'Money',
        'The company will have the right to recover the costs if the employee resigns before completing the contractual term.', []]
    ]) {
      await addItem('TH_PolicyCards', {
        Title: title,
        SectionIdId: rulesSectionId,
        Kind: 'Rule',
        Number: num,
        Icon: icon,
        IconColor: ruleColors[(num - 1) % ruleColors.length],
        Description: desc,
        SubPoints: subPoints.join('\n'),
        DisplayOrder: ruleOrder++,
        IsActive: true
      });
    }

    // "Ask HR" steps - a fixed page-level feature under Need Help, attached
    // directly via PageId (not part of the reorderable sections above).
    await addPolicyCards('PageIdId', benefitsId, [
      { kind: 'HelpStep', number: 1, title: 'Create Ticket', description: 'Log in to the HR Portal and create a new ticket.' },
      { kind: 'HelpStep', number: 2, title: 'Service Category', description: 'Select HR Payroll.' },
      { kind: 'HelpStep', number: 3, title: 'Incident Category', description: 'Select the relevant incident category from the drop down.' }
    ]);

    await seedExploreSubPages();

    // Business Travel (+ relocation), Personal Travel Offers, Meetings &
    // Events and SAP Concur pages - see MORE_PAGE_SEEDERS.
    await seedMorePages();
  }

  async function seedFooter() {
    const columns = [
      ['Travel Services', [
        ['Business Travel', '#'],
        ['Personal Travel Offers', '#'],
        ['Travel Policy', '#'],
        ['SAP Concur', 'https://www.concursolutions.com']
      ]],
      ['Support', [
        ['Travel Help Desk', '#'],
        ['Travel Care 24/7', '#'],
        ['Raise a request', '#']
      ]],
      ['Resources', [
        ['Travel news', '#'],
        ['Upcoming events', '#'],
        ['Travel tips', '#']
      ]],
      ['About', [
        ['Meet the team', '#'],
        ['Green Travel', '#']
      ]],
      ['Legal', [
        ['Privacy notice', '#'],
        ['Terms of use', '#'],
        ['Accessibility', '#']
      ]],
      ['Contact', [
        ['Email the travel team', 'mailto:travel@example.com'],
        ['Call Travel Care', 'tel:+966120000000']
      ]]
    ];
    let colOrder = 1;
    for (const [title, links] of columns) {
      const colId = await addItem('TH_FooterColumns', {
        Title: title,
        DisplayOrder: colOrder++,
        IsActive: true
      });
      let linkOrder = 1;
      for (const [text, url] of links) {
        await addItem('TH_FooterLinks', {
          Title: text,
          ColumnIdId: colId, // lookup column "ColumnId" -> REST field "ColumnIdId"
          Url: link(url),
          OpenInNewTab: /^https?:/i.test(url),
          DisplayOrder: linkOrder++,
          IsActive: true
        });
      }
    }
  }

  // Order matters: parents (questions, footer columns) are seeded inside their
  // own functions before their children.
  const STEPS = [
    ['TH_HeroBanners', seedHero],
    ['TH_TravelServices', seedServices],
    ['TH_BusinessTravelSteps + TH_BusinessTravelInfoCards', seedBusinessTravel],
    ['TH_TravelNews', seedNews],
    ['TH_TravelEvents', seedEvents],
    ['TH_TravelTips', seedTips],
    ['TH_QuickPulseQuestions + TH_QuickPulseOptions', seedQuickPulse],
    ['TH_TravelerTestimonials', seedTestimonials],
    ['TH_DepartmentTravelSpend', seedSpend],
    ['TH_GreenTravel', seedGreen],
    ['TH_TravelTeam', seedTeam],
    ['TH_GlobalNavigation', seedGlobalNav],
    ['TH_PolicyPages + TH_PolicySections + TH_PolicyCards + TH_PolicyTables + TH_PolicyTableRows + TH_PolicyTabs', seedPolicyPages],
    ['TH_FooterColumns + TH_FooterLinks', seedFooter]
  ];

  const RESETTABLE = [
    'TH_FooterLinks', 'TH_FooterColumns', 'TH_QuickPulseOptions', 'TH_QuickPulseResponses',
    'TH_PolicyTableRows', 'TH_PolicyTables', 'TH_PolicyTabs', 'TH_PolicyCards', 'TH_PolicySections', 'TH_PolicyPages',
    'TH_QuickPulseQuestions', 'TH_HeroBanners', 'TH_TravelServices',
    'TH_BusinessTravelSteps', 'TH_BusinessTravelInfoCards', 'TH_TravelNews',
    'TH_TravelEvents', 'TH_TravelTips', 'TH_TravelerTestimonials', 'TH_DepartmentTravelSpend',
    'TH_GreenTravel', 'TH_TravelTeam', 'TH_GlobalNavigation'
  ];

  /* ----------------------------- RUN ---------------------------------- */
  console.group('%cTravelHub sample data', 'color:#04253c;font-weight:bold;font-size:13px');
  log('Target web :', webUrl);
  log('Options    :', JSON.stringify(CONFIG));

  try {
    await refreshDigest();
    const web = await spGetJson('/_api/web?$select=Title,ServerRelativeUrl');
    log('Connected to web:', web.Title, '(' + web.ServerRelativeUrl + ')');

    if (CONFIG.RESEED_SLUGS.length > 0) {
      log('\n-- RESEED: ' + CONFIG.RESEED_SLUGS.join(', ') + ' ----------');
      const pages = await spGetJson("/_api/web/lists/getbytitle('TH_PolicyPages')/items?$select=Id,Title&$top=1000");
      pages.results.forEach((pg) => { pageTitleById[pg.Id] = pg.Title; });
      const seeders = Object.assign({}, SUBPAGE_SEEDERS, MORE_PAGE_SEEDERS);
      for (const slug of CONFIG.RESEED_SLUGS) {
        try {
          if (!seeders[slug]) throw new Error('no seeder for this slug in this file');
          const removed = await deletePolicyPage(slug);
          await seeders[slug]();
          log(`+  ${slug} re-seeded (${removed} old page row(s) removed)`);
        } catch (e) {
          issues.push(`reseed ${slug}: ${e.message}`);
          warn(`  ! reseed ${slug}: ${e.message}`);
        }
      }
      try {
        await linkServicePages();
      } catch (e) {
        issues.push(`TH_TravelServices.PageSlug: ${e.message}`);
        warn(`  ! TH_TravelServices.PageSlug: ${e.message} (re-run travelhub-provision.js?)`);
      }
      log(`\nDeleted ${deleted}, created ${created} item(s).` + (issues.length ? ` ${issues.length} issue(s) - see above.` : ' Done.'));
      return;
    }

    if (CONFIG.RESET) {
      log('\n-- RESET: clearing existing items ---------------');
      for (const list of RESETTABLE) {
        try {
          await clearList(list);
          log(`   cleared ${list}`);
        } catch (e) {
          issues.push(`clear ${list}: ${e.message}`);
          warn(`  ! clear ${list}: ${e.message}`);
        }
      }
    }

    log('\n-- Loading sample data -------------------------');
    for (const [label, fn] of STEPS) {
      const primary = label.split(' ')[0];
      try {
        if (!CONFIG.RESET) {
          const titles = await getTitles(primary);
          if (titles.length > 0) {
            log(`=  ${label} (already has ${titles.length} item(s) - skipped)`);
            continue;
          }
        }
        await fn();
        log(`+  ${label}`);
      } catch (e) {
        issues.push(`${label}: ${e.message}`);
        warn(`  ! ${label}: ${e.message}`);
      }
    }

    log('\n================ SUMMARY ================');
    if (CONFIG.RESET) log(`Deleted ${deleted} old item(s).`);
    log(`Created ${created} item(s).`);
    if (issues.length === 0) {
      log('%cSample data loaded. Open the page with the TravelHub web part. ✔', 'color:#107c41;font-weight:bold');
    } else {
      warn(`%c${issues.length} issue(s):`, 'color:#a4262c;font-weight:bold');
      issues.forEach((e) => warn('   • ' + e));
    }
    if (CONFIG.USE_PLACEHOLDER_IMAGES) {
      log('\nImages use picsum.photos / pravatar.cc placeholders. Replace the URLs');
      log('with files from the "Travel Hub Images" library for production.');
    }
    log('\nNote: the Department Travel Spend card will show "access restricted"');
    log('until you are a member of the TravelHub Spend Viewers group - that is by design.');
  } catch (fatal) {
    console.error('%c[TravelHub data] FATAL:', 'color:#a4262c;font-weight:bold', fatal);
  } finally {
    console.groupEnd();
  }
})();
