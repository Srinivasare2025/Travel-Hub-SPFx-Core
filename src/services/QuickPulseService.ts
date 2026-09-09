/* eslint-disable @rushstack/no-new-null -- raw SharePoint list rows use `null` for empty fields. */
import {
  IQuickPulseAggregate,
  IQuickPulseOption,
  IQuickPulseQuestion,
  IQuickPulseResponseInput,
  IQuickPulseState,
  ITravelHubConfiguration
} from '../models';
import type { SharePointService } from './base/SharePointService';
import { Logger } from './base/Logger';
import { toBool, toNumber, toStringOr } from '../common/utils/collection';

const QUESTIONS_LIST = 'TH_QuickPulseQuestions';
const OPTIONS_LIST = 'TH_QuickPulseOptions';
const RESPONSES_LIST = 'TH_QuickPulseResponses';

interface IRawQuestion {
  Id: number;
  Title: string | null;
  IsActive: boolean | null;
  StartDate: string | null;
  EndDate: string | null;
  AllowComments: boolean | null;
  OneResponsePerUser: boolean | null;
}

interface IRawOption {
  Id: number;
  Title: string | null;
  Icon: string | null;
  OptionValue: number | null;
  DisplayOrder: number | null;
  QuestionIdId: number | null;
}

interface IRawResponseValue {
  Id: number;
  ResponseValue: number | null;
}

/** OData string-literal escaping: SharePoint REST doubles an embedded single quote. */
function odataString(value: string): string {
  return value.replace(/'/g, "''");
}

export interface IQuickPulseService {
  /** The active question + options + this user's own participation state. Never includes other users' rows. */
  getState(config: ITravelHubConfiguration): Promise<IQuickPulseState>;
  /** Submits the current user's response. Re-checks the one-response-per-user guard before inserting. */
  submitResponse(input: IQuickPulseResponseInput, oneResponsePerUser: boolean): Promise<void>;
  /** Aggregate counts only — call only when `IQuickPulseState.canViewResults` is true. */
  getAggregate(questionId: number): Promise<IQuickPulseAggregate | undefined>;
}

/**
 * SECURITY.md §2: the real control is `TH_QuickPulseResponses` list permissions
 * (members: add + read-own-items-only; Pulse Admins: read/manage). This service
 * never returns raw response rows to a component — only a boolean
 * (`userHasResponded`) or a pre-aggregated count shape.
 */
export class QuickPulseService implements IQuickPulseService {
  private readonly log: Logger;

  public constructor(
    private readonly spo: SharePointService,
    logger: Logger
  ) {
    this.log = logger.child('QuickPulseService');
  }

  public async getState(config: ITravelHubConfiguration): Promise<IQuickPulseState> {
    const question = await this.getActiveQuestion();
    if (question === undefined) {
      return { question: undefined, options: [], userHasResponded: false, canViewResults: false };
    }

    const [options, userHasResponded, canViewResults] = await Promise.all([
      this.getOptions(question.id),
      this.hasUserResponded(question),
      this.canViewResults(config)
    ]);

    return { question, options, userHasResponded, canViewResults };
  }

  public async submitResponse(input: IQuickPulseResponseInput, oneResponsePerUser: boolean): Promise<void> {
    const user = await this.spo.getCurrentUser();

    if (oneResponsePerUser) {
      const existing = await this.spo.countItems(
        RESPONSES_LIST,
        `QuestionIdId eq ${String(input.questionId)} and RespondentUpn eq '${odataString(user.loginName)}'`
      );
      if (existing > 0) {
        throw new Error('You have already submitted a response to this question.');
      }
    }

    await this.spo.addListItem(RESPONSES_LIST, {
      Title: `Response ${new Date().toISOString()}`,
      QuestionIdId: input.questionId,
      ResponseValue: input.responseValue,
      Comments: input.comments ?? null,
      RespondentUpn: user.loginName,
      SubmittedDate: new Date().toISOString()
    });
  }

  public async getAggregate(questionId: number): Promise<IQuickPulseAggregate | undefined> {
    try {
      // Select ONLY ResponseValue - never Comments/RespondentUpn - and collapse
      // straight into counts; the per-row values never leave this function.
      const raw = await this.spo.getListItems<IRawResponseValue>({
        list: RESPONSES_LIST,
        select: ['Id', 'ResponseValue'],
        filter: `QuestionIdId eq ${String(questionId)}`,
        top: 2000
      });

      const counts = new Map<number, number>();
      for (const row of raw) {
        const value = toNumber(row.ResponseValue, NaN);
        if (!isFinite(value)) {
          continue;
        }
        counts.set(value, (counts.get(value) ?? 0) + 1);
      }

      const totalResponses = raw.length;
      const breakdown = Array.from(counts.entries())
        .map(([value, count]) => ({
          value,
          count,
          percent: totalResponses > 0 ? Math.round((count / totalResponses) * 100) : 0
        }))
        .sort((a, b) => b.value - a.value);

      return { questionId, totalResponses, breakdown };
    } catch (error) {
      this.log.error(`Could not compute the Quick Pulse aggregate for question ${String(questionId)}`, error);
      return undefined;
    }
  }

  private async getActiveQuestion(): Promise<IQuickPulseQuestion | undefined> {
    const nowIso = new Date().toISOString();
    const raw = await this.spo.getListItems<IRawQuestion>({
      list: QUESTIONS_LIST,
      select: ['Id', 'Title', 'IsActive', 'StartDate', 'EndDate', 'AllowComments', 'OneResponsePerUser'],
      filter: `IsActive eq 1 and (StartDate eq null or StartDate le datetime'${nowIso}') and (EndDate eq null or EndDate ge datetime'${nowIso}')`,
      top: 1
    });
    const item = raw[0];
    if (item === undefined) {
      return undefined;
    }
    return {
      id: item.Id,
      question: toStringOr(item.Title, 'How was your recent travel experience?'),
      allowComments: toBool(item.AllowComments, true),
      oneResponsePerUser: toBool(item.OneResponsePerUser, true)
    };
  }

  private async getOptions(questionId: number): Promise<IQuickPulseOption[]> {
    const raw = await this.spo.getListItems<IRawOption>({
      list: OPTIONS_LIST,
      select: ['Id', 'Title', 'Icon', 'OptionValue', 'DisplayOrder', 'QuestionIdId'],
      filter: `QuestionIdId eq ${String(questionId)} and IsActive eq 1`,
      orderBy: { field: 'DisplayOrder', ascending: true },
      top: 10
    });
    return raw.map((item) => ({
      id: item.Id,
      questionId: item.QuestionIdId ?? questionId,
      title: toStringOr(item.Title, 'Option'),
      icon: toStringOr(item.Icon, 'Emoji2'),
      value: toNumber(item.OptionValue, 0, { min: 0, max: 100 }),
      displayOrder: toNumber(item.DisplayOrder, 0)
    }));
  }

  private async hasUserResponded(question: IQuickPulseQuestion): Promise<boolean> {
    if (!question.oneResponsePerUser) {
      return false;
    }
    try {
      const user = await this.spo.getCurrentUser();
      const count = await this.spo.countItems(
        RESPONSES_LIST,
        `QuestionIdId eq ${String(question.id)} and RespondentUpn eq '${odataString(user.loginName)}'`
      );
      return count > 0;
    } catch {
      // Fail open to "not responded" - submitResponse() re-checks before insert,
      // so the worst case is one retry prompt, never a silently blocked form.
      return false;
    }
  }

  private async canViewResults(config: ITravelHubConfiguration): Promise<boolean> {
    if (!config.quickPulse.showAggregateResults) {
      return false;
    }
    return this.spo.isCurrentUserInGroup(config.quickPulse.pulseAdminGroup);
  }
}
