import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Panel } from '../Panel';

describe('Panel', () => {
  it('renders with title', () => {
    render(<Panel title="Test Panel">Content</Panel>);
    expect(screen.getByText('Test Panel')).toBeInTheDocument();
  });

  it('renders with subtitle', () => {
    render(<Panel title="Panel" subtitle="Subtitle">Content</Panel>);
    expect(screen.getByText('Subtitle')).toBeInTheDocument();
  });

  it('renders children content', () => {
    render(<Panel><p>Test content</p></Panel>);
    expect(screen.getByText('Test content')).toBeInTheDocument();
  });

  it('applies border class', () => {
    const { container } = render(<Panel border="cyber" />);
    expect(container.querySelector('div')).toHaveClass('border-accent-primary/20');
  });

  it('applies cyber glow effect', () => {
    const { container } = render(<Panel cyber />);
    expect(container.querySelector('div')).toHaveClass('animate-[border-glow_2s_infinite]');
  });

  it('has correct container classes', () => {
    const { container } = render(<Panel />);
    expect(container.querySelector('div')).toHaveClass('flex flex-col');
    expect(container.querySelector('div')).toHaveClass('bg-panel');
    expect(container.querySelector('div')).toHaveClass('rounded-cyber');
  });
});
