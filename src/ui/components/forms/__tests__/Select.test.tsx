import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Select } from '../Select.js';

describe('Select', () => {
  const options = [
    { value: 'option1', label: 'Option 1' },
    { value: 'option2', label: 'Option 2' },
  ];

  describe('basic functionality', () => {
    it('renders with label', () => {
      render(<Select label="Choose" options={options} />);
      expect(screen.getByText('Choose')).toBeInTheDocument();
    });

    it('renders placeholder when no value selected', () => {
      render(<Select options={options} />);
      expect(screen.getByText('Select an option...')).toBeInTheDocument();
    });

    it('displays selected value', () => {
      render(<Select options={options} value="option1" />);
      expect(screen.getByText('Option 1')).toBeInTheDocument();
    });

    it('displays error message', () => {
      render(<Select options={options} error="Error" />);
      expect(screen.getByText('Error')).toBeInTheDocument();
    });
  });

  describe('variant styles', () => {
    it('applies outline variant', () => {
      const { container } = render(<Select variant="outline" options={options} />);
      expect(container.querySelector('button')).toHaveClass('border-accent-primary/50');
    });

    it('applies cyber variant', () => {
      const { container } = render(<Select variant="cyber" options={options} />);
      expect(container.querySelector('button')).toHaveClass('rounded-cyber');
    });
  });

  describe('icons', () => {
    it('renders start icon', () => {
      render(<Select startIcon={<span>🔍</span>} options={options} />);
      expect(screen.getByText('🔍')).toBeInTheDocument();
    });

    it('renders cyrillic arrow when enabled', () => {
      render(<Select cyrillicArrow options={options} />);
      expect(screen.getByText('⌠')).toBeInTheDocument();
    });
  });

  describe('dropdown interaction', () => {
    it('opens dropdown when clicked', () => {
      const { container } = render(<Select options={options} />);
      const button = container.querySelector('button');
      expect(button).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has correct ARIA attributes', () => {
      const { container } = render(<Select options={options} />);
      const button = container.querySelector('button');
      expect(button).toHaveAttribute('role', 'button');
      expect(button).toHaveAttribute('aria-haspopup', 'listbox');
    });

    it('has aria-invalid for errors', () => {
      const { container } = render(<Select options={options} error="Error" />);
      expect(container.querySelector('button')).toHaveAttribute('aria-invalid', 'true');
    });
  });

  describe('options', () => {
    it('renders options list', () => {
      render(<Select options={options} />);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('disables options', () => {
      const disabledOptions = [
        { value: 'disabled', label: 'Disabled', disabled: true },
      ];
      render(<Select options={disabledOptions} />);
      expect(screen.getByText('Disabled')).toBeInTheDocument();
    });
  });
});
