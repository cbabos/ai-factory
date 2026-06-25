import type { Meta, StoryObj } from '@storybook/react';
import { Select } from '../Select.js';

const meta: Meta<typeof Select> = {
  title: 'UI/Forms/Select',
  component: Select,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    label: {
      control: { type: 'text' },
      description: 'Label text displayed above select',
    },
    error: {
      control: { type: 'text' },
      description: 'Error message to display',
    },
    helpText: {
      control: { type: 'text' },
      description: 'Helper text displayed below select',
    },
    options: {
      control: { type: 'object' },
      description: 'Options for the select',
    },
    startIcon: {
      control: { type: 'text' },
      description: 'Icon before select',
    },
    cyrillicArrow: {
      control: { type: 'boolean' },
      description: 'Show cyrillic dropdown arrow',
    },
    cyberBorder: {
      control: { type: 'boolean' },
      description: 'Enable cyberpunk animated border',
    },
    glitchEffect: {
      control: { type: 'boolean' },
      description: 'Show glitch effect',
    },
    size: {
      control: { type: 'select' },
      options: ['sm', 'md', 'lg'],
      description: 'Select size',
    },
    variant: {
      control: { type: 'select' },
      options: ['outline', 'filled', 'cyber'],
      description: 'Select variant style',
    },
    disabled: {
      control: { type: 'boolean' },
      description: 'Disable the select',
    },
  },
};

export default meta;
type Story = StoryObj<typeof Select>;

const options = [
  { value: 'option1', label: 'Option 1', icon: '🚀' },
  { value: 'option2', label: 'Option 2', icon: '⚡' },
  { value: 'option3', label: 'Option 3', icon: '💡' },
  { value: 'disabled', label: 'Disabled Option', disabled: true, icon: '🔒' },
];

export const Default: Story = {
  args: {
    label: 'Choose an Option',
    options: options,
    placeholder: 'Select an option...',
  },
};

export const CyberVariant: Story = {
  args: {
    label: 'Cyber Selection',
    variant: 'cyber',
    options: options,
  },
};

export const CyrillicArrow: Story = {
  args: {
    label: 'Cyrillic Arrow',
    cyrillicArrow: true,
    options: options,
  },
};

export const WesternArrow: Story = {
  args: {
    label: 'Western Arrow',
    cyrillicArrow: false,
    options: options,
  },
};

export const WithIcons: Story = {
  args: {
    label: 'Choose Protocol',
    options: options,
  },
};

export const WithError: Story = {
  args: {
    label: 'Invalid Selection',
    error: 'Please select a valid option',
    options: options,
  },
};

export const AllVariants: Story = {
  render: () => (
    <div className="space-y-8">
      <div>
        <h4 className="text-sm font-bold text-accent-primary mb-4">Outline Variant</h4>
        <Select
          label="Outline"
          variant="outline"
          options={options}
          placeholder="Select..."
        />
      </div>
      <div>
        <h4 className="text-sm font-bold text-accent-primary mb-4">Filled Variant</h4>
        <Select
          label="Filled"
          variant="filled"
          options={options}
          placeholder="Select..."
        />
      </div>
      <div>
        <h4 className="text-sm font-bold text-accent-primary mb-4">Cyber Variant</h4>
        <Select
          label="Cyber"
          variant="cyber"
          options={options}
          placeholder="Select..."
        />
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        summary: 'All available select variants',
      },
    },
  },
};

export const SizeVariants: Story = {
  render: () => (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-bold text-accent-primary mb-4">Small Size</h4>
        <Select size="sm" label="Small" options={options} />
      </div>
      <div>
        <h4 className="text-sm font-bold text-accent-primary mb-4">Medium Size</h4>
        <Select size="md" label="Medium" options={options} />
      </div>
      <div>
        <h4 className="text-sm font-bold text-accent-primary mb-4">Large Size</h4>
        <Select size="lg" label="Large" options={options} />
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        summary: 'All available select sizes',
      },
    },
  },
};
