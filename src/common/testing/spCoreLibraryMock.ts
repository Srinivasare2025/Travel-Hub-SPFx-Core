/**
 * Jest stand-in for `@microsoft/sp-core-library`, wired via `moduleNameMapper` in
 * `config/jest.config.json`. The real module imports Microsoft-internal packages
 * that don't resolve outside the SPFx runtime, which otherwise breaks any test
 * that transitively imports `Logger`. Only the members TravelHub uses are stubbed.
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- a loose test double */

const noop = (): void => undefined;

export const Log = {
  info: noop,
  warn: noop,
  error: noop,
  verbose: noop
};

export class Version {
  public static parse(value: string): Version {
    return new Version(value);
  }
  private readonly value: string;
  public constructor(value: string) {
    this.value = value;
  }
  public toString(): string {
    return this.value;
  }
}

export const Guid = {
  newGuid: (): string => '00000000-0000-0000-0000-000000000000',
  isValid: (): boolean => true
};

export const Environment = { type: 0 as any };
export const EnvironmentType = { Local: 0, SharePoint: 1, ClassicSharePoint: 2, Test: 3 };
