import { useCallback } from 'react';
import { useThemeContext } from '../components/ThemeProvider.js';
import type { Theme, ThemeId } from '../types.js';

export interface UseThemeResult {
  currentTheme: Theme;
  setTheme: (themeId: ThemeId) => void;
  themeOptions: Theme[];
}

export const useTheme = (): UseThemeResult => {
  const { currentTheme, setTheme, themeOptions } = useThemeContext();

  const setThemeWithPersistence = useCallback(
    (themeId: ThemeId): void => {
      setTheme(themeId);
      localStorage.setItem('currentTheme', themeId);
      document.documentElement.setAttribute('data-theme', themeId);
    },
    [setTheme],
  );

  return {
    currentTheme,
    setTheme: setThemeWithPersistence,
    themeOptions,
  };
};

export default useTheme;
