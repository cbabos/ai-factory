import type { Meta, StoryObj } from '@storybook/react';
import { ModelsPage } from '../Models.js';

const meta: Meta<typeof ModelsPage> = {
  title: 'Pages/Models',
  component: ModelsPage,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  argTypes: {
    className: {
      control: { type: 'text' },
      description: 'Additional CSS classes',
    },
  },
};

export default meta;
type Story = StoryObj<typeof ModelsPage>;

export const Default: Story = {
  args: {},
  parameters: {
    docs: {
      description: {
        summary: 'Default models page with all models displayed',
      },
    },
  },
};

export const EmptyState: Story = {
  render: () => {
    return <ModelsPage className="min-h-[600px]" />;
  },
  parameters: {
    docs: {
      description: {
        summary: 'Empty state when no models are configured',
      },
    },
  },
};

export const WithFiltering: Story = {
  render: () => {
    return <ModelsPage className="min-h-[600px]" />;
  },
  parameters: {
    docs: {
      description: {
        summary: 'Interactive filtering and sorting interface',
      },
    },
  },
};
