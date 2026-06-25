import React, { useRef, useEffect } from 'react';

export interface RadioOptionProps {
  value: string;
  label: string;
  disabled?: boolean;
  icon?: React.ReactNode;
  cyber?: boolean;
}

export interface ToggleRadioGroupProps {
  /**
   * Selected value
   */
  value: string;
  
  /**
   * CSS class name
   */
  className?: string;
  
  /**
   * Callback for value changes
   */
  onChange?: (value: string) => void;
  
  /**
   * Radio options
   */
  options: RadioOptionProps[];
  
  /**
   * Label
   */
  label?: string;
  
  /**
   * Vertical or horizontal layout
   */
  direction?: 'vertical' | 'horizontal';
  
  /**
   * Cyberpunk style
   */
  cyber?: boolean;
  
  /**
   * Button size
   */
  size?: 'sm' | 'md' | 'lg';
  
  /**
   * Disabled state
   */
  disabled?: boolean;
}

/**
 * Cyberpunk toggle radio group component
 */
const ToggleRadioGroup: React.FC<ToggleRadioGroupProps> = ({
  value,
  onChange,
  options,
  label,
  direction = 'vertical',
  cyber = false,
  size = 'md',
  disabled = false,
  className,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const focusable = containerRef.current?.querySelectorAll('button');
      if (!focusable) return;

      const currentIndex = Array.from(focusable).findIndex(
        (el) => el === document.activeElement
      );

      let newIndex = currentIndex;

      switch (e.key) {
        case 'ArrowUp':
        case 'ArrowLeft':
          newIndex = currentIndex <= 0 ? options.length - 1 : currentIndex - 1;
          break;
        case 'ArrowDown':
        case 'ArrowRight':
          newIndex = currentIndex >= options.length - 1 ? 0 : currentIndex + 1;
          break;
        case 'Home':
          newIndex = 0;
          break;
        case 'End':
          newIndex = options.length - 1;
          break;
        default:
          return;
      }

      e.preventDefault();
      if (newIndex >= 0 && newIndex < options.length) {
        focusable[newIndex]?.focus();
        const optionValue = options[newIndex]?.value;
        if (optionValue) {
          onChange?.(optionValue);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [options, onChange]);

  // Size classes
  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-2 text-sm',
    lg: 'px-4 py-3 text-base',
  };

  // Direction classes
  const directionClasses = {
    vertical: 'flex flex-col gap-2',
    horizontal: 'flex flex-row gap-2',
  };

  // Cyber option classes
  const cyberOptions = {
    default: `
      transition-all duration-200 ease-[cubic-bezier(0.68,-0.55,0.27,1.55)]
    `,
    cyber: `
      bg-[linear-gradient(135deg,theme(colors.bg.panel),theme(colors.bg.secondary))]
      border border-accent-primary/40
      rounded-cyber
      shadow-[0_0_6px_rgba(0,243,255,0.2)]
    `,
  };

  // Option classes
  const optionClasses = (isSelected: boolean) => `
    relative flex items-center gap-3
    cursor-pointer transition-all duration-200 ease-[cubic-bezier(0.68,-0.55,0.27,1.55)]
    disabled:opacity-50 disabled:cursor-not-allowed
    ${isSelected
      ? `
        bg-accent-primary/20 text-accent-primary
        border-accent-primary
        shadow-[0_0_6px_rgba(0,243,255,0.3)]
        scale-105
      `
      : `
        bg-panel text-text-secondary
        border-accent-primary/30
        hover:bg-accent-primary/5 hover:border-accent-primary/60
      `
    }
    ${sizeClasses[size]}
    ${direction === 'horizontal' ? 'flex-1 text-center' : ''}
    ${cyber ? cyberOptions.cyber : ''}
  `;

  // Custom radio circle indicator
  const RadioIndicator: React.FC<{ isSelected: boolean }> = ({ isSelected }) => (
    <div
      className={`
        absolute left-3 w-4 h-4 rounded-full
        border-2 transition-all duration-200 ease-[cubic-bezier(0.68,-0.55,0.27,1.55)]
        ${isSelected
          ? 'border-accent-primary bg-accent-primary'
          : 'border-accent-primary/50 bg-transparent'}
      `}
    >
      {isSelected && (
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2
            bg-black rounded-full shadow-[0_0_6px_rgba(0,0,0,0.8)]"
        />
      )}
    </div>
  );

  return (
    <div
      ref={containerRef}
      className={`
        ${directionClasses[direction]}
        ${cyber ? 'animate-[border-glow_2s_infinite]' : ''}
        ${className || ''}
      `}
      role="radiogroup"
      aria-label={label}
    >
      {options.map((option) => {
        const isSelected = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-disabled={option.disabled || disabled}
            onClick={() => !option.disabled && !disabled && onChange?.(option.value)}
              className={optionClasses(isSelected)}
          >
            <RadioIndicator isSelected={isSelected} />

            {/* Icon */}
            {option.icon && (
              <span className={isSelected ? 'text-lg' : 'text-lg text-accent-primary/70'}>
                {option.icon}
              </span>
            )}

            {/* Label */}
            <span className="flex-1 text-left">
              {option.label}
            </span>

            {/* Cyber border highlight */}
            {cyber && isSelected && (
              <div className="absolute inset-0 rounded-cyber border border-accent-primary pointer-events-none" />
            )}
          </button>
        );
      })}
    </div>
  );
};

export { ToggleRadioGroup };
