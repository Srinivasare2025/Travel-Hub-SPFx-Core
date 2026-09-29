import * as React from 'react';
import { Icon } from '@fluentui/react/lib/Icon';
import { useServices } from '../../../../../common/context/ServiceContext';
import { useNavigation } from '../../../../../common/context/NavigationContext';
import { useAsyncData } from '../../../../../common/hooks';
import { Card, Badge, Button, LoadingState, ErrorState, EmptyState } from '../../../../../common/components';
import { ITravelSpend, ITravelSpendAccess } from '../../../../../models';
import styles from './TravelInsightsSection.module.scss';

interface ISpendResult {
  access: ITravelSpendAccess;
  spend: ITravelSpend | undefined;
}

/** Formats a number as currency; falls back to a plain "CODE amount" if the currency code isn't valid for Intl. */
function formatCurrency(amount: number, currency: string, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString(locale)}`;
  }
}

function SpendTile({ label, amount, currency, locale }: { label: string; amount: number; currency: string; locale: string }): React.ReactElement {
  return (
    <div className={styles.spendTile}>
      <span className={styles.spendTileLabel}>{label}</span>
      <span className={styles.spendTileValue}>{formatCurrency(amount, currency, locale)}</span>
    </div>
  );
}

/**
 * Department Travel Spend Overview. SECURITY.md §3: the SPFx UI is never the
 * security boundary — `getAccess()` is checked first, and figures are only
 * fetched at all when it grants access. A denial never renders numbers,
 * field names, or a retry that might leak whether data exists — just a
 * "Restricted Access" badge, a lock, the configured message, and a link out
 * to the dashboard (which owns its own access model).
 */
export const DepartmentTravelSpendCard: React.FC = () => {
  const { spend, configuration } = useServices();
  const { navigate } = useNavigation();
  const { status, data, retry } = useAsyncData<ISpendResult>(async () => {
    const access = await spend.getAccess(configuration);
    if (!access.hasAccess) {
      return { access, spend: undefined };
    }
    return { access, spend: await spend.getSpend(configuration) };
  }, [configuration]);

  if (status === 'loading') {
    return <LoadingState variant="card" count={1} label="Loading travel spend" />;
  }
  if (status === 'error') {
    return <ErrorState onRetry={retry} />;
  }
  if (data === undefined) {
    return null;
  }

  const dashboardUrl = data.spend?.dashboardUrl ?? (configuration.spend.dashboardUrl !== '#' ? configuration.spend.dashboardUrl : undefined);
  const locale = configuration.dates.locale;

  return (
    <Card padding="lg" className={styles.spendCard}>
      <div className={styles.spendHeader}>
        <span className={styles.spendIcon} aria-hidden="true">
          <Icon iconName="Money" />
        </span>
        <div className={styles.spendHeaderText}>
          <h3 className={styles.spendTitle}>Department Travel Spend Overview</h3>
          {data.spend !== undefined && (
            <p className={styles.spendSubtitle}>
              {data.spend.department}
              {data.spend.period.length > 0 ? ` — ${data.spend.period}` : ''}
            </p>
          )}
        </div>
        {!data.access.hasAccess && <Badge text="Restricted Access" tone="alert" />}
      </div>

      {!data.access.hasAccess ? (
        <div className={styles.spendDenied}>
          <Icon iconName="Lock" className={styles.spendLockIcon} aria-hidden="true" />
          <p className={styles.spendDeniedMessage}>{configuration.spend.deniedMessage}</p>
          {dashboardUrl !== undefined && (
            <Button variant="primary" href={dashboardUrl} openInNewTab>
              View Travel Dashboard
            </Button>
          )}
        </div>
      ) : data.spend === undefined ? (
        <EmptyState message="No travel spend figures are available for this period yet." iconName="Money" />
      ) : (
        <>
          <div className={styles.spendTiles}>
            <SpendTile label="Total" amount={data.spend.totalSpend} currency={data.spend.currency} locale={locale} />
            <SpendTile label="Air" amount={data.spend.airSpend} currency={data.spend.currency} locale={locale} />
            <SpendTile label="Hotel" amount={data.spend.hotelSpend} currency={data.spend.currency} locale={locale} />
            <SpendTile label="Ground" amount={data.spend.groundTransportSpend} currency={data.spend.currency} locale={locale} />
            <SpendTile label="Booking Fees" amount={data.spend.bookingSpend} currency={data.spend.currency} locale={locale} />
          </div>

          {dashboardUrl !== undefined && (
            <>
              {/* The configured Power BI report/dashboard link, embedded
                  right in the card (a compact preview) rather than only
                  linking out to it. */}
              <div className={styles.spendEmbedWrap}>
                <iframe
                  className={styles.spendEmbed}
                  src={dashboardUrl}
                  title="Department Travel Spend report preview"
                  loading="lazy"
                />
              </div>
              <div className={styles.spendAction}>
                <Button variant="secondary" onClick={() => navigate({ kind: 'spendDetail' })} iconAfter="ChevronRight">
                  View Detailed
                </Button>
              </div>
            </>
          )}
        </>
      )}
    </Card>
  );
};
