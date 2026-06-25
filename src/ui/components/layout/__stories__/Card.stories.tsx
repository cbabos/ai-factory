import type { Meta, StoryObj } from '@storybook/react';
import { Card } from '../Card';
import { Badge } from '../../ui/Badge';
import { StatusIndicator } from '../../ui/StatusIndicator';

const meta = {
  title: 'Components/Layout/Card',
  component: Card,
  parameters: {
    layout: 'padded',
  },
  args: {
    title: 'Card Title',
    subtitle: 'Card subtitle text',
  },
  argTypes: {
    variant: {
      options: ['default', 'cyber', 'glitch', 'minimal'],
      control: { type: 'radio' },
    },
    padding: {
      options: ['none', 'sm', 'md', 'lg', 'xl'],
      control: { type: 'radio' },
    },
    size: {
      options: ['sm', 'md', 'lg'],
      control: { type: 'radio' },
    },
    interactive: {
      control: { type: 'boolean' },
    },
    cyber: {
      control: { type: 'boolean' },
    },
    glitchEffect: {
      control: { type: 'boolean' },
    },
  },
} as Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof Card>;

export const Default: Story = {
  args: {
    children: <p>Default card with standard styling.</p>,
  },
};

export const Cyber: Story = {
  args: {
    variant: 'cyber',
    cyber: true,
    children: (
      <div>
        <p>Cyberpunk themed card with gradient background and glow effects.</p>
        <div className="mt-4">
          <StatusIndicator status="online" />
        </div>
      </div>
    ),
  },
};

export const Glitch: Story = {
  args: {
    variant: 'glitch',
    glitchEffect: true,
    children: <p>Glitch variant with animated text effect.</p>,
  },
};

export const Minimal: Story = {
  args: {
    variant: 'minimal',
    padding: 'sm',
    children: <p>Minimal card with transparent background.</p>,
  },
};

export const Interactive: Story = {
  args: {
    interactive: true,
    children: <p>Interactive card with hover effects and transitions.</p>,
  },
};

export const WithBadge: Story = {
  args: {
    children: (
      <div>
        <p>Card with badge component.</p>
        <div className="mt-4">
          <Badge variant="cyber">Cyber</Badge>
        </div>
      </div>
    ),
  },
};

export const CardGroup: Story = {
  args: {
    title: null,
    subtitle: null,
    children: null,
  },
};
