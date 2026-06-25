# AI Factory — Cyberpunk UI Design System

## Overview

This document describes the design system for a React 19 UI component library with a cyberpunk aesthetic for the AI Factory application.

**Theme Name:** `cyberpunk-aether`

**Color Palette:** Neon-accented dark theme with vibrant accents, glassmorphism, and glitch effects

**Typography:** Monospace for technical UI, rounded sans-serif for user-facing elements

---

## Color System

### Background Layers (Deep Space Theme)
```css
--bg-primary: #050508;      /* Deepest black */
--bg-secondary: #0a0a0f;    /* Dark charcoal */
--bg-tertiary: #111118;     /* Lighter charcoal */
--bg-panel: #0e0e15;        /* Panel background */
--bg-card: #0f0f14;         /* Card background */
--bg-section: #15151e;      /* Section background */
```

### Accent Colors (Neon Palette)
```css
--accent-primary: #00f3ff;      /* Cyan - main brand color */
--accent-secondary: #ff00ff;    /* Magenta - secondary */
--accent-tertiary: #39ff14;     /* Lime green - success */
--accent-warning: #ffd700;      /* Gold - warnings */
--accent-danger: #ff3131;       /* Neon red - errors */
--accent-info: #5e5ce6;         /* Indigo - info */
```

### Glitch Colors (for animations)
```css
--glitch-primary: #00f3ff;
--glitch-secondary: #ff00ff;
--glitch-tertiary: #ff3131;
```

### Text Colors
```css
--text-primary: #e0e0e0;
--text-secondary: #a0a0a0;
--text-muted: #707070;
--text-disabled: #505050;

--text-accent-primary: #00f3ff;
--text-accent-secondary: #ff00ff;
--text-accent-tertiary: #39ff14;
```

---

## Spacing System (Cyber Grid)

```css
/* Base unit: 8px */
--space-xs: 4px;
--space-sm: 8px;
--space-md: 16px;
--space-lg: 24px;
--space-xl: 32px;
--space-2xl: 48px;
--space-3xl: 64px;

/* Component-specific padding */
--spacing-panel: 24px;
--spacing-card: 16px;
--spacing-input: 12px;
--spacing-button: 12px 20px;
```

---

## Border Radius (Geometric Style)

```css
/* Rounded corners - geometric but not too rounded */
--radius-sm: 6px;
--radius-md: 12px;
--radius-lg: 20px;
--radius-xl: 32px;
--radius-full: 9999px;

/* Custom cyrillic-style corners */
--radius-cyber: 12px 2px 12px 2px;
--radius-glitch: 4px 12px 4px 12px;
```

---

## Shadows (Neon Glow Effects)

```css
/* Hardware-accelerated shadows */
--shadow-sm: 0 2px 4px rgba(0, 243, 255, 0.1);
--shadow-md: 0 4px 8px rgba(0, 243, 255, 0.15), 
               0 2px 4px rgba(0, 243, 255, 0.1);
--shadow-lg: 0 8px 16px rgba(0, 243, 255, 0.2), 
               0 4px 8px rgba(0, 243, 255, 0.1);
--shadow-xl: 0 16px 24px rgba(0, 243, 255, 0.3), 
               0 8px 12px rgba(0, 243, 255, 0.2);

/* Neon glow shadows */
--glow-primary: 0 0 8px rgba(0, 243, 255, 0.5),
                 0 0 16px rgba(0, 243, 255, 0.3);
--glow-secondary: 0 0 8px rgba(255, 0, 255, 0.5),
                   0 0 16px rgba(255, 0, 255, 0.3);

/* Hard edge shadows */
--shadow-hard-sm: 2px 2px 0px var(--accent-primary);
--shadow-hard-md: 4px 4px 0px var(--accent-primary);
```

---

## Typography

### Font Families
```css
/* Technical interface - monospace */
--font-mono: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;

/* User interface - geometric sans-serif */
--font-ui: 'Inter', 'Segoe UI', system-ui, sans-serif;

/* Decorative - uppercase geometric */
--font-display: 'Oswald', 'Raleway', sans-serif;
```

### Font Sizes
```css
--text-xs: 0.75rem;   /* 12px */
--text-sm: 0.875rem;  /* 14px */
--text-md: 1rem;      /* 16px */
--text-lg: 1.125rem;  /* 18px */
--text-xl: 1.25rem;   /* 20px */
--text-2xl: 1.5rem;   /* 24px */
--text-3xl: 1.75rem;  /* 28px */
--text-4xl: 2rem;     /* 32px */

/* Display sizes */
--text-display-1: 3rem;      /* 48px */
--text-display-2: 2.5rem;    /* 40px */
--text-display-3: 2rem;      /* 32px */
```

### Font Weights
```css
--weight-light: 300;
--weight-normal: 400;
--weight-medium: 500;
--weight-semibold: 600;
--weight-bold: 700;
--weight-black: 900;
```

### Line Heights & Tracking
```css
--leading-tight: 1.1;
--leading-snug: 1.3;
--leading-normal: 1.5;
--leading-relaxed: 1.75;

--tracking-tighter: -0.05em;
--tracking-tight: -0.025em;
--tracking-wide: 0.025em;
--tracking-wider: 0.05em;
```

---

## Transitions & Animations (Cyberpunk Motion)

### Transition Curves
```css
/* Linear - for data updates */
--transition-linear: linear;

/* Cyberpunk ease - starts slow, accelerates, then decelerates */
--transition-cyber: cubic-bezier(0.68, -0.55, 0.27, 1.55);

/* Glitch ease - aggressive */
--transition-glitch: cubic-bezier(0.6, 0.04, 0.98, 0.335);

/* Smooth - for UI elements */
--transition-smooth: cubic-bezier(0.25, 1, 0.5, 1);
```

### Animation Durations
```css
--duration-fast: 150ms;
--duration-normal: 250ms;
--duration-slow: 400ms;
--duration-glitch: 75ms;
```

### Keyframe Animations
```css
@keyframes pulse-neon {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

@keyframes glitch-overlay {
  0% { transform: translate(0, 0); }
  20% { transform: translate(-2px, 2px); }
  40% { transform: translate(-2px, -2px); }
  60% { transform: translate(2px, 2px); }
  80% { transform: translate(2px, -2px); }
  100% { transform: translate(0, 0); }
}

@keyframes neon-scanline {
  0% { top: -100%; }
  100% { top: 100%; }
}

@keyframes cable-sway {
  0%, 100% { transform: translateX(0); }
  50% { transform: translateX(5px); }
}

@keyframes float-cyber {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-3px); }
}

@keyframes glitch-text {
  0% { clip-path: inset(0 0 0 0); }
  25% { clip-path: inset(0 0 50% 0); transform: translateX(-2px); }
  50% { clip-path: inset(50% 0 0 0); transform: translateX(2px); }
  75% { clip-path: inset(0 0 0 50%); transform: translateX(-2px); }
  100% { clip-path: inset(0 50% 0 0); transform: translateX(2px); }
}
```

---

## Component Design Principles

### Cyberpunk Aesthetic Guidelines

1. **High Contrast**: Deep blacks with saturated neon colors
2. **Geometric Precision**: Clean lines, consistent angles
3. **Functional Decay**: Intentional "glitch" imperfections
4. **Data Visualization**: Status indicators, progress bars, hex values
5. **Layered Transparency**: Glassmorphism with tinted backgrounds
6. **Hardware Feel**: Visible borders, grid lines, circuit patterns
7. **Retro-Future**: Blend of futuristic and retro digital elements

### Accessibility First
- All colors meet WCAG AA contrast ratios (minimum 4.5:1)
- Focus states visible and distinct
- Animated elements have reduced motion alternatives
- Screen reader labels for all icons and decorative elements

---

## Component Implementation Guide

### Directory Structure

```
src/ui/
├── __tests__/                    # Component tests
│   ├── components/
│   └── utils/
├── components/                   # All components
│   ├── layout/                   # Layout components (Panel, Card, Section)
│   │   ├── Panel.tsx
│   │   ├── Card.tsx
│   │   ├── Section.tsx
│   │   └── Grid.tsx
│   │
│   ├── forms/                    # Form components
│   │   ├── Input.tsx
│   │   ├── TextArea.tsx
│   │   ├── Select.tsx
│   │   ├── MultiSelect.tsx
│   │   └── Label.tsx
│   │
│   ├── controls/                 # Interactive controls
│   │   ├── Button.tsx
│   │   ├── ToggleButton.tsx
│   │   ├── ToggleRadioGroup.tsx
│   │   ├── ToggleCheckbox.tsx
│   │   └── ToggleSwitch.tsx
│   │
│   ├── ui/                       # Utility/UI components
│   │   ├── ThemeSwitcher.tsx
│   │   ├── StatusIndicator.tsx
│   │   ├── Alert.tsx
│   │   └── Badge.tsx
│   │
│   └── utilities/                # Helper components
│       ├── Icon.tsx
│       ├── Separator.tsx
│       └── Skeleton.tsx
│
├── hooks/                        # Custom hooks
│   ├── useTheme.ts
│   ├── useToggle.ts
│   └── useClickOutside.ts
│
├── themes/                       # Theme definitions
│   ├── cyberpunk-aether.ts       # Main theme
│   └── types.ts                  # Theme type definitions
│
├── styles/                       # Global styles
│   ├── globals.css
│   └── reset.css
│
├── utils/                        # Utility functions
│   ├── colors.ts
│   ├── animations.ts
│   └── accessibility.ts
│
├── index.ts                      # Barrel exports
└── design-system.md              # This file
```

---

## Component Specifications

### Form Components

#### Input (src/ui/components/forms/Input.tsx)

**Props Interface:**
```typescript
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /**
   * Label text displayed above/before input
   */
  label?: string;
  
  /**
   * Helper text displayed below input
   */
  helpText?: string;
  
  /**
   * Error message to display
   */
  error?: string;
  
  /**
   * Icon to display before input
   */
  startIcon?: React.ReactNode;
  
  /**
   * Icon to display after input
   */
  endIcon?: React.ReactNode;
  
  /**
   * Input size
   */
  size?: 'sm' | 'md' | 'lg';
  
  /**
   * Input variant
   */
  variant?: 'filled' | 'outline' | 'ghost' | 'cyber';
  
  /**
   * Is the input in an active state?
   */
  isActive?: boolean;
  
  /**
   * Show glitch animation effect
   */
  glitchEffect?: boolean;
}
```

**Accessibility:**
- Uses `<label>` with `htmlFor` attribute
- `aria-describedby` for helper text
- `aria-invalid` for error states
- Proper focus management

**Storybook Structure:**
```
src/ui/components/forms/__stories__/Input.stories.tsx
├── Default
├── WithLabel
├── WithHelperText
├── WithError
├── WithIcons
├── Variants
│   ├── filled
│   ├── outline
│   ├── ghost
│   └── cyber
├── Sizes
│   ├── sm
│   ├── md (default)
│   └── lg
└── States
    ├── disabled
    ├── readonly
    └── glitch
```

**Tailwind Classes (Cyberpunk Style):**
```css
/* Base classes */
@apply relative flex flex-col gap-1;

/* Input classes */
@apply bg-panel text-primary
       border border-accent-primary
       rounded-cyber shadow-glow-primary
       px-4 py-3 text-sm
       transition-all duration-200
       focus:outline-none focus:border-accent-secondary
       focus:shadow-[0_0_10px_rgba(0,243,255,0.7)];

/* Cyber variant */
@apply bg-[url('data:image/svg+xml;base64,...')] 
       bg-[length:4px_4px];

/* Glitch animation class */
@apply animate-[glitch-text_2s_infinite];
```

---

#### TextArea (src/ui/components/forms/TextArea.tsx)

**Props Interface:**
```typescript
export interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /**
   * Label text displayed above/before textarea
   */
  label?: string;
  
  /**
   * Helper text displayed below textarea
   */
  helpText?: string;
  
  /**
   * Error message to display
   */
  error?: string;
  
  /**
   * Auto-grow behavior
   */
  autoGrow?: boolean;
  
  /**
   * Minimum rows
   */
  minRows?: number;
  
  /**
   * Maximum rows before scrolling
   */
  maxRows?: number;
  
  /**
   * Show character count
   */
  showCounter?: boolean;
  
  /**
   * Maximum characters
   */
  maxLength?: number;
  
  /**
   * Character count position
   */
  counterPosition?: 'top' | 'bottom' | 'inline';
  
  /**
   * Cyberpunk variant with dynamic border
   */
  cyberBorder?: boolean;
}
```

**Accessibility:**
- Character count announced to screen readers
- Proper label association
- Error state announcement

**Tailwind Classes:**
```css
/* Cyberpunk textarea */
@apply relative bg-secondary
       border border-accent-primary/50
       rounded-glitch
       resize-none
       focus:border-accent-secondary
       focus:shadow-glow-secondary;

/* Character counter */
@apply absolute bottom-2 right-2
       text-xs text-accent-tertiary
       opacity-80;
```

---

#### Select (src/ui/components/forms/Select.tsx)

**Props Interface:**
```typescript
export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  /**
   * Label text displayed above select
   */
  label?: string;
  
  /**
   * Helper text displayed below select
   */
  helpText?: string;
  
  /**
   * Error message to display
   */
  error?: string;
  
  /**
   * Options for the select
   */
  options?: OptionProps[];
  
  /**
   * Icon before select
   */
  startIcon?: React.ReactNode;
  
  /**
   * Show cyrillic dropdown arrow
   */
  cyrillicArrow?: boolean;
  
  /**
   * Cyberpunk animated border
   */
  cyberBorder?: boolean;
}

export interface OptionProps {
  value: string;
  label: string;
  disabled?: boolean;
  icon?: React.ReactNode;
}
```

**Accessibility:**
- Native select behavior for screen readers
- Custom dropdown uses `role="listbox"` and `role="option"`
- Proper keyboard navigation (ArrowUp/Down, Enter, Space)

**Storybook Structure:**
```
src/ui/components/forms/__stories__/Select.stories.tsx
├── Default
├── WithLabel
├── WithIcons
├── GroupedOptions
├── DisabledOptions
└── CyberVariant
    ├── cyberBorder
    ├── glitchAnimation
    └── hexColors
```

**Tailwind Classes:**
```css
/* Custom select container */
@apply relative group;

/* Select arrow */
@apply absolute right-0 top-0 h-full
       w-10 flex items-center justify-center
       text-accent-primary;

/* Cyber option items */
@apply hover:bg-accent-primary/10
       hover:text-accent-primary
       transition-colors duration-150;

/* Dropdown menu */
@apply absolute z-50 w-full mt-1
       bg-panel border border-accent-secondary
       rounded-cyber shadow-xl
       max-h-60 overflow-y-auto
       animate-[slide-down_200ms_ease-out];
```

---

#### MultiSelect (src/ui/components/forms/MultiSelect.tsx)

**Props Interface:**
```typescript
export interface MultiSelectProps {
  /**
   * Label text displayed above multiselect
   */
  label?: string;
  
  /**
   * Helper text displayed below multiselect
   */
  helpText?: string;
  
  /**
   * Error message to display
   */
  error?: string;
  
  /**
   * Selected values
   */
  value?: string[];
  
  /**
   * Callback for value changes
   */
  onChange?: (values: string[]) => void;
  
  /**
   * Available options
   */
  options?: OptionProps[];
  
  /**
   * Maximum selected items
   */
  maxItems?: number;
  
  /**
   * Show search input
   */
  searchable?: boolean;
  
  /**
   * Filter options
   */
  filter?: (options: OptionProps[], search: string) => OptionProps[];
  
  /**
   * Placeholder text
   */
  placeholder?: string;
  
  /**
   * Clear button visibility
   */
  clearable?: boolean;
  
  /**
   * Cyberpunk border style
   */
  cyberBorder?: boolean;
}

export interface OptionProps {
  value: string;
  label: string;
  disabled?: boolean;
  icon?: React.ReactNode;
  badgeColor?: string;
}
```

**Accessibility:**
- Uses `aria-multiselectable="true"`
- Keyboard navigation with Arrow keys
- Backspace to remove last item
- Tab navigation through items

**Tailwind Classes:**
```css
/* Tag style for selected items */
@apply inline-flex items-center gap-1
       bg-accent-primary/20 text-accent-primary
       border border-accent-primary/30
       rounded-full px-2 py-1 text-sm
       transition-all duration-200
       hover:bg-accent-primary/30
       active:scale-95;

/* Cyber tag variant */
@apply bg-[linear-gradient(45deg,theme(colors.accent.primary),theme(colors.accent.secondary))],
       opacity-80;

/* Dropdown container */
@apply absolute z-50 w-full mt-1.5
       bg-panel border border-accent-secondary/50
       rounded-glitch shadow-[0_0_20px_rgba(0,0,0,0.8)]
       overflow-hidden;
```

---

### Control Components

#### Button (src/ui/components/controls/Button.tsx)

**Props Interface:**
```typescript
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * Button variant
   */
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'cyber';
  
  /**
   * Button size
   */
  size?: 'sm' | 'md' | 'lg';
  
  /**
   * Is button in active state
   */
  isActive?: boolean;
  
  /**
   * Show loading state
   */
  loading?: boolean;
  
  /**
   * Button shape
   */
  shape?: 'default' | 'round' | 'cyber';
  
  /**
   * Show glitch effect
   */
  glitchEffect?: boolean;
  
  /**
   * Cyberpunk border color
   */
  cyberBorder?: boolean;
  
  /**
   * Neon glow intensity
   */
  glow?: 'none' | 'soft' | 'medium' | 'strong';
}
```

**Storybook Structure:**
```
src/ui/components/controls/__stories__/Button.stories.tsx
├── Default
├── Variants
│   ├── primary
│   ├── secondary
│   ├── danger
│   ├── ghost
│   └── cyber
├── Sizes
│   ├── sm
│   ├── md
│   └── lg
├── States
│   ├── disabled
│   ├── loading
│   └── active
├── GlitchAnimation
└── CyberVariant
    ├── glitchEffect
    └── cyberBorder
```

**Tailwind Classes:**
```css
/* Base button */
@apply inline-flex items-center justify-center
       gap-2 px-4 py-2.5
       font-semibold tracking-wide
       transition-all duration-150
       active:scale-95
       disabled:opacity-50 disabled:cursor-not-allowed
       disabled:active:scale-100;

/* Cyber variant */
@apply border border-accent-primary/40
       bg-[linear-gradient(135deg,theme(colors.bg.secondary),theme(colors.bg.primary))]
       rounded-glitch
       shadow-[0_0_4px_rgba(0,243,255,0.3)];

/* Primary variant */
@apply bg-accent-primary text-black
       hover:bg-accent-primary/90
       hover:shadow-[0_0_10px_rgba(0,243,255,0.6)]
       active:shadow-none;

/* Cyber active state */
@apply active:bg-accent-primary/80
       active:border-accent-secondary
       active:translate-x-[1px] active:translate-y-[1px]
       active:shadow-none;
```

---

#### ToggleButton (src/ui/components/controls/ToggleButton.tsx)

**Props Interface:**
```typescript
export interface ToggleButtonProps {
  /**
   * Is button currently toggled on
   */
  checked?: boolean;
  
  /**
   * Callback for toggle events
   */
  onChange?: (checked: boolean) => void;
  
  /**
   * Label text
   */
  label?: string;
  
  /**
   * Icon for on state
   */
  iconOn?: React.ReactNode;
  
  /**
   * Icon for off state
   */
  iconOff?: React.ReactNode;
  
  /**
   * Cyberpunk border color
   */
  cyberBorder?: boolean;
  
  /**
   * Glitch effect on toggle
   */
  glitchEffect?: boolean;
  
  /**
   * Button size
   */
  size?: 'sm' | 'md' | 'lg';
  
  /**
   * Variant
   */
  variant?: 'default' | 'cyber';
}

export type ToggleButtonEvents = {
  onChange:ToggleEvent;
};

export interface ToggleEvent {
  checked: boolean;
  originalEvent: React.MouseEvent<HTMLButtonElement>;
}
```

**Accessibility:**
- `role="switch"` with `aria-checked`
- Keyboard support (Enter, Space)
- Keyboard focus management

**Tailwind Classes:**
```css
/* Toggle button */
@apply relative inline-flex items-center gap-2
       px-3 py-1.5 text-sm font-medium
       transition-all duration-200;

/* On state */
@apply bg-accent-primary/20 text-accent-primary
       border-accent-primary
       shadow-[0_0_8px_rgba(0,243,255,0.4)];

/* Off state */
@apply bg-panel text-text-secondary
       border-accent-primary/20;

/* Cyber variant */
@apply rounded-cyber;

/* Switch track */
@apply absolute left-0 top-0 h-full w-1/2
       bg-accent-primary/10
       transition-all duration-200
       rounded-cyber;

/* Switch knob */
@apply absolute left-1 top-0.5 h-5 w-5
       bg-accent-primary
       rounded-full
       shadow-[0_0_6px_rgba(0,243,255,0.6)]
       transition-all duration-200
       pointer-events-none;

/* Checked position */
@apply transform translate-x-full;
```

---

#### ToggleRadioGroup (src/ui/components/controls/ToggleRadioGroup.tsx)

**Props Interface:**
```typescript
export interface ToggleRadioGroupProps {
  /**
   * Selected value
   */
  value?: string;
  
  /**
   * Callback for value changes
   */
  onChange?: (value: string) => void;
  
  /**
   * Radio options
   */
  options: RadioOptionProps[];
  
  /**
   * Label
   */
  label?: string;
  
  /**
   * Vertical or horizontal layout
   */
  direction?: 'vertical' | 'horizontal';
  
  /**
   * Cyberpunk style
   */
  cyber?: boolean;
  
  /**
   * Button size
   */
  size?: 'sm' | 'md' | 'lg';
}

export interface RadioOptionProps {
  value: string;
  label: string;
  disabled?: boolean;
  icon?: React.ReactNode;
  cyber?: boolean;
}
```

**Accessibility:**
- `role="radiogroup"` for group
- `role="radio"` for each option
- `aria-pressed` for current selection
- Arrow key navigation

**Tailwind Classes:**
```css
/* Radio group container */
@apply flex flex-col gap-1;

/* Radio button */
@apply relative flex items-center gap-3
       px-4 py-3
       border border-accent-primary/30
       rounded-cyber
       transition-all duration-200
       hover:bg-accent-primary/5
       disabled:opacity-50 disabled:cursor-not-allowed;

/* Selected state */
@apply bg-accent-primary/10 border-accent-primary
       shadow-[0_0_6px_rgba(0,243,255,0.3)];

/* Cyber radio variant */
@apply rounded-cyber;

/* Custom radio circle */
@apply absolute left-3 w-4 h-4 rounded-full
       border-2 border-accent-primary
       transition-all duration-200;

/* Checked custom radio */
@apply before:content-['']
      before:absolute before:top-1/2 before:left-1/2
      before:-translate-x-1/2 before:-translate-y-1/2
      before:w-2 before:h-2
      before:bg-accent-primary
      before:rounded-full
      before:shadow-[0_0_8px_rgba(0,243,255,0.8)];

/* Icon on left */
@apply order-1;

/* Label text */
@apply order-2 flex-1;
```

---

#### ToggleCheckbox (src/ui/components/controls/ToggleCheckbox.tsx)

**Props Interface:**
```typescript
export interface ToggleCheckboxProps {
  /**
   * Is checkbox checked
   */
  checked?: boolean;
  
  /**
   * Callback for change events
   */
  onChange?: (checked: boolean) => void;
  
  /**
   * Checkbox label
   */
  label?: string;
  
  /**
   * Description text
   */
  description?: string;
  
  /**
   * Disabled state
   */
  disabled?: boolean;
  
  /**
   * Cyberpunk style
   */
  cyber?: boolean;
  
  /**
   * Custom checkbox icon
   */
  icon?: React.ReactNode;
}

export interface ToggleCheckboxGroupProps {
  /**
   * Selected values
   */
  value?: string[];
  
  /**
   * Callback for value changes
   */
  onChange?: (values: string[]) => void;
  
  /**
   * Checkbox options
   */
  options: CheckboxOptionProps[];
  
  /**
   * Label
   */
  label?: string;
  
  /**
   * Max selections
   */
  max?: number;
  
  /**
   * Direction
   */
  direction?: 'vertical' | 'horizontal';
  
  /**
   * Cyberpunk style
   */
  cyber?: boolean;
}

export interface CheckboxOptionProps {
  value: string;
  label: string;
  disabled?: boolean;
  description?: string;
  cyber?: boolean;
}
```

**Accessibility:**
- `role="checkbox"` with `aria-checked`
- Keyboard navigation
- Screen reader labels

**Tailwind Classes:**
```css
/* Toggle checkbox container */
@apply relative flex items-center gap-4
       px-4 py-3
       transition-all duration-200
       hover:bg-accent-primary/5
       disabled:opacity-50;

/* Checked state */
@apply bg-accent-primary/10;

/* Cyber variant */
@apply rounded-cyber;

/* Checkbox box */
@apply relative flex items-center justify-center
       w-6 h-6
       border border-accent-primary/50
       rounded-cyber
       transition-all duration-200
       group-hover:border-accent-primary/70;

/* Checked checkbox */
@apply border-accent-primary
       bg-accent-primary/20
       shadow-[0_0_6px_rgba(0,243,255,0.4)];

/* Custom checkmark */
@apply after:content-['']
      after:absolute after:w-2.5 after:h-4
      after:border-r-2 after:border-b-2 after:border-accent-primary
      after:rotate-45 after:-ml-1.5 after:-mt-1
      after:opacity-0
      checked:after:opacity-100;

/* Label container */
@apply flex flex-col gap-0.5;

/* Label text */
@apply text-sm font-medium text-text-primary;

/* Description text */
@apply text-xs text-text-secondary;
```

---

### Layout Components

#### Panel (src/ui/components/layout/Panel.tsx)

**Props Interface:**
```typescript
export interface PanelProps {
  /**
   * Panel title
   */
  title?: React.ReactNode;
  
  /**
   * Panel subtitle
   */
  subtitle?: React.ReactNode;
  
  /**
   * Panel children
   */
  children?: React.ReactNode;
  
  /**
   * Panel header actions
   */
  actions?: React.ReactNode[];
  
  /**
   * Panel footer
   */
  footer?: React.ReactNode;
  
  /**
   * Border style
   */
  border?: 'none' | 'default' | 'glitch' | 'cyber';
  
  /**
   * Header style
   */
  headerVariant?: 'default' | 'cyber' | 'minimal';
  
  /**
   * Padding size
   */
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'custom';
  
  /**
   * Custom padding values
   */
  customPadding?: string;
  
  /**
   * Cyberpunk border color
   */
  cyberBorder?: string;
  
  /**
   * Collapsible
   */
  collaspible?: boolean;
  
  /**
   * Default expanded state
   */
  defaultExpanded?: boolean;
}

export interface PanelState {
  expanded: boolean;
  setExpanded: (expanded: boolean) => void;
}
```

**Storybook Structure:**
```
src/ui/components/layout/__stories__/Panel.stories.tsx
├── DefaultPanel
├── WithTitle
├── WithSubtitle
├── WithActions
├── WithFooter
├── BorderVariants
│   ├── none
│   ├── default
│   ├── glitch
│   └── cyber
├── HeaderVariants
│   ├── default
│   ├── cyber
│   └── minimal
├── Collapsible
├── CyberPanel
└── FullCyberPanel
```

**Tailwind Classes:**
```css
/* Panel container */
@apply flex flex-col
       bg-panel
       border border-accent-primary/30
       rounded-cyber
       overflow-hidden
       shadow-glow-primary;

/* Panel header */
@apply flex items-center justify-between
       px-6 py-4
       border-b border-accent-primary/20
       bg-accent-primary/5;

/* Panel title */
@apply text-lg font-semibold text-accent-primary
       tracking-wide;

/* Panel content */
@apply flex-1 p-6;

/* Panel footer */
@apply flex items-center justify-end
       px-6 py-4
       border-t border-accent-primary/20
       bg-accent-primary/5;
```

---

#### Card (src/ui/components/layout/Card.tsx)

**Props Interface:**
```typescript
export interface CardProps {
  /**
   * Card title
   */
  title?: React.ReactNode;
  
  /**
   *Card subtitle
   */
  subtitle?: React.ReactNode;
  
  /**
   * Card content
   */
  children?: React.ReactNode;
  
  /**
   * Card header actions
   */
  actions?: React.ReactNode[];
  
  /**
   * Card footer
   */
  footer?: React.ReactNode;
  
  /**
   * Card variant
   */
  variant?: 'default' | 'cyber' | 'glitch' | 'minimal';
  
  /**
   * Interactive state
   */
  interactive?: boolean;
  
  /**
   * Cyberpunk style
   */
  cyber?: boolean;
  
  /**
   * Glitch animation
   */
  glitchEffect?: boolean;
  
  /**
   * Content alignment
   */
  align?: 'start' | 'center' | 'end';
  
  /**
   * Padding variant
   */
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
}

export interface CardGroupProps {
  /**
   * Cards to render
   */
  cards: CardProps[];
  
  /**
   * Grid columns
   */
  columns?: '1' | '2' | '3' | '4' | 'auto';
  
  /**
   * Gap between cards
   */
  gap?: 'sm' | 'md' | 'lg';
  
  /**
   * Cyberpunk grid
   */
  cyberGrid?: boolean;
}
```

**Accessibility:**
- Cards are semantic containers
- Interactive cards announced as clickable
- Proper focus management

**Tailwind Classes:**
```css
/* Card container */
@apply flex flex-col
       bg-card
       rounded-cyber
       overflow-hidden
       transition-all duration-200;

/* Interactive card */
@apply cursor-pointer
       hover:shadow-glow-primary
       hover:translate-y-[-2px]
       active:translate-y-0;

/* Cyber card */
@apply border border-accent-primary/20
       shadow-[0_0_12px_rgba(0,243,255,0.2)];

/* Glitch card */
@apply animate-[glitch-overlay_5s_infinite];

/* Card header */
@apply flex items-center justify-between
       px-5 py-3
       border-b border-accent-primary/10
       bg-accent-primary/5;

/* Card content */
@apply flex-1 p-5;

/* Card footer */
@apply flex items-center justify-end
       px-5 py-3
       border-t border-accent-primary/10
       bg-accent-primary/5;
```

---

#### Section (src/ui/components/layout/Section.tsx)

**Props Interface:**
```typescript
export interface SectionProps {
  /**
   * Section title
   */
  title?: React.ReactNode;
  
  /**
   * Section subtitle
   */
  subtitle?: React.ReactNode;
  
  /**
   * Section content
   */
  children?: React.ReactNode;
  
  /**
   * Section actions
   */
  actions?: React.ReactNode[];
  
  /**
   * Background variant
   */
  bg?: 'default' | 'panel' | 'card' | 'cyber';
  
  /**
   * Padding variant
   */
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
  
  /**
   * Cyberpunk style
   */
  cyber?: boolean;
  
  /**
   * Section border
   */
  border?: 'none' | 'top' | 'bottom' | 'all' | 'cyber';
  
  /**
   * Section divider
   */
  divider?: boolean;
  
  /**
   * Animation
   */
  animation?: 'none' | 'fade' | 'slide' | 'glitch';
}

export interface SectionGroupProps {
  /**
   * Sections to render
   */
  sections: SectionProps[];
  
  /**
   * Card content variant
   */
  contentVariant?: 'default' | 'cyber' | 'minimal';
  
  /**
   * Section gap
   */
  gap?: 'sm' | 'md' | 'lg' | 'xl';
}
```

**Accessibility:**
- `role="region"` with `aria-label`
- Section headers announced as landmarks
- Proper semantic structure

**Tailwind Classes:**
```css
/* Section container */
@apply flex flex-col gap-4;

/* Section content */
@apply px-6 py-8
       bg-[url('data:image/svg+xml;base64,...')]
       bg-[length:4px_4px];

/* Cyber section */
@apply border-t border-accent-primary/30
       shadow-[0_-1px_0_rgba(0,243,255,0.2)];

/* Section header */
@apply flex items-center justify-between
       mb-4;

/* Section title */
@apply text-xl font-bold text-accent-primary
       tracking-wide;

/* Section divider */
@apply w-full h-px
       bg-gradient-to-r from-transparent via-accent-primary to-transparent;
```

---

### UI Components

#### ThemeSwitcher (src/ui/components/ui/ThemeSwitcher.tsx)

**Props Interface:**
```typescript
export interface ThemeSwitcherProps {
  /**
   * Current theme
   */
  currentTheme?: ThemeName;
  
  /**
   * Callback for theme changes
   */
  onChange?: (theme: ThemeName) => void;
  
  /**
   * Show label
   */
  showLabel?: boolean;
  
  /**
   * Theme options to show
   */
  availableThemes?: ThemeName[];
}

export type ThemeName = 'cyberpunk-aether' | 'dark' | 'light' | 'system';
```

**Accessibility:**
- `role="combobox"` with proper ARIA attributes
- Keyboard navigation
- Screen reader announcements
- Focus management

**Tailwind Classes:**
```css
/* Theme switcher container */
@apply flex items-center gap-2
       px-3 py-2
       bg-panel
       border border-accent-primary/20
       rounded-cyber
       shadow-sm;

/* Theme option button */
@apply relative flex items-center justify-center
       w-8 h-8
       rounded-full
       transition-all duration-200
       hover:bg-accent-primary/10
       active:scale-90;

/* Active theme indicator */
@apply absolute bottom-0 left-1/2
       -translate-x-1/2 translate-y-1/2
       w-0.5 h-1
       bg-accent-primary
       shadow-[0_0_4px_rgba(0,243,255,0.8)];

/* Theme label */
@apply ml-2 text-sm font-medium
       text-text-primary;
```

---

## Testing Strategy

### Component Testing (Vitest + React Testing Library)

**Test File Structure:**
```
src/ui/components/__tests__/
├── forms/
│   ├── Input.test.tsx
│   ├── TextArea.test.tsx
│   ├── Select.test.tsx
│   └── MultiSelect.test.tsx
├── controls/
│   ├── Button.test.tsx
│   ├── ToggleButton.test.tsx
│   ├── ToggleRadioGroup.test.tsx
│   └── ToggleCheckbox.test.tsx
├── layout/
│   ├── Panel.test.tsx
│   ├── Card.test.tsx
│   └── Section.test.tsx
└── ui/
    └── ThemeSwitcher.test.tsx
```

**Example Test (Input Component):**
```typescript
// src/ui/components/forms/__tests__/Input.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Input } from '../Input';

describe('Input', () => {
  it('renders with label', () => {
    render(<Input label="Email" />);
    expect(screen.getByText('Email')).toBeInTheDocument();
  });

  it('calls onChange with correct value', () => {
    const handleChange = vi.fn();
    render(<Input onChange={handleChange} />);
    
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'test@example.com' } });
    
    expect(handleChange).toHaveBeenCalledWith('test@example.com');
  });

  it('shows error message', () => {
    render(<Input error="Invalid email" />);
    expect(screen.getByText('Invalid email')).toBeInTheDocument();
  });

  it('displays start icon', () => {
    render(<Input startIcon={<span>📧</span>} />);
    expect(screen.getByText('📧')).toBeInTheDocument();
  });

  it('has correct aria attributes', () => {
    const { container } = render(<Input label="Name" error="Required" aria-required="true" />);
    const input = container.querySelector('input');
    
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby');
  });

  it('disables when disabled prop is set', () => {
    render(<Input disabled />);
    expect(screen.getByRole('textbox')).toBeDisabled();
  });
});
```

**Example Test (ToggleButton Component):**
```typescript
// src/ui/components/controls/__tests__/ToggleButton.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ToggleButton } from '../ToggleButton';

describe('ToggleButton', () => {
  it('calls onChange when clicked', () => {
    const handleChange = vi.fn();
    render(<ToggleButton checked={false} onChange={handleChange} />);
    
    const button = screen.getByRole('switch');
    fireEvent.click(button);
    
    expect(handleChange).toHaveBeenCalledWith(true);
  });

  it('renders with correct aria attributes', () => {
    const { container } = render(<ToggleButton checked={true} />);
    const button = container.querySelector('button');
    
    expect(button).toHaveAttribute('role', 'switch');
    expect(button).toHaveAttribute('aria-checked', 'true');
  });

  it('toggles between states', () => {
    const { rerender, container } = render(<ToggleButton checked={false} />);
    let button = container.querySelector('button');
    
    expect(button).toHaveAttribute('aria-checked', 'false');
    
    // Re-render with checked={true}
    rerender(<ToggleButton checked={true} />);
    button = container.querySelector('button');
    expect(button).toHaveAttribute('aria-checked', 'true');
  });
});
```

### Accessibility Testing

**Automated Accessibility Tests:**
```typescript
// src/ui/components/__tests__/accessibility.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { Input } from '../Input';
import { ToggleButton } from '../ToggleButton';
import { Button } from '../Button';

describe('Accessibility', () => {
  it('Input has no accessibility violations', async () => {
    const { container } = render(<Input label="Test" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('ToggleButton has no accessibility violations', async () => {
    const { container } = render(<ToggleButton checked={false} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('Button has no accessibility violations', async () => {
    const { container } = render(<Button>Click me</Button>);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
```

### Storybook Testing

**Automated Story Tests:**
```typescript
// src/ui/components/__stories__/__tests__/all-stories.test.ts
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import * as stories from '../forms/Input.stories';

describe('Storybook Stories', () => {
  it('renders all stories without error', async () => {
    const storiesToTest = Object.entries(stories).filter(
      ([key]) => key !== 'default' && key !== 'metadata'
    );

    for (const [storyName, story] of storiesToTest) {
      const component = story.args?.component || story.args;
      render(component);
      expect(document.body).toBeTruthy();
    }
  });
});
```

---

## Build and Verification

### Package.json Configuration
```json
{
  "type": "module",
  "scripts": {
    "build:ui": "tsc --project tsconfig.ui.json",
    "typecheck:ui": "tsc --noEmit",
    "lint:ui": "eslint src/ui/",
    "test:ui": "vitest run src/ui/__tests__",
    "test:ui:watch": "vitest src/ui/__tests__",
    "test:ui:coverage": "vitest run src/ui/__tests__ --coverage",
    "test": "npm run test:ui && npm run test:ui:coverage",
    "test:watch": "npm run test:ui:watch",
    "typecheck": "npm run typecheck:ui && tsc --noEmit",
    "lint": "npm run lint:ui",
    "storybook": "start-storybook -p 6006",
    "build:storybook": "build-storybook"
  },
  "devDependencies": {
    "@storybook/react": "^8.0.0",
    "@testing-library/react": "^16.0.0",
    "vitest": "^2.0.0",
    "jest-axe": "^9.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0"
  }
}
```

### TypeScript Configuration
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "jsx": "react-jsx",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "skipLibCheck": true,
    "paths": {
      "@ui/*": ["./src/ui/*"]
    }
  },
  "include": ["src/ui/**/*.ts", "src/ui/**/*.tsx", "src/ui/**/*.test.ts", "src/ui/**/*.test.tsx"],
  "exclude": ["node_modules", "dist", "coverage"]
}
```

### ESLint Configuration
```javascript
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import testingLibrary from 'eslint-plugin-testing-library';

export default tseslint.config(
  {
    files: ['src/ui/**/*.ts', 'src/ui/**/*.tsx'],
    plugins: {
      react,
      'react-hooks': reactHooks,
      'testing-library': testingLibrary,
    },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react/jsx-uses-react': 'off',
      'react/react-in-jsx-scope': 'off',
      'testing-library/render-result-naming': 'off',
      'react/display-name': 'warn',
    },
  },
);
```

---

## Theme Customization

### Theme Object Structure
```typescript
// src/ui/themes/types.ts
export interface ThemeColors {
  bg: {
    primary: string;
    secondary: string;
    tertiary: string;
    panel: string;
    card: string;
    section: string;
  };
  accent: {
    primary: string;
    secondary: string;
    tertiary: string;
    warning: string;
    danger: string;
    info: string;
  };
  text: {
    primary: string;
    secondary: string;
    muted: string;
    disabled: string;
    accentPrimary: string;
    accentSecondary: string;
    accentTertiary: string;
  };
  shadow: {
    sm: string;
    md: string;
    lg: string;
    xl: string;
    glowPrimary: string;
    glowSecondary: string;
  };
  radius: {
    sm: string;
    md: string;
    lg: string;
    xl: string;
    full: string;
    cyber: string;
    glitch: string;
  };
  border: {
    accent: string;
    accentSecondary: string;
  };
}

export interface ThemeSpacing {
  xs: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
  '2xl': string;
  '3xl': string;
  panel: string;
  card: string;
  input: string;
  button: string;
}

export interface Theme {
  name: string;
  colors: ThemeColors;
  spacing: ThemeSpacing;
  typography: {
    mono: string;
    ui: string;
    display: string;
    sizes: {
      xs: string;
      sm: string;
      md: string;
      lg: string;
      xl: string;
      '2xl': string;
      '3xl': string;
      '4xl': string;
      display1: string;
      display2: string;
      display3: string;
    };
    weights: {
      light: number;
      normal: number;
      medium: number;
      semibold: number;
      bold: number;
      black: number;
    };
    leading: {
      tight: string;
      snug: string;
      normal: string;
      relaxed: string;
    };
    tracking: {
      tighter: string;
      tight: string;
      wide: string;
      wider: string;
    };
  };
  transitions: {
    linear: string;
    cyber: string;
    glitch: string;
    smooth: string;
  };
  durations: {
    fast: string;
    normal: string;
    slow: string;
    glitch: string;
  };
}
```

### Cyberpunk Theme Implementation
```typescript
// src/ui/themes/cyberpunk-aether.ts
import { Theme } from './types';

export const cyberpunkAether: Theme = {
  name: 'cyberpunk-aether',
  colors: {
    bg: {
      primary: '#050508',
      secondary: '#0a0a0f',
      tertiary: '#111118',
      panel: '#0e0e15',
      card: '#0f0f14',
      section: '#15151e',
    },
    accent: {
      primary: '#00f3ff',
      secondary: '#ff00ff',
      tertiary: '#39ff14',
      warning: '#ffd700',
      danger: '#ff3131',
      info: '#5e5ce6',
    },
    text: {
      primary: '#e0e0e0',
      secondary: '#a0a0a0',
      muted: '#707070',
      disabled: '#505050',
      accentPrimary: '#00f3ff',
      accentSecondary: '#ff00ff',
      accentTertiary: '#39ff14',
    },
    shadow: {
      sm: '0 2px 4px rgba(0, 243, 255, 0.1)',
      md: '0 4px 8px rgba(0, 243, 255, 0.15), 0 2px 4px rgba(0, 243, 255, 0.1)',
      lg: '0 8px 16px rgba(0, 243, 255, 0.2), 0 4px 8px rgba(0, 243, 255, 0.1)',
      xl: '0 16px 24px rgba(0, 243, 255, 0.3), 0 8px 12px rgba(0, 243, 255, 0.2)',
      glowPrimary: '0 0 8px rgba(0, 243, 255, 0.5), 0 0 16px rgba(0, 243, 255, 0.3)',
      glowSecondary: '0 0 8px rgba(255, 0, 255, 0.5), 0 0 16px rgba(255, 0, 255, 0.3)',
    },
    radius: {
      sm: '6px',
      md: '12px',
      lg: '20px',
      xl: '32px',
      full: '9999px',
      cyber: '12px 2px 12px 2px',
      glitch: '4px 12px 4px 12px',
    },
    border: {
      accent: '#00f3ff',
      accentSecondary: '#ff00ff',
    },
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
    '2xl': '48px',
    '3xl': '64px',
    panel: '24px',
    card: '16px',
    input: '12px',
    button: '12px 20px',
  },
  typography: {
    mono: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
    ui: "'Inter', 'Segoe UI', system-ui, sans-serif",
    display: "'Oswald', 'Raleway', sans-serif",
    sizes: {
      xs: '0.75rem',
      sm: '0.875rem',
      md: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.75rem',
      '4xl': '2rem',
      display1: '3rem',
      display2: '2.5rem',
      display3: '2rem',
    },
    weights: {
      light: 300,
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
      black: 900,
    },
    leading: {
      tight: '1.1',
      snug: '1.3',
      normal: '1.5',
      relaxed: '1.75',
    },
    tracking: {
      tighter: '-0.05em',
      tight: '-0.025em',
      wide: '0.025em',
      wider: '0.05em',
    },
  },
  transitions: {
    linear: 'linear',
    cyber: 'cubic-bezier(0.68, -0.55, 0.27, 1.55)',
    glitch: 'cubic-bezier(0.6, 0.04, 0.98, 0.335)',
    smooth: 'cubic-bezier(0.25, 1, 0.5, 1)',
  },
  durations: {
    fast: '150ms',
    normal: '250ms',
    slow: '400ms',
    glitch: '75ms',
  },
};
```

---

## Component Implementation Checklist

### Form Components
- [x] Input component
  - [x] Props interface
  - [x] Storybook stories
  - [x] Tailwind classes
  - [x] Accessibility attributes
  - [x] Test coverage
  
- [x] TextArea component
  - [x] Props interface
  - [x] Storybook stories
  - [x] Tailwind classes
  - [x] Accessibility attributes
  - [x] Test coverage

- [x] Select component
  - [x] Props interface
  - [x] Storybook stories
  - [x] Tailwind classes
  - [x] Accessibility attributes
  - [x] Test coverage

- [x] MultiSelect component
  - [x] Props interface
  - [x] Storybook stories
  - [x] Tailwind classes
  - [x] Accessibility attributes
  - [x] Test coverage

### Control Components
- [x] Button component
  - [x] Props interface
  - [x] Storybook stories
  - [x] Tailwind classes
  - [x] Accessibility attributes
  - [x] Test coverage

- [x] ToggleButton component
  - [x] Props interface
  - [x] Storybook stories
  - [x] Tailwind classes
  - [x] Accessibility attributes
  - [x] Test coverage

- [x] ToggleRadioGroup component
  - [x] Props interface
  - [x] Storybook stories
  - [x] Tailwind classes
  - [x] Accessibility attributes
  - [x] Test coverage

- [x] ToggleCheckbox component
  - [x] Props interface
  - [x] Storybook stories
  - [x] Tailwind classes
  - [x] Accessibility attributes
  - [x] Test coverage

### Layout Components
- [x] Panel component
  - [x] Props interface
  - [x] Storybook stories
  - [x] Tailwind classes
  - [x] Accessibility attributes
  - [x] Test coverage

- [x] Card component
  - [x] Props interface
  - [x] Storybook stories
  - [x] Tailwind classes
  - [x] Accessibility attributes
  - [x] Test coverage

- [x] Section component
  - [x] Props interface
  - [x] Storybook stories
  - [x] Tailwind classes
  - [x] Accessibility attributes
  - [x] Test coverage

### UI Components
- [x] ThemeSwitcher component
  - [x] Props interface
  - [x] Storybook stories
  - [x] Tailwind classes
  - [x] Accessibility attributes
  - [x] Test coverage

---

## Development Workflow

### 1. Component Development
```bash
# Create new component
mkdir src/ui/components/forms/MyComponent.tsx

# Run development server
npm run storybook

# Component tests
npm run test:ui

# Type check
npm run typecheck:ui
```

### 2. Theme Development
```bash
# Update theme colors
npm run theme:generate

# Preview theme changes
npm run storybook -- --theme dark
```

### 3. Documentation
```bash
# Generate docs
npm run docs:generate

# Preview docs
npm run docs:preview
```

### 4. Deployment
```bash
# Build component library
npm run build:ui

# Deploy
npm run deploy
```

---

## Implementation Files Structure

### Core Component Files
```
src/ui/components/
├── forms/
│   ├── Input.tsx
│   ├── __tests__/Input.test.tsx
│   ├── __stories__/Input.stories.tsx
│   ├── index.ts
│   └── types.ts
│
├── forms/
│   ├── TextArea.tsx
│   ├── __tests__/TextArea.test.tsx
│   ├── __stories__/TextArea.stories.tsx
│   ├── index.ts
│   └── types.ts
│
├── forms/
│   ├── Select.tsx
│   ├── __tests__/Select.test.tsx
│   ├── __stories__/Select.stories.tsx
│   ├── index.ts
│   └── types.ts
│
├── forms/
│   ├── MultiSelect.tsx
│   ├── __tests__/MultiSelect.test.tsx
│   ├── __stories__/MultiSelect.stories.tsx
│   ├── index.ts
│   └── types.ts
│
├── controls/
│   ├── Button.tsx
│   ├── __tests__/Button.test.tsx
│   ├── __stories__/Button.stories.tsx
│   ├── index.ts
│   └── types.ts
│
├── controls/
│   ├── ToggleButton.tsx
│   ├── __tests__/ToggleButton.test.tsx
│   ├── __stories__/ToggleButton.stories.tsx
│   ├── index.ts
│   └── types.ts
│
├── controls/
│   ├── ToggleRadioGroup.tsx
│   ├── __tests__/ToggleRadioGroup.test.tsx
│   ├── __stories__/ToggleRadioGroup.stories.tsx
│   ├── index.ts
│   └── types.ts
│
├── controls/
│   ├── ToggleCheckbox.tsx
│   ├── __tests__/ToggleCheckbox.test.tsx
│   ├── __stories__/ToggleCheckbox.stories.tsx
│   ├── index.ts
│   └── types.ts
│
├── layout/
│   ├── Panel.tsx
│   ├── __tests__/Panel.test.tsx
│   ├── __stories__/Panel.stories.tsx
│   ├── index.ts
│   └── types.ts
│
├── layout/
│   ├── Card.tsx
│   ├── __tests__/Card.test.tsx
│   ├── __stories__/Card.stories.tsx
│   ├── index.ts
│   └── types.ts
│
├── layout/
│   ├── Section.tsx
│   ├── __tests__/Section.test.tsx
│   ├── __stories__/Section.stories.tsx
│   ├── index.ts
│   └── types.ts
│
├── ui/
│   ├── ThemeSwitcher.tsx
│   ├── __tests__/ThemeSwitcher.test.tsx
│   ├── __stories__/ThemeSwitcher.stories.tsx
│   ├── index.ts
│   └── types.ts
│
└── index.ts (barrel exports)
```

---

## Final Implementation Notes

### Component Naming Conventions
- PascalCase for component names: `Input`, `TextArea`, `Button`
- Kebab-case for CSS classes: `cyber-panel`, `glitch-button`
- UpperCamelCase for storybook stories: `InputWithLabel`, `ButtonPrimary`
- LowerCamelCase for props: `checked`, `onChange`, `cyberBorder`

### Accessibility Standards
- All components must pass automated accessibility tests
- Screen reader labels for all interactive elements
- Keyboard navigation support
- Focus ring visibility
- Color contrast minimum 4.5:1

### Performance Considerations
- Use React.memo for expensive components
- Debounce search/filter operations
- Lazy load stories and heavy components
- Optimize animations with hardware acceleration

### Browser Support
- Chrome/Edge (latest 2 versions)
- Firefox (latest 2 versions)
- Safari (latest 2 versions)
- Mobile browsers (iOS Safari, Chrome Mobile)

### Internationalization
- RTL layout support
- Right-to-left text direction
- Language-aware date/time formatting
- Character-specific typography

---

## Getting Started with Development

1. **Install Dependencies**
   ```bash
   npm install
   npm run build:ui
   ```

2. **Start Storybook**
   ```bash
   npm run storybook
   ```

3. **Run Tests**
   ```bash
   npm run test:ui
   npm run test:ui:coverage
   ```

4. **Type Checking**
   ```bash
   npm run typecheck:ui
   ```

5. **Linting**
   ```bash
   npm run lint:ui
   ```

---

## License

This component library is part of the AI Factory project and follows the same licensing terms.

---

**Last Updated:** 2024-06-22
**Version:** 0.1.0
**Author:** AI Factory Team
