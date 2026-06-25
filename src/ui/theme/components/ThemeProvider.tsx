import React, { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { Theme, ThemeId, UseThemeResult } from '../types.js';
import { defaultThemeId, getThemeById, isValidTheme, themeOptions } from '../constants.js';
import { applyThemeToDocument } from '../apply-theme.js';

interface ThemeContextType extends UseThemeResult {
  themeManager: {
    setTheme: (themeId: ThemeId) => void;
    injectCSS: () => void;
  };
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProviderWrapper: React.FC<{
  children: ReactNode;
  defaultTheme?: ThemeId;
}> = ({ children, defaultTheme = defaultThemeId }) => {
  const [currentTheme, setCurrentTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('currentTheme');
    if (saved && isValidTheme(saved)) {
      return getThemeById(saved);
    }
    return getThemeById(defaultTheme);
  });

  const themeManager = {
    setTheme: (themeId: ThemeId): void => {
      const nextTheme = getThemeById(themeId);
      setCurrentTheme(nextTheme);
      localStorage.setItem('currentTheme', themeId);
      applyThemeToDocument(nextTheme);
    },
    injectCSS: (): void => {
      applyThemeToDocument(currentTheme);
    },
  };

  useEffect(() => {
    themeManager.injectCSS();
  }, [currentTheme]);

  return (
    <ThemeContext.Provider
      value={{
        currentTheme,
        setTheme: themeManager.setTheme,
        themeOptions,
        themeManager,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useThemeContext = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeContext must be used within a ThemeProvider');
  }
  return context;
};

export default ThemeContext;
