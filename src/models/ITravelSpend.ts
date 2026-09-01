/**
 * Department travel spend figures. TravelHub only *displays* these — it performs
 * no aggregation or currency maths. Authorisation is enforced by the data source,
 * not the UI. See SECURITY.md §3 and ASSUMPTIONS (A23-A26).
 */
export interface ITravelSpend {
  department: string;
  /** Label only, e.g. "2024-Q1". */
  period: string;
  /** ISO 4217. */
  currency: string;
  totalSpend: number;
  airSpend: number;
  hotelSpend: number;
  groundTransportSpend: number;
  bookingSpend: number;
  dashboardUrl: string | undefined;
  source: 'sharepoint' | 'powerbi' | 'concur' | 'api' | 'warehouse';
}

export interface ITravelSpendAccess {
  hasAccess: boolean;
  reason: 'granted' | 'not-in-group' | 'no-department' | 'source-denied';
}
