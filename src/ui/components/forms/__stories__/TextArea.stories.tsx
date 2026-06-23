import type { Meta, StoryObj } from '@storybook/react';
import { TextArea } from '../TextArea.js';

const meta: Meta<typeof TextArea> = {
  title: 'UI/Forms/TextArea',
  component: TextArea,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    label: {
      control: { type: 'text' },
      description: 'Label text displayed above textarea',
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
      description: 'Helper text displayed below textarea',
    },
    autoGrow: {
      control: { type: 'boolean' },
      description: 'Enable auto-grow behavior',
    },
    minRows: {
      control: { type: 'number' },
      description: 'Minimum rows',
    },
    maxRows: {
      control: { type: 'number' },
      description: 'Maximum rows before scrolling',
    },
    showCounter: {
      control: { type: 'boolean' },
      description: 'Show character count',
    },
    maxLength: {
      control: { type: 'number' },
      description: 'Maximum characters',
    },
    counterPosition: {
      control: { type: 'select' },
      options: ['top', 'bottom', 'inline'],
      description: 'Character count position',
    },
    cyberBorder: {
      control: { type: 'boolean' },
      description: 'Enable cyberpunk border',
    },
    glitchEffect: {
      control: { type: 'boolean' },
      description: 'Show glitch animation',
    },
    disabled: {
      control: { type: 'boolean' },
      description: 'Disable the textarea',
    },
  },
};

export default meta;
type Story = StoryObj<typeof TextArea>;

export const Default: Story = {
  args: {
    label: 'Description',
    placeholder: 'Enter your description',
    minRows: 4,
  },
};

export const AutoGrow: Story = {
  args: {
    label: 'Notes',
    autoGrow: true,
    maxRows: 8,
    placeholder: 'Start typing and the textarea will grow...',
    minRows: 2,
  },
};

export const WithCounter: Story = {
  args: {
    label: 'Bio',
    showCounter: true,
    maxLength: 160,
    placeholder: 'Write a short bio (max 160 characters)',
  },
};

export const WithError: Story = {
  args: {
    label: 'Feedback',
    error: 'Feedback is required',
    placeholder: 'Enter your feedback',
  },
};

export const CyberVariant: Story = {
  args: {
    label: 'Cyber Message',
    cyberBorder: true,
    placeholder: 'Enter cyber message...',
  },
};

export const Disabled: Story = {
  args: {
    label: 'Readonly Field',
    disabled: true,
    placeholder: 'This field is readonly',
  },
};

export const AllPositions: Story = {
  render: () => (
    <div className="space-y-8">
      <div>
        <h4 className="text-sm font-bold text-accent-primary mb-4">Counter at Top</h4>
        <TextArea
          label="Top Counter"
          showCounter={true}
          maxLength={100}
          counterPosition="top"
          placeholder="Type here..."
          minRows={3}
        />
      </div>
      <div>
        <h4 className="text-sm font-bold text-accent-primary mb-4">Counter at Bottom</h4>
        <TextArea
          label="Bottom Counter"
          showCounter={true}
          maxLength={100}
          counterPosition="bottom"
          placeholder="Type here..."
          minRows={3}
        />
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        summary: 'Character counter at different positions',
      },
    },
  },
};

export const GlitchEffect: Story = {
  args: {
    label: 'Glitch Text',
    glitchEffect: true,
    placeholder: 'Enter text with glitch effect',
  },
};
