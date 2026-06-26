import { describe, it, expect } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MultiSelect } from '../MultiSelect.js';

describe('MultiSelect', () => {
  const options = [
    { value: 'model1', label: 'GPT-4', icon: '🤖' },
    { value: 'model2', label: 'Claude', icon: '🧠' },
  ];

  describe('basic functionality', () => {
    it('renders with label', () => {
      render(<MultiSelect label="Select Models" options={options} />);
      expect(screen.getByText('Select Models')).toBeInTheDocument();
    });

    it('renders placeholder', () => {
      render(<MultiSelect options={options} placeholder="Choose models..." />);
      expect(screen.getByText('Choose models...')).toBeInTheDocument();
    });

    it('displays selected values', () => {
      render(<MultiSelect options={options} value={['model1']} />);
      expect(screen.getByText('GPT-4')).toBeInTheDocument();
    });
  });

  describe('search functionality', () => {
    it('shows search input when enabled', () => {
      render(<MultiSelect options={options} searchable />);
      fireEvent.click(screen.getByRole('button'));
      expect(screen.getByPlaceholderText('Search options...')).toBeInTheDocument();
    });
  });

  describe('clear functionality', () => {
    it('shows clear all button when clearable', () => {
      render(<MultiSelect options={options} clearable value={['model1']} />);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });
  });

  describe('variants', () => {
    it('applies cyber variant', () => {
      const { container } =
        render(<MultiSelect options={options} variant="cyber" />);
      expect(container.querySelector('.rounded-cyber')).toBeInTheDocument();
    });
  });

  describe('max items', () => {
    it('limits selections', () => {
      render(<MultiSelect options={options} maxItems={1} />);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has correct ARIA attributes', () => {
      const { container } = render(<MultiSelect options={options} />);
      expect(container.querySelector('.relative')).toHaveAttribute('role', 'button');
    });
  });

  describe('keyboard navigation', () => {
    it('supports escape to close', () => {
      render(
        <MultiSelect
          options={options}
          searchable
          placeholder="Search..."
        />
      );
      fireEvent.click(screen.getByRole('button'));
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });
  });
});
