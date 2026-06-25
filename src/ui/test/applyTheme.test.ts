import { describe, expect, it } from 'vitest';
import { getThemeById } from '../theme/constants.js';
import { applyThemeToDocument } from '../theme/apply-theme.js';

describe('applyThemeToDocument', () => {
  it('writes the selected theme tokens to the document root', () => {
    applyThemeToDocument(getThemeById('tokyonight'));

    expect(document.documentElement.dataset.theme).toBe('tokyonight');
    expect(document.documentElement.style.getPropertyValue('--theme-primary')).toBe('#7aa2f7');
    expect(document.documentElement.style.getPropertyValue('--theme-background')).toBe('#1a1b26');
    expect(document.documentElement.style.getPropertyValue('--theme-primary-rgb')).toBe('122 162 247');
    expect(document.documentElement.style.getPropertyValue('--theme-font-family')).toContain('Fira Code');
  });
});
