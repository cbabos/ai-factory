import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Label } from '../Label.js';

describe('Label', () => {
  describe('basic rendering', () => {
    it('renders children text', () => {
      render(<Label>Email Address</Label>);
      expect(screen.getByText('Email Address')).toBeInTheDocument();
    });

    it('renders required indicator', () => {
      render(<Label required>Email</Label>);
      expect(screen.getByText('*')).toBeInTheDocument();
    });

    it('renders helper text', () => {
      render(<Label helpText="Enter your email">Email</Label>);
      expect(screen.getByText('Enter your email')).toBeInTheDocument();
    });
  });

  describe('layout variants', () => {
    it('renders compact layout', () => {
      const { container } = render(<Label compact>Compact</Label>);
      expect(container.querySelector('.flex-start')).toBeInTheDocument();
    });

    it('renders full layout by default', () => {
      const { container } = render(<Label>Full</Label>);
      expect(container.querySelector('.flex-col')).toBeInTheDocument();
    });
  });

  describe('cyberpunk styling', () => {
    it('applies glitch animation when cyber', () => {
      render(<Label cyber>Cyber Label</Label>);
      expect(screen.getByText('Cyber Label')).toHaveClass('glitch-[glitch-text_5s_infinite]');
    });
  });

  describe('accessibility', () => {
    it('has proper label structure', () => {
      render(<Label htmlFor="test-input">Test</Label>);
      expect(screen.getByText('Test')).toBeInTheDocument();
    });

    it('supports disabled state', () => {
      render(<Label disabled>Disabled</Label>);
      expect(screen.getByText('Disabled')).toBeInTheDocument();
    });
  });

  describe('combining features', () => {
    it('renders all features together', () => {
      render(
        <Label required cyber helpText="Required field">
          Complete Name
        </Label>
      );
      expect(screen.getByText('Complete Name')).toBeInTheDocument();
      expect(screen.getByText('*')).toBeInTheDocument();
    });
  });
});
