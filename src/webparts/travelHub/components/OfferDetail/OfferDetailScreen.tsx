import * as React from 'react';
import { Icon } from '@fluentui/react/lib/Icon';
import { useServices } from '../../../../common/context/ServiceContext';
import { useNavigation, ThView } from '../../../../common/context/NavigationContext';
import { useAsyncData } from '../../../../common/hooks';
import { Button, EmptyState, ErrorState, LoadingState, MediaViewer, FitImg } from '../../../../common/components';
import { toTelHref } from '../../../../common/utils/urlValidation';
import type { IMediaItem } from '../../../../common/utils/mediaItems';
import type { IOffer } from '../../../../models';
import { SubPointsBlocks, BUSINESS_TRAVEL_SLUG } from '../PolicyPages/PolicyCardSections';
import styles from './OfferDetailScreen.module.scss';

export interface IOfferDetailScreenProps {
  offerId: number;
  /** The page the offer was opened from - breadcrumb parent and "Back" target. */
  fromSlug: string | undefined;
}

const DATE_FORMAT: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };

/** "Valid until 31 Dec 2026" / "Valid 1 Oct 2026 – 31 Dec 2026" / undefined. */
function validityText(offer: IOffer): string | undefined {
  const fmt = (d: Date): string => d.toLocaleDateString(undefined, DATE_FORMAT);
  if (offer.validFrom !== undefined && offer.validTo !== undefined) {
    return `Valid ${fmt(offer.validFrom)} – ${fmt(offer.validTo)}`;
  }
  if (offer.validTo !== undefined) {
    return `Valid until ${fmt(offer.validTo)}`;
  }
  return offer.validFrom !== undefined ? `Valid from ${fmt(offer.validFrom)}` : undefined;
}

function pageView(slug: string | undefined): ThView {
  if (slug === undefined) {
    return { kind: 'hub' };
  }
  return slug === BUSINESS_TRAVEL_SLUG ? { kind: 'businessTravel' } : { kind: 'policyPage', slug };
}

/**
 * Details screen for one TH_Offers item (e.g. a Featured Personal Travel
 * Offer), opened from its card when the offer has Details / Inclusions (or
 * ClickAction = Details Page): photo + gallery, badge, title, price,
 * validity, the offer's own button (LinkUrl - an external site opens in a new
 * window), contact, details, what's included, documents (attached PDFs, in
 * the popup viewer) and terms. Everything comes from the list item.
 */
export const OfferDetailScreen: React.FC<IOfferDetailScreenProps> = ({ offerId, fromSlug }) => {
  const { offers, policy } = useServices();
  const { navigate } = useNavigation();
  const { status, data, retry } = useAsyncData(() => offers.getOffer(offerId), [offerId]);
  const parent = useAsyncData(() => (fromSlug !== undefined ? policy.getPage(fromSlug) : Promise.resolve(undefined)), [fromSlug]);
  const [viewer, setViewer] = React.useState<{ items: IMediaItem[]; index: number; title: string } | undefined>(undefined);
  const closeViewer = React.useCallback(() => setViewer(undefined), []);

  const parentTitle = parent.data?.title;
  const back = (): void => navigate(pageView(fromSlug));

  const breadcrumb = (
    <nav className={styles.breadcrumb} aria-label="Breadcrumb">
      <button type="button" onClick={() => navigate({ kind: 'hub' })}>
        Home
      </button>
      {fromSlug !== undefined && (
        <>
          <Icon iconName="ChevronRight" aria-hidden="true" />
          <button type="button" onClick={back}>
            {parentTitle ?? 'Back'}
          </button>
        </>
      )}
      {data !== undefined && (
        <>
          <Icon iconName="ChevronRight" aria-hidden="true" />
          <span aria-current="page">{data.title}</span>
        </>
      )}
    </nav>
  );

  if (status === 'loading') {
    return <LoadingState variant="hero" label="Loading offer" />;
  }
  if (status === 'error') {
    return <ErrorState onRetry={retry} />;
  }
  if (data === undefined) {
    return (
      <div className={styles.screen}>
        {breadcrumb}
        <EmptyState
          message="This offer is no longer available."
          iconName="Tag"
          action={
            <Button variant="secondary" onClick={back}>
              {fromSlug !== undefined ? `Back to ${parentTitle ?? 'offers'}` : 'Back to Travel Hub'}
            </Button>
          }
        />
      </div>
    );
  }

  const offer = data;
  const images = offer.files.filter((f) => f.kind === 'image');
  const documents = offer.files.filter((f) => f.kind === 'document');
  // The main photo opens first in the gallery, followed by any attached photos.
  const gallery: IMediaItem[] = [
    ...(offer.imageUrl !== undefined ? [{ label: offer.title, url: offer.imageUrl, kind: 'image' as const }] : []),
    ...images.filter((i) => i.url !== offer.imageUrl)
  ];
  const validity = validityText(offer);
  const telHref = toTelHref(offer.contactPhone);
  const accent = offer.iconColor !== undefined
    ? ({ '--th-offer-accent': offer.iconColor, '--th-offer-accent-on': offer.iconColorOn ?? '#ffffff' } as React.CSSProperties)
    : undefined;

  return (
    <div className={styles.screen} style={accent}>
      {breadcrumb}

      <article className={styles.panel}>
        <div className={styles.media}>
          {offer.imageUrl !== undefined ? (
            <button
              type="button"
              className={styles.mainImage}
              onClick={() => setViewer({ items: gallery, index: 0, title: offer.title })}
              aria-label={`Open photos of ${offer.title}`}
            >
              <FitImg src={offer.imageUrl} eager />
              {offer.badge !== undefined && <span className={styles.badge}>{offer.badge}</span>}
            </button>
          ) : (
            <div className={styles.mainImagePlaceholder} aria-hidden="true">
              <Icon iconName={offer.icon ?? 'Tag'} />
            </div>
          )}
          {gallery.length > 1 && (
            <div className={styles.thumbs}>
              {gallery.slice(0, 5).map((item, index) => (
                <button
                  key={item.url}
                  type="button"
                  className={styles.thumb}
                  onClick={() => setViewer({ items: gallery, index, title: offer.title })}
                  aria-label={`Open photo ${String(index + 1)} of ${String(gallery.length)}`}
                >
                  <img src={item.url} alt="" loading="lazy" />
                  {index === 4 && gallery.length > 5 && <span className={styles.thumbMore}>+{gallery.length - 5}</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className={styles.summary}>
          {offer.logoUrl !== undefined && <img className={styles.logo} src={offer.logoUrl} alt={offer.partner ?? ''} />}
          {offer.badge !== undefined && offer.imageUrl === undefined && <span className={styles.badgeInline}>{offer.badge}</span>}
          <h1 className={styles.title}>{offer.title}</h1>
          {offer.subtitle !== undefined && <p className={styles.subtitle}>{offer.subtitle}</p>}

          {(offer.location !== undefined || offer.partner !== undefined || validity !== undefined) && (
            <ul className={styles.meta}>
              {offer.location !== undefined && (
                <li>
                  <Icon iconName="MapPin" aria-hidden="true" /> {offer.location}
                </li>
              )}
              {offer.partner !== undefined && (
                <li>
                  <Icon iconName="Teamwork" aria-hidden="true" /> {offer.partner}
                </li>
              )}
              {validity !== undefined && (
                <li>
                  <Icon iconName="Calendar" aria-hidden="true" /> {validity}
                </li>
              )}
            </ul>
          )}

          {offer.value !== undefined && (
            <div className={styles.price}>
              {offer.valueLabel !== undefined && <span className={styles.priceLabel}>{offer.valueLabel}</span>}
              <span className={styles.priceValue}>{offer.value}</span>
              {offer.valueNote !== undefined && <span className={styles.priceLabel}>{offer.valueNote}</span>}
            </div>
          )}

          {offer.summary.length > 0 && <p className={styles.lead}>{offer.summary}</p>}

          <div className={styles.actions}>
            {offer.linkUrl !== undefined && (
              <a
                className={styles.primaryButton}
                href={offer.linkUrl}
                target={offer.linkIsExternal ? '_blank' : undefined}
                rel={offer.linkIsExternal ? 'noopener noreferrer' : undefined}
              >
                {offer.ctaText ?? 'View Offer'}
                <Icon iconName={offer.linkIsExternal ? 'OpenInNewWindow' : 'ArrowRight'} aria-hidden="true" />
                {offer.linkIsExternal && <span className={styles.srOnly}> (opens in a new window)</span>}
              </a>
            )}
            {gallery.length > 1 && (
              <button type="button" className={styles.secondaryButton} onClick={() => setViewer({ items: gallery, index: 0, title: offer.title })}>
                <Icon iconName="Photo2" aria-hidden="true" /> View Gallery
              </button>
            )}
          </div>

          {(offer.contactEmail !== undefined || telHref !== undefined) && (
            <div className={styles.contact}>
              {offer.contactEmail !== undefined && (
                <a href={`mailto:${offer.contactEmail}`}>
                  <Icon iconName="Mail" aria-hidden="true" /> {offer.contactEmail}
                </a>
              )}
              {telHref !== undefined && (
                <a href={telHref}>
                  <Icon iconName="Phone" aria-hidden="true" /> {offer.contactPhone}
                </a>
              )}
            </div>
          )}
        </div>
      </article>

      {(offer.details.length > 0 || offer.inclusions.length > 0) && (
        <div className={styles.columns}>
          {offer.details.length > 0 && (
            <section className={styles.block}>
              <h2 className={styles.blockTitle}>Offer Details</h2>
              <SubPointsBlocks subPoints={offer.details} options={{ plainAs: 'paragraph' }} />
            </section>
          )}
          {offer.inclusions.length > 0 && (
            <section className={styles.block}>
              <h2 className={styles.blockTitle}>What&rsquo;s Included</h2>
              <ul className={styles.checklist}>
                {offer.inclusions.map((item, index) => (
                  <li key={index}>
                    <Icon iconName="CheckMark" aria-hidden="true" />
                    <span>{item.replace(/^[-•*]\s*/, '')}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      {documents.length > 0 && (
        <section className={styles.block}>
          <h2 className={styles.blockTitle}>Documents</h2>
          <ul className={styles.documents}>
            {documents.map((doc, index) => (
              <li key={doc.url}>
                <button type="button" className={styles.document} onClick={() => setViewer({ items: documents, index, title: offer.title })}>
                  <Icon iconName="PDF" aria-hidden="true" />
                  <span>{doc.label.length > 0 ? doc.label : `Document ${String(index + 1)}`}</span>
                  <Icon iconName="ChevronRight" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {offer.terms.length > 0 && (
        <section className={`${styles.block} ${styles.terms}`}>
          <h2 className={styles.blockTitle}>Terms &amp; Conditions</h2>
          <SubPointsBlocks subPoints={offer.terms} options={{ plainAs: 'paragraph' }} />
        </section>
      )}

      <div>
        <Button variant="secondary" onClick={back}>
          {fromSlug !== undefined ? `Back to ${parentTitle ?? 'offers'}` : 'Back to Travel Hub'}
        </Button>
      </div>

      {viewer !== undefined && (
        <MediaViewer isOpen onClose={closeViewer} title={viewer.title} items={viewer.items} startIndex={viewer.index} />
      )}
    </div>
  );
};
