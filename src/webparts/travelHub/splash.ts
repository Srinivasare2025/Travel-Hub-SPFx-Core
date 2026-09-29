/**
 * Pre-React loading screen, painted by TravelHubWebPart the moment SharePoint
 * runs the (deliberately tiny) entry bundle - BEFORE React, Fluent, PnPjs and
 * the app chunk have downloaded. It draws the app's own frame (raised top bar
 * with its gold hairline, then the page canvas) in the viewer's saved canvas,
 * so the page reads as "Travel Hub is opening" instead of SharePoint's page
 * content followed by a swap to the app. React replaces it on first render.
 *
 * NO imports on purpose: anything imported here lands in the entry bundle and
 * delays the splash. The storage key and canvas colours duplicate
 * common/context/ShellContext.ts and common/styles/_tokens.scss - keep them in
 * step. (Same pattern as the sibling fa-portal solution's src/styles/splash.ts.)
 */
const STORAGE_KEY = 'th-canvas';

// [page canvas, raised top bar, ink, muted ink] per canvas - _tokens.scss.
const CANVAS: Record<string, [string, string, string, string]> = {
  sky: ['#dff0f6', '#ebf6fa', '#081c32', '#3c5573'],
  cream: ['#f5f0e1', '#faf6ec', '#081c32', '#3c5573'],
  dark: ['#0f2c4a', '#0b233c', '#faf6ec', '#d2c8af']
};

function storedCanvas(): string {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored !== null && Object.prototype.hasOwnProperty.call(CANVAS, stored)) {
      return stored;
    }
  } catch {
    // Storage unavailable - use the default canvas.
  }
  return 'sky';
}

const SPLASH_CSS =
  '@keyframes thSplashSlide{0%{transform:translateX(-100%)}100%{transform:translateX(250%)}}' +
  '.th-splash-bar{position:relative;width:160px;height:3px;margin:18px auto 0;border-radius:9999px;overflow:hidden;background:rgba(195,161,94,.22)}' +
  '.th-splash-bar>span{position:absolute;inset:0;width:40%;border-radius:inherit;background:#c3a15e;animation:thSplashSlide 1.1s cubic-bezier(.2,0,0,1) infinite}' +
  '@media (prefers-reduced-motion:reduce){.th-splash-bar>span{animation:none;width:100%;opacity:.6}}';

const FONT_BODY = "'Noto Sans',system-ui,-apple-system,'Segoe UI',sans-serif";
const FONT_DISPLAY = "'Cormorant Garamond',Georgia,serif";

/** Paint the splash into the web part's element (replaced by React's first render). */
export function renderSplash(el: HTMLElement): void {
  const [canvas, raised, ink, muted] = CANVAS[storedCanvas()];
  el.innerHTML =
    `<style>${SPLASH_CSS}</style>` +
    `<div class="th-splash" role="status" aria-live="polite" style="min-height:100vh;display:flex;flex-direction:column;background:${canvas};color:${ink};font-family:${FONT_BODY}">` +
    `<div style="height:64px;flex:none;background:${raised};border-bottom:1px solid rgba(195,161,94,.32);box-shadow:0 7px 24px rgba(8,28,50,.045)"></div>` +
    '<div style="flex:1;display:flex;align-items:center;justify-content:center;padding:48px 16px">' +
    '<div style="text-align:center">' +
    `<div style="font-family:${FONT_DISPLAY};font-style:italic;font-size:15px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:${muted}">Travel Hub</div>` +
    '<div class="th-splash-bar"><span></span></div>' +
    '<div style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">Loading Travel Hub</div>' +
    '</div></div></div>';
}

/** Shown if the app chunk fails to download, or the service layer fails to start. */
export function renderLoadError(el: HTMLElement): void {
  const [canvas, , ink] = CANVAS[storedCanvas()];
  el.innerHTML =
    `<div role="alert" style="min-height:60vh;display:flex;align-items:center;justify-content:center;padding:48px 16px;background:${canvas};color:${ink};font-family:${FONT_BODY};text-align:center">` +
    '<div><div style="font-size:18px;font-weight:600;margin-bottom:8px">Travel Hub could not start</div>' +
    '<div style="font-size:14px;opacity:.8">Please refresh the page or contact your administrator.</div></div></div>';
}
