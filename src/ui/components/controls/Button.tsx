import React, { forwardRef, ButtonHTMLAttributes } from 'react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * Button variant
   */
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'cyber';
  
  /**
   * Button size
   */
  size?: 'sm' | 'md' | 'lg';
  
  /**
   * Is button in active state
   */
  isActive?: boolean;
  
  /**
   * Show loading state
   */
  loading?: boolean;
  
  /**
   * Button shape
   */
  shape?: 'default' | 'round' | 'cyber';
  
  /**
   * Show glitch effect
   */
  glitchEffect?: boolean;
  
  /**
   * Cyberpunk border color
   */
  cyberBorder?: boolean;
  
  /**
   * Neon glow intensity
   */
  glow?: 'none' | 'soft' | 'medium' | 'strong';
  
  /**
   * Icon to show before content
   */
  startIcon?: React.ReactNode;
  
  /**
   * Icon to show after content
   */
  endIcon?: React.ReactNode;
}

/**
 * Cyberpunk-themed button component
 */
const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      isActive,
      loading = false,
      shape = 'default',
      glitchEffect,
      cyberBorder,
      glow = 'medium',
      startIcon,
      endIcon,
      className,
      disabled,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;

    // Size classes
    const sizeClasses = {
      sm: 'px-3 py-2 text-xs',
      md: 'px-4 py-3 text-sm',
      lg: 'px-6 py-4 text-base',
    };

    // Variant classes
    const variantClasses = {
      primary: `
        bg-accent-primary text-black
        hover:bg-accent-primary/90
        hover:shadow-[0_0_10px_rgba(0,243,255,0.6)]
        focus:ring-2 focus:ring-accent-primary/50
      `,
      secondary: `
        bg-accent-secondary text-white
        hover:bg-accent-secondary/90
        hover:shadow-[0_0_10px_rgba(255,0,255,0.6)]
        focus:ring-2 focus:ring-accent-secondary/50
      `,
      danger: `
        bg-accent-danger text-white
        hover:bg-accent-danger/90
        hover:shadow-[0_0_10px_rgba(255,49,49,0.6)]
        focus:ring-2 focus:ring-accent-danger/50
      `,
      ghost: `
        bg-transparent border border-accent-primary/30
        text-accent-primary
        hover:bg-accent-primary/10 hover:border-accent-primary
        focus:ring-2 focus:ring-accent-primary/30
      `,
      cyber: `
        bg-[linear-gradient(135deg,theme(colors.bg.panel),theme(colors.bg.secondary))]
        border border-accent-primary/40
        text-accent-primary
        hover:bg-accent-primary/10
        hover:border-accent-secondary
        shadow-[0_0_8px_rgba(0,243,255,0.2)]
        focus:ring-2 focus:ring-accent-primary/50
        rounded-cyber
      `,
    };

    // Shape classes
    const shapeClasses = {
      default: 'rounded-cyber',
      round: 'rounded-full',
      cyber: 'rounded-[4px]',
    };

    // Glow classes based on intensity
    const glowClasses = {
      none: '',
      soft: 'shadow-[0_0_4px_rgba(0,243,255,0.3)]',
      medium: 'shadow-[0_0_8px_rgba(0,243,255,0.4)]',
      strong: 'shadow-[0_0_16px_rgba(0,243,255,0.5)]',
    };

    // Active state classes
    const activeClasses = isActive
      ? 'bg-accent-primary/80 border-accent-secondary translate-y-[1px] shadow-[0_2px_4px_rgba(0,0,0,0.5)]'
      : '';

    // Loading spinner
    const LoadingSpinner = () => (
      <svg
        className={`
          w-4 h-4 animate-spin
          ${variant === 'primary' ? 'text-black' : 'text-accent-primary'}
        `}
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    );

    return (
      <button
        ref={ref}
        className={`
          inline-flex items-center justify-center gap-2
          font-semibold tracking-wide
          transition-all duration-150 ease-[cubic-bezier(0.68,-0.55,0.27,1.55)]
          active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed
          disabled:active:scale-100
          ${sizeClasses[size]}
          ${variantClasses[variant]}
          ${shapeClasses[shape]}
          ${glowClasses[glow]}
          ${activeClasses}
          ${glitchEffect ? 'animate-[glitch-text_3s_infinite]' : ''}
          ${cyberBorder ? 'border-2 border-accent-primary' : ''}
          ${isDisabled ? 'pointer-events-none' : 'cursor-pointer'}
          ${className || ''}
        `}
        disabled={isDisabled}
        {...props}
      >
        {/* Loading state overlay */}
        {loading && <LoadingSpinner />}

        {/* Start icon */}
        {!loading && startIcon && <span className="text-lg">{startIcon}</span>}

        {/* Content */}
        <span className="flex-1 text-center">{children}</span>

        {/* End icon */}
        {!loading && endIcon && <span className="text-lg">{endIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';

export { Button };
