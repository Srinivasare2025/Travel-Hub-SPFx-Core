/**
 * Brings a newly opened in-app screen into view at its top, like a real page
 * load.
 *
 * Reported issue: navigating from the bottom of one screen left the next
 * screen scrolled to the bottom too. `window.scrollTo(0)` alone does nothing
 * on a SharePoint modern page - the page scrolls inside SharePoint's own
 * content region (`[data-automation-id="contentScrollRegion"]` / a
 * `data-is-scrollable` div), not the window - so every scrollable ancestor of
 * the web part (and the document itself) is reset.
 *
 * Focus then moves to `focusTarget` (the new screen's container) without
 * scrolling again, so keyboard and screen-reader users also start at the top
 * of the new content instead of on the link they clicked in the old screen.
 */
export function scrollToTopAndFocus(from: HTMLElement | undefined, focusTarget: HTMLElement | undefined): void {
  if (typeof window === 'undefined') {
    return;
  }
  let node: HTMLElement | null = from?.parentElement ?? null;
  while (node !== null && node !== document.body) {
    if (node.scrollTop > 0) {
      node.scrollTop = 0;
    }
    node = node.parentElement;
  }
  const region = document.querySelector<HTMLElement>('[data-automation-id="contentScrollRegion"]');
  if (region !== null) {
    region.scrollTop = 0;
  }
  const scrolling = document.scrollingElement as HTMLElement | null | undefined;
  if (scrolling !== null && scrolling !== undefined) {
    scrolling.scrollTop = 0;
  }
  window.scrollTo(0, 0);

  if (focusTarget !== undefined) {
    try {
      focusTarget.focus({ preventScroll: true });
    } catch {
      focusTarget.focus();
    }
  }
}
