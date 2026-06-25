import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ToggleButton } from '../ToggleButton.js';

describe('ToggleButton', () => {
  describe('basic functionality', () => {
    it('renders label', () => {
      render(<ToggleButton label="Toggle" />);
      expect(screen.getByText('Toggle')).toBeInTheDocument();
    });

    it('shows checked state', () => {
      render(<ToggleButton checked label="On" />);
      expect(screen.getByText('On')).toBeInTheDocument();
    });

    it('shows unchecked state by default', () => {
      render(<ToggleButton label="Off" />);
      expect(screen.getByText('Off')).toBeInTheDocument();
    });
  });

  describe('toggling', () => {
    it('calls onChange when clicked', () => {
      const handleChange = vi.fn();
      render(<ToggleButton onChange={handleChange} label="Toggle" />);
      fireEvent.click(screen.getByText('Toggle'));
      expect(handleChange).toHaveBeenCalledWith(true);
    });
  });

  describe('variant styles', () => {
    it('applies default variant', () => {
      const { container } = render(<ToggleButton variant="default" label="Test" />);
      expect(container.querySelector('button')).toHaveClass('transition-all');
    });

    it('applies cyber variant', () => {
      const { container } = render(<ToggleButton variant="cyber" label="Test" />);
      expect(container.querySelector('button')).toHaveClass('rounded-cyber');
    });
  });

  describe('icons', () => {
    it('renders on icon when checked', () => {
      render(<ToggleButton label="Toggle" iconOn="⚡" iconOff="🔌" checked />);
      expect(screen.getByText('⚡')).toBeInTheDocument();
    });

    it('renders off icon when unchecked', () => {
      render(<ToggleButton label="Toggle" iconOn="⚡" iconOff="🔌" />);
      expect(screen.getByText('🔌')).toBeInTheDocument();
    });
  });

  describe('glitch effects', () => {
    it('applies glitch animation when enabled', () => {
      render(<ToggleButton label="Glitch" glitchEffect />);
      expect(screen.getByText('Glitch')).toHaveClass('animate-[glitch-text_3s_infinite]');
    });
  });

  describe('size variants', () => {
    it('applies small size', () => {
      const { container } = render(<ToggleButton size="sm" label="Small" />);
      expect(container.querySelector('button')).toHaveClass('px-2');
    });

    it('applies large size', () => {
      const { container } = render(<ToggleButton size="lg" label="Large" />);
      expect(container.querySelector('button')).toHaveClass('px-4');
    });
  });

  describe('accessibility', () => {
    it('has correct ARIA attributes', () => {
      const { container } = render(<ToggleButton label="Switch" />);
      expect(container.querySelector('button')).toHaveAttribute('role', 'switch');
      expect(container.querySelector('button')).toHaveAttribute('aria-checked', 'false');
    });

    it('supports disabled state', () => {
      render(<ToggleButton label="Disabled" disabled />);
      expect(screen.getByText('Disabled')).toBeInTheDocument();
      expect(screen.getByRole('switch')).toBeDisabled();
    });
  });

  describe('cyber border', () => {
    it('applies cyber border when enabled', () => {
      const { container } = render(<ToggleButton label="Cyber" cyberBorder />);
      expect(container.querySelector('button')).toHaveClass('border-accent-primary');
    });
  });
});
