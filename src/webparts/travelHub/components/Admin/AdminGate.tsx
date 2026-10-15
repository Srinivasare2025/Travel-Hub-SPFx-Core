import * as React from 'react';
import { useServices } from '../../../../common/context/ServiceContext';
import { useNavigation } from '../../../../common/context/NavigationContext';
import { useAsyncData } from '../../../../common/hooks';
import { Button, EmptyState, LoadingState } from '../../../../common/components';
import { AdminScreen } from './AdminScreen';

/**
 * The Admin tab's screen - only for members of the Content Admin group
 * (TH_SiteConfiguration `admin.group`, default "TravelHub Content Admins").
 * The group check only decides what the UI shows; SharePoint's own list
 * permissions still decide who can actually save (SECURITY.md §2).
 */
export const AdminGate: React.FC = () => {
  const { admin, configuration } = useServices();
  const { navigate } = useNavigation();
  const { status, data } = useAsyncData(() => admin.canAccess(configuration), [configuration]);

  if (status === 'loading') {
    return <LoadingState variant="card" count={1} label="Checking access" />;
  }
  if (data !== true) {
    return (
      <EmptyState
        iconName="Lock"
        message={`The Content Admin screen is available to members of the "${configuration.admin.group}" SharePoint group only.`}
        action={
          <Button variant="secondary" onClick={() => navigate({ kind: 'hub' })}>
            Back to Travel Hub
          </Button>
        }
      />
    );
  }
  return <AdminScreen />;
};
