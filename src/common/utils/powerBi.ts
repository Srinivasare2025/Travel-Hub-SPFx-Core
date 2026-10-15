/**
 * Power BI "refused to connect" (reported on the Department Travel Spend card
 * and its detail page): the link editors copy from the browser address bar -
 * `https://app.powerbi.com/groups/<ws>/reports/<id>/ReportSection…` - is the
 * Power BI *app*, which forbids being shown inside another site's frame
 * (X-Frame-Options / CSP frame-ancestors), so the iframe shows "refused to
 * connect" no matter who is signed in.
 *
 * The frame-able address is the *secure embed* URL (Power BI: File > Embed
 * report > SharePoint Online / Website or portal):
 * `https://app.powerbi.com/reportEmbed?reportId=<id>&groupId=<ws>&autoAuth=true&ctid=<tenant>`.
 * `autoAuth=true` + `ctid` make Power BI sign the viewer in silently with
 * the Microsoft 365 session they already have in SharePoint - no second
 * login - and Power BI's own permissions / row-level security still apply.
 *
 * `toPowerBiEmbedUrl` rewrites an app link into that form (and adds the
 * missing `autoAuth`/`ctid` to an embed link). Non-Power BI URLs, and the
 * public "Publish to web" links (`/view?r=`), are returned unchanged.
 */

const PBI_HOST_RE = /(^|\.)powerbi\.com$/i;
const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isPowerBiUrl(url: string | undefined): boolean {
  if (url === undefined) {
    return false;
  }
  try {
    return PBI_HOST_RE.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

export function toPowerBiEmbedUrl(url: string | undefined, tenantId: string | undefined): string | undefined {
  if (url === undefined || !isPowerBiUrl(url)) {
    return url;
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  const path = parsed.pathname;
  const lowerPath = path.toLowerCase();

  // Public "Publish to web" link - already frame-able, no sign-in involved.
  if (lowerPath === '/view') {
    return url;
  }

  const setAuth = (target: URL): string => {
    target.searchParams.set('autoAuth', 'true');
    const ctid = parsed.searchParams.get('ctid') ?? tenantId;
    if (ctid !== undefined && ctid !== null && GUID_RE.test(ctid)) {
      target.searchParams.set('ctid', ctid);
    }
    return target.toString();
  };

  // Already an embed URL - just make sure it signs in silently.
  if (lowerPath === '/reportembed' || lowerPath === '/dashboardembed' || lowerPath === '/rdlembed') {
    return setAuth(new URL(parsed.toString()));
  }

  // App URL: /groups/<ws|me>/(reports|dashboards|rdlreports)/<id>[/<pageName>]
  const m = /^\/groups\/([^/]+)\/(reports|dashboards|rdlreports)\/([^/]+)(?:\/([^/?#]+))?/i.exec(path);
  if (m === null) {
    return url;
  }
  const [, group, kind, id, page] = m;
  const kindLower = kind.toLowerCase();
  const embed = new URL(
    kindLower === 'dashboards' ? '/dashboardEmbed' : kindLower === 'rdlreports' ? '/rdlEmbed' : '/reportEmbed',
    `${parsed.protocol}//${parsed.host}`
  );
  embed.searchParams.set(kindLower === 'dashboards' ? 'dashboardId' : 'reportId', id);
  if (group.toLowerCase() !== 'me') {
    embed.searchParams.set('groupId', group);
  }
  if (kindLower === 'reports' && page !== undefined && page.length > 0) {
    embed.searchParams.set('pageName', page);
  }
  // Keep report filters the editor added (e.g. ?filter=Dept/Name eq 'X').
  const filter = parsed.searchParams.get('filter');
  if (filter !== null) {
    embed.searchParams.set('filter', filter);
  }
  return setAuth(embed);
}
