/** A member of the travel team (from TH_TravelTeam). */
export interface ITravelTeamMember {
  id: number;
  name: string;
  designation: string;
  department: string | undefined;
  specialization: string | undefined;
  profileImageUrl: string | undefined;
  /** Sanitised local part; rendered only as `mailto:`. */
  email: string | undefined;
  /** Sanitised digits; rendered only as `tel:`. */
  phone: string | undefined;
  location: string | undefined;
  displayOrder: number;
}
