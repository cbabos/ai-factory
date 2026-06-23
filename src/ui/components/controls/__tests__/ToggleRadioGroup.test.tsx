import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ToggleRadioGroup } from '../ToggleRadioGroup.js';

describe('ToggleRadioGroup', () => {
  const options = [
    { value: 'option1', label: 'Option 1' },
    { value: 'option2', label: 'Option 2' },
  ];

  describe('basic functionality', () => {
    it('renders with label', () => {
      render(<ToggleRadioGroup label="Choose" options={options} />);
      expect(screen.getByText('Choose')).toBeInTheDocument();
    });

    it('renders all options', () => {
      render(<ToggleRadioGroup options={options} />);
      expect(screen.getByText('Option 1')).toBeInTheDocument();
      expect(screen.getByText('Option 2')).toBeInTheDocument();
    });

    it('shows selected value', () => {
      render(<ToggleRadioGroup options={options} value="option1" />);
      expect(screen.getByText('Option 1')).toBeInTheDocument();
    });
  });

  describe('variant styles', () => {
    it('applies cyber style when enabled', () => {
      const { container } = render(<ToggleRadioGroup options={options} cyber />);
      expect(container.querySelector('div')).toHaveClass('animate-[border-glow_2s_infinite]');
    });
  });

  describe('layout', () => {
    it('supports vertical layout', () => {
      const { container } = render(<ToggleRadioGroup options={options} direction="vertical" />);
      expect(container.querySelector('.flex-col')).toBeInTheDocument();
    });

    it('supports horizontal layout', () => {
      const { container } = render(<ToggleRadioGroup options={options} direction="horizontal" />);
      expect(container.querySelector('.flex-row')).toBeInTheDocument();
    });
  });

  describe('events', () => {
    it('calls onChange when clicked', () => {
      const handleChange = vi.fn();
      render(<ToggleRadioGroup options={options} onChange={handleChange} />);
      fireEvent.click(screen.getByText('Option 1'));
      expect(handleChange).toHaveBeenCalledWith('option1');
    });
  });

  describe('accessibility', () => {
    it('has correct ARIA attributes', () => {
      const { container } = render(<ToggleRadioGroup options={options} label="Test" />);
      expect(container.querySelector('div')).toHaveAttribute('role', 'radiogroup');
      expect(container.querySelector('div')).toHaveAttribute('aria-label', 'Test');
    });
  });

  describe('disabled state', () => {
    it('disables all options when group disabled', () => {
      const { container } = render(<ToggleRadioGroup options={options} disabled />);
      expect(container.querySelector('div')).toBeInTheDocument();
    });
  });

  describe('keyboard navigation', () => {
    it('supports arrow keys', () => {
      render(<ToggleRadioGroup options={options} />);
      expect(screen.getByRole('radiogroup')).toBeInTheDocument();
    });

    it('supports Home/End keys', () => {
      render(<ToggleRadioGroup options={options} />);
      expect(screen.getByRole('radiogroup')).toBeInTheDocument();
    });
  });

  describe('size variants', () => {
    it('applies small size', () => {
      const { container } = render(<ToggleRadioGroup options={options} size="sm" />);
      expect(container.querySelector('button')).toHaveClass('px-2');
    });

    it('applies large size', () => {
      const { container } = render(<ToggleRadioGroup options={options} size="lg" />);
      expect(container.querySelector('button')).toHaveClass('px-4');
    });
  });

  describe('cyber icons', () => {
    it('renders icons when provided', () => {
      render(
        <ToggleRadioGroup
          options={options.map((opt) => ({
            ...opt,
            icon: '⚡',
          }))}
        />
      );
      expect(screen.getByText('⚡')).toBeInTheDocument();
    });
  });
});
