/**
 * What the Content Admin screen can edit: every Travel Hub list, its fields,
 * the control each field gets, and the plain-language hint shown under it.
 *
 * This mirrors provisioning/travelhub-provision.js (the list schema) and
 * docs/POLICY-CONTENT-GUIDE.md (the text formats). When a list gains a field,
 * add it here too - a field that is not provisioned on the site yet is hidden
 * automatically (AdminService.getFieldNames), so this file may run ahead of
 * the site.
 */

export type AdminFieldKind =
  | 'text'
  | 'note'
  /** Rich text: headings, lists, links, images anywhere, tables (SharePoint enhanced rich text). */
  | 'rich'
  /** Multi-line text where every line is one item (bullets, chips, badges...). */
  | 'lines'
  | 'number'
  | 'bool'
  | 'date'
  | 'datetime'
  | 'choice'
  /** A choice that also accepts a new typed value. */
  | 'choiceFillIn'
  /** Hyperlink column. */
  | 'url'
  /** Hyperlink column holding a picture: upload, preview and focus picker. */
  | 'image'
  /** Fluent UI icon name, with live preview. */
  | 'icon'
  /** Brand colour name or hex, with swatches. */
  | 'color'
  /** In-app page slug (TH_PolicyPages.Slug) - picker of existing pages. */
  | 'slug';

export interface IAdminField {
  /** SharePoint internal name. */
  name: string;
  label: string;
  kind: AdminFieldKind;
  /** Shown under the control - what to type and in which format. */
  hint?: string;
  /** Shown as a monospace example block under the hint. */
  example?: string;
  required?: boolean;
  choices?: string[];
  min?: number;
  max?: number;
  placeholder?: string;
  /** Value for a NEW item. */
  defaultValue?: unknown;
  /** Group heading in the form. */
  group?: string;
}

export interface IAdminChild {
  /** Button text, e.g. "Sections". */
  label: string;
  /** Key of the child list definition (ADMIN_LISTS). */
  listKey: string;
  /** Lookup field on the child pointing at this item, e.g. "PageId". */
  parentField: string;
  /** Extra OData filter, e.g. only page-level cards (no section). */
  extraFilter?: string;
  /** Explains the relationship. */
  hint?: string;
  /** Field values for a NEW child item, e.g. { Kind: 'HelpStep' }. */
  defaults?: Record<string, unknown>;
  /**
   * Also stamp the page (PageId) of the drill path on a NEW child - sections
   * inside a tab must still carry their page's PageId to be loaded.
   */
  inheritPageId?: boolean;
}

export interface IAdminList {
  key: string;
  /** SharePoint list title. */
  list: string;
  label: string;
  /** One line under the title: what this content is and where it shows. */
  description: string;
  /** Label + hint for the Title column. */
  titleLabel: string;
  titleHint?: string;
  titleRequired?: boolean;
  fields: IAdminField[];
  /** Field names (besides Title) shown as table columns. */
  columns: string[];
  /** Sort field for the table; DisplayOrder lists get up/down reorder buttons. */
  orderField?: string;
  orderDescending?: boolean;
  children?: IAdminChild[];
  /** Only reachable as a child (hidden from the side menu). */
  childOnly?: boolean;
  /** Field names whose value is shown as the row's subtitle. */
  subtitleField?: string;
}

export interface IAdminGroup {
  label: string;
  icon: string;
  keys: string[];
}

/* ---------------------------------------------------------------------------
   Reusable field definitions and hint texts
   --------------------------------------------------------------------------- */

const ORDER: IAdminField = {
  name: 'DisplayOrder',
  label: 'Display order',
  kind: 'number',
  hint: 'Lower numbers show first (1, 2, 3...). Tip: use the up/down arrows in the list instead of typing numbers.',
  defaultValue: 0,
  group: 'Display'
};
const ACTIVE: IAdminField = {
  name: 'IsActive',
  label: 'Show on the site',
  kind: 'bool',
  hint: 'Switch off to hide this item without deleting it.',
  defaultValue: true,
  group: 'Display'
};
const START: IAdminField = { name: 'StartDate', label: 'Show from', kind: 'datetime', hint: 'Optional. Hidden before this date and time.', group: 'Display' };
const END: IAdminField = { name: 'EndDate', label: 'Show until', kind: 'datetime', hint: 'Optional. Hidden after this date and time.', group: 'Display' };
const NEW_TAB: IAdminField = {
  name: 'OpenInNewTab',
  label: 'Open link in a new tab',
  kind: 'bool',
  hint: 'Use for links to other websites/systems so visitors keep Travel Hub open.',
  group: 'Link'
};

const ICON_HINT =
  'A Fluent UI icon name, e.g. Airplane, Hotel, Car, Money, Mail, Phone, Calendar, People, Suitcase, CheckMark, Info, Headset, Globe. The preview shows if the name is right. Full list: aka.ms/fluentui-icons';
const COLOR_HINT =
  'Pick a brand colour (or type a hex code like #007481). Used for the icon circle, ribbon, button or card tint.';
const IMAGE_HINT =
  'Upload a picture or paste its link (from the "Travel Hub Images" library). It fills its frame automatically; use "Focus" to choose which part stays visible when the frame crops it, or "Show whole image" for logos and posters.';
const SLUG_HINT = 'Opens another Travel Hub page inside the app. Pick the page; leave empty to use the Link URL instead.';

const SUBPOINTS_EXAMPLE = [
  'Plain line = a bullet point',
  '@Mail|Line with its own icon (Icon|Text)',
  '@Clock|Sub-heading|Description under it (Icon|Heading|Text)',
  '==A small bold sub-heading',
  '~~A paragraph without a bullet',
  '##Column 1|Column 2   (starts a small table)',
  'Cell 1|Cell 2',
  '!!Note:|An info note with a bold label',
  '1. Numbered step   (all lines numbered = numbered list)',
  '%%Traveler   (a small tag badge on the card header)'
].join('\n');

const SUBPOINTS_HINT =
  'One item per line. Plain lines become bullets; start a line with a marker for a special format (see example). Text can use **bold**; emails, https:// links and +966 phone numbers become clickable automatically.';

const BODY_HINT =
  'One paragraph per line. Start a line with "- " for a bullet. All SubPoints markers also work here (@Icon|text, ==heading, ##table, !!note). Use **double asterisks** for bold.';

const POPUP_HINT =
  'Files that open in a popup when the card is clicked (photos are shown with previous/next, PDFs as tabs). One file per line: "Label | link". Add "| image" or "| pdf" when the link has no file extension.';
const POPUP_EXAMPLE = ['Riyadh | https://…/Riyadh-Guide.pdf', 'Jeddah | https://…/Jeddah-Guide.pdf', 'Setup photo 1 | https://…/photo1.jpg', 'Poster | https://…/getimage?id=7 | image'].join('\n');

const BRAND_THEMES = [
  'Gold',
  'Navy',
  'Crystal Waters',
  'Blue Lagoon',
  'Blooming Nature',
  'Majestic Mountains',
  'Thriving Corals',
  'Sandy Dunes',
  'Volcanic Ash'
];

/* ---------------------------------------------------------------------------
   Lists
   --------------------------------------------------------------------------- */

export const ADMIN_LISTS: IAdminList[] = [
  // ----------------------------------------------------------------- HOME
  {
    key: 'hero',
    list: 'TH_HeroBanners',
    label: 'Hero slides',
    description: 'The big rotating banner at the top of the Home page (photos or videos).',
    titleLabel: 'Headline on the slide',
    titleHint: 'Optional big text shown over the picture. Leave empty for a picture-only slide.',
    columns: ['MediaType', 'StartDate', 'EndDate'],
    orderField: 'DisplayOrder',
    fields: [
      { name: 'Description', label: 'Text under the headline', kind: 'note', hint: 'Optional, one or two short sentences shown under the headline.', group: 'Content' },
      { name: 'MediaType', label: 'Slide type', kind: 'choice', choices: ['Image', 'Video'], defaultValue: 'Image', group: 'Media', hint: 'Video slides play muted and move to the next slide when they finish.' },
      {
        name: 'ImageUrl',
        label: 'Picture (desktop)',
        kind: 'image',
        group: 'Media',
        hint: `${IMAGE_HINT} Best size: 1920 × 1080 px (16:9) or wider, under 1 MB. For a video slide this is the still picture shown before the video starts.`
      },
      { name: 'MobileImageUrl', label: 'Picture (phones)', kind: 'image', group: 'Media', hint: 'Optional. A 4:3 crop for phones, e.g. 1200 × 900 px. Leave empty to reuse the desktop picture.' },
      {
        name: 'VideoUrl',
        label: 'Video link',
        kind: 'url',
        group: 'Media',
        hint: 'Video slides only: link to an .mp4 file (upload it to "Travel Hub Videos"). 16:9, 1920 × 1080, under 30 MB recommended.'
      },
      { name: 'AccessibilityText', label: 'Picture description (for screen readers)', kind: 'text', group: 'Media', required: true, hint: 'Describe what the picture shows, e.g. "Travellers boarding a plane at Red Sea International".' },
      { name: 'DurationSeconds', label: 'Seconds on screen', kind: 'number', min: 3, max: 600, defaultValue: 6, group: 'Display', hint: 'Picture slides only (3-600). Videos advance by themselves.' },
      ORDER,
      ACTIVE,
      START,
      END
    ]
  },
  {
    key: 'services',
    list: 'TH_TravelServices',
    label: 'Travel services',
    description: '"Explore Our Travel Services" cards on Home, and the top navigation tabs.',
    titleLabel: 'Service name',
    titleRequired: true,
    titleHint: 'Shown on the card and as the navigation tab, e.g. "SAP Concur".',
    columns: ['LinkText', 'PageSlug'],
    orderField: 'DisplayOrder',
    fields: [
      { name: 'Description', label: 'Short description', kind: 'note', group: 'Content', hint: 'One or two sentences on the card.' },
      { name: 'ImageUrl', label: 'Card picture', kind: 'image', group: 'Content', hint: `${IMAGE_HINT} Best size: 800 × 500 px.` },
      {
        name: 'ImageFit',
        label: 'Picture fit',
        kind: 'choice',
        choices: ['Cover', 'Contain'],
        defaultValue: 'Cover',
        group: 'Content',
        hint: 'Cover = fill the frame (photos). Contain = show the whole image (logos, pictures with text).'
      },
      { name: 'Icon', label: 'Icon', kind: 'icon', group: 'Content', hint: ICON_HINT },
      { name: 'IconBackgroundColor', label: 'Icon colour', kind: 'color', group: 'Content', hint: COLOR_HINT },
      { name: 'PageSlug', label: 'Opens this Travel Hub page', kind: 'slug', group: 'Link', hint: `${SLUG_HINT} Usually the page with the same name.` },
      { name: 'LinkUrl', label: 'Link URL', kind: 'url', group: 'Link', hint: 'Only when the service should open another website instead of a Travel Hub page.' },
      { name: 'LinkType', label: 'Link type', kind: 'choice', choices: ['Internal', 'External'], defaultValue: 'Internal', group: 'Link', hint: 'External = another website (opens in a new tab).' },
      { name: 'LinkText', label: 'Button text', kind: 'text', group: 'Link', hint: 'e.g. "Learn More". Leave empty for the default.' },
      NEW_TAB,
      ORDER,
      ACTIVE,
      START,
      END
    ]
  },
  {
    key: 'news',
    list: 'TH_TravelNews',
    label: 'News & articles',
    description: '"Travel News & Articles" on Home, the All News page and each article page.',
    titleLabel: 'Headline',
    titleRequired: true,
    columns: ['PublishDate', 'Category', 'LinkType'],
    orderField: 'PublishDate',
    orderDescending: true,
    subtitleField: 'Category',
    fields: [
      { name: 'PublishDate', label: 'Publish date', kind: 'date', required: true, group: 'Content', hint: 'Newest articles show first.' },
      { name: 'Category', label: 'Category', kind: 'text', group: 'Content', hint: 'Short label used as a badge and filter, e.g. "Announcement", "Policy Update", "Travel Advisory".' },
      { name: 'Description', label: 'Summary', kind: 'note', required: true, group: 'Content', hint: 'One or two sentences. Shown on the cards and as the introduction of the article.' },
      {
        name: 'ArticleBody',
        label: 'Full article',
        kind: 'rich',
        group: 'Content',
        hint: 'The article page content. Use the toolbar for headings, bold, lists, links and quotes; insert pictures anywhere in the text with the picture button. Paste from Word is cleaned up automatically. Leave empty for a summary-only item.'
      },
      { name: 'ImageUrl', label: 'Main picture', kind: 'image', group: 'Content', hint: `${IMAGE_HINT} Best size: 1600 × 900 px (16:9).` },
      {
        name: 'LinkType',
        label: 'Where the article opens',
        kind: 'choice',
        choices: ['Internal', 'External', 'OnPremReference'],
        defaultValue: 'Internal',
        group: 'Link',
        hint: 'Internal = the article page inside Travel Hub (uses "Full article"). External = another website in a new tab. OnPremReference = the legacy SharePoint site.'
      },
      { name: 'TargetUrl', label: 'Article link', kind: 'url', group: 'Link', hint: 'Required for External / OnPremReference. For Internal, optional "Source page" button on the article page.' },
      { name: 'IsFeatured', label: 'Feature as the lead story', kind: 'bool', group: 'Display', hint: 'The featured article shows big at the top of the news card.' },
      NEW_TAB,
      ORDER,
      ACTIVE
    ]
  },
  {
    key: 'events',
    list: 'TH_TravelEvents',
    label: 'Events',
    description: '"Upcoming Events" on Home (next 3), the All Events page and each event page.',
    titleLabel: 'Event name',
    titleRequired: true,
    columns: ['EventDate', 'StartTime', 'Location'],
    orderField: 'EventDate',
    orderDescending: true,
    subtitleField: 'Location',
    fields: [
      { name: 'EventDate', label: 'Date', kind: 'date', required: true, group: 'When & where' },
      { name: 'StartTime', label: 'Start time', kind: 'text', group: 'When & where', hint: '24-hour time, e.g. 09:00 (needed for "Add to calendar").', placeholder: '09:00' },
      { name: 'EndTime', label: 'End time', kind: 'text', group: 'When & where', hint: 'e.g. 11:30', placeholder: '11:30' },
      { name: 'Location', label: 'Location', kind: 'text', group: 'When & where', hint: 'e.g. "KAFD Office, Level 12 - Training Room" or "Microsoft Teams".' },
      { name: 'Category', label: 'Category', kind: 'text', group: 'Content', hint: 'Short badge and filter label, e.g. "Workshop", "Webinar", "Town Hall".' },
      { name: 'Description', label: 'Summary', kind: 'note', group: 'Content', hint: 'One or two sentences for the cards.' },
      { name: 'EventDetails', label: 'Full details', kind: 'rich', group: 'Content', hint: 'The event page content: agenda, speakers, what to bring... Pictures can be placed anywhere.' },
      { name: 'ImageUrl', label: 'Picture', kind: 'image', group: 'Content', hint: `${IMAGE_HINT} Best size: 1600 × 900 px (16:9).` },
      { name: 'RegistrationUrl', label: 'Registration link', kind: 'url', group: 'Content', hint: 'Optional. Shows a "Register" button (e.g. a Microsoft Forms link).' },
      ORDER,
      ACTIVE
    ]
  },
  {
    key: 'tips',
    list: 'TH_TravelTips',
    label: 'Travel tips',
    description: '"Travel Tips & Insights" on the Home page.',
    titleLabel: 'Tip',
    titleRequired: true,
    titleHint: 'The tip itself, one short sentence.',
    columns: ['Icon', 'Category'],
    orderField: 'DisplayOrder',
    fields: [
      { name: 'Description', label: 'Extra detail', kind: 'note', hint: 'Optional smaller line under the tip.' },
      { name: 'Icon', label: 'Icon', kind: 'icon', hint: ICON_HINT },
      { name: 'Category', label: 'Category', kind: 'text' },
      { name: 'LinkUrl', label: 'Link', kind: 'url', hint: 'Optional "read more" link (opens in a new tab).' },
      ORDER,
      ACTIVE
    ]
  },
  {
    key: 'pulse',
    list: 'TH_QuickPulseQuestions',
    label: 'Quick Pulse questions',
    description: 'The one-click survey on Home. Add the answer options with the "Answers" button.',
    titleLabel: 'Question',
    titleRequired: true,
    columns: ['StartDate', 'EndDate'],
    fields: [
      { name: 'AllowComments', label: 'Allow a comment', kind: 'bool', defaultValue: true },
      { name: 'OneResponsePerUser', label: 'One answer per person', kind: 'bool', defaultValue: true },
      ACTIVE,
      START,
      END
    ],
    children: [{ label: 'Answers', listKey: 'pulseOptions', parentField: 'QuestionId' }]
  },
  {
    key: 'pulseOptions',
    list: 'TH_QuickPulseOptions',
    label: 'Answer options',
    description: 'The answer buttons of a Quick Pulse question.',
    titleLabel: 'Answer text',
    titleRequired: true,
    childOnly: true,
    columns: ['OptionValue', 'Icon'],
    orderField: 'DisplayOrder',
    fields: [
      { name: 'Icon', label: 'Icon', kind: 'icon', hint: 'e.g. Emoji2, EmojiNeutral, EmojiDisappointed' },
      { name: 'OptionValue', label: 'Score', kind: 'number', min: 0, max: 100, hint: 'Number used in the results (0-100), e.g. 100 = very happy.' },
      ORDER,
      ACTIVE
    ]
  },
  {
    key: 'testimonials',
    list: 'TH_TravelerTestimonials',
    label: 'Traveller stories',
    description: '"What our travellers say" carousel and the All Stories page.',
    titleLabel: 'Person name',
    titleRequired: true,
    columns: ['Rating', 'Department'],
    orderField: 'DisplayOrder',
    fields: [
      { name: 'Comment', label: 'Their words', kind: 'note', required: true },
      { name: 'Rating', label: 'Stars (1-5)', kind: 'number', min: 1, max: 5 },
      { name: 'ProfileImage', label: 'Photo', kind: 'image', hint: 'Square photo, at least 400 × 400 px.' },
      { name: 'Designation', label: 'Job title', kind: 'text' },
      { name: 'Department', label: 'Department', kind: 'text' },
      { name: 'Location', label: 'Location', kind: 'text' },
      { name: 'PersonInfoLine', label: 'Custom info line', kind: 'text', hint: 'Optional - replaces the "Job title - Location" line.' },
      { name: 'Category', label: 'Category', kind: 'text' },
      ORDER,
      ACTIVE
    ]
  },
  {
    key: 'spend',
    list: 'TH_DepartmentTravelSpend',
    label: 'Department travel spend',
    description: 'Figures and the Power BI report on the Travel Insights card (visible to the spend viewers group only).',
    titleLabel: 'Department',
    titleRequired: true,
    columns: ['Period', 'TotalSpend'],
    fields: [
      { name: 'Period', label: 'Period', kind: 'text', hint: 'e.g. "Q3 2026" or "Jan - Sep 2026".' },
      { name: 'Currency', label: 'Currency code', kind: 'text', hint: '3-letter code, e.g. SAR', placeholder: 'SAR' },
      { name: 'TotalSpend', label: 'Total', kind: 'number' },
      { name: 'AirSpend', label: 'Air', kind: 'number' },
      { name: 'HotelSpend', label: 'Hotel', kind: 'number' },
      { name: 'GroundTransportSpend', label: 'Ground transport', kind: 'number' },
      { name: 'BookingSpend', label: 'Booking fees', kind: 'number' },
      {
        name: 'DashboardUrl',
        label: 'Power BI report link',
        kind: 'url',
        hint: 'Paste the report link from Power BI (the address bar, or File > Embed report > SharePoint Online). Travel Hub converts it to the secure embed form automatically, so viewers are signed in with their own account.'
      },
      ACTIVE
    ]
  },
  {
    key: 'green',
    list: 'TH_GreenTravel',
    label: 'Green travel',
    description: 'The Green Travel card in Travel Insights and its detail page (only the active item is shown).',
    titleLabel: 'Title',
    titleRequired: true,
    columns: ['Subtitle'],
    fields: [
      { name: 'Subtitle', label: 'Subtitle', kind: 'text' },
      { name: 'Description', label: 'Description', kind: 'note' },
      {
        name: 'Points',
        label: 'Key points',
        kind: 'lines',
        hint: 'One point per line. The first three show as chips on the Home card. Start a line with **Heading:** to give it a bold heading on the detail page.',
        example: '**Choose rail:** Up to 80% lower emissions than flying\n**Combine trips:** One journey instead of two'
      },
      { name: 'ImageUrl', label: 'Picture', kind: 'image', hint: `${IMAGE_HINT} The picture fills the whole card, with the text over its lower part - choose a calm photo. Best size: 1200 × 900 px.` },
      { name: 'LinkUrl', label: 'Link', kind: 'url', hint: 'Optional website (new tab). Empty = opens the Green Travel detail page.' },
      { name: 'LinkText', label: 'Link text', kind: 'text', placeholder: 'Explore Green Travel' },
      ACTIVE
    ]
  },
  {
    key: 'team',
    list: 'TH_TravelTeam',
    label: 'Travel team',
    description: '"Meet the Travel Team" on Home and the All Team Members page.',
    titleLabel: 'Name',
    titleRequired: true,
    columns: ['Designation', 'Location'],
    orderField: 'DisplayOrder',
    subtitleField: 'Designation',
    fields: [
      { name: 'Designation', label: 'Job title', kind: 'text' },
      { name: 'Department', label: 'Department', kind: 'text' },
      { name: 'Specialization', label: 'Speciality', kind: 'text', hint: 'Shown instead of the department, e.g. "Visa & Immigration".' },
      {
        name: 'ProfileImage',
        label: 'Photo',
        kind: 'image',
        hint: 'Upload the ORIGINAL photo (portrait, at least 600 × 800 px). Do not paste a thumbnail/preview link - Travel Hub also upgrades SharePoint profile-photo links to the large size automatically.'
      },
      { name: 'Email', label: 'Email', kind: 'text', placeholder: 'name@redseaglobal.com' },
      { name: 'Phone', label: 'Phone', kind: 'text', placeholder: '+966 11 000 0000' },
      { name: 'Location', label: 'Location', kind: 'text' },
      ORDER,
      ACTIVE
    ]
  },

  // ---------------------------------------------------------------- PAGES
  {
    key: 'pages',
    list: 'TH_PolicyPages',
    label: 'Pages',
    description:
      'Every list-driven page (Travel Policy, Business Travel, Personal Travel Offers, Meetings & Events, SAP Concur, Catering...). Open "Sections" to build the page content.',
    titleLabel: 'Page name',
    titleRequired: true,
    titleHint: 'Used in the breadcrumb, e.g. "SAP Concur".',
    columns: ['Slug', 'ParentTitle'],
    orderField: 'DisplayOrder',
    subtitleField: 'Slug',
    fields: [
      {
        name: 'Slug',
        label: 'Page address (slug)',
        kind: 'text',
        required: true,
        group: 'Page',
        hint: 'Short unique name used in links: lowercase letters, numbers and dashes only, e.g. "sap-concur". Changing it breaks existing links to the page.'
      },
      { name: 'ParentSlug', label: 'Parent page', kind: 'slug', group: 'Page', hint: 'For a sub-page: the page it belongs under (breadcrumb "Home > Parent > This page").' },
      { name: 'ParentTitle', label: 'Parent page name', kind: 'text', group: 'Page', hint: 'The parent page name as shown in the breadcrumb.' },
      { name: 'ParentSectionLabel', label: 'Extra breadcrumb label', kind: 'text', group: 'Page', hint: 'Optional, non-clickable, between parent and this page, e.g. "Explore Policy Information".' },
      { name: 'HeroEyebrow', label: 'Small label above the title', kind: 'text', group: 'Banner (top of page)', hint: 'e.g. "SAP Concur" or "TRAVEL POLICY".' },
      { name: 'HeroTitle', label: 'Banner title', kind: 'text', group: 'Banner (top of page)' },
      { name: 'HeroSubtitle', label: 'Banner subtitle', kind: 'text', group: 'Banner (top of page)' },
      { name: 'HeroDescription', label: 'Banner description', kind: 'note', group: 'Banner (top of page)' },
      {
        name: 'HeroImageUrl',
        label: 'Banner picture',
        kind: 'image',
        group: 'Banner (top of page)',
        hint: `${IMAGE_HINT} The picture sits on the right of the banner and is sized to its own shape automatically. Best size: 1600 × 600 px; keep the subject in the centre or right.`
      },
      { name: 'HeroLogoUrl', label: 'Logo above the title', kind: 'image', group: 'Banner (top of page)', hint: 'Optional partner logo (PNG with transparent background).' },
      { name: 'HeroIcon', label: 'Banner icon', kind: 'icon', group: 'Banner (top of page)', hint: ICON_HINT },
      { name: 'HeroTagline', label: 'Handwritten tagline', kind: 'lines', group: 'Banner (top of page)', hint: 'Script text over the picture, one short phrase per line.', example: 'People Closer\nA Brighter Tomorrow' },
      {
        name: 'HeroHighlights',
        label: 'Badges under the description',
        kind: 'lines',
        group: 'Banner (top of page)',
        hint: 'One badge per line: Icon|Text',
        example: 'Diamond|Premium Quality\nGroup|Tailored for RSG Events'
      },
      { name: 'HeroLinkText', label: 'Button 1 text', kind: 'text', group: 'Banner buttons' },
      { name: 'HeroLinkTargetSlug', label: 'Button 1 opens page', kind: 'slug', group: 'Banner buttons', hint: SLUG_HINT },
      { name: 'HeroLinkUrl', label: 'Button 1 link', kind: 'url', group: 'Banner buttons' },
      { name: 'HeroLink2Text', label: 'Button 2 text', kind: 'text', group: 'Banner buttons' },
      { name: 'HeroLink2TargetSlug', label: 'Button 2 opens page', kind: 'slug', group: 'Banner buttons', hint: SLUG_HINT },
      { name: 'HeroLink2Url', label: 'Button 2 link', kind: 'url', group: 'Banner buttons' },
      { name: 'InfoBannerText', label: 'Info strip under the banner', kind: 'note', group: 'Notes', hint: 'Optional blue info line under the banner.' },
      { name: 'NoteBannerText', label: 'Note at the end of the content', kind: 'note', group: 'Notes', hint: 'Optional, e.g. "Prices are in SAR and exclude VAT."' },
      { name: 'CtaTitle', label: 'Call-to-action title', kind: 'text', group: 'Call to action', hint: 'e.g. "Need to Book Catering Services?"' },
      { name: 'CtaDescription', label: 'Call-to-action text', kind: 'note', group: 'Call to action' },
      { name: 'CtaLinkText', label: 'Secondary link text', kind: 'text', group: 'Call to action' },
      { name: 'CtaLinkUrl', label: 'Secondary link', kind: 'url', group: 'Call to action' },
      { name: 'CtaPrimaryText', label: 'Main button text', kind: 'text', group: 'Call to action' },
      { name: 'CtaPrimaryUrl', label: 'Main button link', kind: 'url', group: 'Call to action' },
      { name: 'NeedHelpTitle', label: '"Need help" title', kind: 'text', group: 'Need help', hint: 'e.g. "Need Help? Contact Travel Services". Leave empty to hide the block.' },
      { name: 'NeedHelpSupportLabel', label: '"Need help" small label', kind: 'text', group: 'Need help' },
      { name: 'NeedHelpDescription', label: '"Need help" text', kind: 'note', group: 'Need help' },
      { name: 'NeedHelpEmail', label: '"Need help" email', kind: 'text', group: 'Need help', placeholder: 'TravelServices@RedSeaGlobal.com' },
      { name: 'SuggestedQuestions', label: 'Policy assistant questions', kind: 'lines', group: 'Policy assistant', hint: 'Optional example questions, one per line. Shows the "Ask Our Policy Assistant" block.' },
      { name: 'AssistantLinkText', label: 'Assistant button text', kind: 'text', group: 'Policy assistant' },
      { name: 'AssistantLinkUrl', label: 'Assistant link', kind: 'url', group: 'Policy assistant', hint: 'Empty = the site-wide assistant link.' },
      { name: 'ClosingBannerTitle', label: 'Closing banner title', kind: 'text', group: 'Closing banner', hint: 'The photo band at the bottom of the page. Leave empty to hide it.' },
      { name: 'ClosingBannerDescription', label: 'Closing banner text', kind: 'note', group: 'Closing banner' },
      { name: 'ClosingBadges', label: 'Closing banner badges', kind: 'lines', group: 'Closing banner', example: 'Our People\nOur Planet\nOur Future' },
      { name: 'ClosingBannerImageUrl', label: 'Closing banner picture', kind: 'image', group: 'Closing banner', hint: 'Wide photo, 1600 × 400 px.' },
      ORDER,
      ACTIVE
    ],
    children: [
      { label: 'Sections', listKey: 'sections', parentField: 'PageId', extraFilter: 'TabIdId eq null', hint: 'The content blocks of the page, top to bottom.' },
      {
        label: 'Help steps',
        listKey: 'cards',
        parentField: 'PageId',
        extraFilter: 'SectionIdId eq null and TabIdId eq null',
        hint: 'Optional numbered "Ask HR" steps shown under the Need Help block.',
        defaults: { Kind: 'HelpStep' }
      }
    ]
  },
  {
    key: 'sections',
    list: 'TH_PolicySections',
    label: 'Sections',
    description: 'One content block of a page. The Layout decides how it looks; its cards / tables / tabs hold the content.',
    titleLabel: 'Section title',
    titleHint: 'Shown as the heading (leave empty for no heading). Start with "1. " to show a number badge.',
    childOnly: true,
    columns: ['Layout', 'CardStyle', 'Width'],
    orderField: 'DisplayOrder',
    subtitleField: 'Layout',
    fields: [
      {
        name: 'Layout',
        label: 'Layout',
        kind: 'choice',
        required: true,
        defaultValue: 'ImageCards',
        group: 'Layout',
        choices: [
          'ImageCards',
          'CardsGrid',
          'Feature',
          'Split',
          'ProcessSteps',
          'NumberedSteps',
          'Table',
          'Tabs',
          'Faq',
          'Callout',
          'Paragraph',
          'Checklist',
          'Banner',
          'LinksList',
          'ImageBlock',
          'PriceList',
          'Gallery',
          'Search',
          'JumpLinks'
        ],
        hint:
          'ImageCards = photo/icon cards (pick a Card style). CardsGrid = icon + text cards. Feature = one rich panel (Body text, optional photo, figure tiles). Split = parts side by side. ProcessSteps = steps with arrows. Table / Tabs / Faq as named. Callout = one highlighted note. PriceList = partner price panels. Gallery = photo strip with popup. JumpLinks = big buttons that scroll to other sections.'
      },
      {
        name: 'CardStyle',
        label: 'Card style',
        kind: 'choice',
        defaultValue: 'Default',
        group: 'Layout',
        choices: ['Default', 'ImageTop', 'ImageTile', 'ImageBanner', 'ImageLeft', 'ImageMenu', 'IconHeader', 'IconMedia', 'Stacked'],
        hint:
          'For ImageCards: ImageTop (photo, title, text, button), ImageTile (compact photo + title), ImageBanner (big photo with text on it), ImageLeft (photo left, text right), ImageMenu (menu card with ribbon and price). For CardsGrid: IconHeader / IconMedia. For ProcessSteps: Stacked (boxed columns). Feature: ImageLeft puts the photo on the left.'
      },
      { name: 'CardVariant', label: 'Card variant (CardsGrid)', kind: 'choice', choices: ['Highlight', 'Category', 'Info'], defaultValue: 'Highlight', group: 'Layout', hint: 'CardsGrid only. Highlight = icon, title, text and points (most used).' },
      { name: 'Columns', label: 'Cards per row', kind: 'number', min: 1, max: 6, group: 'Layout', hint: 'Desktop columns (1-6). Empty = automatic. Phones always show one per row.' },
      {
        name: 'Width',
        label: 'Section width',
        kind: 'choice',
        choices: ['Full', 'Half', 'OneThird', 'TwoThirds'],
        defaultValue: 'Full',
        group: 'Layout',
        hint: 'Sections next to each other share a row: Half + Half, or TwoThirds + OneThird. Sections in one row get the same height. A JumpLinks section with Half width sits on top of the next section in its column.'
      },
      { name: 'SectionStyle', label: 'Container', kind: 'choice', choices: ['Plain', 'Card', 'Tinted'], defaultValue: 'Plain', group: 'Look', hint: 'Plain = no box. Card = white box. Tinted = soft coloured box (pick a Theme).' },
      { name: 'Theme', label: 'Theme colour', kind: 'choice', choices: BRAND_THEMES, group: 'Look', hint: 'Colour of a Tinted container and its accents.' },
      { name: 'TintCards', label: 'Tint each card with its own colour', kind: 'bool', group: 'Look', hint: 'CardsGrid only.' },
      { name: 'Icon', label: 'Section icon', kind: 'icon', group: 'Look', hint: `${ICON_HINT} Shown before the title (Callout: the note icon).` },
      { name: 'Subtitle', label: 'Subtitle', kind: 'note', group: 'Content', hint: 'Small line under the title. Search layout: the search box placeholder.' },
      {
        name: 'Body',
        label: 'Body text',
        kind: 'note',
        group: 'Content',
        hint: `Feature / Paragraph / Callout: the main text. ${BODY_HINT} For other layouts this is a short note at the right of the heading.`,
        example: 'First paragraph.\n- A bullet point\n@CheckMark|A line with an icon\n!!Tip:|A highlighted note'
      },
      { name: 'ImageUrl', label: 'Section picture', kind: 'image', group: 'Content', hint: `Feature / ImageBlock only. ${IMAGE_HINT}` },
      { name: 'LinkText', label: 'Header link text', kind: 'text', group: 'Header link', hint: 'Optional link at the right of the heading, e.g. "View All Offers". Feature: a button under the text.' },
      { name: 'TargetSlug', label: 'Header link opens page', kind: 'slug', group: 'Header link', hint: SLUG_HINT },
      { name: 'LinkUrl', label: 'Header link URL', kind: 'url', group: 'Header link', hint: 'Search layout: the search address, with {query} where the typed words go.' },
      {
        name: 'OfferCollection',
        label: 'Show offers from collection',
        kind: 'text',
        group: 'Offers',
        hint: 'ImageCards only: also show the active "Offers & hotels" items of this Collection, e.g. "Featured Personal Offers", "Riyadh Partnered Hotels".'
      },
      { name: 'HideTitle', label: 'Hide the title', kind: 'bool', group: 'Look' },
      ORDER,
      ACTIVE
    ],
    children: [
      { label: 'Cards', listKey: 'cards', parentField: 'SectionId', hint: 'The cards / steps / parts / questions / photos of this section.' },
      { label: 'Tables', listKey: 'tables', parentField: 'SectionId', hint: 'Table layout: one or more tables.' },
      { label: 'Tabs', listKey: 'tabs', parentField: 'SectionId', hint: 'Tabs layout: one row per tab.' }
    ]
  },
  {
    key: 'cards',
    list: 'TH_PolicyCards',
    label: 'Cards',
    description: 'One card, step, question, photo or button inside a section (or tab).',
    titleLabel: 'Title',
    titleHint: 'Card heading / step name / FAQ question / button text. Start with "2. " for a number badge. Leave empty or write [Note] for an untitled card.',
    childOnly: true,
    columns: ['Kind', 'Icon', 'Value'],
    orderField: 'DisplayOrder',
    subtitleField: 'Kind',
    fields: [
      {
        name: 'Kind',
        label: 'Card type',
        kind: 'choice',
        choices: ['Info', 'Highlight', 'HelpStep', 'Rule', 'Category', 'LinkItem'],
        defaultValue: 'Info',
        group: 'Card',
        hint: 'Info for most cards. HelpStep for process steps, Rule for numbered rules, LinkItem for pill links / search quick links, Highlight for CardsGrid cards.'
      },
      { name: 'Number', label: 'Number', kind: 'number', group: 'Card', hint: 'Steps / rules: the number in the badge (1, 2, 3...).' },
      { name: 'Subtitle', label: 'Subtitle', kind: 'text', group: 'Card', hint: 'Small line under the title, e.g. "Riyadh, KSA" or "30 to 40 guests daily".' },
      { name: 'Badge', label: 'Badge / ribbon', kind: 'text', group: 'Card', hint: 'Pill over the photo (e.g. "Special Offer") or the ribbon of a menu card (e.g. "Menu 1").' },
      { name: 'Description', label: 'Description', kind: 'note', group: 'Card', hint: 'Main text. FAQ: the answer. PriceList: the note under the panel. Use **bold**; emails and links become clickable.' },
      { name: 'SubPoints', label: 'Points', kind: 'lines', group: 'Card', hint: `${SUBPOINTS_HINT} PriceList cards: one price row per line as Icon|Label|Price|Note.`, example: SUBPOINTS_EXAMPLE },
      { name: 'ImageUrl', label: 'Picture', kind: 'image', group: 'Picture & icon', hint: `${IMAGE_HINT} Cards: 800 × 500 px. Banners: 1400 × 600 px. Every card in a section gets the same frame.` },
      { name: 'Icon', label: 'Icon', kind: 'icon', group: 'Picture & icon', hint: ICON_HINT },
      { name: 'IconColor', label: 'Colour', kind: 'color', group: 'Picture & icon', hint: COLOR_HINT },
      { name: 'ValueLabel', label: 'Figure caption (above)', kind: 'text', group: 'Price / figure', hint: 'e.g. "Starting From" / "Up to".' },
      { name: 'Value', label: 'Figure', kind: 'text', group: 'Price / figure', hint: 'Highlighted figure, e.g. "SAR 5,999" / "48 hours".' },
      { name: 'ValueNote', label: 'Figure caption (below)', kind: 'text', group: 'Price / figure', hint: 'e.g. "per person".' },
      { name: 'LinkText', label: 'Button text', kind: 'text', group: 'Link', hint: 'e.g. "View Details". The whole card is clickable when it has a link.' },
      {
        name: 'TargetSlug',
        label: 'Opens page / jumps to section',
        kind: 'slug',
        group: 'Link',
        hint: `${SLUG_HINT} JumpLinks buttons: type # and the title of the section to scroll to, e.g. "#Coffee Break Menus".`
      },
      { name: 'LinkUrl', label: 'Link URL', kind: 'url', group: 'Link', hint: 'Website, document or mailto: link.' },
      NEW_TAB,
      { name: 'PopupContent', label: 'Popup files', kind: 'lines', group: 'Link', hint: POPUP_HINT, example: POPUP_EXAMPLE },
      ORDER,
      ACTIVE
    ]
  },
  {
    key: 'tables',
    list: 'TH_PolicyTables',
    label: 'Tables',
    description: 'A table inside a Table section or a tab. Add its rows with the "Rows" button.',
    titleLabel: 'Table title',
    titleHint: 'Optional heading above the table.',
    childOnly: true,
    columns: ['ColumnHeaders'],
    orderField: 'DisplayOrder',
    fields: [
      {
        name: 'ColumnHeaders',
        label: 'Column headings',
        kind: 'lines',
        required: true,
        hint: 'One heading per line, left to right. Add an icon with Icon::Text.',
        example: 'Suitcase::Job Grade\nClock::Flights up to 6 hours\nClock::Flights over 6 hours'
      },
      ORDER,
      ACTIVE
    ],
    children: [{ label: 'Rows', listKey: 'tableRows', parentField: 'TableId' }]
  },
  {
    key: 'tableRows',
    list: 'TH_PolicyTableRows',
    label: 'Table rows',
    description: 'One row of a table.',
    titleLabel: 'Row name (not shown)',
    titleHint: 'Only for you to recognise the row, e.g. "Grades 12-14".',
    childOnly: true,
    columns: ['CellValues'],
    orderField: 'DisplayOrder',
    fields: [
      {
        name: 'CellValues',
        label: 'Cells',
        kind: 'lines',
        required: true,
        hint: 'One cell per line, in the same order as the column headings. Use **bold** for emphasis.',
        example: 'Grades 12 – 14\nBusiness Class\nBusiness Class'
      },
      ORDER
    ]
  },
  {
    key: 'tabs',
    list: 'TH_PolicyTabs',
    label: 'Tabs',
    description: 'One tab of a Tabs section. Its content: cards, tables, or whole sections.',
    titleLabel: 'Tab label',
    titleRequired: true,
    childOnly: true,
    columns: ['Subtitle', 'Icon'],
    orderField: 'DisplayOrder',
    fields: [
      { name: 'Subtitle', label: 'Small line under the label', kind: 'text', hint: 'e.g. "Less than 30 days".' },
      { name: 'Description', label: 'Description', kind: 'note', hint: 'Shown on rich tab buttons (when an icon is set).' },
      { name: 'Icon', label: 'Icon', kind: 'icon', hint: `Optional. With an icon the tabs become large selector cards. ${ICON_HINT}` },
      ORDER,
      ACTIVE
    ],
    children: [
      {
        label: 'Sections',
        listKey: 'sections',
        parentField: 'TabId',
        inheritPageId: true,
        hint: 'Whole sections inside the tab (banner, card grid...). When used, they replace the cards/tables below.'
      },
      { label: 'Cards', listKey: 'cards', parentField: 'TabId' },
      { label: 'Tables', listKey: 'tables', parentField: 'TabId' }
    ]
  },
  {
    key: 'offers',
    list: 'TH_Offers',
    label: 'Offers & hotels',
    description: 'Personal travel offers, offer categories and partnered hotels - shown by sections that name their Collection.',
    titleLabel: 'Offer / hotel name',
    titleRequired: true,
    columns: ['Collection', 'Value', 'ValidTo'],
    orderField: 'DisplayOrder',
    subtitleField: 'Collection',
    fields: [
      {
        name: 'Collection',
        label: 'Collection',
        kind: 'choiceFillIn',
        choices: ['Featured Personal Offers', 'Explore Personal Offers', 'Riyadh Partnered Hotels', 'Jeddah Partnered Hotels'],
        required: true,
        group: 'Card',
        hint: 'Which group of cards this belongs to. A page section shows a collection via its "Show offers from collection" field. You can type a new name.'
      },
      { name: 'Subtitle', label: 'Subtitle', kind: 'text', group: 'Card', hint: 'e.g. "5 Nights Holiday Package" or "Riyadh, KSA".' },
      { name: 'Badge', label: 'Badge', kind: 'text', group: 'Card', hint: 'e.g. "Special Offer".' },
      { name: 'Summary', label: 'Card text', kind: 'note', group: 'Card' },
      { name: 'ImageUrl', label: 'Card picture', kind: 'image', group: 'Card', hint: `${IMAGE_HINT} 800 × 500 px. (Pictures added in the SharePoint form's "Card image" column also work.)` },
      { name: 'LogoUrl', label: 'Partner logo', kind: 'image', group: 'Card', hint: 'Optional, PNG with transparent background.' },
      { name: 'Icon', label: 'Icon', kind: 'icon', group: 'Card', hint: ICON_HINT },
      { name: 'IconColor', label: 'Colour', kind: 'color', group: 'Card', hint: COLOR_HINT },
      { name: 'ValueLabel', label: 'Price caption (above)', kind: 'text', group: 'Price', placeholder: 'Starting From' },
      { name: 'Value', label: 'Price', kind: 'text', group: 'Price', placeholder: 'SAR 5,999' },
      { name: 'ValueNote', label: 'Price caption (below)', kind: 'text', group: 'Price', placeholder: 'per person' },
      { name: 'Details', label: 'Details', kind: 'lines', group: 'Details page', hint: 'Paragraphs of the offer details page, one per line.' },
      { name: 'Inclusions', label: "What's included", kind: 'lines', group: 'Details page', hint: 'One item per line (shown with check marks).' },
      { name: 'Terms', label: 'Terms & conditions', kind: 'lines', group: 'Details page', hint: 'One condition per line.' },
      { name: 'Partner', label: 'Partner name', kind: 'text', group: 'Details page' },
      { name: 'Location', label: 'Location', kind: 'text', group: 'Details page' },
      { name: 'ContactEmail', label: 'Contact email', kind: 'text', group: 'Details page' },
      { name: 'ContactPhone', label: 'Contact phone', kind: 'text', group: 'Details page' },
      { name: 'CtaText', label: 'Main button text', kind: 'text', group: 'Details page', placeholder: 'View Offer' },
      {
        name: 'ClickAction',
        label: 'When the card is clicked',
        kind: 'choice',
        choices: ['Auto', 'Details Page', 'Popup', 'Link', 'None'],
        defaultValue: 'Auto',
        group: 'Link',
        hint: 'Auto = popup when the item has attachments or popup files, details page when it has Details/Inclusions, otherwise the link.'
      },
      { name: 'LinkText', label: 'Card button text', kind: 'text', group: 'Link', placeholder: 'View Details' },
      { name: 'LinkUrl', label: 'Link', kind: 'url', group: 'Link', hint: 'Booking / partner website (opens in a new tab).' },
      { name: 'PopupContent', label: 'Popup files', kind: 'lines', group: 'Link', hint: `${POPUP_HINT} Easier: add the files as attachments in the SharePoint form.`, example: POPUP_EXAMPLE },
      { name: 'ValidFrom', label: 'Valid from', kind: 'date', group: 'Display', hint: 'The card is hidden outside the validity dates.' },
      { name: 'ValidTo', label: 'Valid until', kind: 'date', group: 'Display' },
      ORDER,
      ACTIVE
    ]
  },
  {
    key: 'btSteps',
    list: 'TH_BusinessTravelSteps',
    label: 'Business Travel steps (classic)',
    description: 'Only used when there is no "business-travel" page in Pages: the request-to-expense steps.',
    titleLabel: 'Step title',
    titleRequired: true,
    columns: ['Number'],
    orderField: 'DisplayOrder',
    fields: [
      { name: 'Number', label: 'Number', kind: 'number' },
      { name: 'Description', label: 'Description', kind: 'note' },
      { name: 'BackgroundColor', label: 'Colour', kind: 'color', hint: COLOR_HINT },
      ORDER,
      ACTIVE
    ]
  },
  {
    key: 'btInfo',
    list: 'TH_BusinessTravelInfoCards',
    label: 'Business Travel info cards (classic)',
    description: 'Only used when there is no "business-travel" page in Pages.',
    titleLabel: 'Title',
    titleRequired: true,
    columns: ['Icon', 'TargetSlug'],
    orderField: 'DisplayOrder',
    fields: [
      { name: 'Description', label: 'Description', kind: 'note' },
      { name: 'Icon', label: 'Icon', kind: 'icon', hint: ICON_HINT },
      { name: 'TargetSlug', label: 'Opens page', kind: 'slug', hint: SLUG_HINT },
      { name: 'LinkUrl', label: 'Link URL', kind: 'url' },
      { name: 'LinkText', label: 'Link text', kind: 'text' },
      NEW_TAB,
      ORDER,
      ACTIVE
    ]
  },

  // ----------------------------------------------------------------- SITE
  {
    key: 'nav',
    list: 'TH_GlobalNavigation',
    label: 'Extra navigation tabs',
    description: 'Additional tabs in the top navigation (the service tabs come from "Travel services").',
    titleLabel: 'Tab text',
    titleRequired: true,
    columns: ['Kind', 'Url'],
    orderField: 'DisplayOrder',
    fields: [
      { name: 'Url', label: 'Link', kind: 'url', required: true },
      { name: 'Kind', label: 'Type', kind: 'choice', choices: ['App', 'External'], defaultValue: 'App', hint: 'External opens in a new tab.' },
      ORDER,
      ACTIVE
    ]
  },
  {
    key: 'footerCols',
    list: 'TH_FooterColumns',
    label: 'Footer',
    description: 'Footer columns. Open "Links" to edit the links in a column.',
    titleLabel: 'Column heading',
    titleRequired: true,
    columns: [],
    orderField: 'DisplayOrder',
    fields: [ORDER, ACTIVE],
    children: [{ label: 'Links', listKey: 'footerLinks', parentField: 'ColumnId' }]
  },
  {
    key: 'footerLinks',
    list: 'TH_FooterLinks',
    label: 'Footer links',
    description: 'Links inside a footer column.',
    titleLabel: 'Link text',
    titleRequired: true,
    childOnly: true,
    columns: ['Url'],
    orderField: 'DisplayOrder',
    fields: [{ name: 'Url', label: 'Link', kind: 'url', required: true }, { name: 'Icon', label: 'Icon', kind: 'icon', hint: ICON_HINT }, NEW_TAB, ORDER, ACTIVE]
  },
  {
    key: 'config',
    list: 'TH_SiteConfiguration',
    label: 'Site settings',
    description: 'Site-wide settings (texts, counts, links, group names, on/off switches). Each setting is one key. See docs/CONFIGURATION.md.',
    titleLabel: 'Setting key',
    titleRequired: true,
    titleHint: 'The exact key, e.g. hero.aspectRatio, admin.group, updates.news.count. Changing a key name disconnects the setting.',
    columns: ['ConfigValue', 'Category'],
    orderField: 'Title',
    subtitleField: 'Notes',
    fields: [
      {
        name: 'ConfigValue',
        label: 'Value',
        kind: 'note',
        required: true,
        hint: 'Text as it should appear; numbers as digits (e.g. 6); switches as true / false; links as full https:// addresses.'
      },
      { name: 'ValueType', label: 'Value type', kind: 'choice', choices: ['string', 'number', 'boolean', 'json'], defaultValue: 'string' },
      {
        name: 'Category',
        label: 'Category',
        kind: 'choice',
        choices: ['Brand', 'Hero', 'Services', 'BusinessTravel', 'Updates', 'Testimonials', 'QuickPulse', 'Spend', 'Team', 'Footer', 'Dates', 'Sections', 'ViewAll', 'FeatureFlags']
      },
      { name: 'Notes', label: 'Notes', kind: 'note', hint: 'What this setting does - for the next editor.' },
      ACTIVE
    ]
  }
];

export const ADMIN_GROUPS: IAdminGroup[] = [
  { label: 'Home page', icon: 'Home', keys: ['hero', 'services', 'news', 'events', 'tips', 'pulse', 'testimonials', 'spend', 'green', 'team'] },
  { label: 'Pages', icon: 'Page', keys: ['pages', 'offers', 'btSteps', 'btInfo'] },
  { label: 'Site', icon: 'Settings', keys: ['nav', 'footerCols', 'config'] }
];

export function findAdminList(key: string): IAdminList | undefined {
  return ADMIN_LISTS.find((l) => l.key === key);
}

/** OData field name for reading/writing a lookup (`PageId` -> `PageIdId`). */
export function lookupIdField(parentField: string): string {
  return `${parentField}Id`;
}
