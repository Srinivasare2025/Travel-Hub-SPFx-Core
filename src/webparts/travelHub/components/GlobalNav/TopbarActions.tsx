import * as React from 'react';
import { useServices } from '../../../../common/context/ServiceContext';
import {
  useShell,
  CANVAS_KEYS,
  CANVAS_LABEL,
  CANVAS_SWATCH,
  ThCanvas,
  getInitials
} from '../../../../common/context/ShellContext';
import { useAsyncData } from '../../../../common/hooks';
import { formatLongDate } from '../../../../common/utils/dateFormatting';
import { ITravelEvent, ITravelNews } from '../../../../models';
import styles from './TopbarActions.module.scss';

/*
 * The top bar's right-hand cluster - theme menu · notification bell · profile
 * menu - replicating the sibling HR-Hub-SPFx solution's Topbar.tsx (same
 * pill/round triggers, 14px rounded pop menus, keyboard contract and click-away
 * scrim). Only one menu is open at a time.
 */

type OpenMenu = 'theme' | 'notifications' | 'profile' | undefined;

/** Stroke icons (HR Hub Topbar PROFILE_ITEM_D + bell/chevron/check). */
const ICON = {
  chevron: 'M6 9l6 6 6-6',
  check: 'M20 6L9 17l-5-5',
  bell: 'M18 9a6 6 0 1 0-12 0c0 6-2.5 7-2.5 7h17S18 15 18 9zM10 20a2.2 2.2 0 0 0 4 0',
  profile: 'M20 21a8 8 0 1 0-16 0M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  signout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  news: 'M4 5h13a1 1 0 0 1 1 1v12a2 2 0 0 0 2 2H6a2 2 0 0 1-2-2V5zM18 9h2v9a2 2 0 0 1-2 2M8 9h6M8 13h6M8 17h4',
  event: 'M7 3v3M17 3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z'
};

const Svg: React.FC<{ d: string; size?: number; strokeWidth?: number; className?: string }> = ({
  d,
  size = 16,
  strokeWidth = 1.8,
  className
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
    className={className}
  >
    <path d={d} />
  </svg>
);

/**
 * HR Hub's shared menu keyboard contract: focus moves into the menu on open,
 * ArrowUp/Down + Home/End rove over the items, Escape closes and returns focus
 * to the trigger.
 */
function useMenuKeyboard(
  open: boolean,
  close: () => void,
  triggerRef: React.RefObject<HTMLButtonElement>,
  menuRef: React.RefObject<HTMLDivElement>
): (e: React.KeyboardEvent<HTMLDivElement>) => void {
  React.useEffect(() => {
    if (!open || menuRef.current === null) {
      return;
    }
    const first = menuRef.current.querySelector<HTMLElement>('[role="menuitem"],[role="menuitemradio"],button');
    if (first !== null) {
      first.focus();
    }
  }, [open, menuRef]);

  return React.useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>): void => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        close();
        if (triggerRef.current !== null) {
          triggerRef.current.focus();
        }
        return;
      }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') {
        return;
      }
      const menu = menuRef.current;
      if (menu === null) {
        return;
      }
      const items = Array.from(menu.querySelectorAll<HTMLElement>('[role="menuitem"],[role="menuitemradio"]'));
      if (items.length === 0) {
        return;
      }
      e.preventDefault();
      const current = items.indexOf(document.activeElement as HTMLElement);
      const next =
        e.key === 'Home'
          ? 0
          : e.key === 'End'
            ? items.length - 1
            : e.key === 'ArrowDown'
              ? (current + 1 + items.length) % items.length
              : (current - 1 + items.length) % items.length;
      items[next].focus();
    },
    [close, triggerRef, menuRef]
  );
}

// --- Notifications ------------------------------------------------------------

interface INotificationItem {
  key: string;
  kind: 'news' | 'event';
  title: string;
  date: Date;
  url: string | undefined;
  openInNewTab: boolean;
}

const SEEN_STORAGE_KEY = 'th-notif-seen';
const SEEN_CAP = 200;

function readSeen(): string[] {
  try {
    const raw = window.localStorage.getItem(SEEN_STORAGE_KEY);
    const parsed: unknown = raw === null ? [] : JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

function writeSeen(keys: string[]): void {
  try {
    window.localStorage.setItem(SEEN_STORAGE_KEY, JSON.stringify(keys.slice(-SEEN_CAP)));
  } catch {
    /* Storage unavailable - read state just won't persist across visits. */
  }
}

/**
 * The bell's feed: the latest Travel News and Upcoming Events, read through
 * the SAME services (and cache) the Travel Updates section already uses - no
 * new list or schema. "Read" is tracked per viewer in localStorage.
 */
function useTravelNotifications(): {
  items: INotificationItem[];
  loading: boolean;
  unread: number;
  isUnread: (key: string) => boolean;
  markRead: (key: string) => void;
  markAllRead: () => void;
} {
  const { news, events, configuration } = useServices();
  const { status, data } = useAsyncData(async () => {
    const [newsItems, eventItems] = await Promise.all([
      news.getNews(configuration).catch((): ITravelNews[] => []),
      events.getUpcomingEvents(configuration).catch((): ITravelEvent[] => [])
    ]);
    const merged: INotificationItem[] = [
      ...newsItems.map((n) => ({
        key: `news:${String(n.id)}`,
        kind: 'news' as const,
        title: n.title,
        date: n.publishDate,
        url: n.targetUrl,
        openInNewTab: n.openInNewTab
      })),
      ...eventItems.map((e) => ({
        key: `event:${String(e.id)}`,
        kind: 'event' as const,
        title: e.title,
        date: e.eventDate,
        url: e.registrationUrl,
        openInNewTab: true
      }))
    ];
    return merged;
  }, [configuration]);

  const [seen, setSeen] = React.useState<string[]>(readSeen);
  const items = data ?? [];
  const isUnread = React.useCallback((key: string) => seen.indexOf(key) < 0, [seen]);
  const unread = items.filter((i) => isUnread(i.key)).length;

  const markRead = React.useCallback((key: string) => {
    setSeen((prev) => {
      if (prev.indexOf(key) >= 0) {
        return prev;
      }
      const next = [...prev, key];
      writeSeen(next);
      return next;
    });
  }, []);

  const markAllRead = React.useCallback(() => {
    setSeen((prev) => {
      const next = [...prev, ...items.map((i) => i.key).filter((k) => prev.indexOf(k) < 0)];
      writeSeen(next);
      return next;
    });
  }, [items]);

  return { items, loading: status === 'loading', unread, isUnread, markRead, markAllRead };
}

// --- Component ------------------------------------------------------------------

export const TopbarActions: React.FC = () => {
  const { configuration } = useServices();
  const { canvas, setCanvas, user } = useShell();
  const [open, setOpen] = React.useState<OpenMenu>(undefined);
  const close = React.useCallback(() => setOpen(undefined), []);
  const toggle = (menu: Exclude<OpenMenu, undefined>): void => setOpen((current) => (current === menu ? undefined : menu));

  const themeTriggerRef = React.useRef<HTMLButtonElement>(null);
  const themeMenuRef = React.useRef<HTMLDivElement>(null);
  const notifTriggerRef = React.useRef<HTMLButtonElement>(null);
  const notifMenuRef = React.useRef<HTMLDivElement>(null);
  const profileTriggerRef = React.useRef<HTMLButtonElement>(null);
  const profileMenuRef = React.useRef<HTMLDivElement>(null);
  const onThemeKeyDown = useMenuKeyboard(open === 'theme', close, themeTriggerRef, themeMenuRef);
  const onNotifKeyDown = useMenuKeyboard(open === 'notifications', close, notifTriggerRef, notifMenuRef);
  const onProfileKeyDown = useMenuKeyboard(open === 'profile', close, profileTriggerRef, profileMenuRef);

  const notifications = useTravelNotifications();
  const initials = getInitials(user);
  const dateOpts = configuration.dates;

  const selectCanvas = (k: ThCanvas): void => {
    setCanvas(k);
    close();
  };

  const openNotification = (item: INotificationItem): void => {
    notifications.markRead(item.key);
    if (item.url === undefined) {
      return;
    }
    if (item.openInNewTab) {
      window.open(item.url, '_blank', 'noopener,noreferrer');
    } else {
      window.location.assign(item.url);
    }
  };

  const bellLabel =
    notifications.unread > 0 ? `Notifications, ${String(notifications.unread)} unread` : 'Notifications';

  return (
    <div className={styles.root}>
      {open !== undefined && <div className={styles.scrim} onClick={close} aria-hidden="true" />}

      {/* Theme (canvas) menu */}
      <div className={styles.slot} data-th-topbar-theme="true">
        <button
          type="button"
          ref={themeTriggerRef}
          className={styles.themeTrigger}
          onClick={() => toggle('theme')}
          aria-haspopup="menu"
          aria-expanded={open === 'theme'}
          aria-label={`Theme: ${CANVAS_LABEL[canvas]}`}
        >
          <span className={styles.swatch} style={{ background: CANVAS_SWATCH[canvas] }} />
          <span className={styles.triggerLabel}>{CANVAS_LABEL[canvas]}</span>
          <Svg d={ICON.chevron} size={14} strokeWidth={2} className={`${styles.chevron} ${open === 'theme' ? styles.chevronOpen : ''}`} />
        </button>
        {open === 'theme' && (
          <div ref={themeMenuRef} role="menu" tabIndex={-1} aria-label="Canvas" className={`${styles.menu} ${styles.themeMenu}`} onKeyDown={onThemeKeyDown}>
            {CANVAS_KEYS.map((k) => {
              const on = canvas === k;
              return (
                <button
                  key={k}
                  type="button"
                  role="menuitemradio"
                  aria-checked={on}
                  className={`${styles.menuItem} ${on ? styles.menuItemOn : ''}`}
                  onClick={() => selectCanvas(k)}
                >
                  <span className={styles.swatchLg} style={{ background: CANVAS_SWATCH[k] }} />
                  <span className={styles.menuItemLabel}>{CANVAS_LABEL[k]}</span>
                  {on && <Svg d={ICON.check} size={15} strokeWidth={2.4} className={styles.check} />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Notification bell */}
      <div className={styles.slot}>
        <button
          type="button"
          ref={notifTriggerRef}
          className={styles.bell}
          onClick={() => toggle('notifications')}
          aria-haspopup="menu"
          aria-expanded={open === 'notifications'}
          aria-label={bellLabel}
          title="Notifications"
        >
          <Svg d={ICON.bell} size={19} />
          {notifications.unread > 0 && (
            <span className={styles.badge} aria-hidden="true">
              {notifications.unread > 9 ? '9+' : notifications.unread}
            </span>
          )}
        </button>
        {open === 'notifications' && (
          <div ref={notifMenuRef} role="menu" tabIndex={-1} aria-label="Notifications" className={`${styles.menu} ${styles.notifMenu}`} onKeyDown={onNotifKeyDown}>
            <div className={styles.notifHeader} role="presentation">
              <span className={styles.notifTitle}>Notifications</span>
              {notifications.unread > 0 && (
                <button type="button" className={styles.markAll} onClick={notifications.markAllRead}>
                  Mark all as read
                </button>
              )}
            </div>
            {notifications.loading && <div className={styles.notifEmpty}>Loading…</div>}
            {!notifications.loading && notifications.items.length === 0 && (
              <div className={styles.notifEmpty}>You&apos;re all caught up.</div>
            )}
            {notifications.items.map((item) => {
              const unread = notifications.isUnread(item.key);
              return (
                <button
                  key={item.key}
                  type="button"
                  role="menuitem"
                  className={`${styles.notifItem} ${unread ? styles.notifItemUnread : ''}`}
                  onClick={() => openNotification(item)}
                >
                  <span className={styles.notifIcon}>
                    <Svg d={item.kind === 'news' ? ICON.news : ICON.event} size={16} />
                  </span>
                  <span className={styles.notifBody}>
                    <span className={styles.notifItemTitle}>{item.title}</span>
                    <span className={styles.notifMeta}>
                      {item.kind === 'news' ? 'Travel News' : 'Upcoming Event'} · {formatLongDate(item.date, dateOpts)}
                    </span>
                  </span>
                  {unread && <span className={styles.unreadDot} aria-label="Unread" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Profile menu */}
      <div className={`${styles.slot} ${styles.profileSlot}`} data-th-topbar-profile="true">
        <button
          type="button"
          ref={profileTriggerRef}
          className={styles.profileTrigger}
          onClick={() => toggle('profile')}
          aria-haspopup="menu"
          aria-expanded={open === 'profile'}
          aria-label={`Account menu for ${user.displayName}`}
        >
          <span className={styles.avatar}>{initials}</span>
          <span className={styles.profileName}>{user.displayName}</span>
          <Svg d={ICON.chevron} size={14} strokeWidth={2} className={`${styles.chevron} ${open === 'profile' ? styles.chevronOpen : ''}`} />
        </button>
        {open === 'profile' && (
          <div ref={profileMenuRef} role="menu" tabIndex={-1} aria-label="Account menu" className={`${styles.menu} ${styles.profileMenu}`} onKeyDown={onProfileKeyDown}>
            <div className={styles.profileCard} role="presentation">
              <span className={`${styles.avatar} ${styles.avatarLg}`}>{initials}</span>
              <span className={styles.profileText}>
                <span className={styles.profileCardName}>{user.displayName}</span>
                {user.email.length > 0 && <span className={styles.profileCardMeta}>{user.email}</span>}
              </span>
            </div>
            <a
              role="menuitem"
              className={styles.profileItem}
              href="https://myaccount.microsoft.com/"
              target="_blank"
              rel="noopener noreferrer"
              onClick={close}
            >
              <Svg d={ICON.profile} size={17} strokeWidth={1.7} className={styles.profileItemIcon} />
              <span>My account</span>
            </a>
            <button
              type="button"
              role="menuitem"
              className={styles.profileItem}
              onClick={() => setOpen('notifications')}
            >
              <Svg d={ICON.bell} size={17} strokeWidth={1.7} className={styles.profileItemIcon} />
              <span>Notifications</span>
            </button>
            <a role="menuitem" className={styles.profileItem} href="/_layouts/15/SignOut.aspx">
              <Svg d={ICON.signout} size={17} strokeWidth={1.7} className={styles.profileItemIcon} />
              <span>Sign out</span>
            </a>
          </div>
        )}
      </div>
    </div>
  );
};
