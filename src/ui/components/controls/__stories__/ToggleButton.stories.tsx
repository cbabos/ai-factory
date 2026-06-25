import type { Meta, StoryObj } from '@storybook/react';
import { ToggleButton } from '../controls/ToggleButton.js';

const meta: Meta<typeof ToggleButton> = {
  title: 'UI/Controls/ToggleButton',
  component: ToggleButton,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    checked: {
      control: { type: 'boolean' },
      description: 'Is button currently toggled on',
    },
    onChange: {
      control: { action: 'onChange' },
      description: 'Callback for toggle events',
    },
    label: {
      control: { type: 'text' },
      description: 'Label text',
    },
    iconOn: {
      control: { type: 'text' },
      description: 'Icon for on state',
    },
    iconOff: {
      control: { type: 'text' },
      description: 'Icon for off state',
    },
    cyberBorder: {
      control: { type: 'boolean' },
      description: 'Cyberpunk border color',
    },
    glitchEffect: {
      control: { type: 'boolean' },
      description: 'Glitch effect on toggle',
    },
    size: {
      control: { type: 'select' },
      options: ['sm', 'md', 'lg'],
      description: 'Button size',
    },
    variant: {
      control: { type: 'select' },
      options: ['default', 'cyber'],
      description: 'Button variant',
    },
    disabled: {
      control: { type: 'boolean' },
      description: 'Disabled state',
    },
  },
};

export default meta;
type Story = StoryObj<typeof ToggleButton>;

export const Default: Story = {
  args: {
    label: 'Enable Feature',
    checked: false,
  },
};

export const OnState: Story = {
  args: {
    label: 'Feature Active',
    checked: true,
  },
};

export const WithIcons: Story = {
  args: {
    label: 'Toggle With Icons',
    iconOn: '⚡',
    iconOff: '🔌',
    checked: false,
  },
};

export const CyberVariant: Story = {
  args: {
    label: 'Cyber Toggle',
    variant: 'cyber',
    cyberBorder: true,
    checked: false,
  },
};

export const GlitchEffect: Story = {
  args: {
    label: 'Glitch Toggle',
    glitchEffect: true,
    checked: false,
  },
};

export const SizeVariants: Story = {
  render: () => (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-bold text-accent-primary mb-2">Small Size</h4>
        <ToggleButton label=" SMALL" size="sm" />
      </div>
      <div>
        <h4 className="text-sm font-bold text-accent-primary mb-2">Medium Size</h4>
        <ToggleButton label=" MEDIUM" size="md" />
      </div>
      <div>
        <h4 className="text-sm font-bold text-accent-primary mb-2">Large Size</h4>
        <ToggleButton label=" LARGE" size="lg" />
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        summary: 'All available toggle button sizes',
      },
    },
  },
};

export const WithIconsAndState: Story = {
  args: {
    label: 'Air Mode',
    iconOn: '✈️ ON',
    iconOff: '✈️ OFF',
    checked: false,
  },
};
