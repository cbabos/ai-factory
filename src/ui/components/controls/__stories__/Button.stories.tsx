import type { Meta, StoryObj } from '@storybook/react';
import { Button } from '../controls/Button.js';

const meta: Meta<typeof Button> = {
  title: 'UI/Controls/Button',
  component: Button,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['primary', 'secondary', 'danger', 'ghost', 'cyber'],
      description: 'Button variant style',
    },
    size: {
      control: { type: 'select' },
      options: ['sm', 'md', 'lg'],
      description: 'Button size',
    },
    isActive: {
      control: { type: 'boolean' },
      description: 'Is button in active state',
    },
    loading: {
      control: { type: 'boolean' },
      description: 'Show loading state',
    },
    shape: {
      control: { type: 'select' },
      options: ['default', 'round', 'cyber'],
      description: 'Button shape',
    },
    glitchEffect: {
      control: { type: 'boolean' },
      description: 'Show glitch effect',
    },
    cyberBorder: {
      control: { type: 'boolean' },
      description: 'Enable cyberpunk border',
    },
    glow: {
      control: { type: 'select' },
      options: ['none', 'soft', 'medium', 'strong'],
      description: 'Neon glow intensity',
    },
    startIcon: {
      control: { type: 'text' },
      description: 'Icon to show before content',
    },
    endIcon: {
      control: { type: 'text' },
      description: 'Icon to show after content',
    },
    disabled: {
      control: { type: 'boolean' },
      description: 'Disable the button',
    },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = {
  args: {
    variant: 'primary',
    children: 'Click Me',
  },
};

export const Secondary: Story = {
  args: {
    variant: 'secondary',
    children: 'Secondary Action',
  },
};

export const Danger: Story = {
  args: {
    variant: 'danger',
    children: 'Delete',
  },
};

export const Ghost: Story = {
  args: {
    variant: 'ghost',
    children: 'Ghost Button',
  },
};

export const Cyber: Story = {
  args: {
    variant: 'cyber',
    children: 'Cyberpunk Button',
    cyberBorder: true,
  },
};

export const WithIcons: Story = {
  args: {
    variant: 'primary',
    startIcon: '🚀',
    endIcon: '⚡',
    children: 'Launch Mission',
  },
};

export const Loading: Story = {
  args: {
    variant: 'primary',
    loading: true,
    children: 'Processing...',
  },
};

export const SizeLarge: Story = {
  args: {
    variant: 'primary',
    size: 'lg',
    children: 'Large Button',
  },
};

export const SizeSmall: Story = {
  args: {
    variant: 'primary',
    size: 'sm',
    children: 'Small',
  },
};

export const RoundShape: Story = {
  args: {
    variant: 'primary',
    shape: 'round',
    startIcon: '⚡',
    children: ' ',
  },
  parameters: {
    docs: {
      description: {
        summary: 'Round button with icon',
      },
    },
  },
};

export const CyberBorder: Story = {
  args: {
    variant: 'cyber',
    cyberBorder: true,
    glow: 'strong',
    children: 'Cyber with Border',
  },
};

export const AllVariants: Story = {
  render: () => (
    <div className="space-y-8">
      <div className="flex gap-2">
        <Button variant="primary" className="flex-1">Primary</Button>
        <Button variant="secondary" className="flex-1">Secondary</Button>
        <Button variant="danger" className="flex-1">Danger</Button>
        <Button variant="ghost" className="flex-1">Ghost</Button>
        <Button variant="cyber" className="flex-1">Cyber</Button>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        summary: 'All available button variants',
      },
    },
  },
};

export const AllSizes: Story = {
  render: () => (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button size="sm" variant="primary">Small</Button>
        <Button size="md" variant="primary">Medium</Button>
        <Button size="lg" variant="primary">Large</Button>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        summary: 'All available button sizes',
      },
    },
  },
};

export const GlitchAnimation: Story = {
  args: {
    variant: 'primary',
    glitchEffect: true,
    children: 'Glitch Effect',
  },
};
