import type { Config } from 'tailwindcss'
import forms from '@tailwindcss/forms'

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
        'accent-primary': 'rgb(var(--theme-primary-rgb) / <alpha-value>)',
        'accent-secondary': 'rgb(var(--theme-secondary-rgb) / <alpha-value>)',
        'accent-accent': 'rgb(var(--theme-accent-rgb) / <alpha-value>)',
        'accent-success': 'rgb(var(--theme-success-rgb) / <alpha-value>)',
        'accent-warning': 'rgb(var(--theme-warning-rgb) / <alpha-value>)',
        'accent-danger': 'rgb(var(--theme-error-rgb) / <alpha-value>)',
        'text-muted': 'rgb(var(--theme-muted-rgb) / <alpha-value>)',
        'text-primary': 'rgb(var(--theme-foreground-rgb) / <alpha-value>)',
        'text-secondary': 'rgb(var(--theme-foreground-rgb) / <alpha-value>)',
        panel: 'rgb(var(--theme-background-rgb) / <alpha-value>)',
        card: 'rgb(var(--theme-background-rgb) / <alpha-value>)',
        'border-primary': 'rgb(var(--theme-primary-rgb) / <alpha-value>)',
        primary: 'rgb(var(--theme-primary-rgb) / <alpha-value>)',
        secondary: 'rgb(var(--theme-secondary-rgb) / <alpha-value>)',
        accent: 'rgb(var(--theme-accent-rgb) / <alpha-value>)',
        success: 'rgb(var(--theme-success-rgb) / <alpha-value>)',
        warning: 'rgb(var(--theme-warning-rgb) / <alpha-value>)',
        error: 'rgb(var(--theme-error-rgb) / <alpha-value>)',
        muted: 'rgb(var(--theme-muted-rgb) / <alpha-value>)',
        border: 'rgb(var(--theme-primary-rgb) / <alpha-value>)',
        background: 'rgb(var(--theme-background-rgb) / <alpha-value>)',
        foreground: 'rgb(var(--theme-foreground-rgb) / <alpha-value>)',
      },
      fontFamily: {
        mono: ['var(--theme-font-family)', 'monospace'],
        ui: ['var(--theme-font-family)', 'sans-serif'],
        display: ['var(--theme-font-family)', 'sans-serif'],
      },
      borderRadius: {
        cyber: 'var(--theme-borderRadius)',
        tokyo: 'var(--theme-borderRadius)',
        zen: 'var(--theme-borderRadius)',
      },
    },
  },
  plugins: [forms],
}

export default config
