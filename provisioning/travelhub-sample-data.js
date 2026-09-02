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
      ['Excellent', 'Emoji2', 5],
      ['Good', 'Emoji', 4],
      ['Average', 'EmojiNeutral', 3],
      ['Poor', 'Sad', 2],
      ['Very Poor', 'EmojiDisappointed', 1]
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
    const rows = [
      ['Khalid Alattas', 5, 'The request-to-booking flow was quick and the Travel Care team sorted a last-minute change within minutes.', 'Principal', 'Project Delivery', 'Jeddah', 11],
      ['Noura Alharbi', 5, 'Concur made expense submission painless and I especially value the proactive travel advisories.', 'Analyst', 'Finance', 'Riyadh', 5],
      ['Faisal Bin Saeed', 4, 'The preferred-hotel programme saved my family money on a workation and the support was excellent.', 'Operations Lead', 'Operations', 'Dammam', 12]
    ];
    let order = 1;
    for (const [name, rating, comment, desig, dept, loc, av] of rows) {
      await addItem('TH_TravelerTestimonials', {
        Title: name,
        ProfileImage: link(avatar(av)),
        Rating: rating,
        Comment: comment,
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

  // Admin-added tabs only - the hub's built-in Help Desk / Travel Care / Our
  // Services tabs come from hero.quickLink.* config + the services section
  // anchor, not from this list (GlobalNavigationService.ts).
  async function seedGlobalNav() {
    const items = [
      // ['Title', 'Url', 'App' | 'External']
      ['Travel Policy', '#', 'App'],
      ['SAP Concur', 'https://www.concursolutions.com', 'External']
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
    ['TH_FooterColumns + TH_FooterLinks', seedFooter]
  ];

  const RESETTABLE = [
    'TH_FooterLinks', 'TH_FooterColumns', 'TH_QuickPulseOptions', 'TH_QuickPulseResponses',
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
