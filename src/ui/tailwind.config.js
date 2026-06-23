import type { Config } from 'tailwindcss'
import forms from '@tailwindcss/forms'

const themes = {
  synthwave84: {
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
    },
    fontFamily: '"Segoe UI Variable", "Roboto", "Helvetica Neue", sans-serif',
    borderRadius: '12px',
    shadow: '0 4px 20px rgba(0, 243, 255, 0.2)',
    glow: '0 0 15px rgba(0, 243, 255, 0.4)',
  },
  tokyonight: {
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
    },
    fontFamily: '"Fira Code", "Monaco", "Consolas", monospace',
    borderRadius: '8px',
    shadow: '0 4px 12px rgba(122, 162, 247, 0.15)',
    glow: '0 0 10px rgba(122, 162, 247, 0.3)',
  },
  zenburn: {
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
    },
    fontFamily: '"DejaVu Sans Mono", "Courier New", monospace',
    borderRadius: '6px',
    shadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
    glow: 'none',
  },
}

const config: Config = {
  content: [
    './components/**/*.{js,ts,jsx,tsx}',
    './pages/**/*.{js,ts,jsx,tsx}',
    './theme/**/*.{js,ts,jsx,tsx}',
    './*.ts*',
  ],
  theme: {
    extend: {
      colors: {
        'accent-primary': themes.synthwave84.colors.primary,
        'accent-secondary': themes.synthwave84.colors.secondary,
        'accent-accent': themes.synthwave84.colors.accent,
        'accent-success': themes.synthwave84.colors.success,
        'accent-warning': themes.synthwave84.colors.warning,
        'accent-danger': themes.synthwave84.colors.error,
        'text-muted': themes.synthwave84.colors.muted,
        'text-primary': themes.synthwave84.colors.foreground,
        'text-secondary': themes.synthwave84.colors.foreground,
        'panel': themes.synthwave84.colors.background,
        'card': themes.synthwave84.colors.background,
        'border-primary': themes.synthwave84.colors.border,
        ...themes.synthwave84.colors,
      },
      fontFamily: {
        mono: themes.tokyonight.fontFamily,
        ui: themes.synthwave84.fontFamily,
        display: themes.synthwave84.fontFamily,
      },
      borderRadius: {
        cyber: themes.synthwave84.borderRadius,
        tokyo: themes.tokyonight.borderRadius,
        zen: themes.zenburn.borderRadius,
      },
    },
  },
  plugins: [forms],
}

export default config
