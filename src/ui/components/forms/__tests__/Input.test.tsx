import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Input } from '../Input.js';

describe('Input', () => {
  describe('core functionality', () => {
    it('renders with label', () => {
      render(<Input label="Email" />);
      expect(screen.getByText('Email')).toBeInTheDocument();
    });

    it('renders placeholder text', () => {
      render(<Input placeholder="Enter email" />);
      expect(screen.getByPlaceholderText('Enter email')).toBeInTheDocument();
    });

    it('displays error message', () => {
      render(<Input error="Invalid email" />);
      expect(screen.getByText('Invalid email')).toBeInTheDocument();
    });
  });

  describe('variants', () => {
    it('applies filled variant classes', () => {
      const { container } = render(<Input variant="filled" />);
      expect(container.querySelector('input')).toHaveClass('bg-panel');
    });

    it('applies outline variant classes', () => {
      const { container } = render(<Input variant="outline" />);
      expect(container.querySelector('input')).toHaveClass('bg-transparent');
    });

    it('applies cyber variant classes', () => {
      const { container } = render(<Input variant="cyber" />);
      expect(container.querySelector('input')).toHaveClass('rounded-cyber');
    });
  });

  describe('icons', () => {
    it('renders start icon', () => {
      render(<Input startIcon={<span>📧</span>} />);
      expect(screen.getByText('📧')).toBeInTheDocument();
    });

    it('renders end icon', () => {
      render(<Input endIcon={<span>✅</span>} />);
      expect(screen.getByText('✅')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has aria attributes', () => {
      const { container } = render(<Input label="Name" error="Required" />);
      const input = container.querySelector('input');
      expect(input).toHaveAttribute('aria-invalid', 'true');
    });

    it('supports disabled state', () => {
      render(<Input disabled />);
      expect(screen.getByRole('textbox')).toBeDisabled();
    });
  });

  describe('event handlers', () => {
    it('calls onChange', () => {
      const handleChange = vi.fn();
      render(<Input onChange={handleChange} />);
      
      const input = screen.getByRole('textbox');
      input.value = 'test';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      expect(handleChange).toHaveBeenCalled();
    });
  });
});
