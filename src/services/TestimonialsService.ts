/* eslint-disable @rushstack/no-new-null -- raw SharePoint list rows use `null` for empty fields. */
import { ITestimonialSubmissionInput, ITravelerTestimonial, ITravelHubConfiguration } from '../models';
import type { SharePointService } from './base/SharePointService';
import { Logger } from './base/Logger';
import type { ICache } from './base/MemoryCache';
import { sanitizeUrl } from '../common/utils/urlValidation';
import { orderBy, toNumber, toOptionalString, toStringOr } from '../common/utils/collection';

const LIST = 'TH_TravelerTestimonials';
const TTL_SECONDS = 300;

interface IRawTestimonialItem {
  Id: number;
  Title: string | null;
  ProfileImage: { Url: string } | null;
  Rating: number | null;
  Comment: string | null;
  Category: string | null;
  Designation: string | null;
  Department: string | null;
  Location: string | null;
  PersonInfoLine: string | null;
  DisplayOrder: number | null;
}

const SELECT = [
  'Id',
  'Title',
  'ProfileImage',
  'Rating',
  'Comment',
  'Category',
  'Designation',
  'Department',
  'Location',
  'PersonInfoLine',
  'DisplayOrder'
];

export interface ITestimonialsService {
  /** Every active testimonial - the carousel paginates client-side, and `ViewAllFeedbackScreen` shows this same list in full. */
  getTestimonials(config: ITravelHubConfiguration): Promise<ITravelerTestimonial[]>;
  /**
   * Submits a new testimonial from `SubmitFeedbackScreen`. Written with
   * `IsActive = false` - new submissions are held for moderation and won't
   * appear on the hub until an admin reviews and activates the row, the same
   * caution SECURITY.md applies to other user-submitted content. The
   * submitter's name comes from their signed-in identity, never a free-text
   * field, so a testimonial can't be posted under someone else's name.
   */
  submitFeedback(input: ITestimonialSubmissionInput): Promise<void>;
}

/** ASSUMPTIONS_AND_OPEN_QUESTIONS.md A20: `personInfoLine` composed from
 * `testimonials.personInfoTemplate` unless the row sets its own override. */
export class TestimonialsService implements ITestimonialsService {
  private readonly log: Logger;

  public constructor(
    private readonly spo: SharePointService,
    private readonly cache: ICache,
    logger: Logger
  ) {
    this.log = logger.child('TestimonialsService');
  }

  public async getTestimonials(config: ITravelHubConfiguration): Promise<ITravelerTestimonial[]> {
    return this.cache.getOrAdd('testimonials', TTL_SECONDS, async () => {
      const raw = await this.spo.getListItems<IRawTestimonialItem>({
        list: LIST,
        select: SELECT,
        filter: 'IsActive eq 1',
        orderBy: { field: 'DisplayOrder', ascending: true },
        top: 100
      });
      const mapped = raw.map((item) => this.mapTestimonial(item, config.testimonials.personInfoTemplate));
      return orderBy(mapped, (t) => t.displayOrder);
    });
  }

  public async submitFeedback(input: ITestimonialSubmissionInput): Promise<void> {
    const user = await this.spo.getCurrentUser();
    await this.spo.addListItem(LIST, {
      Title: user.displayName,
      Rating: Math.min(5, Math.max(1, Math.round(input.rating))),
      Comment: input.comment,
      Category: input.category ?? null,
      Designation: input.designation ?? null,
      Department: input.department ?? null,
      Location: input.location ?? null,
      DisplayOrder: 0,
      IsActive: false
    });
  }

  private mapTestimonial(item: IRawTestimonialItem, template: string): ITravelerTestimonial {
    const profileImageUrl = sanitizeUrl(item.ProfileImage?.Url);
    if (item.ProfileImage?.Url !== undefined && profileImageUrl === undefined) {
      this.log.warn(`Testimonial ${String(item.Id)} has an unsafe ProfileImage URL; the photo will be hidden.`);
    }

    const designation = toOptionalString(item.Designation);
    const location = toOptionalString(item.Location);
    const override = toOptionalString(item.PersonInfoLine);
    const personInfoLine = override ?? this.composePersonInfoLine(template, designation, location);

    return {
      id: item.Id,
      personName: toStringOr(item.Title, 'A traveller'),
      profileImageUrl,
      rating: toNumber(item.Rating, 5, { min: 1, max: 5 }),
      comment: toStringOr(item.Comment, ''),
      category: toOptionalString(item.Category),
      designation,
      department: toOptionalString(item.Department),
      location,
      personInfoLine,
      displayOrder: toNumber(item.DisplayOrder, 0)
    };
  }

  /**
   * `{designation}` / `{location}` token replace. When only one is present,
   * render it alone rather than filling the other token with an empty string -
   * that would leave the template's own separator (e.g. the " – " in the
   * default `{designation} – {location}`) dangling, and neither value is
   * regex-scanned for accidental separator characters (a real "Co-ordinator"
   * or "Riyadh-West" must never be mangled).
   */
  private composePersonInfoLine(template: string, designation: string | undefined, location: string | undefined): string | undefined {
    if (designation !== undefined && location !== undefined) {
      return template.replace('{designation}', designation).replace('{location}', location);
    }
    return designation ?? location;
  }
}
