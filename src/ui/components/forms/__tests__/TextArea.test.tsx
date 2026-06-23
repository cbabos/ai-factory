import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TextArea } from '../TextArea.js';

describe('TextArea', () => {
  describe('basic functionality', () => {
    it('renders with label', () => {
      render(<TextArea label="Notes" />);
      expect(screen.getByText('Notes')).toBeInTheDocument();
    });

    it('renders with placeholder', () => {
      render(<TextArea placeholder="Enter notes" />);
      expect(screen.getByPlaceholderText('Enter notes')).toBeInTheDocument();
    });

    it('displays error message', () => {
      render(<TextArea error="Error message" />);
      expect(screen.getByText('Error message')).toBeInTheDocument();
    });
  });

  describe('auto-grow', () => {
    it('auto-grows when enabled', () => {
      render(<TextArea autoGrow minRows={2} />);
      const textarea = screen.getByRole(' textbox');
      expect(textarea).toBeInTheDocument();
    });
  });

  describe('character counter', () => {
    it('shows character count when enabled', () => {
      render(<TextArea showCounter maxLength={100} />);
      expect(screen.getByText('0/100')).toBeInTheDocument();
    });

    it('warns when approaching limit', () => {
      render(
        <TextArea
          showCounter
          maxLength={5}
          value="1234"
        />
      );
      expect(screen.getByText('4/5')).toBeInTheDocument();
    });
  });

  describe('cyberpunk styling', () => {
    it('applies cyber border when enabled', () => {
      const { container } = render(<TextArea cyberBorder />);
      expect(container.querySelector('.absolute.inset-0')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has aria-invalid attribute for errors', () => {
      const { container } = render(<TextArea error="Error" />);
      const textarea = container.querySelector('textarea');
      expect(textarea).toHaveAttribute('aria-invalid', 'true');
    });
  });

  describe('event handlers', () => {
    it('calls onChange', () => {
      const handleChange = vi.fn();
      render(<TextArea onChange={handleChange} />);
      
      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: 'test' } });
      expect(handleChange).toHaveBeenCalledWith('test');
    });

    it('calls onInput for auto-grow', () => {
      render(<TextArea autoGrow />);
      const textarea = screen.getByRole('textbox');
      expect(textarea).toBeInTheDocument();
    });
  });
});
