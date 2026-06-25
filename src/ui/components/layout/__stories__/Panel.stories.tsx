import type { Meta, StoryObj } from '@storybook/react';
import { Panel } from '../Panel';
import { Button } from '../../controls/Button';

const meta = {
  title: 'Components/Layout/Panel',
  component: Panel,
  parameters: {
    layout: 'padded',
  },
  args: {
    title: 'Cyberpunk Panel',
    subtitle: 'Advanced monitoring interface',
  },
  argTypes: {
    border: {
      options: ['none', 'default', 'glitch', 'cyber'],
      control: { type: 'radio' },
    },
    headerVariant: {
      options: ['default', 'cyber', 'minimal'],
      control: { type: 'select' },
    },
    padding: {
      options: ['none', 'sm', 'md', 'lg', 'custom'],
      control: { type: 'radio' },
    },
    cyber: {
      control: { type: 'boolean' },
      description: 'Enable cyberpunk glow effects',
    },
    glitchEffect: {
      control: { type: 'boolean' },
      description: 'Enable glitch animation',
    },
    collapsible: {
      control: { type: 'boolean' },
      description: 'Make panel collapsible',
    },
  },
} as Meta<typeof Panel>;

export default meta;
type Story = StoryObj<typeof Panel>;

export const Default: Story = {
  args: {
    children: (
      <p>
        This is the default panel with basic styling and glow effects.
      </p>
    ),
  },
};

export const Cyberpunk: Story = {
  args: {
    cyber: true,
    border: 'cyber',
    headerVariant: 'cyber',
    children: (
      <p>
        Cyberpunk themed panel with full neon glow effects and glitch animation.
      </p>
    ),
  },
};

export const Collapsible: Story = {
  args: {
    collapsible: true,
    defaultExpanded: true,
    children: (
      <div>
        <p>This panel can be collapsed and expanded.</p>
        <p>Click the header to toggle visibility.</p>
      </div>
    ),
  },
};

export const WithHeaderActions: Story = {
  args: {
    actions: [<Button key={1} variant="cyber" size="sm">Action 1</Button>, <Button key={2} variant="secondary" size="sm">Action 2</Button>],
    children: <p>Panel with custom header actions.</p>,
  },
};

export const WithFooter: Story = {
  args: {
    footer: (
      <div className="flex gap-2">
        <Button variant="primary">Save</Button>
        <Button variant="danger">Cancel</Button>
      </div>
    ),
    children: <p>Panel with footer section.</p>,
  },
};

export const Minimal: Story = {
  args: {
    headerVariant: 'minimal',
    padding: 'sm',
    children: <p>Minimal theme with reduced padding and subtle header.</p>,
  },
};

export const GlitchEffect: Story = {
  args: {
    glitchEffect: true,
    cyber: true,
    children: <p>Panel content with glitch animation effects.</p>,
  },
};
