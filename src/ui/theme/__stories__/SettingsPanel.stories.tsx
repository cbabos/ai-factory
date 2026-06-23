import type { Meta, StoryObj } from '@storybook/react';
import { SettingsPanel } from '../components/SettingsPanel.js';
import { ThemeProviderWrapper as ThemeProvider } from '../components/ThemeProvider.js';

const meta: Meta<typeof SettingsPanel> = {
  title: 'UI/Theme/SettingsPanel',
  component: SettingsPanel,
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
    title: {
      control: { type: 'text' },
      description: 'Panel title',
    },
    subtitle: {
      control: { type: 'text' },
      description: 'Panel subtitle',
    },
    className: {
      control: { type: 'text' },
      description: 'Additional CSS classes',
    },
  },
};

export default meta;
type Story = StoryObj<typeof SettingsPanel>;

export const Default: Story = {
  args: {
    title: 'Appearance Settings',
    subtitle: 'Customize the visual theme of AI Factory',
  },
  parameters: {
    docs: {
      description: {
        summary: 'Basic settings panel with theme selection',
      },
    },
  },
};

export const Minimal: Story = {
  args: {
    title: 'Theme',
  },
  parameters: {
    docs: {
      source: {
        code: `<SettingsPanel title="Theme" />`,
      },
    },
  },
};

export const FullFeature: Story = {
  render: () => (
    <div className="max-w-md">
      <SettingsPanel
        title="Appearance Settings"
        subtitle="Manage AI Factory UI theme preferences"
      />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        summary: 'Complete settings panel with full theme selection and preview',
      },
    },
  },
};

export const CustomCSS: Story = {
  args: {
    title: 'UI Configuration',
    className: 'max-w-lg w-full',
  },
  parameters: {
    docs: {
      source: {
        code: `<SettingsPanel title="UI Configuration" className="max-w-lg w-full" />`,
      },
    },
  },
};
