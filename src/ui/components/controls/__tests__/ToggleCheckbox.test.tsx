import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ToggleCheckbox } from '../ToggleCheckbox.js';

describe('ToggleCheckbox', () => {
  describe('basic functionality', () => {
    it('renders label', () => {
      render(<ToggleCheckbox label="Enable" />);
      expect(screen.getByText('Enable')).toBeInTheDocument();
    });

    it('shows checked state', () => {
      render(<ToggleCheckbox checked label="On" />);
      expect(screen.getByText('On')).toBeInTheDocument();
    });

    it('shows unchecked state by default', () => {
      render(<ToggleCheckbox label="Off" />);
      expect(screen.getByText('Off')).toBeInTheDocument();
    });
  });

  describe('toggling', () => {
    it('calls onChange when clicked', () => {
      const handleChange = vi.fn();
      render(<ToggleCheckbox onChange={handleChange} label="Toggle" />);
      fireEvent.click(screen.getByText('Toggle'));
      expect(handleChange).toHaveBeenCalledWith(true);
    });
  });

  describe('variant styles', () => {
    it('applies cyber style when enabled', () => {
      const { container } = render(<ToggleCheckbox label="Test" cyber />);
      expect(container.querySelector('div')).toHaveClass('rounded-cyber');
    });
  });

  describe('checkbox icon', () => {
    it('displays checkmark when checked', () => {
      render(<ToggleCheckbox label="Check" checked />);
      expect(screen.getByText('Check')).toBeInTheDocument();
    });

    it('hides checkmark when unchecked', () => {
      render(<ToggleCheckbox label="Uncheck" />);
      expect(screen.getByText('Uncheck')).toBeInTheDocument();
    });
  });

  describe('size variants', () => {
    it('applies small size', () => {
      const { container } = render(<ToggleCheckbox label="Small" size="sm" />);
      expect(container.querySelector('div')).toHaveClass('w-4');
    });

    it('applies large size', () => {
      const { container } = render(<ToggleCheckbox label="Large" size="lg" />);
      expect(container.querySelector('div')).toHaveClass('w-6');
    });
  });

  describe('accessibility', () => {
    it('has correct ARIA attributes', () => {
      const { container } = render(<ToggleCheckbox label="Switch" />);
      expect(container.querySelector('div')).toHaveAttribute('role', 'checkbox');
      expect(container.querySelector('div')).toHaveAttribute('aria-checked', 'false');
    });

    it('supports disabled state', () => {
      render(<ToggleCheckbox label="Disabled" disabled />);
      expect(screen.getByText('Disabled')).toBeInTheDocument();
    });
  });

  describe('description', () => {
    it('renders description text', () => {
      render(<ToggleCheckbox label="Feature" description="This is a feature" />);
      expect(screen.getByText('This is a feature')).toBeInTheDocument();
    });
  });

  describe('onChange handler', () => {
    it('calls with correct value', () => {
      const handleChange = vi.fn();
      render(<ToggleCheckbox onChange={handleChange} label="Test" />);
      fireEvent.click(screen.getByText('Test'));
      expect(handleChange).toHaveBeenCalledWith(true);
    });
  });
});
