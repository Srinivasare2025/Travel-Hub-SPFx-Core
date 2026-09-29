import * as React from 'react';
import { Icon } from '@fluentui/react/lib/Icon';
import { useServices } from '../../../../common/context/ServiceContext';
import { useNavigation } from '../../../../common/context/NavigationContext';
import { useAsyncData } from '../../../../common/hooks';
import { ImageLightbox } from '../../../../common/components';
import { ThView } from '../../../../common/context/NavigationContext';
import { IGlobalNavItem } from '../../../../models';
import { TopbarActions } from './TopbarActions';
import styles from './GlobalNav.module.scss';

/**
 * For a page view, the `policy` tab that owns it: the tab whose page slug
 * equals it or prefixes it (`sap-concur` owns `sap-concur-plan-book`);
 * otherwise the Travel Policy tab owns every other page, as before.
 */
function owningPolicyTab(items: IGlobalNavItem[], slug: string): IGlobalNavItem | undefined {
  const policyTabs = items.filter((i) => i.kind === 'policy' && i.url !== undefined);
  return (
    policyTabs.find((i) => slug === i.url || slug.indexOf(`${i.url as string}-`) === 0) ??
    policyTabs.find((i) => i.url === 'travel-policy') ??
    policyTabs[0]
  );
}

/** Whether `item` is the tab for the screen currently showing. */
function isActive(item: IGlobalNavItem, view: ThView, items: IGlobalNavItem[]): boolean {
  switch (item.kind) {
    case 'home':
      return view.kind === 'hub';
    case 'policy':
      return view.kind === 'policyPage' && owningPolicyTab(items, view.slug) === item;
    case 'service':
      return view.kind === 'servicePage' && Number(item.url) === view.serviceId;
    case 'businessTravel':
      return view.kind === 'businessTravel';
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
  if (item.kind === 'businessTravel') {
    return (
      <li>
        <button type="button" className={className} onClick={() => navigate({ kind: 'businessTravel' })}>
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
 * The app's top bar, styled after the sibling HR-Hub-SPFx solution's Topbar:
 * brand eyebrow on the left, the global navigation tabs in the middle and the
 * theme menu / notification bell / profile menu on the right (TopbarActions).
 *
 * The tabs are unchanged: Home, one tab per Travel Service (Business Travel,
 * Personal Travel, Travel Policy, SAP Concur, Catering Services, Meetings &
 * Events, …), the Help Desk / Travel Care hero quick links, plus any
 * admin-added rows from `TH_GlobalNavigation` (GlobalNavigationService.ts).
 * Configuration-driven, not a section (it isn't gated by
 * `configuration.sections`).
 */
export const GlobalNav: React.FC = () => {
  const { globalNav, configuration } = useServices();
  const { view, navigate } = useNavigation();
  const { status, data } = useAsyncData(() => globalNav.getNavItems(configuration), [configuration]);
  const [imageViewer, setImageViewer] = React.useState<IGlobalNavItem | undefined>(undefined);

  // No loading skeleton and no error/retry panel for the tabs - a flash of
  // "loading…"/"failed to load" chrome in the top bar would be more
  // distracting than the tabs simply appearing once ready. getNavItems()
  // itself never rejects on a missing TH_GlobalNavigation list
  // (GlobalNavigationService.ts falls back to the built-in tabs only), so
  // 'error' here would mean a genuine unexpected failure. The bar itself
  // (brand + actions) always renders.
  const items = status === 'success' && data !== undefined ? data : [];

  return (
    <header className={styles.root} data-th-topbar="true">
      {/* Mirrors TravelHub.module.scss .fullBleed .page: the same edge-to-edge
          vs. centred-column choice, so the bar lines up with the sections below. */}
      <div className={`${styles.bar} ${configuration.layout.fullBleed ? styles.fullBleedBar : ''}`}>
        <button type="button" className={styles.brand} onClick={() => navigate({ kind: 'hub' })} aria-label={`${configuration.brandName} Travel Hub - home`}>
          <span className={styles.brandMark}>{configuration.brandName}</span>
          <span className={styles.brandDivider} aria-hidden="true" />
          <span className={styles.brandName}>Travel Hub</span>
        </button>

        <nav className={styles.nav} aria-label="Global">
          {items.length > 0 && (
            <ul className={styles.list}>
              {items.map((item) => (
                <NavLink key={item.id} item={item} active={isActive(item, view, items)} onOpenImage={setImageViewer} />
              ))}
            </ul>
          )}
        </nav>

        <div className={styles.actions}>
          <TopbarActions />
        </div>
      </div>

      <ImageLightbox
        isOpen={imageViewer !== undefined}
        onClose={() => setImageViewer(undefined)}
        src={imageViewer?.url}
        alt={imageViewer?.title ?? 'Travel Care'}
        title={imageViewer?.title}
      />
    </header>
  );
};
