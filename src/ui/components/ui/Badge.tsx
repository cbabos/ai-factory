import React, { forwardRef, HTMLAttributes } from 'react';

export interface BadgeProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'cyber' | 'glitch' | 'minimal';
  size?: 'sm' | 'md' | 'lg';
  status?: 'online' | 'offline' | 'busy' | 'idle';
  icon?: React.ReactNode;
}

const Badge = forwardRef<HTMLDivElement, BadgeProps>(
  (
    {
      variant = 'default',
      size = 'md',
      status,
      icon,
      children,
      className,
      ...props
    },
    ref
  ) => {
    const variantClasses = {
      default: 'bg-accent-primary/10 text-accent-primary border border-accent-primary/20',
      cyber: 'bg-[linear-gradient(135deg,theme(colors.accent.primary),theme(colors.accent.secondary))] text-white shadow-[0_0_8px_rgba(0,243,255,0.5)]',
      glitch: 'bg-accent-secondary text-white animate-[glitch-bg_2s_infinite]',
      minimal: 'bg-accent-primary/5 text-accent-primary/70 border border-accent-primary/10',
    };

    const sizeClasses = {
      sm: 'px-2 py-1 text-xs',
      md: 'px-3 py-1.5 text-sm',
      lg: 'px-4 py-2 text-base',
    };

    const statusColors = {
      online: 'bg-success/50',
      offline: 'bg-error/50',
      busy: 'bg-warning/50',
      idle: 'bg-accent-info/50',
    };

    return (
      <div
        ref={ref}
        className={`
          inline-flex items-center gap-2
          rounded-cyber
          ${variantClasses[variant]}
          ${sizeClasses[size]}
          ${status ? statusColors[status] : ''}
          ${className || ''}
        `}
        role="status"
        aria-label={children?.toString()}
        {...props}
      >
        {icon && <span className="text-lg">{icon}</span>}
        {children}
      </div>
    );
  }
);

Badge.displayName = 'Badge';

export { Badge };
