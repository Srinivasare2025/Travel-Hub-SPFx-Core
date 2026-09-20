/** Green Travel content block (from TH_GreenTravel — one active record). */
export interface IGreenTravel {
  id: number;
  title: string;
  subtitle: string | undefined;
  description: string;
  /** Bullet points, split from the newline-delimited `Points` field. */
  points: string[];
  imageUrl: string | undefined;
  linkUrl: string | undefined;
  linkText: string | undefined;
}
