import type { Meta, StoryObj } from '@storybook/react';
import { ThemeSwitcher } from '../components/ThemeSwitcher.js';
import { ThemeProviderWrapper as ThemeProvider } from '../components/ThemeProvider.js';

const meta: Meta<typeof ThemeSwitcher> = {
  title: 'UI/Theme/ThemeSwitcher',
  component: ThemeSwitcher,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <ThemeProvider defaultTheme="synthwave84">
        <Story />
      </ThemeProvider>
    ),
  ],
  tags: ['autodocs'],
  argTypes: {
    showLabel: {
      control: { type: 'boolean' },
      description: 'Show theme name label',
      defaultValue: false,
    },
    className: {
      control: { type: 'text' },
      description: 'Additional CSS classes',
    },
  },
};

export default meta;
type Story = StoryObj<typeof ThemeSwitcher>;

export const Default: Story = {
  args: {
    showLabel: false,
  },
};

export const WithLabel: Story = {
  args: {
    showLabel: true,
  },
};

export const CustomCSS: Story = {
  args: {
    className: 'w-32',
  },
  parameters: {
    docs: {
      source: {
        code: `<ThemeSwitcher className="w-32" />`,
      },
    },
  },
};

export const AllThemes: Story = {
  render: () => (
    <div className="space-y-8">
      <div className="text-center mb-8">
        <h3 className="text-lg font-bold text-accent-primary">Theme Switcher Demo</h3>
        <p className="text-sm text-text-secondary">
          Click the switcher below to switch between available themes
        </p>
      </div>
      <div className="flex justify-center gap-4">
        <ThemeSwitcher showLabel={true} className="w-48" />
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        summary: 'Theme switcher with all three available themes: Synthwave 84, Tokyo Night, and Zenburn',
      },
    },
  },
};
