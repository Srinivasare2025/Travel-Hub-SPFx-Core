/* eslint-disable @typescript-eslint/no-floating-promises -- act() wrappers in tests */
/* eslint-disable @rushstack/pair-react-dom-render-unmount -- unmounted in afterEach */
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import { NavigationContext, ThView } from '../../../../../common/context/NavigationContext';
import { ServiceContext } from '../../../../../common/context/ServiceContext';
import type { IServiceRegistry } from '../../../../../services/IServiceRegistry';
import type { IOffer, IPolicyCard, IPolicySection } from '../../../../../models';
import { SectionFlow } from '../PolicyCardSections';
import { OfferDetailScreen } from '../../OfferDetail/OfferDetailScreen';
import { scrollToTopAndFocus } from '../../scrollToTop';
import { PolicyPageScreen } from '../PolicyPageScreen';
import type { IPolicyPageContent } from '../../../../../models';

let nextId = 1;
function card(partial: Partial<IPolicyCard> = {}): IPolicyCard {
  const id = nextId++;
  return {
    id, kind: 'info', number: undefined, title: `Card ${String(id)}`, description: '', icon: 'Info', iconExplicit: false,
    iconColor: undefined, iconColorOn: undefined, iconColorInk: undefined, subPoints: [], targetSlug: undefined, linkUrl: undefined,
    linkText: undefined, openInNewTab: false, imageUrl: undefined, subtitle: undefined, badge: undefined, value: undefined,
    valueLabel: undefined, valueNote: undefined, popupItems: [], offerId: undefined, logoUrl: undefined, displayOrder: id,
    ...partial
  };
}
function section(partial: Partial<IPolicySection>): IPolicySection {
  const id = nextId++;
  return {
    id, title: `Section ${String(id)}`, subtitle: undefined, layout: 'paragraph', cardVariant: undefined, body: undefined, icon: undefined,
    imageUrl: undefined, cards: [], tables: [], tabs: [], columns: undefined, cardStyle: 'default', tintCards: false, sectionStyle: 'plain',
    theme: undefined, width: 'full', linkText: undefined, linkUrl: undefined, targetSlug: undefined, offerCollection: undefined, displayOrder: id,
    ...partial
  };
}

const img = 'https://x/photo.jpg';
const brandColor = { iconColor: 'var(--full-brand-gold, #b89c67)', iconColorOn: '#04253c', iconColorInk: '#7b6945' };

/** One section of every layout / card style, including offer, popup and link cards. */
const SECTIONS: IPolicySection[] = [
  section({ layout: 'paragraph', body: 'Para one\nPara two' }),
  section({ layout: 'paragraph', icon: 'BullseyeTarget', body: 'Purpose text', theme: 'crystal-waters', sectionStyle: 'tinted' }),
  section({ layout: 'cardsGrid', cardVariant: 'category', cards: [card({ title: 'Category', ...brandColor, targetSlug: 'expenses' })] }),
  section({ layout: 'cardsGrid', cardVariant: 'info', cards: [card({ title: 'Info tile' })] }),
  section({ layout: 'cardsGrid', cardVariant: 'highlight', tintCards: true, cards: [card({ title: '2. Highlight', ...brandColor, subPoints: ['- bullet', '##A|B', 'x|y'] })] }),
  section({ layout: 'cardsGrid', cardStyle: 'iconHeader', cards: [card({ title: 'Icon header', iconExplicit: true, ...brandColor })] }),
  section({ layout: 'cardsGrid', cardStyle: 'iconMedia', cards: [card({ title: 'Icon media', iconExplicit: true })] }),
  section({ layout: 'table', tables: [{ id: 1, title: 'T', columnHeaders: ['A', 'B'], rows: [{ id: 1, cells: ['MapPin::One', '**Two**'], displayOrder: 1 }], displayOrder: 1 }] }),
  section({
    layout: 'tabs',
    tabs: [
      { id: 501, label: 'Tab A', subtitle: 'sub', description: 'desc', icon: 'Airplane', cards: [card({ title: 'Tab card' })], tables: [], sections: [], displayOrder: 1 },
      { id: 502, label: 'Tab B', subtitle: undefined, description: undefined, icon: undefined, cards: [], tables: [], sections: [section({ layout: 'banner', title: 'Banner in tab', theme: 'navy', body: 'Tagline' })], displayOrder: 2 }
    ]
  }),
  section({ layout: 'numberedSteps', cards: [card({ kind: 'rule', number: 1, title: 'Rule', ...brandColor })] }),
  section({ layout: 'processSteps', cards: [card({ kind: 'helpStep', number: 1, title: 'Step', description: 'Do it' })] }),
  section({ layout: 'processSteps', cardStyle: 'stacked', cards: [card({ kind: 'helpStep', number: 1, title: 'Stacked', ...brandColor })] }),
  section({ layout: 'callout', body: '**Important:** read this' }),
  section({ layout: 'imageBlock', imageUrl: img, body: 'Caption' }),
  section({ layout: 'linksList', cards: [card({ kind: 'linkItem', title: 'Link item', linkUrl: 'https://x' })] }),
  section({ layout: 'split', cards: [card({ title: 'Split part', iconExplicit: true, ...brandColor, linkText: 'Open', linkUrl: 'https://x' })] }),
  section({ layout: 'checklist', body: 'Check one\nCheck two' }),
  section({
    layout: 'imageCards', cardStyle: 'imageTop', columns: 5, title: 'Business Travel & Mobility', cards: [
      card({ title: 'Offer card', imageUrl: img, badge: 'Special', value: 'SAR 1', offerId: 42, linkText: 'View Details', logoUrl: img, ...brandColor }),
      card({ title: 'Popup card', imageUrl: img, iconExplicit: true, linkText: 'View Gallery', popupItems: [{ label: 'One', url: 'https://x/1.jpg', kind: 'image' }, { label: 'Two', url: 'https://x/2.jpg', kind: 'image' }] }),
      card({ title: 'External card', imageUrl: img, description: 'A long description that wraps', subPoints: ['@System|Through SAP Concur'], linkUrl: 'https://partner.example.com', openInNewTab: true })
    ]
  }),
  section({ layout: 'imageCards', cardStyle: 'imageTile', cards: [card({ title: 'Tile', imageUrl: img, iconExplicit: true, linkUrl: 'https://x' })] }),
  section({ layout: 'imageCards', cardStyle: 'imageBanner', cards: [card({ title: 'Banner card', imageUrl: img, linkText: 'Book', linkUrl: 'https://x' })] }),
  section({ layout: 'imageCards', cardStyle: 'imageLeft', cards: [card({ title: 'Left card', imageUrl: img, value: 'SAR 2,500' })] }),
  section({ layout: 'imageCards', cardStyle: 'imageMenu', columns: 2, cards: [card({ title: '[Menu 1]', badge: 'Menu 1', value: 'SAR 120', subPoints: ['Item A'] })] }),
  section({ layout: 'feature', icon: 'Package', body: 'Feature body', imageUrl: img, cards: [card({ title: 'Stat', value: 'SAR 25,000' }), card({ title: 'Info' })] }),
  section({ layout: 'faq', cards: [card({ title: 'Question?', description: 'Answer' })] }),
  section({ layout: 'search', linkUrl: 'https://x/search?q={query}', cards: [card({ title: 'Quick' })] }),
  section({ layout: 'priceList', cards: [card({ title: 'Partner', imageUrl: img, subPoints: ['Coffee|Coffee Break|SAR 120|per person', 'Lunch|SAR 225'], description: 'VAT note', targetSlug: 'catering-services-movenpick', linkText: 'View Menus' })] }),
  section({ layout: 'gallery', title: 'Catering Setup Gallery', cards: [card({ title: 'Photo 1', imageUrl: 'https://x/g1.jpg' }), card({ title: 'Photo 2', imageUrl: 'https://x/g2.jpg' })] }),
  section({ layout: 'cardsGrid', width: 'half', cards: [card()] }),
  section({ layout: 'cardsGrid', width: 'half', cards: [card()] })
];

let container: HTMLDivElement;
beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
});
afterEach(() => {
  ReactDOM.unmountComponentAtNode(container);
  container.remove();
});

function renderWithNav(ui: React.ReactElement, view: ThView = { kind: 'policyPage', slug: 'business-travel-x' }): jest.Mock {
  const navigate = jest.fn();
  act(() => {
    ReactDOM.render(<NavigationContext.Provider value={{ view, navigate }}>{ui}</NavigationContext.Provider>, container);
  });
  return navigate;
}

function buttonByText(text: string): HTMLElement {
  const el = Array.from(container.querySelectorAll<HTMLElement>('button, a')).find((b) => (b.textContent ?? '').indexOf(text) >= 0);
  if (el === undefined) {
    throw new Error(`no button/link containing "${text}"`);
  }
  return el;
}

describe('SectionFlow renders every layout', () => {
  it('renders all sections without throwing', () => {
    renderWithNav(<SectionFlow sections={SECTIONS} />);
    ['Para two', 'Purpose text', 'Category', 'Rule', 'Stacked', 'Important', 'Link item', 'Split part', 'Check two', 'Offer card',
      'Tile', 'Banner card', 'Left card', 'SAR 2,500', 'Menu 1', 'Feature body', 'Question?', 'Coffee Break', 'VAT note', 'Tab A'
    ].forEach((text) => expect(container.textContent).toContain(text));
    // Theme keys reach the DOM; light brand colours get navy text roles.
    expect(container.querySelector('[data-th-theme="crystal-waters"]')).not.toBeNull();
    expect(container.innerHTML).toContain('--th-card-accent-on: #04253c');
  });

  it('ImageTop cards have head / text / foot rows (aligned across cards)', () => {
    renderWithNav(<SectionFlow sections={SECTIONS} />);
    const external = buttonByText('External card');
    expect(external.querySelector('.imageCardHead .imageCardTitle')).not.toBeNull();
    expect(external.querySelector('.imageCardText')).not.toBeNull();
    expect(external.querySelector('.imageCardFoot .imageCardPoints')).not.toBeNull();
  });

  it('an offer card opens the offer details screen, remembering the page', () => {
    const navigate = renderWithNav(<SectionFlow sections={SECTIONS} />, { kind: 'policyPage', slug: 'personal-travel-offers' });
    act(() => buttonByText('Offer card').click());
    expect(navigate).toHaveBeenCalledWith({ kind: 'offer', id: 42, fromSlug: 'personal-travel-offers' });
  });

  it('popup cards and gallery photos open the in-app viewer', () => {
    renderWithNav(<SectionFlow sections={SECTIONS} />);
    act(() => buttonByText('Popup card').click());
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(document.querySelector('[aria-label="Next image"]')).not.toBeNull();
  });

  it('external links open in a new tab; in-app links navigate', () => {
    const navigate = renderWithNav(<SectionFlow sections={SECTIONS} />);
    const external = buttonByText('External card') as HTMLAnchorElement;
    expect(external.getAttribute('target')).toBe('_blank');
    act(() => buttonByText('Partner').click());
    expect(navigate).toHaveBeenCalledWith({ kind: 'policyPage', slug: 'catering-services-movenpick' });
  });
});

describe('OfferDetailScreen', () => {
  const offer: IOffer = {
    id: 42, collection: 'Featured Personal Offers', title: 'Maldives', subtitle: '5 Nights', badge: 'Special Offer', summary: 'Summary text',
    details: ['Details line'], inclusions: ['Flights'], terms: ['Terms line'], imageUrl: img, logoUrl: undefined, icon: undefined,
    iconColor: undefined, iconColorOn: undefined, iconColorInk: undefined, valueLabel: 'Starting From', value: 'SAR 5,999', valueNote: 'per person',
    partner: 'Partner Co', location: 'Maldives', validFrom: undefined, validTo: new Date('2026-12-31T00:00:00Z'), linkText: 'View Details',
    linkUrl: 'https://partner.example.com/maldives', linkIsExternal: true, ctaText: 'Book This Offer', contactEmail: 'a@b.com',
    contactPhone: '+966 11 000 0000', files: [{ label: 'Brochure', url: 'https://x/b.pdf', kind: 'document' }], action: 'details', displayOrder: 1
  };

  it('shows the offer and opens its external link in a new window', async () => {
    const services = {
      offers: { getOffer: async () => offer, getCollections: async () => new Map() },
      policy: { getPage: async () => ({ title: 'Personal Travel Offers' }) }
    } as unknown as IServiceRegistry;
    await act(async () => {
      ReactDOM.render(
        <ServiceContext.Provider value={services}>
          <NavigationContext.Provider value={{ view: { kind: 'offer', id: 42, fromSlug: 'personal-travel-offers' }, navigate: jest.fn() }}>
            <OfferDetailScreen offerId={42} fromSlug="personal-travel-offers" />
          </NavigationContext.Provider>
        </ServiceContext.Provider>,
        container
      );
    });
    ['Maldives', 'SAR 5,999', 'Valid until', 'Details line', 'Flights', 'Brochure', 'Terms line', 'Personal Travel Offers'].forEach((t) =>
      expect(container.textContent).toContain(t)
    );
    const cta = buttonByText('Book This Offer') as HTMLAnchorElement;
    expect(cta.getAttribute('href')).toBe('https://partner.example.com/maldives');
    expect(cta.getAttribute('target')).toBe('_blank');
  });
});

describe('scrollToTopAndFocus', () => {
  it('resets every scrolled ancestor and focuses the new screen', () => {
    const scroller = document.createElement('div');
    const root = document.createElement('div');
    const screen = document.createElement('div');
    screen.tabIndex = -1;
    scroller.appendChild(root);
    root.appendChild(screen);
    document.body.appendChild(scroller);
    scroller.scrollTop = 500;
    Object.defineProperty(scroller, 'scrollTop', { value: 500, writable: true });
    window.scrollTo = jest.fn();
    scrollToTopAndFocus(root, screen);
    expect(scroller.scrollTop).toBe(0);
    expect(document.activeElement).toBe(screen);
    scroller.remove();
  });
});

describe('PolicyPageScreen banner, assistant and closing banner', () => {
  function page(partial: Partial<IPolicyPageContent> = {}): IPolicyPageContent {
    return {
      slug: 'travel-policy', title: 'Travel Policy', parent: undefined, parentSectionLabel: undefined,
      hero: { icon: undefined, eyebrow: 'Travel Policy', title: 'Travel Policy', subtitle: undefined, description: 'Hero text', imageUrl: img, tagline: 'People Places', style: 'dark', links: [], logoUrl: undefined, highlights: [] },
      infoBannerText: undefined, noteBannerText: undefined, cta: undefined, needHelp: undefined,
      closingBanner: { title: 'Travel with Purpose', description: 'Closing text', badges: ['Our People'], imageUrl: undefined },
      suggestedQuestions: ['Can I fly business class?'], assistantLinkUrl: undefined, assistantLinkText: undefined, sections: [],
      ...partial
    };
  }
  async function renderPage(content: IPolicyPageContent, assistantUrl: string | undefined, closingDefault?: string): Promise<void> {
    const services = {
      policy: { getPage: async () => content },
      configuration: {
        policyAssistant: { url: assistantUrl, buttonText: 'Ask Policy Assistant', title: 'Ask Our Policy Assistant', description: 'Get answers.' },
        pages: { closingBannerImageUrl: closingDefault }
      }
    } as unknown as IServiceRegistry;
    ReactDOM.unmountComponentAtNode(container); // fresh screen per case (same slug would keep the loaded page)
    await act(async () => {
      ReactDOM.render(
        <ServiceContext.Provider value={services}>
          <NavigationContext.Provider value={{ view: { kind: 'policyPage', slug: content.slug }, navigate: jest.fn() }}>
            <PolicyPageScreen slug={content.slug} />
          </NavigationContext.Provider>
        </ServiceContext.Provider>,
        container
      );
    });
  }

  it('renders every page with the light (SAP Concur) banner, even HeroStyle = Dark', async () => {
    await renderPage(page(), undefined);
    expect(container.querySelector('.heroLight')).not.toBeNull();
    expect(container.querySelector('.heroLightTitle')?.textContent).toBe('Travel Policy');
    // Eyebrow, description and photo still render (content unchanged, only the style is unified).
    expect(container.querySelector('.heroEyebrow')?.textContent).toBe('Travel Policy');
    expect(container.querySelector('.heroLightDescription')?.textContent).toBe('Hero text');
    expect((container.querySelector('.heroLightImage') as HTMLElement).style.backgroundImage).toContain(img);
    expect(container.querySelector('.heroLightTagline')).not.toBeNull();
  });

  it('assistant: no search box; the configured agent opens in a new tab; page link wins', async () => {
    await renderPage(page(), 'https://copilotstudio.microsoft.com/agent/policy');
    expect(container.querySelector('input')).toBeNull();
    const button = buttonByText('Ask Policy Assistant') as HTMLAnchorElement;
    expect(button.getAttribute('href')).toBe('https://copilotstudio.microsoft.com/agent/policy');
    expect(button.getAttribute('target')).toBe('_blank');
    expect(container.textContent).toContain('Can I fly business class?');

    await renderPage(page({ assistantLinkUrl: 'https://x/page-agent', assistantLinkText: 'Ask about expenses' }), 'https://copilotstudio.microsoft.com/agent/policy');
    expect(buttonByText('Ask about expenses').getAttribute('href')).toBe('https://x/page-agent');
  });

  it('assistant without any link shows no button', async () => {
    await renderPage(page(), undefined);
    expect(container.textContent).toContain('Ask Our Policy Assistant');
    expect(Array.from(container.querySelectorAll('a')).some((a) => (a.textContent ?? '').indexOf('Ask Policy Assistant') >= 0)).toBe(false);
  });

  it('closing banner: photo from the page, else the site default, else the plain band', async () => {
    await renderPage(page({ closingBanner: { title: 'T', description: 'D', badges: [], imageUrl: 'https://x/closing.jpg' } }), undefined);
    let band = container.querySelector('.closingBanner') as HTMLElement;
    expect(band.className).toContain('closingBannerImage');
    expect(band.style.backgroundImage).toContain('https://x/closing.jpg');

    await renderPage(page(), undefined, 'https://x/default-closing.jpg');
    band = container.querySelector('.closingBanner') as HTMLElement;
    expect(band.style.backgroundImage).toContain('default-closing.jpg');

    await renderPage(page(), undefined);
    band = container.querySelector('.closingBanner') as HTMLElement;
    expect(band.className).not.toContain('closingBannerImage');
  });
});
