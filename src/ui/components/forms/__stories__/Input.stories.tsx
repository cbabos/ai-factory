import type { Meta, StoryObj } from '@storybook/react';
import { Input } from '../Input.js';

const meta: Meta<typeof Input> = {
  title: 'UI/Forms/Input',
  component: Input,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    label: {
      control: { type: 'text' },
      description: 'Label text displayed above input',
    },
    placeholder: {
      control: { type: 'text' },
      description: 'Placeholder text',
    },
    error: {
      control: { type: 'text' },
      description: 'Error message to display',
    },
    helpText: {
      control: { type: 'text' },
      description: 'Helper text displayed below input',
    },
    startIcon: {
      control: { type: 'text' },
      description: 'Icon to display before input',
    },
    endIcon: {
      control: { type: 'text' },
      description: 'Icon to display after input',
    },
    size: {
      control: { type: 'select' },
      options: ['sm', 'md', 'lg'],
      description: 'Input size',
    },
    variant: {
      control: { type: 'select' },
      options: ['filled', 'outline', 'ghost', 'cyber'],
      description: 'Input variant style',
    },
    isActive: {
      control: { type: 'boolean' },
      description: 'Is the input in an active state',
    },
    glitchEffect: {
      control: { type: 'boolean' },
      description: 'Show glitch animation effect',
    },
    cyberBorder: {
      control: { type: 'boolean' },
      description: 'Enable cyberpunk border',
    },
    disabled: {
      control: { type: 'boolean' },
      description: 'Disable the input',
    },
  },
};

export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = {
  args: {
    label: 'Email Address',
    placeholder: 'Enter your email',
  },
};

export const WithError: Story = {
  args: {
    label: 'Password',
    error: 'Password must be at least 8 characters',
  },
};

export const CyberVariant: Story = {
  args: {
    label: 'API Key',
    variant: 'cyber',
    placeholder: 'Enter your API key',
  },
};

export const WithIcons: Story = {
  args: {
    label: 'Username',
    startIcon: '👤',
    endIcon: '⚡',
    placeholder: 'Enter username',
  },
};

export const GlitchEffect: Story = {
  args: {
    label: 'Glitch Input',
    glitchEffect: true,
    placeholder: 'Enter text with glitch effect',
  },
};

export const Disabled: Story = {
  args: {
    label: 'Disabled Field',
    disabled: true,
    placeholder: 'This field is disabled',
  },
};

export const AllVariants: Story = {
  render: () => (
    <div className="space-y-8">
      <div>
        <h4 className="text-sm font-bold text-accent-primary mb-4">Filled Variant</h4>
        <Input variant="filled" placeholder="Filled input" />
      </div>
      <div>
        <h4 className="text-sm font-bold text-accent-primary mb-4">Outline Variant</h4>
        <Input variant="outline" placeholder="Outline input" />
      </div>
      <div>
        <h4 className="text-sm font-bold text-accent-primary mb-4">Ghost Variant</h4>
        <Input variant="ghost" placeholder="Ghost input" />
      </div>
      <div>
        <h4 className="text-sm font-bold text-accent-primary mb-4">Cyber Variant</h4>
        <Input variant="cyber" placeholder="Cyberpunk input" />
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        summary: 'All available input variants with cyberpunk aesthetic',
      },
    },
  },
};

export const SizeVariants: Story = {
  render: () => (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-bold text-accent-primary mb-4">Small Size</h4>
        <Input size="sm" placeholder="Small input" />
      </div>
      <div>
        <h4 className="text-sm font-bold text-accent-primary mb-4">Medium Size (Default)</h4>
        <Input placeholder="Medium input" />
      </div>
      <div>
        <h4 className="text-sm font-bold text-accent-primary mb-4">Large Size</h4>
        <Input size="lg" placeholder="Large input" />
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        summary: 'All available input sizes',
      },
    },
  },
};
