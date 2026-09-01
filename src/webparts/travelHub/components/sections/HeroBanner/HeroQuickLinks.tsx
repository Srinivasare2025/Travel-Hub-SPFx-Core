import * as React from 'react';
import { Icon } from '@fluentui/react/lib/Icon';
import { IHeroQuickLink } from '../../../../../models';
import { Badge, ImageLightbox } from '../../../../../common/components';
import { sanitizeUrl } from '../../../../../common/utils/urlValidation';
import styles from './HeroBanner.module.scss';

export interface IHeroQuickLinksProps {
  links: IHeroQuickLink[];
  supportingMessage: string;
  /** From `hero.quickLinks.layout` config. */
  layout: 'stack' | 'inline';
}

const ICONS: Record<IHeroQuickLink['key'], string> = {
  helpDesk: 'Headset',
  travelCare: 'Ringer'
};

interface ICardProps {
  link: IHeroQuickLink;
  onViewImage: (link: IHeroQuickLink) => void;
}

function CardInner({ link }: { link: IHeroQuickLink }): React.ReactElement {
  const opensImage = link.kind === 'image';
  return (
    <>
      <span className={styles.quickLinkIcon} aria-hidden="true">
        <Icon iconName={ICONS[link.key]} />
      </span>
      <span className={styles.quickLinkBody}>
        <span className={styles.quickLinkTitleRow}>
          <span className={styles.quickLinkTitle}>{link.title}</span>
          {link.badgeText !== undefined && <Badge text={link.badgeText} tone="alert" />}
        </span>
        <span className={styles.quickLinkDesc}>{link.description}</span>
      </span>
      <Icon
        iconName={opensImage ? 'ImageSearch' : link.openInNewTab ? 'OpenInNewWindow' : 'ChevronRight'}
        className={styles.quickLinkChevron}
        aria-hidden="true"
      />
    </>
  );
}

function QuickLinkCard({ link, onViewImage }: ICardProps): React.ReactElement {
  const href = sanitizeUrl(link.url);

  if (href === undefined) {
    return (
      <li className={`${styles.quickLink} ${styles.quickLinkDisabled}`} aria-disabled="true">
        <CardInner link={link} />
      </li>
    );
  }

  if (link.kind === 'image') {
    return (
      <li>
        <button
          type="button"
          className={styles.quickLink}
          onClick={() => onViewImage(link)}
          aria-label={`${link.title}. ${link.description}. Opens an image viewer.`}
        >
          <CardInner link={link} />
        </button>
      </li>
    );
  }

  return (
    <li>
      <a
        className={styles.quickLink}
        href={href}
        target={link.openInNewTab ? '_blank' : undefined}
        rel={link.openInNewTab ? 'noopener noreferrer' : undefined}
        aria-label={
          `${link.title}. ${link.description}` + (link.openInNewTab ? ' Opens in a new tab.' : '')
        }
      >
        <CardInner link={link} />
      </a>
    </li>
  );
}

/**
 * The two static links overlaid on the hero, plus the supporting message.
 * Deliberately NOT part of the carousel (spec §5). Each link's destination,
 * new-tab behaviour and kind (page vs image) are configuration-driven. An
 * `image` link opens an in-app viewer rather than navigating to the file URL.
 */
export const HeroQuickLinks: React.FC<IHeroQuickLinksProps> = ({ links, supportingMessage, layout }) => {
  const [viewer, setViewer] = React.useState<IHeroQuickLink | undefined>(undefined);
  const viewerHref = sanitizeUrl(viewer?.url);

  return (
    <div className={`${styles.quickLinks} ${layout === 'inline' ? styles.inline : ''}`}>
      <ul className={styles.quickLinkList}>
        {links.map((link) => (
          <QuickLinkCard key={link.key} link={link} onViewImage={setViewer} />
        ))}
      </ul>

      {supportingMessage.length > 0 && (
        <p className={styles.supporting}>
          <Icon iconName="Shield" aria-hidden="true" /> {supportingMessage}
        </p>
      )}

      <ImageLightbox
        isOpen={viewer !== undefined && viewerHref !== undefined}
        onClose={() => setViewer(undefined)}
        src={viewer?.url}
        alt={viewer?.title ?? 'Travel Care'}
        title={viewer?.title}
      />
    </div>
  );
};
