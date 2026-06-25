import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '../Button.js';

describe('Button', () => {
  describe('basic rendering', () => {
    it('renders children', () => {
      render(<Button>Click me</Button>);
      expect(screen.getByText('Click me')).toBeInTheDocument();
    });

    it('applies variant classes', () => {
      const { container } = render(<Button variant="primary">Test</Button>);
      expect(container.querySelector('button')).toHaveClass('bg-accent-primary');
    });

    it('applies size classes', () => {
      const { container } = render(<Button size="sm">Test</Button>);
      expect(container.querySelector('button')).toHaveClass('px-3');
    });
  });

  describe('variants', () => {
    it('applies primary variant', () => {
      const { container } = render(<Button variant="primary">Test</Button>);
      expect(container.querySelector('button')).toHaveClass('text-black');
    });

    it('applies secondary variant', () => {
      const { container } = render(<Button variant="secondary">Test</Button>);
      expect(container.querySelector('button')).toHaveClass('bg-accent-secondary');
    });

    it('applies danger variant', () => {
      const { container } = render(<Button variant="danger">Test</Button>);
      expect(container.querySelector('button')).toHaveClass('bg-accent-danger');
    });

    it('applies cyber variant', () => {
      const { container } = render(<Button variant="cyber">Test</Button>);
      expect(container.querySelector('button')).toHaveClass('rounded-cyber');
    });
  });

  describe('interactive states', () => {
    it('shows loading state', () => {
      render(<Button loading>Processing...</Button>);
      expect(screen.getByText('Processing...')).toBeInTheDocument();
      expect(screen.getByRole('button')).toBeDisabled();
    });

    it('applies disabled styles', () => {
      const { container } = render(<Button disabled>Disabled</Button>);
      expect(container.querySelector('button')).toHaveAttribute('disabled');
    });

    it('supports active state', () => {
      render(<Button isActive>Active</Button>);
      expect(screen.getByText('Active')).toBeInTheDocument();
    });
  });

  describe('icons', () => {
    it('renders start icon', () => {
      render(<Button startIcon="🚀">Launch</Button>);
      expect(screen.getByText('🚀')).toBeInTheDocument();
    });

    it('renders end icon', () => {
      render(<Button endIcon="⚡">Power</Button>);
      expect(screen.getByText('⚡')).toBeInTheDocument();
    });
  });

  describe('glow effects', () => {
    it('applies soft glow', () => {
      const { container } = render(<Button glow="soft">Test</Button>);
      expect(container.querySelector('button')).toHaveStyle('box-shadow');
    });
  });

  describe('events', () => {
    it('calls onClick', () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>Click</Button>);
      fireEvent.click(screen.getByText('Click'));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('prevents click when disabled', () => {
      const handleClick = vi.fn();
      render(<Button disabled onClick={handleClick}>Click</Button>);
      fireEvent.click(screen.getByText('Click'));
      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  describe('accessibility', () => {
    it('has correct button role', () => {
      render(<Button>Submit</Button>);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('supports aria-label', () => {
      render(<Button aria-label="Submit form">Submit</Button>);
      expect(screen.getByLabelText('Submit form')).toBeInTheDocument();
    });
  });
});
