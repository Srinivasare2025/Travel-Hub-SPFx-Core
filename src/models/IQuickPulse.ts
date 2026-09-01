/** Active Quick Pulse question (from TH_QuickPulseQuestions). */
export interface IQuickPulseQuestion {
  id: number;
  question: string;
  allowComments: boolean;
  oneResponsePerUser: boolean;
}

/** A selectable answer option (from TH_QuickPulseOptions). */
export interface IQuickPulseOption {
  id: number;
  questionId: number;
  title: string;
  /** Emoji or icon key. */
  icon: string;
  /** Ordinal used for aggregation (e.g. 5..1). */
  value: number;
  displayOrder: number;
}

/** Write model for submitting a response. */
export interface IQuickPulseResponseInput {
  questionId: number;
  responseValue: number;
  comments: string | undefined;
}

/** Read model — aggregate only, never per-user rows. Available to permitted users. */
export interface IQuickPulseAggregate {
  questionId: number;
  totalResponses: number;
  breakdown: Array<{ value: number; count: number; percent: number }>;
}

/** What a normal user is allowed to know about their own participation. */
export interface IQuickPulseState {
  question: IQuickPulseQuestion | undefined;
  options: IQuickPulseOption[];
  userHasResponded: boolean;
  /** Whether the current user may view aggregate results. */
  canViewResults: boolean;
}
