import { useCallback } from 'react';
import { useThemeContext } from '../components/ThemeProvider.js';
import type { Theme, ThemeId } from '../types.js';

export interface UseThemePreferenceResult {
  saveThemePreference: (themeId: ThemeId) => void;
  loadThemePreference: () => ThemeId;
  defaultTheme: ThemeId;
}

export const useThemePreference = (): UseThemePreferenceResult => {
  const { currentTheme, setTheme } = useThemeContext() as { currentTheme: Theme; setTheme: (themeId: ThemeId) => void };

  const saveThemePreference = useCallback(
    (themeId: ThemeId): void => {
      localStorage.setItem('currentTheme', themeId);
      document.documentElement.setAttribute('data-theme', themeId);
      setTheme(themeId);
    },
    [setTheme],
  );

  const loadThemePreference = useCallback((): ThemeId => {
    const saved = localStorage.getItem('currentTheme');
    return (saved as ThemeId) || 'synthwave84';
  }, []);

  return {
    saveThemePreference,
    loadThemePreference,
    defaultTheme: 'synthwave84',
  };
};

export default useThemePreference;
