/** A footer link (from TH_FooterLinks). */
export interface IFooterLink {
  id: number;
  columnId: number;
  title: string;
  /** Validated; `undefined` when invalid (link is dropped). */
  url: string | undefined;
  icon: string | undefined;
  openInNewTab: boolean;
  displayOrder: number;
}

/** A footer column with its links composed in (from TH_FooterColumns). */
export interface IFooterColumn {
  id: number;
  title: string;
  displayOrder: number;
  links: IFooterLink[];
}

/** Everything the footer renders. */
export interface IFooterContent {
  columns: IFooterColumn[];
  legalText: string;
  lastUpdatedText: string | undefined;
  qrCodeUrl: string | undefined;
}
