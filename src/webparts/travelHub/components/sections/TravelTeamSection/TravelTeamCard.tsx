import * as React from 'react';
import { Icon } from '@fluentui/react/lib/Icon';
import { Card, ImageWithFallback } from '../../../../../common/components';
import { ITravelTeamMember } from '../../../../../models';
import styles from './TravelTeamSection.module.scss';

/**
 * SECURITY.md §4: `mailto:`/`tel:` are built here from the already-sanitised
 * `email`/`phone` values (TravelTeamService.ts) - never from a raw URL field.
 */
export const TravelTeamCard: React.FC<{ member: ITravelTeamMember }> = ({ member }) => {
  const secondaryLine = member.specialization ?? member.department;

  return (
    <Card as="article" padding="none" className={styles.card}>
      {/* Card always wraps its children in its own column-flex body div
          (Card.module.scss), which isn't ours to restyle - so the actual
          photo-left/content-right row lives one level deeper, in a div we
          fully own, rather than fighting Card's internal layout. */}
      <div className={styles.cardRow}>
        <ImageWithFallback
          src={member.profileImageUrl}
          alt=""
          aspectRatio="3 / 4"
          className={styles.avatar}
          fallbackIcon="Contact"
        />
        <div className={styles.body}>
          <h3 className={styles.name}>{member.name}</h3>
          <p className={styles.designation}>{member.designation}</p>
          {secondaryLine !== undefined && <p className={styles.secondary}>{secondaryLine}</p>}

          <div className={styles.contactRows}>
            {member.location !== undefined && (
              <span className={styles.contactItem}>
                <Icon iconName="POI" aria-hidden="true" /> {member.location}
              </span>
            )}
            {(member.email !== undefined || member.phone !== undefined) && (
              <div className={styles.contactActions}>
                {member.email !== undefined && (
                  <a className={styles.contactLink} href={`mailto:${member.email}`} aria-label={`Email ${member.name}`}>
                    <Icon iconName="Mail" aria-hidden="true" />
                  </a>
                )}
                {member.phone !== undefined && (
                  <a className={styles.contactLink} href={`tel:${member.phone}`} aria-label={`Call ${member.name}`}>
                    <Icon iconName="Phone" aria-hidden="true" />
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};
