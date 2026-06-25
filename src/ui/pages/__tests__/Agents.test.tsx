import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AgentsPage } from '../Agents.js';

describe('AgentsPage', () => {
  it('renders the Agents page with title and subtitle', () => {
    render(
      <AgentsPage
        title="Agents"
        subtitle="Manage AI agent configurations"
      />
    );
    expect(screen.getByText('Agents')).toBeInTheDocument();
  });

  it('renders Add Agent button', () => {
    render(<AgentsPage />);
    expect(screen.getByText('Add Agent')).toBeInTheDocument();
  });

  it('renders filter controls', () => {
    render(<AgentsPage />);
    expect(screen.getByText('Filter by Tags')).toBeInTheDocument();
    expect(screen.getByText('Complexity Range')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
  });

  it('shows empty state when no agents', () => {
    render(<AgentsPage />);
    expect(screen.getByText('No Agents Found')).toBeInTheDocument();
  });

  it('applies cyberpunk theme classes', () => {
    const { container } = render(<AgentsPage />);
    expect(container.querySelector('[class*="cyber"]')).toBeInTheDocument();
  });

  it('applies glitch effects', () => {
    const { container } = render(<AgentsPage />);
    expect(container.querySelector('[class*="glitch"]')).toBeInTheDocument();
  });
});
