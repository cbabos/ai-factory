import type { Theme } from './types.js';

const hexToRgbChannels = (value: string): string => {
  const normalized = value.trim().replace('#', '');
  const segments = normalized.length === 3
    ? normalized.split('').map((segment) => `${segment}${segment}`)
    : [normalized.slice(0, 2), normalized.slice(2, 4), normalized.slice(4, 6)];

  return segments
    .map((segment) => Number.parseInt(segment, 16))
    .join(' ');
};

export const applyThemeToDocument = (theme: Theme): void => {
  const root = document.documentElement;

  root.dataset.theme = theme.id;
  root.style.setProperty('--theme-primary', theme.colors.primary);
  root.style.setProperty('--theme-primary-rgb', hexToRgbChannels(theme.colors.primary));
  root.style.setProperty('--theme-secondary', theme.colors.secondary);
  root.style.setProperty('--theme-secondary-rgb', hexToRgbChannels(theme.colors.secondary));
  root.style.setProperty('--theme-accent', theme.colors.accent);
  root.style.setProperty('--theme-accent-rgb', hexToRgbChannels(theme.colors.accent));
  root.style.setProperty('--theme-success', theme.colors.success);
  root.style.setProperty('--theme-success-rgb', hexToRgbChannels(theme.colors.success));
  root.style.setProperty('--theme-warning', theme.colors.warning);
  root.style.setProperty('--theme-warning-rgb', hexToRgbChannels(theme.colors.warning));
  root.style.setProperty('--theme-error', theme.colors.error);
  root.style.setProperty('--theme-error-rgb', hexToRgbChannels(theme.colors.error));
  root.style.setProperty('--theme-muted', theme.colors.muted);
  root.style.setProperty('--theme-muted-rgb', hexToRgbChannels(theme.colors.muted));
  root.style.setProperty('--theme-background', theme.colors.background);
  root.style.setProperty('--theme-background-rgb', hexToRgbChannels(theme.colors.background));
  root.style.setProperty('--theme-foreground', theme.colors.foreground);
  root.style.setProperty('--theme-foreground-rgb', hexToRgbChannels(theme.colors.foreground));
  root.style.setProperty('--theme-font-family', theme.colors.fontFamily);
  root.style.setProperty('--theme-borderRadius', theme.borderRadius);
  root.style.setProperty('--theme-shadow', theme.shadow);
  root.style.setProperty('--theme-glow', theme.glow);
};
