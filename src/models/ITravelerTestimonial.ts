/** A traveller testimonial card (from TH_TravelerTestimonials). */
export interface ITravelerTestimonial {
  id: number;
  personName: string;
  profileImageUrl: string | undefined;
  /** 1..5. */
  rating: number;
  comment: string;
  /** Free-text tag shown top-left of the card, e.g. "Business Travel" / "Travel Care" / "Personal Travel". */
  category: string | undefined;
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

/** Write model for a new testimonial submitted from `SubmitFeedbackScreen`. */
export interface ITestimonialSubmissionInput {
  rating: number;
  comment: string;
  category: string | undefined;
  designation: string | undefined;
  department: string | undefined;
  location: string | undefined;
}
