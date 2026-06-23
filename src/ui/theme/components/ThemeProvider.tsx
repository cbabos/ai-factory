import React, { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { Theme, ThemeId, UseThemeResult } from '../types.js';
import { themeOptions, defaultThemeId } from '../constants.js';

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
    if (saved && themeOptions.some((t: Theme) => t.id === saved)) {
      return themeOptions.find((t: Theme) => t.id === saved)!;
    }
    const theme = themeOptions.find((t: Theme) => t.id === defaultTheme);
    return theme!;
  });

  const themeManager = {
    setTheme: (themeId: ThemeId): void => {
      setCurrentTheme(themeOptions.find((t: Theme) => t.id === themeId)!);
      localStorage.setItem('currentTheme', themeId);
      const foundTheme = themeOptions.find((t: Theme) => t.id === themeId);
      document.documentElement.style.cssText = `
        :root {
          --theme-primary: ${foundTheme?.colors.primary};
          --theme-secondary: ${foundTheme?.colors.secondary};
          --theme-accent: ${foundTheme?.colors.accent};
          --theme-success: ${foundTheme?.colors.success};
          --theme-warning: ${foundTheme?.colors.warning};
          --theme-error: ${foundTheme?.colors.error};
          --theme-muted: ${foundTheme?.colors.muted};
          --theme-border: ${foundTheme?.colors.border};
          --theme-background: ${foundTheme?.colors.background};
          --theme-foreground: ${foundTheme?.colors.foreground};
          --theme-font-family: ${foundTheme?.colors.fontFamily};
          --theme-borderRadius: ${foundTheme?.borderRadius};
          --theme-shadow: ${foundTheme?.shadow};
          --theme-glow: ${foundTheme?.glow};
        }
      `;
    },
    injectCSS: (): void => {
      const styleId = 'ai-factory-theme-styles';
      let styleElement = document.getElementById(styleId) as HTMLStyleElement | null;

      if (!styleElement) {
        styleElement = document.createElement('style');
        styleElement.id = styleId;
        document.head.appendChild(styleElement);
      }

      const theme = themeOptions.find((t: Theme) => t.id === currentTheme.id);
      if (theme) {
        styleElement.textContent = `
          :root {
            --theme-primary: ${theme.colors.primary};
            --theme-secondary: ${theme.colors.secondary};
            --theme-accent: ${theme.colors.accent};
            --theme-success: ${theme.colors.success};
            --theme-warning: ${theme.colors.warning};
            --theme-error: ${theme.colors.error};
            --theme-muted: ${theme.colors.muted};
            --theme-border: ${theme.colors.border};
            --theme-background: ${theme.colors.background};
            --theme-foreground: ${theme.colors.foreground};
            --theme-font-family: ${theme.colors.fontFamily};
            --theme-borderRadius: ${theme.borderRadius};
            --theme-shadow: ${theme.shadow};
            --theme-glow: ${theme.glow};
          }
        `;
      }
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
