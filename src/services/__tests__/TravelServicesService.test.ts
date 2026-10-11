import { resolveServicePageSlug } from '../TravelServicesService';

const PAGES = [
  { Title: 'Travel Policy', Slug: 'travel-policy', ParentSlug: null },
  { Title: 'Business Travel', Slug: 'business-travel', ParentSlug: null },
  { Title: 'Personal Travel Offers', Slug: 'personal-travel-offers', ParentSlug: null },
  { Title: 'Meetings & Events', Slug: 'meetings-events', ParentSlug: null },
  { Title: 'SAP Concur – Plan & Book', Slug: 'sap-concur-plan-book', ParentSlug: 'sap-concur' },
  { Title: 'SAP Concur', Slug: 'sap-concur', ParentSlug: null }
];

describe('resolveServicePageSlug', () => {
  it('matches the page title exactly, ignoring &/and and plurals', () => {
    expect(resolveServicePageSlug('Meeting & Events', PAGES)).toBe('meetings-events');
    expect(resolveServicePageSlug('SAP Concur', PAGES)).toBe('sap-concur');
  });

  it('matches a page title containing every word of the service title', () => {
    expect(resolveServicePageSlug('Travel Offers', PAGES)).toBe('personal-travel-offers');
    expect(resolveServicePageSlug('Personal Travel', PAGES)).toBe('personal-travel-offers');
  });

  it('prefers a top-level page over a child page', () => {
    const pages = PAGES.filter((p) => p.Slug !== 'sap-concur').concat([{ Title: 'SAP Concur Home', Slug: 'sap-home', ParentSlug: null }]);
    expect(resolveServicePageSlug('SAP Concur', pages)).toBe('sap-home');
  });

  it('never links Travel Policy / Business Travel, or services with no matching page', () => {
    expect(resolveServicePageSlug('Travel Policy', PAGES)).toBeUndefined();
    expect(resolveServicePageSlug('Business Travel', PAGES)).toBeUndefined();
    expect(resolveServicePageSlug('Catering Services', PAGES)).toBeUndefined();
    expect(resolveServicePageSlug('Travel', PAGES)).toBeUndefined();
  });
});
