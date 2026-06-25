import type { Meta, StoryObj } from '@storybook/react';
import { ToggleCheckbox } from '../controls/ToggleCheckbox.js';

const meta: Meta<typeof ToggleCheckbox> = {
  title: 'UI/Controls/ToggleCheckbox',
  component: ToggleCheckbox,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    checked: {
      control: { type: 'boolean' },
      description: 'Is checkbox checked',
    },
    onChange: {
      control: { action: 'onChange' },
      description: 'Callback for change events',
    },
    label: {
      control: { type: 'text' },
      description: 'Checkbox label',
    },
    description: {
      control: { type: 'text' },
      description: 'Description text',
    },
    disabled: {
      control: { type: 'boolean' },
      description: 'Disabled state',
    },
    cyber: {
      control: { type: 'boolean' },
      description: 'Cyberpunk style',
    },
    icon: {
      control: { type: 'text' },
      description: 'Custom checkbox icon',
    },
    size: {
      control: { type: 'select' },
      options: ['sm', 'md', 'lg'],
      description: 'Checkbox size',
    },
    type: {
      control: { type: 'text' },
      description: 'Checkbox type',
    },
  },
};

export default meta;
type Story = StoryObj<typeof ToggleCheckbox>;

export const Default: Story = {
  args: {
    label: 'Enable Feature',
    checked: false,
  },
};

export const Checked: Story = {
  args: {
    label: 'Feature Enabled',
    checked: true,
  },
};

export const CyberStyle: Story = {
  args: {
    label: 'Cyber Checkbox',
    cyber: true,
    checked: false,
  },
};

export const WithDescription: Story = {
  args: {
    label: 'Email Notifications',
    description: 'Receive daily updates about your projects',
    checked: false,
  },
};

export const Disabled: Story = {
  args: {
    label: 'ReadOnly Feature',
    disabled: true,
    checked: false,
  },
};

export const SizeVariants: Story = {
  render: () => (
    <div className="space-y-6">
      <div>
        <h4 className="text-sm font-bold text-accent-primary mb-2">Small Size</h4>
        <ToggleCheckbox label=" Small" size="sm" />
      </div>
      <div>
        <h4 className="text-sm font-bold text-accent-primary mb-2">Medium Size</h4>
        <ToggleCheckbox label=" Medium" size="md" />
      </div>
      <div>
        <h4 className="text-sm font-bold text-accent-primary mb-2">Large Size</h4>
        <ToggleCheckbox label=" Large" size="lg" />
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        summary: 'All available checkbox sizes',
      },
    },
  },
};

export const CyberChecked: Story = {
  args: {
    label: 'Cyber Enabled',
    cyber: true,
    checked: true,
  },
};
