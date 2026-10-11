import { BRAND_COLORS, contrastRatio, onColor, resolveColor, safeColor } from '../color';

describe('resolveColor', () => {
  it('accepts brand colour names in any spacing/case and maps them to brand tokens', () => {
    expect(resolveColor('Blue Lagoon')).toEqual({ value: 'var(--full-brand-blue-lagoon, #007481)', on: '#ffffff', ink: '#00636e' });
    expect(resolveColor('crystalwaters')?.value).toBe('var(--full-brand-crystal-waters, #54c0e8)');
    expect(resolveColor('Navy')?.on).toBe('#ffffff');
    expect(resolveColor('Gold')?.on).toBe('#04253c');
  });

  it('accepts hex and computes readable roles for non-brand colours', () => {
    expect(resolveColor('#007481')).toEqual({ value: '#007481', on: '#ffffff', ink: '#00636e' });
    const light = resolveColor('#fde047');
    expect(light?.on).toBe('#04253c');
    expect(contrastRatio(light!.ink, '#ffffff')).toBeGreaterThanOrEqual(4.5);
  });

  it('accepts design tokens bare or as var()', () => {
    expect(resolveColor('--full-primary')?.value).toBe('var(--full-primary)');
    expect(resolveColor('var(--full-brand-gold)')).toEqual({ value: 'var(--full-brand-gold)', on: '#04253c', ink: '#7b6945' });
  });

  it('rejects anything else', () => {
    expect(resolveColor('red; background:url(x)')).toBeUndefined();
    expect(resolveColor('')).toBeUndefined();
    expect(safeColor('nope', 'var(--full-primary)')).toBe('var(--full-primary)');
    expect(onColor(undefined)).toBe('#ffffff');
  });
});

describe('BRAND_COLORS', () => {
  it('every ink is AA (4.5:1) on white and every "on" colour is readable on its fill', () => {
    BRAND_COLORS.forEach((c) => {
      expect(contrastRatio(c.ink, '#ffffff')).toBeGreaterThanOrEqual(4.5);
      // Blooming Nature (#00946e) reaches 4.1:1 with navy - the best of navy/white.
      expect(contrastRatio(c.on, c.hex)).toBeGreaterThanOrEqual(c.key === 'blooming-nature' ? 4 : 4.5);
    });
  });
});
