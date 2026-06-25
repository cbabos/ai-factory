import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../services/client.js';

describe('apiClient', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it('builds task query params and maps list responses', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({
        items: [
          {
            id: 'task-1',
            task: {
              description: 'Review pipeline output',
              priority: 'high',
              origin: { channel: 'api' },
            },
            status: 'running',
            createdAt: 100,
            updatedAt: 200,
            result: {
              totalCost: 1.25,
              totalTokens: { total: 456 },
            },
          },
        ],
        total: 1,
        page: 2,
        pageSize: 10,
      }),
    } as Response);

    const result = await apiClient.listTasks({
      page: 2,
      pageSize: 10,
      status: 'running',
      priority: 'high',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/api/tasks?page=2&pageSize=10&status=running&priority=high',
      undefined,
    );
    expect(result).toEqual({
      items: [
        {
          id: 'task-1',
          description: 'Review pipeline output',
          status: 'running',
          createdAt: 100,
          updatedAt: 200,
          priority: 'high',
          originChannel: 'api',
          cost: 1.25,
          tokens: 456,
        },
      ],
      total: 1,
      page: 2,
      pageSize: 10,
    });
  });

  it('maps task detail conversations from the result payload when needed', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({
        data: {
          id: 'task-2',
          task: {
            description: 'Summarize incident',
            priority: 'normal',
            origin: { channel: 'slack' },
            workflow: { workflowId: 'requirements-flow', workflowVersion: 1 },
          },
          status: 'completed',
          createdAt: 300,
          updatedAt: 400,
          result: {
            output: 'done',
            totalCost: 0.4,
            totalTokens: { total: 222 },
            conversation: [
              { role: 'user', content: 'hello', timestamp: 301 },
            ],
          },
        },
      }),
    } as Response);

    const result = await apiClient.getTask('task-2');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/api/tasks/task-2',
      undefined,
    );
    expect(result.conversation).toEqual([
      { role: 'user', content: 'hello', timestamp: 301 },
    ]);
    expect(result.output).toBe('done');
    expect(result.originChannel).toBe('slack');
    expect(result.workflowId).toBe('requirements-flow');
    expect(result.workflowVersion).toBe(1);
  });

  it('sends nested token profiles unchanged for agent updates', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({
        data: {
          id: 'agent-1',
          name: 'Agent One',
          tags: ['analysis'],
          complexityMin: 1,
          complexityMax: 5,
          tokenProfile: { min: 10, max: 20, typical: 15 },
          preferredModels: ['gpt-4o-mini'],
          timeoutMs: 1000,
          maxRetries: 2,
          version: 2,
          isActive: true,
          configSource: 'custom',
          createdAt: 1,
          updatedAt: 2,
        },
      }),
    } as Response);

    await apiClient.updateAgent('agent-1', {
      id: 'agent-1',
      name: 'Agent One',
      tags: ['analysis'],
      complexityMin: 1,
      complexityMax: 5,
      tokenProfile: { min: 10, max: 20, typical: 15 },
      preferredModels: ['gpt-4o-mini'],
      timeoutMs: 1000,
      maxRetries: 2,
      configSource: 'custom',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/api/agents/agent-1',
      expect.objectContaining({
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 'agent-1',
          name: 'Agent One',
          tags: ['analysis'],
          complexityMin: 1,
          complexityMax: 5,
          tokenProfile: { min: 10, max: 20, typical: 15 },
          preferredModels: ['gpt-4o-mini'],
          timeoutMs: 1000,
          maxRetries: 2,
          configSource: 'custom',
        }),
      }),
    );
  });

  it('lists workflows from the workflow API', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({
        data: [
          {
            id: 'requirements-flow',
            name: 'Requirements Flow',
            version: 2,
            status: 'active',
            steps: [],
            createdAt: 1,
            updatedAt: 2,
          },
        ],
        total: 1,
      }),
    } as Response);

    const result = await apiClient.listWorkflows();

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/api/workflows',
      undefined,
    );
    expect(result[0]?.id).toBe('requirements-flow');
    expect(result[0]?.status).toBe('active');
  });

  it('creates workflow-backed tasks through the task API', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 201,
      statusText: 'Created',
      json: async () => ({
        data: {
          id: 'task-workflow-1',
          task: {
            description: 'Launch deterministic workflow',
            priority: 'high',
            origin: { channel: 'api' },
            workflow: { workflowId: 'implement-test-review', workflowVersion: 1 },
          },
          status: 'pending',
          createdAt: 100,
          updatedAt: 100,
        },
      }),
    } as Response);

    const result = await apiClient.createTask({
      description: 'Launch deterministic workflow',
      priority: 'high',
      context: { repo: 'ai-factory' },
      workflowId: 'implement-test-review',
      workflowVersion: 1,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/api/tasks',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: 'Launch deterministic workflow',
          priority: 'high',
          context: { repo: 'ai-factory' },
          workflowId: 'implement-test-review',
          workflowVersion: 1,
        }),
      }),
    );
    expect(result.workflowId).toBe('implement-test-review');
    expect(result.workflowVersion).toBe(1);
  });

  it('posts human task responses to the HITL endpoint', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({
        data: {
          output: {
            workflowRunId: 'run-1',
            waitingForHuman: false,
          },
        },
      }),
    } as Response);

    const result = await apiClient.respondToHumanTask('human-1', 'approved');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/api/human-tasks/human-1/respond',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: 'approved' }),
      }),
    );
    expect(result).toEqual({
      output: {
        workflowRunId: 'run-1',
        waitingForHuman: false,
      },
    });
  });
});
