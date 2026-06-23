import type { Meta, StoryObj } from '@storybook/react';
import { MultiSelect } from '../MultiSelect.js';

const meta: Meta<typeof MultiSelect> = {
  title: 'UI/Forms/MultiSelect',
  component: MultiSelect,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    label: {
      control: { type: 'text' },
      description: 'Label text displayed above multiselect',
    },
    error: {
      control: { type: 'text' },
      description: 'Error message to display',
    },
    helpText: {
      control: { type: 'text' },
      description: 'Helper text displayed below multiselect',
    },
    value: {
      control: { type: 'array' },
      description: 'Selected values',
    },
    onChange: {
      control: { type: 'action' },
      description: 'Callback for value changes',
    },
    options: {
      control: { type: 'object' },
      description: 'Available options',
    },
    maxItems: {
      control: { type: 'number' },
      description: 'Maximum selected items',
    },
    searchable: {
      control: { type: 'boolean' },
      description: 'Show search input',
    },
    placeholder: {
      control: { type: 'text' },
      description: 'Placeholder text',
    },
    clearable: {
      control: { type: 'boolean' },
      description: 'Clear button visibility',
    },
    cyberBorder: {
      control: { type: 'boolean' },
      description: 'Enable cyberpunk border style',
    },
    glitchEffect: {
      control: { type: 'boolean' },
      description: 'Show glitch effect',
    },
    size: {
      control: { type: 'select' },
      options: ['sm', 'md', 'lg'],
      description: 'MultiSelect size',
    },
    variant: {
      control: { type: 'select' },
      options: ['outline', 'filled', 'cyber'],
      description: 'MultiSelect variant style',
    },
    disabled: {
      control: { type: 'boolean' },
      description: 'Disable the MultiSelect',
    },
  },
};

export default meta;
type Story = StoryObj<typeof MultiSelect>;

const options = [
  { value: 'model1', label: 'GPT-4', icon: '🤖', badgeColor: '#00f3ff' },
  { value: 'model2', label: 'Claude 3', icon: '🧠', badgeColor: '#ff00ff' },
  { value: 'model3', label: 'Llama 3', icon: '🦙', badgeColor: '#00ff3c' },
  { value: 'disabled', label: ' unavailable', disabled: true, icon: '🔒', badgeColor: '#5a5a5a' },
];

export const Default: Story = {
  args: {
    label: 'Select Models',
    options: options,
    placeholder: 'Choose models...',
  },
};

export const Searchable: Story = {
  args: {
    label: 'Search Models',
    searchable: true,
    options: options,
    placeholder: 'Search models...',
  },
};

export const WithMax: Story = {
  args: {
    label: 'Max 2 Models',
    maxItems: 2,
    options: options,
    placeholder: 'Select up to 2 models...',
  },
};

export const CyberVariant: Story = {
  args: {
    label: 'Cyber Models',
    variant: 'cyber',
    options: options,
  },
};

export const WithIcons: Story = {
  args: {
    label: 'AI Models',
    options: options,
  },
};

export const WithError: Story = {
  args: {
    label: 'Selection Required',
    error: 'Please select at least one option',
    options: options,
  },
};

export const AllVariants: Story = {
  render: () => (
    <div className="space-y-8">
      <div>
        <h4 className="text-sm font-bold text-accent-primary mb-4">Outline Variant</h4>
        <MultiSelect
          label="Outline"
          variant="outline"
          options={options}
          placeholder="Select..."
        />
      </div>
      <div>
        <h4 className="text-sm font-bold text-accent-primary mb-4">Filled Variant</h4>
        <MultiSelect
          label="Filled"
          variant="filled"
          options={options}
          placeholder="Select..."
        />
      </div>
      <div>
        <h4 className="text-sm font-bold text-accent-primary mb-4">Cyber Variant</h4>
        <MultiSelect
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
        summary: 'All available multiselect variants',
      },
    },
  },
};

export const SizeVariants: Story = {
  render: () => (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-bold text-accent-primary mb-4">Small Size</h4>
        <MultiSelect size="sm" label="Small" options={options} />
      </div>
      <div>
        <h4 className="text-sm font-bold text-accent-primary mb-4">Medium Size</h4>
        <MultiSelect size="md" label="Medium" options={options} />
      </div>
      <div>
        <h4 className="text-sm font-bold text-accent-primary mb-4">Large Size</h4>
        <MultiSelect size="lg" label="Large" options={options} />
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        summary: 'All available multiselect sizes',
      },
    },
  },
};

export const ClearAll: Story = {
  args: {
    label: 'Clearable Selection',
    placeholder: 'Select models...',
    clearable: true,
    options: options,
  },
  parameters: {
    docs: {
      description: {
        summary: 'MultiSelect with clear all and individual clear buttons',
      },
    },
  },
};
