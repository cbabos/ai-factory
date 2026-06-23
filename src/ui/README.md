# AI Factory Cyberpunk UI Component Library

A comprehensive React 19 UI component library with a cyberpunk aesthetic for the AI Factory application.

## Features

- **Cyberpunk Aesthetic**: Neon accents, glitch effects, glassmorphism, and retro-future design
- **Full TypeScript Support**: Type-safe components with comprehensive prop interfaces
- **Accessibility First**: WCAG AA compliant with proper ARIA attributes
- **Tailwind CSS Integration**: Cyberpunk color palette and utility classes
- **Storybook Integration**: Interactive component documentation
- **Vitest + React Testing Library**: Comprehensive test coverage

## Quick Start

### Installation

```bash
npm install react react-dom @tailwindcss/forms
```

### Setup

Add the cyberpunk theme to your `tailwind.config.js`:

```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/ui/**/*.{js,ts,jsx,tsx}',
    './src/**/*.tsx',
  ],
  theme: {
    extend: {
      colors: {
        accent: {
          primary: '#00f3ff',
          secondary: '#ff00ff',
          tertiary: '#39ff14',
          warning: '#ffd700',
          danger: '#ff3131',
          info: '#5e5ce6',
        },
      },
      animation: {
        'glitch': 'glitch-text 3s infinite',
        'border-pulse': 'border-pulse 2s infinite',
      },
      keyframes: {
        'glitch-text': {
          '0%': { clipPath: 'inset(0 0 0 0)' },
          '25%': { clipPath: 'inset(0 0 50% 0)', transform: 'translateX(-2px)' },
          '50%': { clipPath: 'inset(50% 0 0 0)', transform: 'translateX(2px)' },
          '75%': { clipPath: 'inset(0 0 0 50%)', transform: 'translateX(-2px)' },
          '100%': { clipPath: 'inset(0 50% 0 0)', transform: 'translateX(2px)' },
        },
        'border-pulse': {
          '0%, 100%': { boxShadow: '0 0 8px rgba(0, 243, 255, 0.5)' },
          '50%': { boxShadow: '0 0 4px rgba(0, 243, 255, 0.7)' },
        },
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
};
```

### Import Components

```typescript
import { Input, Select, Button, Panel, Card, Section } from '@ui/components';

// Or import individual components
import { Input } from '@ui/components/forms/Input';
import { Button } from '@ui/components/controls/Button';
```

## Component Categories

### Forms

- **Input**: Single-line text input with label, icons, and variants
- **TextArea**: Multi-line text input with auto-grow and character counter
- **Select**: Dropdown select with custom styling and cyrillic arrow
- **MultiSelect**: Multi-selection dropdown with tag display and search

### Controls

- **Button**: Button with variants (primary, secondary, danger, ghost, cyber)
- **ToggleButton**: On/Off toggle switch with icon support
- **ToggleRadioGroup**: Radio group with toggle button interface
- **ToggleCheckbox**: Checkbox with toggle button interface

### Layout

- **Panel**: Panel with header, body, footer, and collapsible sections
- **Card**: Card component with variants and grid layout
- **Section**: Section with title, subtitle, and divider

### UI Components

- **ThemeSwitcher**: Theme selector with dropdown menu
- **StatusIndicator**: Status indicator with pulsing dot
- **Alert**: Alert messages with types (info, success, warning, error)
- **Badge**: Badge with various variants and sizes

## Example Usage

### Form Components

```tsx
import { Input, Select, Button, TextArea } from '@ui/components';

function MyForm() {
  return (
    <div className="max-w-2xl mx-auto p-6">
      <Input 
        label="Email Address"
        placeholder="Enter your email"
        error={error}
        helpText="We'll never share your email"
        startIcon={<span>📧</span>}
        cyberBorder
      />
      
      <Select 
        label="Choose an option"
        options={[
          { value: 'option1', label: 'Option 1' },
          { value: 'option2', label: 'Option 2' },
        ]}
        cyberBorder
      />
      
      <TextArea 
        label="Description"
        autoGrow
        maxLength={500}
        showCounter
        cyberBorder
      />
      
      <Button variant="cyber" onClick={handleSubmit}>
        Submit Form
      </Button>
    </div>
  );
}
```

### Layout Components

```tsx
import { Panel, Card, Section } from '@ui/components';

function Dashboard() {
  return (
    <div className="p-6 space-y-6">
      <Section title="System Status">
        <div className="grid grid-cols-3 gap-6">
          <Card 
            title="CPU Usage" 
            subtitle="65% - Normal" 
            variant="cyber"
          >
            <div className="h-32 flex items-center justify-center">
              <StatusIndicator status="online" showLabel />
            </div>
          </Card>
          <Card 
            title="Memory" 
            subtitle="42% - Normal" 
            variant="cyber"
          />
          <Card 
            title="Network" 
            subtitle="Active" 
            variant="cyber"
          />
        </div>
      </Section>

      <Panel 
        title="Configuration"
        cyberBorder
        collapsible
        defaultExpanded={true}
      >
        <div className="space-y-4">
          {/* Configuration options */}
        </div>
      </Panel>
    </div>
  );
}
```

### Interactive Components

```tsx
import { ToggleButton, ToggleRadioGroup, ToggleCheckbox } from '@ui/components';

function Settings() {
  const [settings, setSettings] = useState({
    notifications: true,
    theme: 'dark',
    features: ['analytics', 'reports'],
  });

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold mb-4">Preferences</h3>
        <div className="space-y-4">
          <ToggleButton
            label="Enable Notifications"
            checked={settings.notifications}
            onChange={(checked) => setSettings(s => ({...s, notifications: checked}))}
            cyber
          />
          
          <ToggleRadioGroup
            label="Theme Selection"
            value={settings.theme}
            onChange={(theme) => setSettings(s => ({...s, theme}))}
            options={[
              { value: 'cyberpunk-aether', label: 'Cyberpunk' },
              { value: 'dark', label: 'Dark' },
              { value: 'light', label: 'Light' },
            ]}
            cyber
          />
          
          <ToggleCheckbox
            label="Advanced Features"
            description="Enable experimental features"
            checked={settings.features.includes('advanced')}
            onChange={(checked) => {
              const newFeatures = checked 
                ? [...settings.features, 'advanced']
                : settings.features.filter(f => f !== 'advanced');
              setSettings(s => ({...s, features: newFeatures}));
            }}
            cyber
          />
        </div>
      </div>
    </div>
  );
}
```

## Testing

```bash
# Run all tests
npm run test:ui

# Run tests with coverage
npm run test:ui:coverage

# Type check
npm run typecheck:ui

# Lint
npm run lint:ui
```

## Theme Customization

Customize the cyberpunk theme by modifying `src/ui/themes/cyberpunk-aether.ts`:

```typescript
export const cyberpunkAether: Theme = {
  name: 'cyberpunk-aether',
  
  colors: {
    accent: {
      primary: '#00f3ff',   // Cyan
      secondary: '#ff00ff', // Magenta
      tertiary: '#39ff14',  // Lime green
      warning: '#ffd700',   // Gold
      danger: '#ff3131',    // Neon red
      info: '#5e5ce6',      // Indigo
    },
    // ... other color definitions
  },
  
  // ... other theme properties
};
```

## Accessibility

All components follow WCAG AA accessibility guidelines:

- Proper ARIA attributes for form controls
- Keyboard navigation support
- Screen reader compatible labels
- Focus management
- Color contrast ratio ≥ 4.5:1

## Browser Support

- Chrome/Edge (latest 2 versions)
- Firefox (latest 2 versions)
- Safari (latest 2 versions)
- Mobile browsers (iOS Safari, Chrome Mobile)

## License

MIT License - See LICENSE file for details.

## Contributing

1. Create a feature branch
2. Add tests for new components
3. Update Storybook stories
4. Run type check and lint
5. Create a pull request

## Acknowledgments

- Tailwind CSS for utility-first styling
- Storybook for component development
- React Testing Library for component testing
- WCAG guidelines for accessibility
