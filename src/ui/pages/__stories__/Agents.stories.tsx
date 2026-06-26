import type { Meta, StoryObj } from '@storybook/react';
import { AgentsPage } from '../Agents.js';
import type { AgentRecord } from '../../services/types.js';

const meta = {
  title: 'Pages/Agents',
  component: AgentsPage,
  parameters: {
    layout: 'padded',
  },
  args: {
    title: 'Agents',
    subtitle: 'Manage AI agent configurations',
  },
  argTypes: {
    title: {
      control: { type: 'text' },
      description: 'Page title',
    },
    subtitle: {
      control: { type: 'text' },
      description: 'Page subtitle',
    },
  },
} as Meta<typeof AgentsPage>;

export default meta;
type Story = StoryObj<typeof AgentsPage>;

const mockAgents: AgentRecord[] = [
  {
    id: 'agent-001',
    name: 'Chat Assistant',
    tags: ['general', 'chat', 'assistant'],
    complexityMin: 1,
    complexityMax: 5,
    timeoutMs: 30000,
    maxRetries: 2,
    version: 1,
    isActive: true,
    configSource: 'static',
    description: 'General-purpose chat assistant for everyday queries',
    createdAt: Date.now() - 100000,
    updatedAt: Date.now(),
  },
  {
    id: 'agent-002',
    name: 'Code Analyzer',
    tags: ['code', 'analysis', 'development'],
    complexityMin: 3,
    complexityMax: 8,
    timeoutMs: 60000,
    maxRetries: 3,
    version: 2,
    isActive: true,
    configSource: 'custom',
    description: 'Advanced code analysis and refactoring agent',
    createdAt: Date.now() - 50000,
    updatedAt: Date.now(),
  },
  {
    id: 'agent-003',
    name: 'Data Processor',
    tags: ['data', 'ETL', 'pipeline'],
    complexityMin: 5,
    complexityMax: 10,
    timeoutMs: 120000,
    maxRetries: 1,
    version: 3,
    isActive: false,
    configSource: 'static',
    description: 'Complex data processing and transformation agent',
    createdAt: Date.now() - 200000,
    updatedAt: Date.now() - 10000,
  },
  {
    id: 'agent-004',
    name: 'Quick Q&A',
    tags: ['general', 'quick', 'faq'],
    complexityMin: 1,
    complexityMax: 3,
    timeoutMs: 15000,
    maxRetries: 1,
    version: 1,
    isActive: true,
    configSource: 'static',
    description: 'Fast response Q&A agent for simple questions',
    createdAt: Date.now() - 80000,
    updatedAt: Date.now(),
  },
];

export const Default: Story = {
  args: {
    title: 'Agents',
    subtitle: 'Manage AI agent configurations',
  },
  parameters: {
    mockData: {
      agents: mockAgents,
    },
  },
};

export const EmptyState: Story = {
  args: {
    title: 'Agents',
    subtitle: 'No agents configured yet',
  },
  parameters: {
    mockData: {
      agents: [],
    },
  },
};

export const Cyberpunk: Story = {
  args: {
    title: 'Agents',
    subtitle: 'Advanced monitoring interface',
  },
  parameters: {
    mockData: {
      agents: mockAgents,
    },
  },
};

export const WithFilters: Story = {
  args: {
    title: 'Agents',
    subtitle: 'Filtered view',
  },
  parameters: {
    mockData: {
      agents: mockAgents,
      initialFilter: {
        tags: ['code', 'data'],
        complexity: 'medium',
        isActive: 'true',
      },
    },
  },
};
