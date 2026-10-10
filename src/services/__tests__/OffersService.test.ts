// @microsoft/sp-core-library is stubbed via config/jest.config.json moduleNameMapper.
import { OffersService, attachmentLabel, attachmentsToMedia, resolveOfferAction, thumbnailUrl } from '../OffersService';
import { PolicyService } from '../PolicyService';
import { MemoryCache } from '../base/MemoryCache';
import { Logger } from '../base/Logger';
import type { SharePointService } from '../base/SharePointService';
import type { IOffer } from '../../models';

type Row = Record<string, unknown>;

describe('attachments', () => {
  it('labels files without extension and ordering prefix', () => {
    expect(attachmentLabel('2 - Jeddah City Guide.pdf')).toBe('Jeddah City Guide');
    expect(attachmentLabel('10_Ballroom.jpg')).toBe('Ballroom');
    expect(attachmentLabel('Poster.PNG')).toBe('Poster');
  });

  it('sorts by file name in natural order and detects images / PDFs', () => {
    const media = attachmentsToMedia([
      { FileName: '10 - Last.jpg', ServerRelativeUrl: '/sites/th/Lists/TH_Offers/Attachments/1/10 - Last.jpg' },
      { FileName: '2 - Jeddah.pdf', ServerRelativeUrl: '/sites/th/Lists/TH_Offers/Attachments/1/2 - Jeddah.pdf' },
      { FileName: '1 - Riyadh.pdf', ServerRelativeUrl: '/sites/th/Lists/TH_Offers/Attachments/1/1 - Riyadh.pdf' }
    ]);
    expect(media.map((m) => `${m.label}:${m.kind}`)).toEqual(['Riyadh:document', 'Jeddah:document', 'Last:image']);
  });

  it('reads SharePoint Image (Thumbnail) column values', () => {
    expect(thumbnailUrl('{"serverRelativeUrl":"/sites/th/SiteAssets/x.jpg","fileName":"x.jpg"}')).toBe('/sites/th/SiteAssets/x.jpg');
    expect(thumbnailUrl({ serverRelativeUrl: '/a.png' })).toBe('/a.png');
    expect(thumbnailUrl('not json')).toBeUndefined();
    expect(thumbnailUrl(null)).toBeUndefined();
  });
});

describe('resolveOfferAction', () => {
  it('Auto: details content -> details, files -> popup, else link / none', () => {
    expect(resolveOfferAction('Auto', { files: true, details: true, link: true })).toBe('details');
    expect(resolveOfferAction(null, { files: true, details: false, link: true })).toBe('popup');
    expect(resolveOfferAction('Auto', { files: false, details: false, link: true })).toBe('link');
    expect(resolveOfferAction('', { files: false, details: false, link: false })).toBe('none');
  });

  it('honours an explicit choice when it can', () => {
    expect(resolveOfferAction('Details Page', { files: false, details: false, link: false })).toBe('details');
    expect(resolveOfferAction('Popup', { files: true, details: true, link: true })).toBe('popup');
    expect(resolveOfferAction('Link', { files: true, details: true, link: true })).toBe('link');
    // Popup without files falls back to Auto.
    expect(resolveOfferAction('Popup', { files: false, details: false, link: true })).toBe('link');
  });
});

function fakeSpo(rows: Row[], rejectSelect?: string): SharePointService {
  return {
    getListItems: async ({ select, filter }: { select: string[]; filter?: string }) => {
      if (rejectSelect !== undefined && select.indexOf(rejectSelect) >= 0) {
        throw new Error(`Column '${rejectSelect}' does not exist`);
      }
      const id = /Id eq (\d+)/.exec(filter ?? '');
      // Like SharePoint, text comparisons are case-insensitive.
      return rows.filter((r) => (id !== null ? r.Id === Number(id[1]) : (filter ?? '').toLowerCase().indexOf(`'${String(r.Collection).toLowerCase()}'`) >= 0));
    }
  } as unknown as SharePointService;
}

const ROWS: Row[] = [
  {
    Id: 7, Title: 'Maldives', Collection: 'Featured Personal Offers', Details: 'Line one\nLine two', IconColor: 'Thriving Corals',
    LinkUrl: { Url: 'https://partner.example.com/maldives' }, DisplayOrder: 20,
    AttachmentFiles: [{ FileName: '1 - Gallery.jpg', ServerRelativeUrl: '/sites/th/a/1 - Gallery.jpg' }]
  },
  { Id: 8, Title: 'Baku', Collection: 'Featured Personal Offers', DisplayOrder: 10, ImageUrl: { Url: 'https://x/baku.jpg' }, CardImage: '{"serverRelativeUrl":"/sites/th/img/baku.jpg"}' },
  { Id: 9, Title: 'City Guide', Collection: 'Explore Personal Offers', PopupContent: 'Riyadh | https://x/r.pdf', DisplayOrder: 10 }
];

describe('OffersService', () => {
  it('groups by collection (case-insensitive), orders and maps', async () => {
    const service = new OffersService(fakeSpo(ROWS), new MemoryCache(), new Logger('test'));
    const map = await service.getCollections(['Featured Personal Offers', 'explore personal offers']);
    const featured = map.get('featured personal offers') as IOffer[];
    expect(featured.map((o) => o.title)).toEqual(['Baku', 'Maldives']);
    expect(featured[0].imageUrl).toBe('/sites/th/img/baku.jpg'); // uploaded image wins over ImageUrl
    expect(featured[1].action).toBe('details');
    expect(featured[1].linkIsExternal).toBe(true);
    expect(featured[1].iconColorOn).toBe('#04253c');
    expect(featured[1].files.map((f) => f.kind)).toEqual(['image']);
    const explore = map.get('explore personal offers') as IOffer[];
    expect(explore[0].action).toBe('popup');
  });

  it('falls back when the Image columns are missing', async () => {
    const service = new OffersService(fakeSpo(ROWS, 'CardImage'), new MemoryCache(), new Logger('test'));
    expect((await service.getOffer(8))?.title).toBe('Baku');
  });
});

describe('PolicyService + TH_Offers', () => {
  it('appends a section\'s OfferCollection items as cards with the right action', async () => {
    const lists: Record<string, Row[]> = {
      TH_PolicyPages: [{ Id: 1, Title: 'Personal Travel Offers', Slug: 'personal-travel-offers', IsActive: true }],
      TH_PolicySections: [{ Id: 10, Title: 'Featured', PageIdId: 1, Layout: 'ImageCards', OfferCollection: 'Featured Personal Offers', DisplayOrder: 1, IsActive: true }],
      TH_PolicyTabs: [],
      TH_PolicyCards: [],
      TH_PolicyTables: [],
      TH_PolicyTableRows: []
    };
    const spo = {
      getListItems: async ({ list, filter }: { list: string; filter?: string }) => {
        const rows = lists[list] ?? [];
        const slug = /Slug eq '([^']+)'/.exec(filter ?? '');
        return slug !== null ? rows.filter((r) => r.Slug === slug[1]) : rows;
      }
    } as unknown as SharePointService;
    const offers = new OffersService(fakeSpo(ROWS), new MemoryCache(), new Logger('test'));
    const page = await new PolicyService(spo, new MemoryCache(), new Logger('test'), offers).getPage('personal-travel-offers');
    const cards = page!.sections[0].cards;
    expect(cards.map((c) => c.title)).toEqual(['Baku', 'Maldives']);
    expect(cards[1].offerId).toBe(7);
    expect(cards[1].id).toBeGreaterThan(1000000000);
  });
});
