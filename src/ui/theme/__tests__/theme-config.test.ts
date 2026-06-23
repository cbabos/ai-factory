import { describe, it, expect } from 'vitest';
import { themeOptions, defaultThemeId, getThemeById, isValidTheme } from '../constants.js';

describe('Theme Configuration', () => {
  it('should have correct default theme', () => {
    expect(defaultThemeId).toBe('synthwave84');
  });

  it('should have three theme options', () => {
    expect(themeOptions).toHaveLength(3);
    expect(themeOptions.map((t) => t.id)).toEqual([
      'synthwave84',
      'tokyonight',
      'zenburn',
    ]);
  });

  it('should get theme by valid ID', () => {
    const theme = getThemeById('synthwave84');
    expect(theme).toBeDefined();
    expect(theme!.id).toBe('synthwave84');
    expect(theme!.name).toBe('Synthwave 84');
  });

  it('should return default theme for invalid ID', () => {
    const theme = getThemeById('invalid' as any);
    expect(theme.id).toBe('synthwave84');
  });

  it('should validate theme IDs', () => {
    expect(isValidTheme('synthwave84')).toBe(true);
    expect(isValidTheme('tokyonight')).toBe(true);
    expect(isValidTheme('zenburn')).toBe(true);
    expect(isValidTheme('invalid')).toBe(false);
  });

  it('should have correct colors for synthwave84', () => {
    const theme = getThemeById('synthwave84');
    expect(theme.colors.primary).toBe('#00f3ff');
    expect(theme.colors.secondary).toBe('#ff00ff');
    expect(theme.colors.success).toBe('#00ff3c');
  });

  it('should have correct colors for tokyonight', () => {
    const theme = getThemeById('tokyonight');
    expect(theme.colors.primary).toBe('#7aa2f7');
    expect(theme.colors.background).toBe('#1a1b26');
  });

  it('should have correct colors for zenburn', () => {
    const theme = getThemeById('zenburn');
    expect(theme.colors.primary).toBe('#dcdccc');
    expect(theme.colors.background).toBe('#3f3f3f');
  });
});
