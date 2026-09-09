import * as React from 'react';
import { Icon } from '@fluentui/react/lib/Icon';
import { useServices } from '../../../../common/context/ServiceContext';
import { useNavigation } from '../../../../common/context/NavigationContext';
import { useAsyncData } from '../../../../common/hooks';
import { ImageLightbox } from '../../../../common/components';
import { ThView } from '../../../../common/context/NavigationContext';
import { IGlobalNavItem } from '../../../../models';
import styles from './GlobalNav.module.scss';

/** Whether `item` is the tab for the screen currently showing. */
function isActive(item: IGlobalNavItem, view: ThView): boolean {
  switch (item.kind) {
    case 'home':
      return view.kind === 'hub';
    case 'policy':
      return view.kind === 'policyPage';
    case 'service':
      return view.kind === 'servicePage' && Number(item.url) === view.serviceId;
    default:
      return false;
  }
}

function NavLink({
  item,
  active,
  onOpenImage
}: {
  item: IGlobalNavItem;
  active: boolean;
  onOpenImage: (item: IGlobalNavItem) => void;
}): React.ReactElement {
  const { navigate } = useNavigation();
  const className = `${styles.navLink} ${active ? styles.navLinkActive : ''}`;

  // These kinds open an in-app screen/popup instead of following a normal
  // href (GlobalNavigationService.ts / NavigationContext.ts).
  if (item.kind === 'home') {
    return (
      <li>
        <button type="button" className={className} onClick={() => navigate({ kind: 'hub' })}>
          {item.title}
        </button>
      </li>
    );
  }
  if (item.kind === 'policy') {
    return (
      <li>
        <button type="button" className={className} onClick={() => navigate({ kind: 'policyPage', slug: item.url ?? 'travel-policy' })}>
          {item.title}
        </button>
      </li>
    );
  }
  if (item.kind === 'service') {
    const serviceId = Number(item.url);
    return (
      <li>
        <button type="button" className={className} onClick={() => navigate({ kind: 'servicePage', serviceId })}>
          {item.title}
        </button>
      </li>
    );
  }
  if (item.kind === 'image') {
    // Matches the hero's own Travel Care quick link: an in-app viewer, never
    // a browser navigation to the raw file URL (SECURITY.md §4).
    return (
      <li>
        <button type="button" className={className} onClick={() => onOpenImage(item)}>
          {item.title}
        </button>
      </li>
    );
  }

  return (
    <li>
      <a
        className={className}
        href={item.url}
        target={item.openInNewTab ? '_blank' : undefined}
        rel={item.openInNewTab ? 'noopener noreferrer' : undefined}
      >
        {item.title}
        {item.kind === 'external' && <Icon iconName="OpenInNewWindow" className={styles.navLinkIcon} aria-hidden="true" />}
      </a>
    </li>
  );
}

/**
 * Global navigation tabs shown above the hero banner: Home, one tab per
 * Travel Service (Business Travel, Personal Travel, Travel Policy, SAP
 * Concur, Catering Services, Meetings & Events, …), the Help Desk / Travel
 * Care hero quick links, plus any admin-added rows from `TH_GlobalNavigation`
 * (GlobalNavigationService.ts). Configuration-driven, not a section (it
 * isn't gated by `configuration.sections`).
 */
export const GlobalNav: React.FC = () => {
  const { globalNav, configuration } = useServices();
  const { view } = useNavigation();
  const { status, data } = useAsyncData(() => globalNav.getNavItems(configuration), [configuration]);
  const [imageViewer, setImageViewer] = React.useState<IGlobalNavItem | undefined>(undefined);

  // No loading skeleton and no error/retry panel for this bar - it sits
  // directly above the hero, so a flash of "loading…"/"failed to load" chrome
  // there would be more distracting than the nav simply appearing once ready.
  // getNavItems() itself never rejects on a missing TH_GlobalNavigation list
  // (GlobalNavigationService.ts falls back to the built-in tabs only), so
  // 'error' here would mean a genuine unexpected failure.
  if (status !== 'success' || data === undefined || data.length === 0) {
    return null;
  }

  return (
    <nav className={styles.root} aria-label="Global">
      {/* Mirrors TravelHub.module.scss .fullBleed .page: the same edge-to-edge
          vs. centred-column choice, so the nav's links line up with the
          sections below it either way. */}
      <ul className={`${styles.list} ${configuration.layout.fullBleed ? styles.fullBleedList : ''}`}>
        {data.map((item) => (
          <NavLink
            key={item.id}
            item={item}
            active={isActive(item, view)}
            onOpenImage={setImageViewer}
          />
        ))}
      </ul>

      <ImageLightbox
        isOpen={imageViewer !== undefined}
        onClose={() => setImageViewer(undefined)}
        src={imageViewer?.url}
        alt={imageViewer?.title ?? 'Travel Care'}
        title={imageViewer?.title}
      />
    </nav>
  );
};
