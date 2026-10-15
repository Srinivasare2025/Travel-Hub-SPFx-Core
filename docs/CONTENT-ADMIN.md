# Content Admin screen & page-load fix (Oct 2026)

## Content Admin ("Admin" tab)

- Visible only to members of the SharePoint group named in `TH_SiteConfiguration` key
  `admin.group` (default **TravelHub Content Admins**). `travelhub-provision.js` step 6
  creates the group and gives it **Contribute** on the site; add the members by hand.
- The tab is a convenience, not the security boundary: saving still needs edit rights on
  each `TH_*` list. Lists with broken inheritance (`TH_DepartmentTravelSpend`,
  `TH_QuickPulseResponses`) need the group added explicitly if admins should edit them.
- Menu: **Home page** (hero, services, news, events, tips, Quick Pulse, stories, spend,
  green travel, team), **Pages** (pages → sections → cards / tables → rows / tabs, offers),
  **Site** (navigation, footer, settings).
- Every field shows a hint (and an example for multi-line formats such as SubPoints,
  PopupContent, table cells). Pictures can be uploaded (to *Travel Hub Images*) and
  given a **Focus** (which part stays visible) or **Show whole image**.
- Delete moves items to the site Recycle Bin. Sub-items are not deleted with a parent.
- Field list: `src/webparts/travelHub/components/Admin/adminSchema.ts`. Fields that are not
  provisioned on the site are hidden automatically.

## Image hints (any image field, any list)

Append to an image URL: `#focus=top` (or bottom/left/right/top-left/`50%-20%`) and/or
`#fit=contain`. The Admin screen writes these for you.

## Page-load flash ("SharePoint page shows before Travel Hub")

1. Deploy the new package (1.0.0.15+).
2. Run `provisioning/travelhub-register-loader.js` once on the site (registers the
   *TravelHubLoader* Application Customizer, which shows the Travel Hub splash and hides
   SharePoint chrome before the page canvas loads).
3. Recommended site settings: host the web part on a **single-part app page**
   (New → App → Travel Hub) or a page with no other sections; Change the look → Header
   *Minimal*, site title hidden; Navigation hidden; Footer off; page comments off.

## Power BI on the spend card

Paste the normal report link; it is converted to the secure embed URL
(`reportEmbed?...&autoAuth=true&ctid=<tenant>`), which signs viewers in with their
Microsoft 365 account. Power BI permissions / RLS still apply. If the tenant blocks
embedding, ask the Power BI admin to allow "Embed content in apps" / SharePoint embedding.
