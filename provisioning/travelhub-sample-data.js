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
    return (await res.json()).d.Id;
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
      ['Policy reminders', 'A quick refresher on approval limits, per-diem rules and booking classes before you travel.', 'View'],
      ['Useful Documents', 'Download travel request templates, expense forms and the mobile app guide.', 'View'],
      ['Need further help?', 'Reach the Travel Care team for support with requests, approvals or urgent changes.', 'View']
    ];
    let infoOrder = 1;
    for (const [title, desc, linkText] of infoCards) {
      await addItem('TH_BusinessTravelInfoCards', {
        Title: title,
        Description: desc,
        LinkUrl: link('#'),
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
  async function addPolicySection(pageId, opts) {
    return addItem('TH_PolicySections', {
      Title: opts.title || null,
      PageIdId: pageId,
      Subtitle: opts.subtitle || null,
      Layout: opts.layout,
      CardVariant: opts.cardVariant || null,
      Body: Array.isArray(opts.body) ? opts.body.join('\n') : (opts.body || null),
      Icon: opts.icon || null,
      ImageUrl: opts.imageUrl ? link(opts.imageUrl) : null,
      DisplayOrder: opts.order,
      IsActive: true
    });
  }

  async function addPolicyTab(sectionId, label, order) {
    return addItem('TH_PolicyTabs', {
      Title: label,
      SectionIdId: sectionId,
      DisplayOrder: order,
      IsActive: true
    });
  }

  // parentField is 'PageIdId' | 'SectionIdId' | 'TabIdId'.
  async function addPolicyCards(parentField, parentId, cards) {
    let order = 1;
    for (const c of cards) {
      const row = {
        Title: c.title || '',
        Kind: c.kind,
        Number: c.number != null ? c.number : null,
        Icon: c.icon || null,
        IconColor: c.iconColor || null,
        Description: c.description || null,
        SubPoints: c.subPoints ? c.subPoints.join('\n') : null,
        TargetSlug: c.targetSlug || null,
        LinkUrl: c.linkUrl ? link(c.linkUrl) : null,
        LinkText: c.linkText || null,
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
        linkText: 'View Policy', linkUrl: '#'
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
        kind: 'Highlight', title: 'Plan Before Your Travel', icon: 'Calendar',
        description: 'To ensure adequate time for travel arrangements, employees shall submit travel requests as follows:',
        subPoints: [
          'GCC Countries: at least 5 business days before travel',
          'Rest of the World: at least 10 business days before travel',
          'Conferences & Events: at least 30 days before travel',
          "Policy note: business travel shall not normally be combined with an employee's annual vacation. However, this may be permitted with the approval of the Group Chief Administrative Officer."
        ]
      },
      {
        kind: 'Highlight', title: 'Exceeding Accommodation Cap Limits', icon: 'Bed',
        description: 'Accommodation above the applicable policy cap requires an approved exception.',
        subPoints: [
          'Up to 25% over cap: GCAO Approval',
          'Above 25% over cap: GCEO Approval',
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

    // -------------------------------------------------------------------
    // The 6 "Explore Policy Information" sub-pages - common ending on every
    // one: Ask Policy Assistant (SuggestedQuestions) -> Need Help? (Contact
    // Travel Services) -> Travel with Purpose footer (ClosingBanner).
    // -------------------------------------------------------------------
    const COMMON_SUBPAGE_FIELDS = {
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

    // --- 1. Purpose & Scope ---------------------------------------------
    const purposeId = await addSubPage(3, {
      Title: 'Purpose & Scope',
      Slug: 'purpose-scope',
      HeroIcon: 'Page',
      HeroTitle: 'Purpose & Scope',
      HeroSubtitle: 'Understand why the Business Travel and Business Assignment Policy exists and when each part of the policy applies.',
      HeroDescription: 'Know your journey. Understand the policy that applies to you.',
      HeroImageUrl: link(img('policy-purpose-hero', 1600, 500)),
      SuggestedQuestions: ['Which policy applies to me?', 'Can I combine business travel with vacation?', 'What expenses are covered?'].join('\n')
    });
    await addPolicySection(purposeId, {
      layout: 'Paragraph', order: 1, title: 'Purpose',
      body: [
        'The following policy guidelines specify conditions for travel arrangements and the reimbursement of expenses incurred while employees are traveling on company business.',
        'In order to be covered under the terms of this policy, expenses must be supported with valid documentation and approval, and must meet the requirement of being reasonable and necessary business travel-related expenses.'
      ]
    });
    const purposeComparisonId = await addPolicySection(purposeId, {
      layout: 'CardsGrid', cardVariant: 'Highlight', order: 2, title: 'Which Policy Applies to Your Travel?'
    });
    await addPolicyCards('SectionIdId', purposeComparisonId, [
      {
        kind: 'Highlight', title: 'Business Travel', icon: 'Airplane',
        description: "Less than 30 days. Business travel outside the employee's base working location for business meetings, conferences, events, training sessions, etc.",
        subPoints: ['Important: Travel to project sites is not included under this Policy.']
      },
      {
        kind: 'Highlight', title: 'Business Assignment', icon: 'Suitcase',
        description: 'Exceeding 30 continuous calendar days. Any business assignment for business purposes for a period exceeding thirty (30) continuous calendar days.',
        subPoints: ['Up to 4 days of discontinuation of the business trip will not be counted as an interruption of the business trip.']
      }
    ]);
    await addPolicySection(purposeId, {
      layout: 'Callout', order: 3, title: 'Business Travel + Annual Vacation', icon: 'Info',
      body: "Business Travel shall not normally be combined with the employee's annual vacation. However, it can be allowed upon approval of the Group Chief Administrative Officer. In that case, the employee will be responsible for bearing the accommodation cost for the extended period and the cost of the return air ticket if the destination of the return flight differs from the business trip's destination."
    });

    // --- 2. Guiding Principles -------------------------------------------
    const principlesId = await addSubPage(4, {
      Title: 'Guiding Principles',
      Slug: 'guiding-principles',
      HeroIcon: 'CompassNW',
      HeroTitle: 'Guiding Principles',
      HeroSubtitle: 'The principles that guide responsible, consistent and effective business travel across RSG.',
      HeroDescription: 'Travel with purpose. Make responsible decisions. Represent RSG.',
      HeroImageUrl: link(img('policy-principles-hero', 1600, 500)),
      SuggestedQuestions: ['Do I need approval before travelling?', 'What does "no loss, no gain" mean?', 'When should I consider alternatives to travel?'].join('\n')
    });
    await addPolicySection(principlesId, {
      layout: 'Paragraph', order: 1, title: 'Our Commitment',
      body: 'Our guiding principles ensure that business travel at RSG is purposeful, responsible and aligned with our values. They help us make the right decisions, represent the company professionally and create value for our people, our business and our planet.'
    });
    const principlesGridId = await addPolicySection(principlesId, {
      layout: 'CardsGrid', cardVariant: 'Highlight', order: 2, title: 'How We Approach Business Travel'
    });
    await addPolicyCards('SectionIdId', principlesGridId, [
      { kind: 'Highlight', title: 'Travel with a Business Purpose', icon: 'Ribbon', description: 'Business travel should be necessary to achieve company objectives, including face-to-face meetings, work requirements, training and projects.' },
      { kind: 'Highlight', title: 'Consider the Need to Travel', icon: 'Video', description: 'Balance the need for travel against cost, time and environmental impact. Where appropriate, consider alternatives such as phone, video or conferencing.' },
      { kind: 'Highlight', title: 'Obtain Approval Before Travel', icon: 'CheckMark', description: "All business trips require prior authorization from the employee's Manager before travel arrangements are made." },
      { kind: 'Highlight', title: 'Follow a Consistent Framework', icon: 'TaskList', description: 'The policy provides the mandatory baseline standards for managing Business Travel and Business Assignments across the organization.' },
      { kind: 'Highlight', title: 'No Loss, No Gain', icon: 'Balance', description: 'Business travel reimbursement follows the "no loss, no gain" principle - employees should neither personally gain nor incur a financial loss from approved business travel.' },
      { kind: 'Highlight', title: 'Travel Responsibly & Professionally', icon: 'ContactCard', description: 'Employees are expected to understand and follow the Travel Policy, minimize travel costs where reasonably possible, retain required invoices and documentation, and conduct themselves in accordance with RSG professional standards, values and Code of Conduct.' }
    ]);
    await addPolicySection(principlesId, {
      layout: 'Callout', order: 3, title: 'Company-Determined Travel Arrangements', icon: 'Info',
      body: 'RSG reserves the right to determine appropriate transportation and accommodation arrangements based on the best interests of the company.'
    });

    // --- 3. Travel Planning & Approvals -----------------------------------
    const planningId = await addSubPage(5, {
      Title: 'Travel Planning & Approvals',
      Slug: 'travel-planning-approvals',
      HeroIcon: 'Calendar',
      HeroTitle: 'Travel Planning & Approvals',
      HeroSubtitle: 'Plan your business travel early and secure the required approvals before making travel arrangements.',
      HeroDescription: 'Plan ahead. Obtain approval. Travel with confidence.',
      HeroImageUrl: link(img('policy-planning-hero', 1600, 500)),
      SuggestedQuestions: ['How early should I submit my travel request?', 'Who approves my business trip?', 'What if I need an urgent travel change?'].join('\n')
    });
    const planningTableId = await addPolicySection(planningId, {
      layout: 'Table', order: 1, title: 'Plan Before You Travel',
      subtitle: "All business trips require prior authorization from the employee's Manager. To ensure adequate time for travel arrangements, employees shall submit travel requests as follows:"
    });
    await addPolicyTables('SectionIdId', planningTableId, [
      { headers: ['Travel Type', 'Submit Request'], rows: [
        ['GCC Countries', 'At least 5 business days before travel'],
        ['Rest of the World', 'At least 10 business days before travel'],
        ['International Conferences & Events', 'At least 30 days before travel']
      ] }
    ]);
    await addPolicySection(planningId, {
      layout: 'Callout', order: 2, icon: 'Lightbulb',
      body: "Plan Early for Better Value: employees should request travel arrangements with RSG's travel agency as far in advance as possible in order to obtain the lowest possible cost/fare."
    });
    const urgentTableId = await addPolicySection(planningId, { layout: 'Table', order: 3, title: 'Urgent Changes to Travel Plans' });
    await addPolicyTables('SectionIdId', urgentTableId, [
      { headers: ['Travel Type', 'Urgent Change Request'], rows: [
        ['GCC Countries', 'At least 3 business days before travel'],
        ['Rest of the World', 'At least 5 business days before travel'],
        ['International Conferences & Events', 'At least 15 days before travel']
      ] }
    ]);
    await addPolicySection(planningId, {
      layout: 'Callout', order: 4, icon: 'Warning',
      body: 'Exception: travel-plan exceptions require approval from the Group Chief Administrative Officer (GCAO).'
    });
    const beforeArrangingId = await addPolicySection(planningId, { layout: 'CardsGrid', cardVariant: 'Highlight', order: 5, title: 'Before Making Travel Arrangements' });
    await addPolicyCards('SectionIdId', beforeArrangingId, [
      { kind: 'Highlight', title: 'Get Manager Approval', icon: 'AccountActivity', description: 'Obtain prior authorization from your Manager before proceeding with business travel.' },
      { kind: 'Highlight', title: 'Check Visa Requirements', icon: 'Certificate', description: 'Employees are responsible for verifying applicable entry visa requirements. RSG will cover required visa documentation costs in accordance with the policy.' },
      { kind: 'Highlight', title: 'Use the Approved Travel Channel', icon: 'Airplane', description: 'Once approved, proceed with travel arrangements through the approved RSG travel process/channel.' }
    ]);
    await addPolicySection(planningId, {
      layout: 'Callout', order: 6, title: 'Business Travel + Annual Vacation', icon: 'Info',
      body: "Business travel shall not normally be combined with an employee's annual vacation. However, it may be permitted with approval from the Group Chief Administrative Officer (GCAO), subject to the applicable policy conditions."
    });

    // --- 4. Travel Entitlement ---------------------------------------------
    const entitlementId = await addSubPage(6, {
      Title: 'Travel Entitlement',
      Slug: 'travel-entitlement',
      HeroIcon: 'Money',
      HeroTitle: 'Travel Entitlement',
      HeroSubtitle: 'Understand your travel entitlements based on job grade, travel duration and destination.',
      HeroDescription: 'Know your entitlement. Plan your journey with confidence.',
      HeroImageUrl: link(img('policy-entitlement-hero', 1600, 500)),
      SuggestedQuestions: [
        'What is my travel class entitlement?', 'What is my hotel accommodation cap?',
        'What are my daily and transportation allowances?', 'What is my assignment entitlement?'
      ].join('\n')
    });
    const entitlementTabsSectionId = await addPolicySection(entitlementId, { layout: 'Tabs', order: 1 });
    const businessTravelTabId = await addPolicyTab(entitlementTabsSectionId, 'Business Travel (< 30 days)', 1);
    const businessAssignmentTabId = await addPolicyTab(entitlementTabsSectionId, 'Business Assignment (> 30 days)', 2);

    await addPolicyTables('TabIdId', businessTravelTabId, [
      { title: 'Air Travel Entitlement', headers: ['Job Grade', 'Zone 1 (< 6 flying hours)', 'Zone 2 (> 6 flying hours)'], rows: [
        ['Grades 12-14', 'Business Class', 'Business Class'],
        ['Grades 1-11', 'Economy Class', 'Business Class']
      ] },
      { title: 'RSI & EJH (Al Wajh)', headers: ['Job Grade', 'Travel Class'], rows: [
        ['Grade 14', 'Business Class'],
        ['Grades 1-13', 'Economy Class']
      ] },
      { title: 'Accommodation Entitlement', headers: ['Location', 'Grade 13', 'Grades 12 & Below'], rows: [
        ['Within KSA', 'SAR 1,800', 'SAR 1,000'],
        ['Outside KSA', 'SAR 2,250', 'SAR 1,500']
      ] },
      { title: 'Daily Transportation Allowance', headers: ['Travel Location', 'Grades 13-14', 'Grades 1-12'], rows: [
        ['Outside KSA', 'SAR 750', 'SAR 500'],
        ['Within KSA', 'SAR 600', 'SAR 300']
      ] },
      { title: 'Daily Allowance', headers: ['Travel Location', 'Grades 13-14', 'Grades 1-12'], rows: [
        ['Outside KSA', 'SAR 600', 'SAR 500'],
        ['Within KSA', 'SAR 500', 'SAR 400']
      ] }
    ]);
    await addPolicyCards('TabIdId', businessTravelTabId, [
      { kind: 'Highlight', title: 'Upgrade Approval', icon: 'DoubleChevronUp', description: 'If the eligible travel class is unavailable, an upgrade is subject to approval from the Group Head of People Strategy and Culture.' },
      { kind: 'Highlight', title: 'Excess Baggage', icon: 'Bank', description: 'Excess baggage is covered only when required for a business purpose and with prior Division Head approval.' },
      { kind: 'Highlight', title: 'Accommodation Standard', icon: 'Bed', description: 'Minimum standard: 4-star accommodation. Hotel lounge access is not covered. Corporate rates should be utilized through approved company travel providers. Room and breakfast are excluded from the Daily Allowance. For accommodation above the applicable cap, raise an exception through SAP Concur.' },
      { kind: 'Highlight', title: 'Airport Transfer', icon: 'Car', description: 'Grade 13 and below: reimbursable up to SAR 100 per trip for standard/economy car services through ride-sharing applications or taxis. Where possible, employees should share airport transfers.' },
      { kind: 'Highlight', title: 'Additional Entitlement - Extra Travel Day', icon: 'CalendarAgenda', description: 'For international travel excluding GCC and domestic travel, one additional day may be added to the total travel duration. The employee may request the additional day before or after the business trip.' }
    ]);

    await addPolicyTables('TabIdId', businessAssignmentTabId, [
      { title: 'Accommodation Entitlement (Maximum)', headers: ['Location', 'Maximum Accommodation'], rows: [
        ['Within KSA', 'SAR 600'],
        ['Outside KSA', 'SAR 850']
      ] },
      { title: 'Daily Cash Allowance', headers: ['Job Grade', 'Daily Cash Allowance'], rows: [
        ['Grades 12-14', 'SAR 400'],
        ['Grades 1-11', 'SAR 285']
      ] }
    ]);
    await addPolicyCards('TabIdId', businessAssignmentTabId, [
      { kind: 'Highlight', title: 'Air Travel Entitlement', icon: 'Airplane', description: 'Uses the same Zone 1/Zone 2 travel-class table and RSI & EJH (Al Wajh) airport-specific entitlement as Business Travel, including the excess-baggage rule.' },
      { kind: 'Highlight', title: 'Accommodation Standard', icon: 'Bed', description: 'Minimum standard: 4-star accommodation. Hotel lounge access is not covered. For accommodation exceeding the applicable cap: up to 25% requires GCAO approval, above 25% requires GCEO approval. Room and breakfast are excluded from the Daily Cash Allowance. Corporate rates should be utilized through approved company travel providers.' },
      { kind: 'Highlight', title: 'Daily Cash Allowance', icon: 'Money', description: 'No receipts are required. The Daily Cash Allowance covers meals, local transportation and incidental expenses during the assignment.' },
      { kind: 'Highlight', title: 'Airport Transfer', icon: 'Car', description: 'Approved business-assignment travelers are eligible for airport transfers. Grade 13 and below: reimbursable up to SAR 100 per trip for standard/economy car services through ride-sharing applications or taxis. Where possible, employees should share airport transfers.' },
      { kind: 'Highlight', title: 'Important Assignment Information', icon: 'Info', description: "Applies when travel exceeds 30 continuous days. Short interruptions of up to 4 days do not interrupt the assignment. A cash advance of up to one month's allowance may be provided, subject to applicable requirements. Assignment extensions require reapproval from the applicable authority." }
    ]);

    // --- 5. Expenses (Allowable & Non-Allowable) --------------------------
    const expensesId = await addSubPage(7, {
      Title: 'Expenses (Allowable & Non-Allowable)',
      Slug: 'expenses',
      HeroIcon: 'ReceiptCheck',
      HeroTitle: 'Expenses (Allowable & Non-Allowable)',
      HeroSubtitle: 'Understand which business travel expenses are eligible for reimbursement and what documentation is required.',
      HeroDescription: 'Spend responsibly. Keep your receipts. Claim with confidence.',
      HeroImageUrl: link(img('policy-expenses-hero', 1600, 500)),
      SuggestedQuestions: ['Is this expense reimbursable?', 'What documents do I need for a business meal?', 'When must I submit my expense claim?'].join('\n')
    });
    await addPolicySection(expensesId, {
      layout: 'Paragraph', order: 1, title: 'Expense Reimbursement Principles',
      body: [
        'Business travel expenses must be reasonable, necessary and related to company business. Eligible expenses must be supported by the required documentation and approvals.',
        'Employees are responsible for retaining invoices and supporting documents and submitting their expense claim through SAP Concur within 30 business days after completion of the trip.'
      ]
    });
    const allowableTableId = await addPolicySection(expensesId, { layout: 'Table', order: 2, title: 'Allowable Expenses' });
    await addPolicyTables('SectionIdId', allowableTableId, [
      { headers: ['Category', 'Allowable Items'], rows: [
        ['Meals & Business Meals', 'Eligible meals within the applicable Daily Allowance limit. For business meals, provide the invoice and attendee details, including company and title.'],
        ['Travel & Transportation', 'Taxi and eligible local transportation; car rental; parking and tolls; airport transfers in accordance with the applicable entitlement.'],
        ['Business & Connectivity', 'Registration and seminar fees; data roaming for the duration of the business trip; necessary business-office expenses such as photocopying, internet and package delivery.'],
        ['Other Eligible Expenses', 'Reasonable laundry/dry-cleaning for trips of 3 or more consecutive days; mineral water from the minibar; mandatory tipping up to 10% of restaurant service; currency-conversion fees; other necessary official-business expenses with appropriate explanation/documentation.']
      ] }
    ]);
    const nonAllowableTableId = await addPolicySection(expensesId, { layout: 'Table', order: 3, title: 'Non-Allowable Expenses' });
    await addPolicyTables('SectionIdId', nonAllowableTableId, [
      { headers: ['Category', 'Non-Allowable Items'], rows: [
        ['Personal & Lifestyle', 'Barber/hairdresser; clothing; health club/spa/lounge; gum/candy; cigarettes; alcohol; personal/vacation-day expenses.'],
        ['Memberships & Personal Financial Costs', 'Airline club memberships; airline upgrades; annual personal credit-card fees.'],
        ['Vehicle & Other Personal Costs', 'Car washes; locksmith expenses; cellular phone rental; monthly cellular data-roaming charges.'],
        ['Other', 'Charitable contributions; excess baggage without sufficient business justification.']
      ] }
    ]);
    const claimStepsId = await addPolicySection(expensesId, { layout: 'ProcessSteps', order: 4, title: 'Before You Submit Your Claim' });
    let claimStepOrder = 1;
    for (const [num, title, desc] of [
      [1, 'Check Eligibility', 'Ensure the expense is allowable under the policy.'],
      [2, 'Keep Documentation', 'Retain all required invoices and supporting documents.'],
      [3, 'Submit in SAP Concur', 'Submit your expense claim with complete information.'],
      [4, 'Manager Review', 'Approvers review eligibility, receipts and reasonableness.']
    ]) {
      await addItem('TH_PolicyCards', {
        Title: title, SectionIdId: claimStepsId, Kind: 'HelpStep', Number: num, Description: desc,
        DisplayOrder: claimStepOrder++, IsActive: true
      });
    }
    await addPolicySection(expensesId, {
      layout: 'Callout', order: 5, icon: 'Info',
      body: 'Submit your expense claim within 30 business days after the end of your business trip. Approvers should review and approve expense claims normally within 3 business days, while validating eligibility, receipts and reasonableness.'
    });
    await addPolicySection(expensesId, {
      layout: 'Callout', order: 6, title: 'Important Reminder', icon: 'Lightbulb',
      body: 'Not sure whether an expense is allowable? Check the policy before incurring the expense or use the Policy Assistant for guidance.'
    });

    // --- 6. Compliance & Responsibilities ----------------------------------
    const complianceId = await addSubPage(8, {
      Title: 'Compliance & Responsibilities',
      Slug: 'compliance-responsibilities',
      HeroIcon: 'Shield',
      HeroTitle: 'Compliance & Responsibilities',
      HeroSubtitle: 'Understand your responsibilities as a traveler or approver and help ensure every business trip complies with RSG policy.',
      HeroDescription: 'Know your responsibility. Follow the policy. Travel with accountability.',
      HeroImageUrl: link(img('policy-compliance-hero', 1600, 500)),
      SuggestedQuestions: ['What are my responsibilities as a traveler?', 'What should an approver check?', 'What happens if the Travel Policy is not followed?'].join('\n')
    });
    await addPolicySection(complianceId, {
      layout: 'Paragraph', order: 1, title: 'Shared Responsibility',
      body: 'Travel policy compliance is a shared responsibility. Employees and approvers are responsible for understanding the applicable policy requirements, ensuring appropriate approvals are obtained, and maintaining accurate supporting documentation.'
    });
    const employeeRespId = await addPolicySection(complianceId, { layout: 'CardsGrid', cardVariant: 'Highlight', order: 2, title: 'Employee Responsibilities' });
    await addPolicyCards('SectionIdId', employeeRespId, [
      {
        kind: 'Highlight', title: 'Employee Responsibilities', icon: 'Contact',
        subPoints: [
          'Confirm the need to travel and ensure the trip is necessary for business purposes.',
          'Obtain approval before booking or making travel arrangements.',
          'Follow the Travel Policy and applicable travel entitlements.',
          'Manage costs responsibly and exercise reasonable judgment when incurring business travel expenses.',
          'Retain invoices, receipts and supporting documentation required for reimbursement and audit.',
          'Submit expense claims through SAP Concur within 30 business days after completion of the trip, with appropriate explanations and supporting documents.'
        ]
      }
    ]);
    const approverRespId = await addPolicySection(complianceId, { layout: 'CardsGrid', cardVariant: 'Highlight', order: 3, title: 'Approver Responsibilities' });
    await addPolicyCards('SectionIdId', approverRespId, [
      {
        kind: 'Highlight', title: 'Approver Responsibilities', icon: 'AccountActivity',
        subPoints: [
          'Confirm the business necessity of the travel.',
          'Understand the applicable Travel Policy requirements and employee entitlement.',
          'Ensure expenses are legitimate, reasonable and supported by appropriate documentation.',
          "Review requests and claims with sufficient knowledge of the employee's business travel.",
          'Validate policy compliance, eligibility and reasonableness before approval.',
          'Review and approve expense claims normally within 3 business days.'
        ]
      }
    ]);
    const complianceStagesId = await addPolicySection(complianceId, { layout: 'Table', order: 4, title: 'Compliance Starts Before Travel' });
    await addPolicyTables('SectionIdId', complianceStagesId, [
      { headers: ['Stage', 'Content'], rows: [
        ['Plan Early', "Employees should request travel arrangements with RSG's travel agency as far in advance as possible in order to obtain the lowest possible cost/fare."],
        ['Obtain Approval', "All business trips require prior authorization from the employee's Manager."],
        ['Use Approved Travel Channels', 'Travel arrangements should be processed through the approved RSG travel process and channels.']
      ] }
    ]);
    await addPolicySection(complianceId, {
      layout: 'Callout', order: 5, title: 'Audit & Accountability', icon: 'Warning',
      body: 'RSG reserves the right to audit business travel requests, bookings, supporting documents and expense claims to ensure compliance with the applicable policy. Employees and approvers are responsible for policy compliance. Non-compliance may result in accountability and appropriate disciplinary action in accordance with RSG requirements.'
    });
    const complianceCheckId = await addPolicySection(complianceId, { layout: 'Table', order: 6, title: 'Before You Travel - Quick Compliance Check' });
    await addPolicyTables('SectionIdId', complianceCheckId, [
      { headers: ['Check', 'Status'], rows: [
        ['Business need confirmed', 'Yes'],
        ['Manager approval obtained', 'Yes'],
        ['Policy entitlement checked', 'Yes'],
        ['Travel requested through approved channel', 'Yes'],
        ['Required documentation understood', 'Yes']
      ] }
    ]);
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
