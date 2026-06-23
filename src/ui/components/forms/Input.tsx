import React, { forwardRef } from 'react';
import type { InputHTMLAttributes } from 'react';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /**
   * Label text displayed above/before input
   */
  label?: string;
  
  /**
   * Helper text displayed below input
   */
  helpText?: string;
  
  /**
   * Error message to display
   */
  error?: string;
  
  /**
   * Icon to display before input
   */
  startIcon?: React.ReactNode;
  
  /**
   * Icon to display after input
   */
  endIcon?: React.ReactNode;
  
  /**
   * Input size
   */
  size?: 'sm' | 'md' | 'lg';
  
  /**
   * Input variant
   */
  variant?: 'filled' | 'outline' | 'ghost' | 'cyber';
  
  /**
   * Is the input in an active state?
   */
  isActive?: boolean;
  
  /**
   * Show glitch animation effect
   */
  glitchEffect?: boolean;
  
  /**
   * Cyberpunk border
   */
  cyberBorder?: boolean;
}

/**
 * Cyberpunk-themed input component
 */
const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      helpText,
      error,
      startIcon,
      endIcon,
      size = 'md',
      variant = 'outline',
      isActive,
      glitchEffect,
      cyberBorder,
      className,
      ...props
    },
    ref
  ) => {
    const inputSizeClasses = {
      sm: 'px-3 py-2 text-sm',
      md: 'px-4 py-3 text-sm',
      lg: 'px-5 py-4 text-base',
    };

    const variantClasses = {
      filled:
        'bg-panel border-accent-primary/30 focus:border-accent-primary/70 focus:shadow-glow-primary',
      outline:
        'bg-transparent border-accent-primary/50 focus:border-accent-primary focus:shadow-[0_0_6px_rgba(0,243,255,0.4)]',
      ghost: 'bg-transparent border-transparent hover:border-accent-primary/30 hover:bg-accent-primary/5',
      cyber:
        'bg-[linear-gradient(135deg,theme(colors.bg.panel),theme(colors.bg.secondary))] border-accent-primary/40 focus:border-accent-secondary hover:border-accent-primary/70 rounded-cyber',
    };

    const errorClasses = error ? 'focus:border-accent-danger focus:shadow-[0_0_8px_rgba(255,49,49,0.6)]' : '';
    const activeClasses = isActive ? 'border-accent-primary shadow-[0_0_6px_rgba(0,243,255,0.5)]' : '';

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label className="text-xs font-medium text-text-primary tracking-wider uppercase">
            {label}
          </label>
        )}
        
        <div className={`relative flex items-center group ${glitchEffect ? 'animate-[glitch-text_3s_infinite]' : ''}`}>
          {startIcon && (
            <div className="absolute left-3 text-accent-primary/70 group-focus-within:text-accent-primary transition-colors">
              {startIcon}
            </div>
          )}
          
          <input
            ref={ref}
            className={`
              flex w-full items-center
              bg-panel text-primary
              border rounded-cyber
              ${inputSizeClasses[size]}
              ${variantClasses[variant]}
              ${errorClasses} ${activeClasses}
              placeholder:text-accent-primary/30
              focus:outline-none focus:ring-0
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-all duration-200 ease-[cubic-bezier(0.68,-0.55,0.27,1.55)]
              ${className || ''}
            `}
            aria-invalid={!!error}
            aria-describedby={helpText ? `${label}-help` : undefined}
            {...props}
          />
          
          {endIcon && (
            <div className="absolute right-3 text-accent-primary/70 group-focus-within:text-accent-primary transition-colors">
              {endIcon}
            </div>
          )}
          
          {/* Cyberpunk border glow effect */}
          {cyberBorder && (
            <div className="absolute inset-0 rounded-cyber border border-accent-primary/30 pointer-events-none animate-[border-pulse_2s_infinite]" />
          )}
        </div>
        
        {/* Error message */}
        {error && (
          <span
            id="error-message"
            className="text-xs font-medium text-accent-danger flex items-center gap-1"
            role="alert"
          >
            <span className="text-lg">⚠</span> {error}
          </span>
        )}
        
        {/* Helper text */}
        {helpText && !error && (
          <span
            id={`${label}-help`}
            className="text-xs text-text-secondary flex items-center gap-1"
          >
            <span className="text-accent-info">ℹ</span> {helpText}
          </span>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export { Input };
