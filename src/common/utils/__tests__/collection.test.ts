import { orderBy, toBool, toNumber, toOptionalString, toStringOr } from '../collection';

describe('orderBy', () => {
  it('sorts ascending by the primary selector and is stable via the tiebreaker', () => {
    const items = [
      { id: 'a', order: 2, sub: 1 },
      { id: 'b', order: 1, sub: 2 },
      { id: 'c', order: 2, sub: 0 }
    ];
    const sorted = orderBy(items, (i) => i.order, (i) => i.sub).map((i) => i.id);
    expect(sorted).toEqual(['b', 'c', 'a']);
  });

  it('does not mutate the input', () => {
    const items = [{ n: 3 }, { n: 1 }];
    orderBy(items, (i) => i.n);
    expect(items.map((i) => i.n)).toEqual([3, 1]);
  });
});

describe('toBool', () => {
  it.each([
    ['true', true],
    ['Yes', true],
    ['1', true],
    ['false', false],
    ['no', false],
    ['0', false]
  ])('coerces %s', (input, expected) => {
    expect(toBool(input)).toBe(expected);
  });

  it('uses the fallback for unrecognised values', () => {
    expect(toBool('maybe', true)).toBe(true);
    expect(toBool(undefined, false)).toBe(false);
  });
});

describe('toNumber', () => {
  it('parses and clamps to bounds', () => {
    expect(toNumber('5', 0)).toBe(5);
    expect(toNumber('50', 0, { min: 0, max: 8 })).toBe(8);
    expect(toNumber('-3', 0, { min: 1 })).toBe(1);
    expect(toNumber('x', 4)).toBe(4);
  });
});

describe('string helpers', () => {
  it('toOptionalString maps blank to undefined', () => {
    expect(toOptionalString('  hi ')).toBe('hi');
    expect(toOptionalString('   ')).toBeUndefined();
    expect(toOptionalString(null)).toBeUndefined();
  });

  it('toStringOr falls back', () => {
    expect(toStringOr(null, 'x')).toBe('x');
    expect(toStringOr('y', 'x')).toBe('y');
  });
});
