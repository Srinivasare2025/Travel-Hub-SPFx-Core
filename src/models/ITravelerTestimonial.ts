/** A traveller testimonial card (from TH_TravelerTestimonials). */
export interface ITravelerTestimonial {
  id: number;
  personName: string;
  profileImageUrl: string | undefined;
  /** 1..5. */
  rating: number;
  comment: string;
  designation: string | undefined;
  department: string | undefined;
  location: string | undefined;
  /**
   * Explicit override for the ambiguous sub-line in the mock. When set it is
   * rendered verbatim; otherwise the line is composed from
   * `testimonials.personInfoTemplate`. See ASSUMPTIONS_AND_OPEN_QUESTIONS (A20/Q13).
   */
  personInfoLine: string | undefined;
  displayOrder: number;
}
