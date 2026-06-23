# AI Factory Theme System

A complete theme system with runtime switching and SQLite persistence for the AI Factory UI.

## Features

- **Three Pre-built Themes**: synthwave84 (default), tokyonight, zenburn
- **Runtime Switching**: Instant theme changes without page reload
- **SQLite Persistence**: Theme preferences persist across sessions
- **Cyberpunk Aesthetic**: Rounded corners and subtle glow effects
- **CSS Variables Injection**: Runtime CSS variable updates

## Architecture

```
src/ui/theme/
├── components/          # React components
│   ├── SettingsPanel.tsx     # Settings management panel
│   ├── ThemeProvider.tsx     # Theme provider component
│   └── ThemeSwitcher.tsx     # Theme selector UI widget
├── hooks/               # Custom React hooks
│   ├── useTheme.ts           # Theme access hook
│   └── useThemePreference.ts # Persistence hook
├── services.ts          # SQLite theme persistence
├── theme-manager.ts     # Theme processing and validation
├── constants.ts         # Theme definitions
├── types.ts             # TypeScript types
├── styles/
│   └── global.css       # Global CSS with theme variables
├── index.ts             # Barrel exports
└── __stories__/         # Storybook stories
```

## Theme System Components

### 1. Types (types.ts)

```typescript
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
```

### 2. Theme Configuration (constants.ts)

Three theme options with cyberpunk colors:

- **synthwave84**: Neon pink/purple, vibrant, high contrast
- **tokyonight**: Soft purple/blue, reduced brightness
- **zenburn**: Low-contrast grayscale, eye comfort

### 3. Theme Manager (theme-manager.ts)

Handles theme processing, CSS variable injection, and validation.

```typescript
export class ThemeManager {
  setTheme(themeId: ThemeId): void;
  toCSSVariables(): string;
  injectCSS(): void;
}
```

### 4. SQLite Repository (services.ts)

Persistence layer using SQLite key-value store.

```typescript
export class SQLiteThemeRepository {
  async getThemeId(): Promise<string | undefined>;
  async saveThemeId(themeId: ThemeId): Promise<void>;
  async deleteThemeId(): Promise<void>;
}
```

### 5. React Hooks

#### useTheme

Access current theme and switch themes:

```typescript
const { currentTheme, setTheme, themeOptions } = useTheme();
```

#### useThemePreference

Persist theme preferences:

```typescript
const { saveThemePreference, loadThemePreference, defaultTheme } = useThemePreference();
```

### 6. React Components

#### ThemeProvider

Wraps application with theme context:

```tsx
<ThemeProviderWrapper defaultTheme="synthwave84">
  <App />
</ThemeProviderWrapper>
```

#### ThemeSwitcher

Theme selector dropdown widget:

```tsx
<ThemeSwitcher showLabel={true} className="w-48" />
```

#### SettingsPanel

Full settings management panel:

```tsx
<SettingsPanel
  title="Appearance Settings"
  subtitle="Customize AI Factory UI theme"
/>
```

## CSS Variables

Runtime-injected CSS variables:

```css
--theme-primary
--theme-secondary
--theme-accent
--theme-success
--theme-warning
--theme-error
--theme-muted
--theme-border
--theme-background
--theme-foreground
--theme-font-family
--theme-borderRadius
--theme-shadow
--theme-glow
```

## Usage Examples

### Basic Theme Switching

```tsx
import { useTheme } from './theme';

function MyComponent() {
  const { currentTheme, setTheme } = useTheme();
  
  return (
    <div>
      <p>Current theme: {currentTheme.name}</p>
      <button onClick={() => setTheme('tokyonight')}>
        Switch to Tokyo Night
      </button>
    </div>
  );
}
```

### Persistent Theme Preference

```tsx
import { useThemePreference } from './theme';

function Settings() {
  const { saveThemePreference, loadThemePreference } = useThemePreference();
  
  const handleSave = (themeId: string) => {
    saveThemePreference(themeId);
  };
  
  return (
    <div>
      <p>Default theme: {loadThemePreference()}</p>
    </div>
  );
}
```

### Storybook Stories

The theme system includes Storybook stories:

```bash
npx storybook
```

- **ThemeSwitcher**: Storybook story showing theme switcher with all three themes
- **SettingsPanel**: Storybook story showing settings management panel

## Testing

Runs 8 tests for the theme configuration:

```bash
npm run test -- src/ui/theme/__tests__/theme-config.test.ts
```

## Integration with Existing System

The theme system is designed to work alongside the existing `cyberpunk-aether` theme system while providing its own independent implementation with:

- Runtime CSS variable injection
- SQLite persistence
- React hooks for easy access
- Storybook documentation

## Files Created

1. `src/ui/theme/types.ts` - TypeScript types
2. `src/ui/theme/constants.ts` - Theme definitions
3. `src/ui/theme/services.ts` - SQLite repository
4. `src/ui/theme/theme-manager.ts` - Theme processing
5. `src/ui/theme/components/SettingsPanel.tsx` - Settings panel
6. `src/ui/theme/components/ThemeProvider.tsx` - Provider component
7. `src/ui/theme/components/ThemeSwitcher.tsx` - Theme selector
8. `src/ui/theme/hooks/useTheme.ts` - Theme hook
9. `src/ui/theme/hooks/useThemePreference.ts` - Persistence hook
10. `src/ui/theme/styles/global.css` - Global CSS
11. `src/ui/theme/index.ts` - Barrel exports
12. `src/ui/theme/__stories__/ThemeSwitcher.stories.tsx` - Storybook stories
13. `src/ui/theme/__stories__/SettingsPanel.stories.tsx` - Storybook stories
14. `src/ui/theme/__tests__/theme-config.test.ts` - Tests

## Test Results

All 212 tests pass, including 8 theme-specific tests:

- Test Suite: 39 passed
- Tests: 212 passed
- Theme Tests: 8 passed
