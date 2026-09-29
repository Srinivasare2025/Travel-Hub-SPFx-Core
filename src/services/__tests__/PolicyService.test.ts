// @microsoft/sp-core-library is stubbed via config/jest.config.json moduleNameMapper.
import { PolicyService } from '../PolicyService';
import { MemoryCache } from '../base/MemoryCache';
import { Logger } from '../base/Logger';
import type { SharePointService } from '../base/SharePointService';

type Row = Record<string, unknown>;

/** Minimal OData `$filter` evaluator for the shapes PolicyService sends. */
function matches(row: Row, filter: string | undefined): boolean {
  if (filter === undefined) {
    return true;
  }
  const js = filter
    .replace(/(\w+) eq ('(?:[^']|'')*'|\d+)/g, (_m, f: string, v: string) =>
      `(r.${f} == ${v.startsWith("'") ? JSON.stringify(v.slice(1, -1)) : v})`
    )
    .replace(/\band\b/g, '&&')
    .replace(/\bor\b/g, '||');
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  return (new Function('r', `return ${js};`) as (r: Row) => boolean)(row);
}

function fakeSpo(lists: Record<string, Row[]>, options: { rejectSelect?: string } = {}): SharePointService {
  return {
    getListItems: async ({ list, select, filter }: { list: string; select?: string[]; filter?: string }) => {
      if (options.rejectSelect !== undefined && select !== undefined && select.indexOf(options.rejectSelect) >= 0) {
        throw new Error(`Column '${options.rejectSelect}' does not exist`);
      }
      // Like SharePoint, return only the $select-ed columns.
      return (lists[list] ?? [])
        .filter((r) => matches(r, filter))
        .map((r) => {
          if (select === undefined) {
            return r;
          }
          const picked: Row = {};
          select.filter((c) => c in r).forEach((c) => {
            picked[c] = r[c];
          });
          return picked;
        });
    }
  } as unknown as SharePointService;
}

const LISTS: Record<string, Row[]> = {
  TH_PolicyPages: [{ Id: 1, Title: 'Travel Entitlement', Slug: 'travel-entitlement', IsActive: true }],
  TH_PolicySections: [
    { Id: 10, Title: 'Select Your Travel Type', PageIdId: 1, Layout: 'Tabs', DisplayOrder: 1, IsActive: true, SectionStyle: 'Card' },
    { Id: 11, Title: 'Business Travel Entitlements', PageIdId: 1, TabIdId: 100, Layout: 'Banner', DisplayOrder: 1, IsActive: true, Theme: 'Blue' },
    { Id: 12, Title: 'Grid', PageIdId: 1, TabIdId: 100, Layout: 'CardsGrid', CardVariant: 'Highlight', DisplayOrder: 2, IsActive: true, HideTitle: true, Columns: 4, CardStyle: 'IconHeader', TintCards: true }
  ],
  TH_PolicyTabs: [{ Id: 100, Title: 'Business Travel', SectionIdId: 10, Icon: 'Airplane', DisplayOrder: 1, IsActive: true }],
  TH_PolicyCards: [
    { Id: 1000, Title: 'Air Travel Entitlement', SectionIdId: 12, Kind: 'Highlight', Icon: 'Airplane', DisplayOrder: 1, IsActive: true },
    { Id: 1001, Title: '[Info 1]', SectionIdId: 10, Kind: 'Info', Icon: null, DisplayOrder: 1, IsActive: true }
  ],
  TH_PolicyTables: [],
  TH_PolicyTableRows: []
};

describe('PolicyService', () => {
  it('nests TabId sections inside their tab and maps the presentation options', async () => {
    const page = await new PolicyService(fakeSpo(LISTS), new MemoryCache(), new Logger('test')).getPage('travel-entitlement');
    expect(page).toBeDefined();
    const sections = page!.sections;
    expect(sections.map((s) => s.id)).toEqual([10]); // nested sections are not top-level
    expect(sections[0].sectionStyle).toBe('card');

    const tab = sections[0].tabs[0];
    expect(tab.sections.map((s) => s.layout)).toEqual(['banner', 'cardsGrid']);
    expect(tab.sections[0].theme).toBe('blue');
    const grid = tab.sections[1];
    expect(grid.title).toBeUndefined(); // HideTitle
    expect(grid.columns).toBe(4);
    expect(grid.cardStyle).toBe('iconHeader');
    expect(grid.tintCards).toBe(true);
    expect(grid.cards[0].iconExplicit).toBe(true);

    // Cards on the tabs section itself (the info bar); [bracketed] title = internal name.
    expect(sections[0].cards[0].title).toBe('');
    expect(sections[0].cards[0].iconExplicit).toBe(false);
  });

  it('maps the newer page / section / card columns (ImageCards, Width, hero links)', async () => {
    const lists: Record<string, Row[]> = {
      TH_PolicyPages: [
        { Id: 2, Title: 'SAP Concur', Slug: 'sap-concur', IsActive: true, HeroStyle: 'Light', HeroEyebrow: 'SAP Concur', HeroLinkText: 'Access', HeroLinkUrl: { Url: 'https://www.concursolutions.com' }, HeroLink2Text: 'Start', HeroLink2TargetSlug: 'Sap-Concur-Plan-Book' }
      ],
      TH_PolicySections: [
        { Id: 20, Title: 'Offers', PageIdId: 2, Layout: 'ImageCards', CardStyle: 'ImageBanner', Width: 'Two Thirds', LinkText: 'View All', TargetSlug: 'offers', DisplayOrder: 1, IsActive: true }
      ],
      TH_PolicyTabs: [],
      TH_PolicyCards: [
        { Id: 200, Title: 'Maldives', SectionIdId: 20, Kind: 'Info', ImageUrl: { Url: 'https://x/img.jpg' }, Badge: 'Special Offer', Value: 'SAR 5,999', ValueLabel: 'Starting From', ValueNote: 'per person', OpenInNewTab: true, DisplayOrder: 1, IsActive: true }
      ],
      TH_PolicyTables: [],
      TH_PolicyTableRows: []
    };
    const page = await new PolicyService(fakeSpo(lists), new MemoryCache(), new Logger('test')).getPage('sap-concur');
    expect(page!.hero.style).toBe('light');
    expect(page!.hero.eyebrow).toBe('SAP Concur');
    expect(page!.hero.links.map((l) => l.targetSlug ?? l.url)).toEqual(['https://www.concursolutions.com', 'sap-concur-plan-book']);
    const section = page!.sections[0];
    expect(section.layout).toBe('imageCards');
    expect(section.cardStyle).toBe('imageBanner');
    expect(section.width).toBe('twoThirds');
    expect(section.targetSlug).toBe('offers');
    const card = section.cards[0];
    expect([card.badge, card.value, card.valueLabel, card.valueNote, card.imageUrl, card.openInNewTab]).toEqual([
      'Special Offer', 'SAR 5,999', 'Starting From', 'per person', 'https://x/img.jpg', true
    ]);
  });

  it('falls back to the legacy columns when the new ones are not provisioned', async () => {
    const page = await new PolicyService(fakeSpo(LISTS, { rejectSelect: 'SectionStyle' }), new MemoryCache(), new Logger('test')).getPage(
      'travel-entitlement'
    );
    expect(page).toBeDefined();
    expect(page!.sections.length).toBeGreaterThan(0);
    expect(page!.sections.every((s) => s.cardStyle === 'default' && s.sectionStyle === 'plain')).toBe(true);
  });
});
