import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ModelsPage } from '../Models.js';
import { ModelForm } from '../ModelForm.js';

const mockModels = [
  {
    id: 'model-1',
    provider: 'openai' as const,
    modelId: 'gpt-4',
    maxTokens: 8192,
    costPer1kInput: 0.03,
    costPer1kOutput: 0.06,
    capabilities: ['text-generation', 'coding'],
    ownedBy: 'OpenAI',
    isActive: true,
  },
];

describe('ModelsPage', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it('renders models grid', async () => {
    const mockFetch = vi.fn();
    (global.fetch as unknown) = mockFetch;
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: mockModels }),
    });

    render(<ModelsPage />);

    expect(screen.getByText('AI Models')).toBeInTheDocument();
    expect(screen.getByText('gpt-4')).toBeInTheDocument();
  });

  it('renders empty state when no models', async () => {
    const mockFetch = vi.fn();
    (global.fetch as unknown) = mockFetch;
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: [] }),
    });

    render(<ModelsPage />);

    await waitFor(() => {
      expect(screen.getByText('No models found')).toBeInTheDocument();
    });
  });

  it('renders error state on fetch failure', async () => {
    const mockFetch = vi.fn();
    (global.fetch as unknown) = mockFetch;
    mockFetch.mockResolvedValueOnce({
      ok: false,
      statusText: 'Not Found',
    });

    render(<ModelsPage />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load models')).toBeInTheDocument();
    });
  });
});

describe('ModelForm', () => {
  it('renders form fields', () => {
    render(
      <ModelForm
        model={null}
        onClose={() => {}}
        onSubmit={() => {}}
      />
    );

    expect(screen.getByText('Add New Model')).toBeInTheDocument();
    expect(screen.getByLabelText('Provider')).toBeInTheDocument();
    expect(screen.getByLabelText('Model ID')).toBeInTheDocument();
  });

  it('pre-fills existing model data', () => {
    const model = {
      id: 'test-model',
      provider: 'openai' as const,
      modelId: 'gpt-4',
      maxTokens: 8192,
      costPer1kInput: 0.03,
      costPer1kOutput: 0.06,
      capabilities: ['text-generation'],
      ownedBy: 'OpenAI',
      isActive: true,
    };

    render(<ModelForm model={model} onClose={() => {}} onSubmit={() => {}} />);

    expect(screen.getByDisplayValue('gpt-4')).toBeInTheDocument();
  });
});
