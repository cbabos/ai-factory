import type { Meta, StoryObj } from '@storybook/react';
import { ToggleRadioGroup } from '../controls/ToggleRadioGroup.js';

const meta: Meta<typeof ToggleRadioGroup> = {
  title: 'UI/Controls/ToggleRadioGroup',
  component: ToggleRadioGroup,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    value: {
      control: { type: 'text' },
      description: 'Selected value',
    },
    onChange: {
      control: { action: 'onChange' },
      description: 'Callback for value changes',
    },
    options: {
      control: { type: 'object' },
      description: 'Radio options',
    },
    label: {
      control: { type: 'text' },
      description: 'Label',
    },
    direction: {
      control: { type: 'select' },
      options: ['vertical', 'horizontal'],
      description: 'Vertical or horizontal layout',
    },
    cyber: {
      control: { type: 'boolean' },
      description: 'Cyberpunk style',
    },
    size: {
      control: { type: 'select' },
      options: ['sm', 'md', 'lg'],
      description: 'Button size',
    },
    disabled: {
      control: { type: 'boolean' },
      description: 'Disabled state',
    },
  },
};

export default meta;
type Story = StoryObj<typeof ToggleRadioGroup>;

const options = [
  { value: 'option1', label: 'Option 1', icon: '🚀', cyber: false },
  { value: 'option2', label: 'Option 2', icon: '⚡', cyber: false },
  { value: 'option3', label: 'Option 3', icon: '💡', cyber: false },
];

export const Default: Story = {
  args: {
    label: 'Choose Option',
    options: options,
    value: 'option1',
  },
};

export const Horizontal: Story = {
  args: {
    label: 'Direction',
    direction: 'horizontal',
    options: options,
    value: 'option1',
  },
};

export const CyberStyle: Story = {
  args: {
    label: 'Cyber Selection',
    cyber: true,
    options: options,
    value: 'option1',
  },
};

export const WithIcons: Story = {
  args: {
    label: 'Select Method',
    options: options,
    value: 'option1',
  },
};

export const DisabledOption: Story = {
  args: {
    label: 'Choices',
    options: [
      ...options,
      { value: 'disabled', label: 'Disabled', icon: '🔒', disabled: true, cyber: false },
    ],
    value: 'option1',
  },
};

export const AllSizes: Story = {
  render: () => (
    <div className="space-y-6">
      <div>
        <h4 className="text-sm font-bold text-accent-primary mb-2">Small Size</h4>
        <ToggleRadioGroup
          label="Size"
          size="sm"
          options={options}
          value="option1"
        />
      </div>
      <div>
        <h4 className="text-sm font-bold text-accent-primary mb-2">Large Size</h4>
        <ToggleRadioGroup
          label="Size"
          size="lg"
          options={options}
          value="option1"
        />
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        summary: 'Toggle Radio Group in different sizes',
      },
    },
  },
};

export const CyberWithIcons: Story = {
  args: {
    label: 'Cyber Selection',
    cyber: true,
    options: [
      { value: 'cyber1', label: 'First', icon: '🤖', cyber: true },
      { value: 'cyber2', label: 'Second', icon: '🧠', cyber: true },
      { value: 'cyber3', label: 'Third', icon: '📡', cyber: true },
    ],
    value: 'cyber1',
  },
};

export const KeyboardNavigation: Story = {
  render: () => (
    <div className="space-y-6">
      <div>
        <h4 className="text-sm font-bold text-accent-primary mb-4">
          Use arrow keys to navigate
        </h4>
        <ToggleRadioGroup
          label="Navigation Test"
          direction="vertical"
          options={options}
          value="option1"
        />
      </div>
      <div className="text-xs text-text-secondary">
        <p className="mb-1 font-bold text-accent-primary">Keyboard shortcuts:</p>
        <ul className="list-disc list-inside">
          <li>
            <span className="text-accent-primary">↑ / Arrow Left</span> - Move to previous option
          </li>
          <li>
            <span className="text-accent-primary">↓ / Arrow Right</span> - Move to next option
          </li>
          <li>
            <span className="text-accent-primary">Home</span> - Jump to first option
          </li>
          <li>
            <span className="text-accent-primary">End</span> - Jump to last option
          </li>
        </ul>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        summary: 'Example with keyboard navigation support',
      },
    },
  },
};
