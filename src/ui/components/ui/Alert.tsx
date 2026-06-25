import React, { forwardRef, HTMLAttributes } from 'react';

export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  icon?: React.ReactNode;
  closable?: boolean;
  onClose?: () => void;
}

const Alert = forwardRef<HTMLDivElement, AlertProps>(
  (
    {
      variant = 'info',
      title,
      icon,
      closable = false,
      onClose,
      children,
      className,
      ...props
    },
    ref
  ) => {
    const variantClasses = {
      success: 'bg-success/10 border-success/30 text-success',
      error: 'bg-error/10 border-error/30 text-error',
      warning: 'bg-warning/10 border-warning/30 text-warning',
      info: 'bg-accent-info/10 border-accent-info/30 text-accent-info',
    };

    const iconMap = {
      success: '✓',
      error: '⚠',
      warning: '⚠',
      info: 'ℹ',
    };

    const displayIcon = icon || iconMap[variant];

    return (
      <div
        ref={ref}
        className={`
          flex items-start gap-3
          rounded-cyber
          border
          p-4
          ${variantClasses[variant]}
          ${className || ''}
        `}
        role="alert"
        aria-label={title || variant}
        {...props}
      >
        <div className="flex-shrink-0 text-lg mt-0.5">
          {displayIcon}
        </div>
        
        <div className="flex-1">
          {title && (
            <h4 className="font-bold uppercase tracking-wider text-sm mb-1">
              {title}
            </h4>
          )}
          {children}
        </div>
        
        {closable && onClose && (
          <button
            onClick={onClose}
            className="text-current hover:text-accent-primary/70 transition-colors"
            aria-label="Close alert"
          >
            ×
          </button>
        )}
      </div>
    );
  }
);

Alert.displayName = 'Alert';

export { Alert };
