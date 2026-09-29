import * as React from 'react';

export type ThCanvas = 'sky' | 'cream' | 'dark';

export const CANVAS_KEYS: readonly ThCanvas[] = ['sky', 'cream', 'dark'];

/** Menu swatch per canvas - HR Hub hubViewModel.ts CANVAS_SWATCH. */
export const CANVAS_SWATCH: Record<ThCanvas, string> = {
  sky: 'rgb(127 187 222)',
  cream: 'rgb(227 211 166)',
  dark: 'rgb(18 48 78)'
};

export const CANVAS_LABEL: Record<ThCanvas, string> = { sky: 'Sky', cream: 'Cream', dark: 'Dark' };

/**
 * Page canvas colour per theme (`--full-page-bg` in _tokens.scss). Mirrored
 * onto <html> as `--th-host-canvas` so the SharePoint page behind the web
 * part (hostChrome.ts) is painted to match - no white band on Dark.
 */
export const CANVAS_PAGE_BG: Record<ThCanvas, string> = { sky: '#dff0f6', cream: '#f5f0e1', dark: '#0f2c4a' };

/**
 * localStorage key for the viewer's own canvas choice. Duplicated in the
 * import-free splash.ts (it paints before this module loads) - keep in step.
 */
export const CANVAS_STORAGE_KEY = 'th-canvas';

/** The viewer's saved canvas, or `undefined` when they never picked one (the site default then applies). */
export function readStoredCanvas(): ThCanvas | undefined {
  try {
    const stored = window.localStorage.getItem(CANVAS_STORAGE_KEY);
    return stored !== null && (CANVAS_KEYS as readonly string[]).indexOf(stored) >= 0 ? (stored as ThCanvas) : undefined;
  } catch {
    return undefined;
  }
}

export function storeCanvas(canvas: ThCanvas): void {
  try {
    window.localStorage.setItem(CANVAS_STORAGE_KEY, canvas);
  } catch {
    /* Storage unavailable (private window / blocked) - the choice just won't persist. */
  }
}

export interface IShellUser {
  displayName: string;
  email: string;
}

export interface IShellContext {
  canvas: ThCanvas;
  setCanvas: (canvas: ThCanvas) => void;
  user: IShellUser;
}

/**
 * Viewer-level shell state for the top bar (theme menu, profile menu):
 * the active canvas and the signed-in user from the SPFx page context.
 * Provided once by TravelHub.tsx; consumed via `useShell()`.
 */
export const ShellContext = React.createContext<IShellContext | undefined>(undefined);

export function useShell(): IShellContext {
  const shell = React.useContext(ShellContext);
  if (shell === undefined) {
    throw new Error('useShell() must be used within <ShellContext.Provider>. Check TravelHub.tsx.');
  }
  return shell;
}

/** "Ahmed Saleh" -> "AS"; falls back to the email's first letter. */
export function getInitials(user: IShellUser): string {
  const parts = user.displayName.trim().split(/\s+/).filter((p) => p.length > 0);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return user.email.length > 0 ? user.email[0].toUpperCase() : '?';
}
