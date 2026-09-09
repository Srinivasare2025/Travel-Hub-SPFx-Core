import * as React from 'react';
import { useServices } from '../../../../common/context/ServiceContext';
import { useAsyncData } from '../../../../common/hooks';
import { ImageWithFallback } from '../../../../common/components';
import { FooterColumn } from './FooterColumn';
import styles from './TravelHubFooter.module.scss';

/**
 * The site footer (COMPONENTS.md §3.7): up to 6 fully list-driven link
 * columns (ASSUMPTIONS A33) plus a configuration-driven brand block
 * (A34/A35). Rendered outside `.page` (TravelHub.tsx) like GlobalNav, as a
 * masthead-style band, not a "section" - quietly renders nothing on
 * load/error rather than a loading/error panel, same choice as GlobalNav
 * (footer chrome shouldn't be the thing that visibly fails on the page).
 */
export const TravelHubFooter: React.FC = () => {
  const { footer, configuration } = useServices();
  const { status, data } = useAsyncData(() => footer.getContent(configuration), [configuration]);

  if (status !== 'success' || data === undefined) {
    return null;
  }

  return (
    <footer className={styles.root}>
      <div className={`${styles.inner} ${configuration.layout.fullBleed ? styles.fullBleedInner : ''}`}>
        {data.columns.length > 0 && (
          <div className={styles.columns}>
            {data.columns.map((column) => (
              <FooterColumn key={column.id} column={column} />
            ))}
          </div>
        )}

        <div className={styles.brandRow}>
          <div className={styles.brandText}>
            {/* Always non-empty: ConfigurationService's `str()` helper falls back to the
                default template ("© {year} {brand}. All rights reserved.") for a blank config value. */}
            <p className={styles.legal}>{data.legalText}</p>
            {data.lastUpdatedText !== undefined && <p className={styles.lastUpdated}>{data.lastUpdatedText}</p>}
          </div>
          {data.qrCodeUrl !== undefined && (
            <ImageWithFallback src={data.qrCodeUrl} alt="Scan to open the Travel Hub" aspectRatio="1 / 1" className={styles.qrCode} />
          )}
        </div>
      </div>
    </footer>
  );
};
