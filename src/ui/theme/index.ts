export { ThemeSwitcher } from './components/ThemeSwitcher.js';
export { SettingsPanel } from './components/SettingsPanel.js';
export { ThemeProviderWrapper as ThemeProvider } from './components/ThemeProvider.js';

export { useTheme } from './hooks/useTheme.js';
export { useThemePreference } from './hooks/useThemePreference.js';

export type { Theme, ThemeColors, ThemeId } from './types.js';

export {
  themeOptions,
  defaultThemeId,
  getThemeById,
  isValidTheme,
} from './constants.js';

export { ThemeManager } from './theme-manager.js';
