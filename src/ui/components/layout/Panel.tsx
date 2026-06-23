import React, { forwardRef, HTMLAttributes } from 'react';

export interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  subtitle?: string;
  border?: 'none' | 'default' | 'glitch' | 'cyber';
  headerVariant?: 'default' | 'cyber' | 'minimal';
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'custom';
  cyber?: boolean;
  glitchEffect?: boolean;
  collapsible?: boolean;
  defaultExpanded?: boolean;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
}

const Panel = forwardRef<HTMLDivElement, PanelProps>(
  (
    {
      title,
      subtitle,
      border = 'cyber',
      headerVariant = 'cyber',
      padding = 'md',
      cyber = false,
      glitchEffect = false,
      collapsible: _collapsible = false,
      defaultExpanded: _defaultExpanded = true,
      actions,
      footer,
      children,
      className,
      ...props
    },
    ref
  ) => {
    const borderClasses = {
      none: '',
      default: 'border border-accent-primary/10',
      glitch: 'border border-accent-primary/30 animate-[glitch-border_1.5s_infinite]',
      cyber: 'border border-accent-primary/20 shadow-[0_0_12px_rgba(0,243,255,0.15)]',
    };

    const headerClasses = {
      default: 'pb-3 border-b border-accent-primary/10',
      cyber: 'pb-3 border-b border-accent-primary/20 bg-accent-primary/5',
      minimal: 'pb-2',
    };

    const paddingClasses = {
      none: '',
      sm: 'p-4',
      md: 'p-6',
      lg: 'p-8',
      custom: 'p-6',
    };

    const cyberGlow = cyber
      ? 'animate-[border-glow_2s_infinite]'
      : '';

    const glitchText = glitchEffect ? 'animate-[glitch-text_3s_infinite]' : '';

  return (
    <div
      ref={ref}
      className={`
        flex flex-col
        bg-[#1a1a1a]
        rounded-[12px]
        ${borderClasses[border]}
        ${cyberGlow}
        ${className || ''}
      `}
      role="region"
      aria-label={title || 'Panel'}
      {...props}
    >
        {(title || subtitle || actions) && (
          <div
            className={`
              flex items-start justify-between
              ${headerClasses[headerVariant]}
              ${paddingClasses[padding]}
            `}
          >
            <div>
              {title && (
                <h2
                  className={`
                    text-lg font-bold tracking-wider uppercase
                    ${glitchText}
                  `}
                >
                  {title}
                </h2>
              )}
              {subtitle && (
                <p className="text-xs text-text-secondary mt-1">
                  {subtitle}
                </p>
              )}
            </div>
            {actions && (
              <div className="flex gap-2">
                {actions}
              </div>
            )}
          </div>
        )}
        
        <div className={`${paddingClasses[padding]} flex-1`}>
          {children}
        </div>
        
        {footer && (
          <div
            className={`
              border-t border-accent-primary/10
              ${paddingClasses[padding]}
            `}
          >
            {footer}
          </div>
        )}
      </div>
    );
  }
);

Panel.displayName = 'Panel';

export { Panel };
