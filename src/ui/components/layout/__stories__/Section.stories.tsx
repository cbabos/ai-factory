import type { Meta, StoryObj } from '@storybook/react';
import { Section } from '../Section';
import { Button } from '../../controls/Button';

const meta = {
  title: 'Components/Layout/Section',
  component: Section,
  parameters: {
    layout: 'fullscreen',
  },
  args: {
    title: 'Section Title',
    subtitle: 'Section subtitle description',
  },
  argTypes: {
    bg: {
      options: ['default', 'panel', 'card', 'cyber'],
      control: { type: 'radio' },
    },
    padding: {
      options: ['none', 'sm', 'md', 'lg', 'xl', '2xl', '3xl'],
      control: { type: 'radio' },
    },
    border: {
      options: ['none', 'top', 'bottom', 'all', 'cyber'],
      control: { type: 'radio' },
    },
    animation: {
      options: ['none', 'fade', 'slide', 'glitch'],
      control: { type: 'radio' },
    },
    cyber: {
      control: { type: 'boolean' },
    },
    divider: {
      control: { type: 'boolean' },
    },
  },
} as Meta<typeof Section>;

export default meta;
type Story = StoryObj<typeof Section>;

export const Default: Story = {
  args: {
    children: <p>Default section with panel background.</p>,
  },
};

export const Cyber: Story = {
  args: {
    bg: 'cyber',
    cyber: true,
    children: <p>Cyberpunk section with grid background and glow.</p>,
  },
};

export const WithBorder: Story = {
  args: {
    border: 'all',
    children: <p>Section with full border and rounded corners.</p>,
  },
};

export const WithDivider: Story = {
  args: {
    divider: true,
    children: <p>Section with gradient divider line.</p>,
  },
};

export const WithActions: Story = {
  args: {
    actions: [<Button key={1} variant="primary">Primary Action</Button>, <Button key={2} variant="secondary">Secondary Action</Button>],
    children: <p>Section with custom action buttons in header.</p>,
  },
};

export const Minimal: Story = {
  args: {
    padding: 'sm',
    children: <p>Minimally padded section.</p>,
  },
};

export const FullPage: Story = {
  args: {
    padding: '3xl',
    cyber: true,
    children: (
      <div>
        <h3 className="text-lg font-semibold">Full page section</h3>
        <p className="mt-2">Maximum padding with cyberpunk styling.</p>
      </div>
    ),
  },
};
