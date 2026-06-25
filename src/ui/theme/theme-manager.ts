import type { Theme, ThemeId } from './types.js';
import { themeOptions, defaultThemeId, getThemeById } from './constants.js';

export class ThemeManager {
  private currentTheme: Theme;
  private readonly availableThemes: Theme[];

  constructor(defaultTheme: ThemeId = defaultThemeId) {
    this.availableThemes = themeOptions;
    this.currentTheme = getThemeById(defaultTheme);
  }

  getCurrentTheme(): Theme {
    return this.currentTheme;
  }

  getAvailableThemes(): Theme[] {
    return this.availableThemes;
  }

  setTheme(themeId: ThemeId): void {
    const theme = getThemeById(themeId);
    if (theme.id !== this.currentTheme.id) {
      this.currentTheme = theme;
    }
  }

  isValidTheme(themeId: string): themeId is ThemeId {
    return this.availableThemes.some((t) => t.id === themeId);
  }

  toCSSVariables(): string {
    const { colors, borderRadius, shadow, glow } = this.currentTheme;

    return `
      --theme-primary: ${colors.primary};
      --theme-secondary: ${colors.secondary};
      --theme-accent: ${colors.accent};
      --theme-success: ${colors.success};
      --theme-warning: ${colors.warning};
      --theme-error: ${colors.error};
      --theme-muted: ${colors.muted};
      --theme-border: ${colors.border};
      --theme-background: ${colors.background};
      --theme-foreground: ${colors.foreground};
      --theme-font-family: ${colors.fontFamily};
      --theme-borderRadius: ${borderRadius};
      --theme-shadow: ${shadow};
      --theme-glow: ${glow};
    `;
  }

  injectCSS(): void {
    const css = this.toCSSSelector();
    const styleId = 'ai-factory-theme-styles';
    let styleElement = document.getElementById(styleId) as HTMLStyleElement | null;

    if (!styleElement) {
      styleElement = document.createElement('style');
      styleElement.id = styleId;
      document.head.appendChild(styleElement);
    }

    styleElement.textContent = css;
  }

  toCSSSelector(): string {
    return `:root { ${this.toCSSVariables()} }`;
  }

  clearCSS(): void {
    const styleElement = document.getElementById('ai-factory-theme-styles');
    if (styleElement) {
      styleElement.textContent = '';
    }
  }

  async persistTheme(themeId: ThemeId): Promise<void> {
    this.setTheme(themeId);
    this.injectCSS();
  }
}
