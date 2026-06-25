import type { Meta, StoryObj } from '@storybook/react';
import { Label } from '../Label.js';

const meta: Meta<typeof Label> = {
  title: 'UI/Forms/Label',
  component: Label,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    children: {
      control: { type: 'text' },
      description: 'Label text',
    },
    helpText: {
      control: { type: 'text' },
      description: 'Optional helper text',
    },
    required: {
      control: { type: 'boolean' },
      description: 'Required indicator',
    },
    disabled: {
      control: { type: 'boolean' },
      description: 'Disabled state',
    },
    compact: {
      control: { type: 'boolean' },
      description: 'Compact version',
    },
    cyber: {
      control: { type: 'boolean' },
      description: 'Cyberpunk style',
    },
  },
};

export default meta;
type Story = StoryObj<typeof Label>;

export const Default: Story = {
  args: {
    children: 'Email Address',
  },
};

export const Required: Story = {
  args: {
    children: 'Password',
    required: true,
  },
};

export const WithHelper: Story = {
  args: {
    children: 'Username',
    helpText: 'Must be 3-16 characters',
  },
};

export const Disabled: Story = {
  args: {
    children: 'Disabled Field',
    disabled: true,
  },
};

export const CyberStyle: Story = {
  args: {
    children: 'Cyberpunk Label',
    cyber: true,
  },
};

export const FullLayout: Story = {
  render: () => (
    <div className="space-y-6">
      <div>
        <h4 className="text-sm font-bold text-accent-primary mb-4">Standard Layout</h4>
        <Label>Standard Label</Label>
      </div>
      <div>
        <h4 className="text-sm font-bold text-accent-primary mb-4">Compact Layout</h4>
        <Label compact>Compact</Label>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        summary: 'Label layout variations',
      },
    },
  },
};

export const CompleteForm: Story = {
  render: () => (
    <div className="space-y-6 max-w-md">
      <div>
        <Label required helpText="Enter your email">
          Email Address
        </Label>
        <input className="mt-1 w-full p-2 bg-panel border border-accent-primary/30 rounded-cyber text-text-primary focus:border-accent-primary" />
      </div>
      <div>
        <Label required>Password</Label>
        <input className="mt-1 w-full p-2 bg-panel border border-accent-primary/30 rounded-cyber text-text-primary focus:border-accent-primary" />
      </div>
      <div>
        <Label disabled>Disabled Field</Label>
        <input
          disabled
          className="mt-1 w-full p-2 bg-panel border border-accent-primary/30 rounded-cyber text-text-primary opacity-50"
        />
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        summary: 'Complete form example with labels',
      },
    },
  },
};
