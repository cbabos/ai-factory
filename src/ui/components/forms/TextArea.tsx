import React, {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  TextareaHTMLAttributes,
} from 'react';

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /**
   * Label text displayed above/before textarea
   */
  label?: string;
  
  /**
   * Helper text displayed below textarea
   */
  helpText?: string;
  
  /**
   * Error message to display
   */
  error?: string;
  
  /**
   * Auto-grow behavior
   */
  autoGrow?: boolean;
  
  /**
   * Minimum rows
   */
  minRows?: number;
  
  /**
   * Maximum rows before scrolling
   */
  maxRows?: number;
  
  /**
   * Show character count
   */
  showCounter?: boolean;
  
  /**
   * Maximum characters
   */
  maxLength?: number;
  
  /**
   * Character count position
   */
  counterPosition?: 'top' | 'bottom' | 'inline';
  
  /**
   * Cyberpunk variant with dynamic border
   */
  cyberBorder?: boolean;
  
  /**
   * Show glitch animation
   */
  glitchEffect?: boolean;
}

/**
 * Cyberpunk-themed textarea component with auto-grow
 */
const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  (
    {
      label,
      helpText,
      error,
      autoGrow = false,
      minRows = 4,
      maxRows = 8,
      showCounter = false,
      maxLength,
      counterPosition = 'bottom',
      cyberBorder,
      glitchEffect,
      className,
      ...props
    },
    _ref
  ) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    React.useState(minRows);

    // Auto-grow functionality
    useEffect(() => {
      if (autoGrow && textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
      }
    }, [props.value, autoGrow]);

    // Handle content change for auto-grow
    const handleInput = useCallback(
      (e: React.FormEvent<HTMLTextAreaElement>) => {
        if (autoGrow) {
          const target = e.target as HTMLTextAreaElement;
          target.style.height = 'auto';
          target.style.height = `${Math.min(target.scrollHeight, maxRows * 24)}px`;
        }
      },
      [autoGrow, maxRows]
    );

    // Calculate character count
    const currentLength = (props.value?.toString() || '').length;
    const remainingLength = maxLength ? maxLength - currentLength : null;
    const isOverLimit = maxLength && remainingLength! < 0;

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label className="text-xs font-medium text-text-primary tracking-wider uppercase">
            {label}
          </label>
        )}

        {counterPosition === 'top' && maxLength && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-text-secondary">
              {remainingLength !== null ? remainingLength : 0} remaining
            </span>
          </div>
        )}

        <div
          className={`
            relative w-full
            ${glitchEffect ? 'animate-[glitch-overlay_5s_infinite]' : ''}
          `}
        >
          <textarea
            ref={textareaRef}
            className={`
              flex w-full min-h-[6rem] items-start
              bg-panel text-primary
              border border-accent-primary/50 rounded-glitch
              p-4 text-sm
              focus:outline-none focus:border-accent-secondary
              focus:shadow-[0_0_8px_rgba(0,243,255,0.4)]
              resize-none
              transition-all duration-200 ease-[cubic-bezier(0.68,-0.55,0.27,1.55)]
              ${isOverLimit ? 'border-accent-danger focus:shadow-[0_0_8px_rgba(255,49,49,0.6)]' : ''}
              disabled:opacity-50 disabled:cursor-not-allowed
              ${className || ''}
            `}
            aria-invalid={!!error}
            aria-describedby={helpText ? `${label}-help` : undefined}
            onInput={handleInput}
            rows={minRows || 4}
            {...props}
          />

          {cyberBorder && (
            <div className="absolute inset-0 rounded-glitch border border-accent-primary/20 pointer-events-none" />
          )}
        </div>

        {/* Counter and helper text */}
        <div className="flex items-center gap-2">
          {counterPosition !== 'top' && showCounter && maxLength && (
            <span
              className={`
                text-xs font-medium
                ${isOverLimit
                  ? 'text-accent-danger'
                  : remainingLength !== null && remainingLength! < 10
                    ? 'text-accent-warning'
                    : 'text-text-secondary'}
              `}
            >
              {currentLength}/{maxLength}
            </span>
          )}

          {error && (
            <span
              className="text-xs font-medium text-accent-danger flex items-center gap-1"
              role="alert"
            >
              <span className="text-lg">⚠</span> {error}
            </span>
          )}

          {helpText && !error && (
            <span
              id={`${label}-help`}
              className="text-xs text-text-secondary flex items-center gap-1"
            >
              <span className="text-accent-info">ℹ</span> {helpText}
            </span>
          )}
        </div>

        {counterPosition === 'bottom' && maxLength && (
          <div className="flex items-center justify-between text-xs mt-1">
            <span className="text-text-secondary">
              {remainingLength !== null ? remainingLength : 0} remaining
            </span>
          </div>
        )}
      </div>
    );
  }
);

TextArea.displayName = 'TextArea';

export { TextArea };
