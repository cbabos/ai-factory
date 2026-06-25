export type ThemeId = 'synthwave84' | 'tokyonight' | 'zenburn';

export interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  success: string;
  warning: string;
  error: string;
  muted: string;
  border: string;
  background: string;
  foreground: string;
  fontFamily: string;
}

export interface Theme {
  id: ThemeId;
  name: string;
  description: string;
  colors: ThemeColors;
  borderRadius: string;
  shadow: string;
  glow: string;
}

export type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: ThemeId;
};

export type UseThemeResult = {
  currentTheme: Theme;
  setTheme: (themeId: ThemeId) => void;
  themeOptions: Theme[];
};

export type UseThemePreferenceResult = {
  saveThemePreference: (themeId: ThemeId) => void;
  loadThemePreference: () => ThemeId;
  defaultTheme: ThemeId;
};
