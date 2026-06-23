import React, { forwardRef, HTMLAttributes } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  subtitle?: string;
  variant?: 'default' | 'cyber' | 'glitch' | 'minimal';
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  size?: 'sm' | 'md' | 'lg';
  interactive?: boolean;
  cyber?: boolean;
  glitchEffect?: boolean;
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      title,
      subtitle,
      variant = 'default',
      padding = 'md',
      size = 'md',
      interactive = false,
      cyber = false,
      glitchEffect = false,
      children,
      className,
      ...props
    },
    ref
  ) => {
    const variantClasses = {
      default: 'bg-panel border border-accent-primary/10',
      cyber: 'bg-[linear-gradient(135deg,theme(colors.bg.panel),theme(colors.bg.secondary))] border border-accent-primary/40 shadow-[0_0_16px_rgba(0,243,255,0.2)]',
      glitch: 'bg-panel border border-accent-primary/20 animate-[glitch-border_2s_infinite]',
      minimal: 'bg-transparent border border-accent-primary/5',
    };

    const paddingClasses = {
      none: '',
      sm: 'p-3',
      md: 'p-5',
      lg: 'p-7',
      xl: 'p-9',
    };

    const sizeClasses = {
      sm: 'text-sm',
      md: 'text-base',
      lg: 'text-lg',
    };

    const cyberGlow = cyber
      ? 'animate-[border-glow_2s_infinite]'
      : '';

    const glitchText = glitchEffect ? 'animate-[glitch-text_3s_infinite]' : '';

    const interactiveClasses = interactive
      ? 'cursor-pointer hover:border-accent-primary hover:shadow-[0_0_12px_rgba(0,243,255,0.2)] hover:bg-accent-primary/5 transition-all duration-200'
      : '';

    return (
      <div
        ref={ref}
        className={`
          flex flex-col
          ${variantClasses[variant]}
          ${cyberGlow}
          ${interactiveClasses}
          ${className || ''}
        `}
        role="article"
        aria-label={title || 'Card'}
        {...props}
      >
        {(title || subtitle) && (
          <div className={`${paddingClasses[padding]} pb-2`}>
            {title && (
              <h3
                className={`
                  text-base font-bold tracking-wide uppercase
                  ${sizeClasses[size]}
                  ${glitchText}
                `}
              >
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-xs text-text-secondary mt-1 ml-1">
                {subtitle}
              </p>
            )}
          </div>
        )}
        
        <div className={`${paddingClasses[padding]} flex-1`}>
          {children}
        </div>
      </div>
    );
  }
);

Card.displayName = 'Card';

export { Card };
