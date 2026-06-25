import type { Theme, ThemeId } from './types.js';

export const themeOptions: Theme[] = [
  {
    id: 'synthwave84',
    name: 'Synthwave 84',
    description: 'Neon pink/purple high-contrast cyberpunk theme',
    colors: {
      primary: '#00f3ff',
      secondary: '#ff00ff',
      accent: '#bc13fe',
      success: '#00ff3c',
      warning: '#ffb800',
      error: '#ff3131',
      muted: '#5a5a5a',
      border: '#00f3ff/30',
      background: '#0a0a12',
      foreground: '#ffffff',
      fontFamily: '"Segoe UI Variable", "Roboto", "Helvetica Neue", sans-serif',
    },
    borderRadius: '12px',
    shadow: '0 4px 20px rgba(0, 243, 255, 0.2)',
    glow: '0 0 15px rgba(0, 243, 255, 0.4)',
  },
  {
    id: 'tokyonight',
    name: 'Tokyo Night',
    description: 'Soft purple/blue reduced brightness theme',
    colors: {
      primary: '#7aa2f7',
      secondary: '#bb9af7',
      accent: '#565f89',
      success: '#9ece6a',
      warning: '#e0af68',
      error: '#f7768e',
      muted: '#414868',
      border: '#7aa2f7/20',
      background: '#1a1b26',
      foreground: '#c0caf5',
      fontFamily: '"Fira Code", "Monaco", "Consolas", monospace',
    },
    borderRadius: '8px',
    shadow: '0 4px 12px rgba(122, 162, 247, 0.15)',
    glow: '0 0 10px rgba(122, 162, 247, 0.3)',
  },
  {
    id: 'zenburn',
    name: 'Zenburn',
    description: 'Low-contrast grayscale eye comfort theme',
    colors: {
      primary: '#dcdccc',
      secondary: '#cc9393',
      accent: '#7f9f7f',
      success: '#7f9f7f',
      warning: '#f0d893',
      error: '#cc9393',
      muted: '#7e7e7e',
      border: '#a8a8a8/20',
      background: '#3f3f3f',
      foreground: '#dcdccc',
      fontFamily: '"DejaVu Sans Mono", "Courier New", monospace',
    },
    borderRadius: '6px',
    shadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
    glow: 'none',
  },
];

export const defaultThemeId: ThemeId = 'synthwave84';

export const getThemeById = (id: ThemeId): Theme => {
  const theme = themeOptions.find((t: Theme) => t.id === id);
  return (theme ?? themeOptions[0]) as Theme;
};

export const isValidTheme = (id: string): id is ThemeId => {
  return themeOptions.some((t) => t.id === id);
};
