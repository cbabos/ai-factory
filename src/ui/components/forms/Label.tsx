import React, { forwardRef, LabelHTMLAttributes } from 'react';

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  /**
   * Label text
   */
  children?: React.ReactNode;
  
  /**
   * Optional helper text
   */
  helpText?: string;
  
  /**
   * Required indicator
   */
  required?: boolean;
  
  /**
   * Disabled state
   */
  disabled?: boolean;
  
  /**
   * Compact version
   */
  compact?: boolean;
  
  /**
   * Cyberpunk style
   */
  cyber?: boolean;
}

/**
 * Cyberpunk-themed label component
 */
const Label = forwardRef<HTMLLabelElement, LabelProps>(
  (
    {
      children,
      helpText,
      required,
      disabled,
      compact,
      cyber,
      className,
      ...props
    },
    ref
  ) => {
    const baseClasses = `
      inline-flex items-center gap-2
      font-medium text-xs uppercase tracking-wider
      text-text-primary
      ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
    `;

    const compactClasses = 'flex-start';
    const fullClasses = 'flex-col gap-1';

    const labelContent = (
      <>
        <span className="font-bold text-accent-primary">
          {children}
        </span>
        {required && <span className="text-accent-danger text-lg leading-none">*</span>}
      </>
    );

    return (
      <label
        ref={ref}
        className={`
          ${compact ? compactClasses : fullClasses}
          ${baseClasses}
          ${cyber ? 'glitch-[glitch-text_5s_infinite]' : ''}
          ${className || ''}
        `}
        {...props}
      >
        {labelContent}
        
        {helpText && (
          <span className="text-xs text-text-secondary ml-4">
            {helpText}
          </span>
        )}
      </label>
    );
  }
);

Label.displayName = 'Label';

export { Label };
