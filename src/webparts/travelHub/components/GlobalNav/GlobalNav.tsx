import * as React from 'react';
import { Icon } from '@fluentui/react/lib/Icon';
import { useServices } from '../../../../common/context/ServiceContext';
import { useAsyncData } from '../../../../common/hooks';
import { IGlobalNavItem } from '../../../../models';
import styles from './GlobalNav.module.scss';

function NavLink({ item }: { item: IGlobalNavItem }): React.ReactElement {
  return (
    <li>
      <a
        className={styles.navLink}
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
 * Global navigation tabs shown above the hero banner: the built-in Our
 * Services / Help Desk / Travel Care tabs plus any admin-added rows from
 * `TH_GlobalNavigation` (GlobalNavigationService.ts). Configuration-driven,
 * not a section (it isn't gated by `configuration.sections`).
 */
export const GlobalNav: React.FC = () => {
  const { globalNav, configuration } = useServices();
  const { status, data } = useAsyncData(() => globalNav.getNavItems(configuration), [configuration]);

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
          <NavLink key={item.id} item={item} />
        ))}
      </ul>
    </nav>
  );
};
