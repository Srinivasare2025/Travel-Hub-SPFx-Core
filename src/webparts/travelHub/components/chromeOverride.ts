const STYLE_ELEMENT_ID = 'th-fullbleed-chrome-override';

/** Stamped on the web part's own root element so the injected CSS below can
 * scope itself to pages that actually host TravelHub, via `:has()`, instead
 * of touching every zone/section on the page unconditionally. */
export const SHELL_MARKER_ATTR = 'data-th-shell';

/**
 * When `layout.fullBleed` is on, the web part is meant to span the page
 * edge-to-edge inside a full-width section (DEPLOYMENT.md "Full-width page").
 * SharePoint's own chrome - the suite/command bar and the mobile app bar -
 * sits above the page canvas, and the canvas's own zone/section/control-zone
 * wrappers (`#spPageCanvasContent`, `.CanvasZone`, `.CanvasSection`,
 * `.CanvasZoneSectionContainer`, `.ControlZone`) each carry their own
 * margin/padding/rounding/shadow/max-width, so without this override the web
 * part still shows a white gutter and site chrome even inside a full-width
 * section. CSS Modules can't reach elements outside the web part's own DOM,
 * so this injects a single global `<style>` tag and removes it again when
 * `fullBleed` is off or the web part unmounts.
 *
 * The canvas-zone neutralization technique (`:has([data-th-shell])`-scoped
 * resets on the zone/section/control-zone classes, rather than one blanket
 * rule on `#spPageCanvasContent`) mirrors the sibling HR-Hub-SPFx solution's
 * `src/styles/host-reset.css` - `.CanvasZone`/`.CanvasSection`/
 * `.CanvasZoneSectionContainer`/`.ControlZone` are SharePoint's own stable,
 * documented modern-page framework classes (unlike a hashed Fluent class),
 * and scoping every rule to `:has()` the shell marker means a page that
 * mixes TravelHub with other web parts only has ITS zone neutralized, not
 * every zone on the page. `:has()` is Baseline-2023-supported and SharePoint
 * Online's modern experience requires an evergreen browser, so no fallback
 * is provided for older engines (same call as HR-Hub-SPFx's own comment).
 *
 * `[class*="headerRow-"]` (and the literal `.headerRow-113` kept alongside
 * it) targets a hashed Fluent UI class name for the modern site header row -
 * it is NOT a stable public SharePoint selector and the numeric suffix can
 * change with a SharePoint service update. If the header row reappears after
 * such an update, re-inspect the page in devtools and update the selector
 * here.
 */
export function applyFullBleedChrome(enable: boolean): void {
  if (typeof document === 'undefined') {
    return;
  }

  const existing = document.getElementById(STYLE_ELEMENT_ID);

  if (!enable) {
    if (existing !== null) {
      existing.remove();
    }
    return;
  }

  if (existing !== null) {
    return;
  }

  const marker = `[${SHELL_MARKER_ATTR}]`;

  const style = document.createElement('style');
  style.id = STYLE_ELEMENT_ID;
  style.textContent = `
    body:has(${marker}) #spCommandBar,
    body:has(${marker}) #sp-appBar,
    body:has(${marker}) #spAppBar,
    body:has(${marker}) .headerRow-113,
    body:has(${marker}) [class*="headerRow-"] {
      display: none !important;
    }

    #spPageChromeAppDiv:has(${marker}),
    #spPageCanvasContent:has(${marker}) {
      margin: 0 !important;
      padding: 0 !important;
      border-radius: 0 !important;
      box-shadow: none !important;
      max-width: none !important;
    }

    .CanvasZone:has(${marker}),
    .CanvasSection:has(${marker}),
    .CanvasZoneSectionContainer:has(${marker}),
    .ControlZone:has(${marker}) {
      margin: 0 !important;
      padding: 0 !important;
      border: 0 !important;
      border-radius: 0 !important;
      box-shadow: none !important;
      background: transparent !important;
      max-width: none !important;
    }
  `;
  document.head.appendChild(style);
}
