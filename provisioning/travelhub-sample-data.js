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
 *   2. F12 -> Console. Set CONFIG.TARGET_WEB_URL below if auto-detect is wrong.
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
  const CONFIG = {
    TARGET_WEB_URL:
      (typeof _spPageContextInfo !== 'undefined' && _spPageContextInfo.webAbsoluteUrl) ||
      window.location.origin,
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
  // SP.FieldUrlValue for Hyperlink columns.
  const link = (url, desc) =>
    url ? { __metadata: { type: 'SP.FieldUrlValue' }, Url: url, Description: desc || url } : null;

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

  // The Travel Policy landing page + the one fully-specified detail page
  // (Annual Flight Ticket Benefits). No mock exists yet for the "Explore
  // Policy Information" targets or the other two category cards' detail
  // pages, so those seed with no link (inert) rather than fabricated content
  // - see PolicyService.ts.
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

    const categories = [
      ['Business Travel Policy', 'Airplane',
        'Guidance for approved business travel of less than 30 days, covering travel arrangements, entitlements, expenses and reimbursement requirements.',
        'View Policy', null],
      ['Business Assignment Policy', 'Suitcase',
        'Guidance for business assignments exceeding 30 continuous calendar days, covering preparation, allowances, accommodation and applicable entitlements.',
        'View Policy', null],
      ['Annual Flight Ticket Benefits', 'AirTickets',
        'With every service anniversary, employees can choose to use the company agency to book a flight ticket or request the benefit in cash.',
        'View Rules and Conditions', 'annual-flight-ticket-benefits']
    ];
    let order = 1;
    for (const [title, icon, desc, linkText, targetSlug] of categories) {
      await addItem('TH_PolicyCards', {
        Title: title,
        PageIdId: landingId,
        Kind: 'Category',
        Icon: icon,
        Description: desc,
        LinkText: linkText,
        TargetSlug: targetSlug,
        LinkUrl: targetSlug ? null : link('#'),
        DisplayOrder: order++,
        IsActive: true
      });
    }

    const infoTopics = [
      ['Purpose & Scope', 'Page'],
      ['Guiding Principles', 'CompassNW'],
      ['Travel Planning & Approvals', 'Calendar'],
      ['Travel Entitlement', 'Money'],
      ['Expenses (Allowable & Non-Allowable)', 'ReceiptCheck'],
      ['Compliance & Responsibilities', 'Shield']
    ];
    order = 1;
    for (const [title, icon] of infoTopics) {
      await addItem('TH_PolicyCards', {
        Title: title,
        PageIdId: landingId,
        Kind: 'Info',
        Icon: icon,
        DisplayOrder: order++,
        IsActive: true
      });
    }

    // Content Specifications §3.1-3.4 - the approved wording, including the
    // submit-by-destination / approval-by-excess tables (rendered as bullets,
    // since TH_PolicyCards has no table field) and the numbered cancellation steps.
    const highlights = [
      ['Plan Before Your Travel', 'Calendar',
        'To ensure adequate time for travel arrangements, employees shall submit travel requests as follows:',
        [
          'GCC Countries: at least 5 business days before travel',
          'Rest of the World: at least 10 business days before travel',
          'Conferences & Events: at least 30 days before travel',
          "Policy note: business travel shall not normally be combined with an employee's annual vacation. However, this may be permitted with the approval of the Group Chief Administrative Officer."
        ]],
      ['Exceeding Accommodation Cap Limits', 'Bed',
        'Accommodation above the applicable policy cap requires an approved exception.',
        [
          'Up to 25% over cap: GCAO Approval',
          'Above 25% over cap: GCEO Approval',
          'You may use your daily transportation allowance, or part of it, to increase the hotel cap, provided the overall daily transportation amount is not exceeded.',
          'Raise accommodation-cap exception requests through SAP Concur.'
        ]],
      ['Cancellations & No-Shows', 'Cancel',
        "Tickets and accommodation cannot be cancelled after booking confirmation, except in circumstances beyond the employee's control or when required for business purposes.",
        [
          'In such cases, RSG will bear the cancellation charges, subject to DoA approval.',
          'If an employee cancels a booking for personal reasons, they must notify the Travel Desk and provide appropriate justification.',
          'Failure to notify the Travel Desk or provide appropriate justification may result in disciplinary action by RSG.'
        ]],
      ['Cancellation Process', 'Sync', '',
        [
          '1. Inform your manager and raise a cancellation request in SAP Concur.',
          '2. Contact the Travel Desk to cancel your reservation at rsgtravel@travelats.com.',
          '3. Ensure you receive a cancellation confirmation.',
          '4. Retain records for audit purposes.'
        ]]
    ];
    order = 1;
    for (const [title, icon, desc, subPoints] of highlights) {
      await addItem('TH_PolicyCards', {
        Title: title,
        PageIdId: landingId,
        Kind: 'Highlight',
        Icon: icon,
        Description: desc,
        SubPoints: subPoints.join('\n'),
        DisplayOrder: order++,
        IsActive: true
      });
    }

    // Cycled across a few on-brand colours (gold/navy/success/danger) rather
    // than inventing an arbitrary new palette for the numbered badges.
    const ruleColors = ['#b89c66', '#04253c', '#107c41', '#a4262c'];
    const rules = [
      [1, 'Probation Period Completion', 'CheckMark',
        'Employees must have successfully passed their probation period to be eligible for the annual flight ticket benefit. Earning the accrued ticket will be upon the service anniversary.',
        []],
      [2, 'Approved Annual Leave', 'CheckList',
        'The employee must have their annual leave approved before submitting the flight ticket booking request.',
        []],
      [3, 'Ticket Submission Deadline', 'CalendarAgenda',
        'Travel plans must be submitted at least 30 days before the date of the flight. For seasonal periods, it should be 90 days in advance after obtaining the approved annual leave.',
        [
          'Summer months: July, August and September',
          'New Year: 15 December - 15 January',
          '10 days prior to and after Eid Al-Fitr and Eid Al-Adha (including Eid break)',
          'A week before and after National Day and Founding Day'
        ]],
      [4, 'Eligible Routes', 'Airplane',
        "Only flights between the employee's home country (point of origin) and Riyadh (nearest international airport). Tickets from site will not be covered within the booked route. Maximum one stop is allowed with a reasonable layover time.",
        []],
      [5, 'Dependents', 'People',
        "The benefit extends to dependents as per the company's policy. Dependents' flight tickets must follow the same point-of-origin and work-location route criteria. Employee SF profile should be updated with applicable backup documents.",
        []],
      [6, 'Flight Tickets Cancellation / Rescheduling', 'EventDeclined',
        'Employee and their eligible dependents must comply with the airfare and contract terms and conditions for travel. The company will not cover the cost if the issued ticket has been rescheduled or canceled.',
        []],
      [7, 'Non-Eligibility', 'Blocked', '',
        [
          'Terminated or resigned employees.',
          'Employees on long unpaid leave.',
          'Employees or dependents travelling outside of approved routes.',
          'Employees on a business trip.',
          "Employees cannot use their dependents' ticket for their own booking."
        ]],
      [8, 'Recovery', 'Money',
        'The company will have the right to recover the costs if the employee resigns before completing the contractual term.',
        []]
    ];
    order = 1;
    for (const [num, title, icon, desc, subPoints] of rules) {
      await addItem('TH_PolicyCards', {
        Title: title,
        PageIdId: benefitsId,
        Kind: 'Rule',
        Number: num,
        Icon: icon,
        IconColor: ruleColors[(num - 1) % ruleColors.length],
        Description: desc,
        SubPoints: subPoints.join('\n'),
        DisplayOrder: order++,
        IsActive: true
      });
    }

    const steps = [
      [1, 'Create Ticket', 'Log in to the HR Portal and create a new ticket.'],
      [2, 'Service Category', 'Select HR Payroll.'],
      [3, 'Incident Category', 'Select the relevant incident category from the drop down.']
    ];
    order = 1;
    for (const [num, title, desc] of steps) {
      await addItem('TH_PolicyCards', {
        Title: title,
        PageIdId: benefitsId,
        Kind: 'HelpStep',
        Number: num,
        Description: desc,
        DisplayOrder: order++,
        IsActive: true
      });
    }
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
    ['TH_TravelNews', seedNews],
    ['TH_TravelEvents', seedEvents],
    ['TH_TravelTips', seedTips],
    ['TH_QuickPulseQuestions + TH_QuickPulseOptions', seedQuickPulse],
    ['TH_TravelerTestimonials', seedTestimonials],
    ['TH_DepartmentTravelSpend', seedSpend],
    ['TH_GreenTravel', seedGreen],
    ['TH_TravelTeam', seedTeam],
    ['TH_GlobalNavigation', seedGlobalNav],
    ['TH_PolicyPages + TH_PolicyCards', seedPolicyPages],
    ['TH_FooterColumns + TH_FooterLinks', seedFooter]
  ];

  const RESETTABLE = [
    'TH_FooterLinks', 'TH_FooterColumns', 'TH_QuickPulseOptions', 'TH_QuickPulseResponses',
    'TH_PolicyCards', 'TH_PolicyPages',
    'TH_QuickPulseQuestions', 'TH_HeroBanners', 'TH_TravelServices', 'TH_TravelNews',
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
