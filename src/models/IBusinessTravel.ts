/** One of the 5 process-step cards on the Business Travel page (from TH_BusinessTravelSteps). */
export interface IBusinessTravelStep {
  id: number;
  /** The number shown in the small square (e.g. 1..5). */
  number: number;
  title: string;
  description: string;
  /** Validated CSS colour for the square's background. */
  backgroundColor: string;
  displayOrder: number;
}

/** One of the info cards below the steps, e.g. "Policy reminders" or "Employee Relocation" (from TH_BusinessTravelInfoCards). */
export interface IBusinessTravelInfoCard {
  id: number;
  title: string;
  description: string;
  icon: string | undefined;
  /** In-app navigation to a TH_PolicyPages row (e.g. "employee-relocation") - wins over `linkUrl` when both are set. */
  targetSlug: string | undefined;
  /** Validated destination for the "View" link; `undefined` hides the link. */
  linkUrl: string | undefined;
  linkText: string;
  openInNewTab: boolean;
  displayOrder: number;
}
