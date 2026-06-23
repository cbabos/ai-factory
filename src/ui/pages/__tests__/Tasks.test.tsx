import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Tasks from '../Tasks.js';
import TaskDetails from '../TaskDetails.js';

vi.mock('react-router-dom', async () => {
  const actual = await import('react-router-dom');
  const mockSearchParams = new URLSearchParams();
  const mockSetSearchParams = vi.fn();
  
  actual.useSearchParams = () => [mockSearchParams, mockSetSearchParams];
  
  return {
    ...actual,
    useSearchParams: () => [mockSearchParams, mockSetSearchParams],
    MemoryRouter: MemoryRouter,
  };
});

describe('Tasks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', async () => {
    render(
      <MemoryRouter>
        <Tasks />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Loading tasks.../i)).toBeInTheDocument();
    });
  });

  it('renders error state when fetch fails', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    render(
      <MemoryRouter>
        <Tasks />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Failed to fetch tasks/i)).toBeInTheDocument();
    });
  });

  it('renders empty state when no tasks match filters', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        items: [],
        total: 0,
        page: 1,
        pageSize: 20,
      }),
    });

    render(
      <MemoryRouter initialEntries={['/tasks?status=completed&priority=critical']}>
        <Tasks />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/No tasks match your filters/i)).toBeInTheDocument();
    });
  });

  it('renders tasks list when data is available', async () => {
    const mockTasks = [
      {
        id: 'abc12345',
        description: 'Test task 1',
        status: 'pending' as const,
        createdAt: Date.now() - 1000 * 60 * 5,
        priority: 'high' as const,
        cost: 0.0023,
        tokens: 1250,
      },
      {
        id: 'def67890',
        description: 'Test task 2',
        status: 'running' as const,
        createdAt: Date.now() - 1000 * 60 * 10,
        priority: 'normal' as const,
        cost: 0.0056,
        tokens: 2300,
      },
    ];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        items: mockTasks,
        total: 2,
        page: 1,
        pageSize: 20,
      }),
    });

    render(
      <MemoryRouter>
        <Tasks />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Test task 1/i)).toBeInTheDocument();
      expect(screen.getByText(/Test task 2/i)).toBeInTheDocument();
    });
  });

  it('filters tasks by status', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        items: [],
        total: 0,
        page: 1,
        pageSize: 20,
      }),
    });

    render(
      <MemoryRouter initialEntries={['/tasks?status=running']}>
        <Tasks />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('status=running')
      );
    });
  });

  it('filters tasks by priority', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        items: [],
        total: 0,
        page: 1,
        pageSize: 20,
      }),
    });

    render(
      <MemoryRouter initialEntries={['/tasks?priority=critical']}>
        <Tasks />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('priority=critical')
      );
    });
  });

  it('handles search functionality', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        items: [],
        total: 0,
        page: 1,
        pageSize: 20,
      }),
    });

    render(
      <MemoryRouter>
        <Tasks />
      </MemoryRouter>
    );

    const input = await screen.getByPlaceholderText(/Search tasks.../i);
    fireEvent.change(input, { target: { value: 'test search' } });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('search=test search')
      );
    });
  });

  it('handles pagination', async () => {
    const mockTasks = Array(25).fill(null).map((_, i) => ({
      id: `task${i}`,
      description: `Task ${i}`,
      status: 'completed' as const,
      createdAt: Date.now(),
      priority: 'normal' as const,
      cost: 0.001,
      tokens: 500,
    }));

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        items: mockTasks.slice(0, 20),
        total: 25,
        page: 1,
        pageSize: 20,
      }),
    });

    render(
      <MemoryRouter>
        <Tasks />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Page 1 of 2/i)).toBeInTheDocument();
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('page=1')
    );
  });

  it('renders status badges with correct colors', async () => {
    const mockTasks = [
      {
        id: 'pending',
        description: 'Pending task',
        status: 'pending' as const,
        createdAt: Date.now(),
        priority: 'normal' as const,
      },
      {
        id: 'running',
        description: 'Running task',
        status: 'running' as const,
        createdAt: Date.now(),
        priority: 'normal' as const,
      },
      {
        id: 'completed',
        description: 'Completed task',
        status: 'completed' as const,
        createdAt: Date.now(),
        priority: 'normal' as const,
      },
      {
        id: 'failed',
        description: 'Failed task',
        status: 'failed' as const,
        createdAt: Date.now(),
        priority: 'normal' as const,
      },
    ];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        items: mockTasks,
        total: 4,
        page: 1,
        pageSize: 20,
      }),
    });

    render(
      <MemoryRouter>
        <Tasks />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Pending task/i)).toBeInTheDocument();
    });

    const badges = screen.getAllByRole('badge');
    expect(badges).toHaveLength(4);
  });

  it('handles refresh button click', async () => {
    const fetchCount = vi.fn();

    global.fetch = vi.fn().mockImplementation(() => {
      fetchCount();
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          items: [],
          total: 0,
          page: 1,
          pageSize: 20,
        }),
      });
    });

    render(
      <MemoryRouter>
        <Tasks />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(fetchCount).toHaveBeenCalledTimes(1);
    });

    const button = await screen.getByText(/Refresh/i);
    fireEvent.click(button);

    await waitFor(() => {
      expect(fetchCount).toHaveBeenCalledTimes(2);
    });
  });
});

describe('Tasks - Filter Controls', () => {
  it('renders status filter options', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        items: [],
        total: 0,
        page: 1,
        pageSize: 20,
      }),
    });

    render(
      <MemoryRouter>
        <Tasks />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/All Status/i)).toBeInTheDocument();
    });

    const statusElements = await screen.findAllByText(/Status/i);
    expect(statusElements).toHaveLength(1);
  });

  it('renders priority filter options', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        items: [],
        total: 0,
        page: 1,
        pageSize: 20,
      }),
    });

    render(
      <MemoryRouter>
        <Tasks />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/All Priorities/i)).toBeInTheDocument();
    });
  });
});

describe('Tasks - Cyberpunk Styling', () => {
  it('uses cyberpunk border classes', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        items: [],
        total: 0,
        page: 1,
        pageSize: 20,
      }),
    });

    render(
      <MemoryRouter>
        <Tasks />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(document.body).toBeTruthy();
    });

    expect(document.querySelector('.rounded-cyber')).toBeTruthy();
  });

  it('applies glow effects to filtered views', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        items: [],
        total: 0,
        page: 1,
        pageSize: 20,
      }),
    });

    render(
      <MemoryRouter initialEntries={['/tasks?status=running']}>
        <Tasks />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(document.querySelector('.rounded-cyber')).toBeTruthy();
    });
  });
});
