import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HumanTasksPage from '../HumanTasks.js';

const navigateMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await import('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

describe('HumanTasksPage', () => {
  beforeEach(() => {
    navigateMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders pending human tasks from the API', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          data: [
            {
              id: 'human-1',
              workflowRunId: 'run-1',
              workflowId: 'requirements-flow',
              workflowVersion: 1,
              stepId: 'clarify',
              type: 'question',
              status: 'pending',
              title: 'Clarify release target',
              prompt: 'Which environment should this ship to?',
              createdAt: 1,
              updatedAt: 2,
            },
          ],
          total: 1,
        }),
      } as Response));

    render(
      <MemoryRouter>
        <HumanTasksPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Clarify release target/i)).toBeInTheDocument();
      expect(screen.getByText(/Which environment should this ship to/i)).toBeInTheDocument();
    });
  });

  it('submits a response and navigates to the workflow run', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          data: [
            {
              id: 'human-1',
              workflowRunId: 'run-1',
              workflowId: 'requirements-flow',
              workflowVersion: 1,
              stepId: 'clarify',
              type: 'question',
              status: 'pending',
              title: 'Clarify release target',
              prompt: 'Which environment should this ship to?',
              createdAt: 1,
              updatedAt: 2,
            },
          ],
          total: 1,
        }),
      } as Response)
      .mockResolvedValueOnce({
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
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          data: [],
          total: 0,
        }),
      } as Response);
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter>
        <HumanTasksPage />
      </MemoryRouter>,
    );

    const textarea = await screen.findByPlaceholderText(/Provide the missing requirement or decision/i);
    fireEvent.change(textarea, { target: { value: 'production' } });
    fireEvent.click(screen.getByRole('button', { name: /Submit Response/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:3001/api/human-tasks/human-1/respond',
        expect.objectContaining({
          method: 'POST',
        }),
      );
      expect(navigateMock).toHaveBeenCalledWith('/workflow-runs/run-1');
    });
  });
});
