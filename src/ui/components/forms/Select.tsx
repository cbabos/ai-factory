import React, {
  useState,
  useRef,
  useEffect,
  SelectHTMLAttributes,
} from 'react';

export interface OptionProps {
  value: string;
  label: string;
  disabled?: boolean;
  icon?: React.ReactNode;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  /**
   * Label text displayed above select
   */
  label?: string;
  
  /**
   * Helper text displayed below select
   */
  helpText?: string;
  
  /**
   * Error message to display
   */
  error?: string;
  
  /**
   * Options for the select
   */
  options?: OptionProps[];
  
  /**
   * Icon before select
   */
  startIcon?: React.ReactNode;
  
  /**
   * Show cyrillic dropdown arrow
   */
  cyrillicArrow?: boolean;
  
  /**
   * Cyberpunk animated border
   */
  cyberBorder?: boolean;
  
  /**
   * Show glitch effect
   */
  glitchEffect?: boolean;
  
  /**
   * Size
   */
  size?: 'sm' | 'md' | 'lg';
  
  /**
   * Variant
   */
  variant?: 'outline' | 'filled' | 'cyber';
}

/**
 * Cyberpunk-themed select component with custom dropdown
 */
const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      helpText,
      error,
      options = [],
      startIcon,
      cyrillicArrow = true,
      cyberBorder,
      glitchEffect,
      size = 'md',
      variant = 'outline',
      ...props
    }
  ) => {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedValue, setSelectedValue] = useState<string | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const selectRef = useRef<HTMLSelectElement>(null);

    // Handle click outside to close dropdown
    useEffect(() => {
      function handleClickOutside(event: MouseEvent) {
        if (
          dropdownRef.current &&
          !dropdownRef.current.contains(event.target as Node)
        ) {
          setIsOpen(false);
        }
      }

      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Handle value changes
    const handleSelectChange = (value: string) => {
      setSelectedValue(value);
      setIsOpen(false);
      
      // Dispatch custom event for outer handling
      if (selectRef.current) {
        const event = new Event('change', { bubbles: true });
        void selectRef.current.dispatchEvent(event);
      }
    };

    const selectedOption = options.find((opt) => opt.value === selectedValue);
    const placeholderOption = options.find((opt) => opt.value === '');

    // Size styles
    const sizeClasses = {
      sm: 'py-2 text-sm',
      md: 'py-3 text-sm',
      lg: 'py-4 text-base',
    };

    // Variant styles
    const variantClasses = {
      outline: 'bg-panel border-accent-primary/50 focus:border-accent-primary focus:shadow-[0_0_6px_rgba(0,243,255,0.4)]',
      filled: 'bg-accent-primary/10 border-accent-primary/30 focus:border-accent-primary focus:shadow-[0_0_8px_rgba(0,243,255,0.5)]',
      cyber: 'bg-[linear-gradient(135deg,theme(colors.bg.panel),theme(colors.bg.primary))] border-accent-primary/40 shadow-[0_0_8px_rgba(0,243,255,0.2)] rounded-cyber',
    };

    // Arrow icon
    const ArrowIcon = () => (
      <svg
        className="w-4 h-4 transition-transform duration-200"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        style={{
          transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
        }}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M19 9l-7 7-7-7"
        />
      </svg>
    );

    // Cyrillic arrow variant
    const CyrillicArrow = () => (
      <div
        className="text-accent-primary text-lg leading-none"
        aria-hidden="true"
      >
        ⌠
      </div>
    );

    return (
      <div className="flex flex-col gap-1.5" ref={dropdownRef}>
        {label && (
          <label className="text-xs font-medium text-text-primary tracking-wider uppercase">
            {label}
          </label>
        )}

        <div
          className={`
            relative w-full
            ${glitchEffect ? 'animate-[glitch-text_3s_infinite]' : ''}
          `}
        >
          {/* Selected value display */}
          <div
            className={`
              flex items-center gap-2 cursor-pointer
              ${variantClasses[variant]}
              ${sizeClasses[size]}
              rounded-cyber
              border
              transition-all duration-200 ease-[cubic-bezier(0.68,-0.55,0.27,1.55)]
            `}
            onClick={() => setIsOpen(!isOpen)}
            role="button"
            aria-haspopup="listbox"
            aria-expanded={isOpen}
            aria-controls="select-dropdown"
          >
            {/* Start icon */}
            {startIcon && (
              <span className="text-accent-primary/70">{startIcon}</span>
            )}

            {/* Selected value */}
            <span className="flex-1 truncate">
              {selectedOption?.icon && (
                <span className="mr-2 inline-block align-middle">
                  {selectedOption.icon}
                </span>
              )}
              {selectedOption?.label ||
                placeholderOption?.label ||
                'Select an option...'}
            </span>

            {/* Arrow icon */}
            <span className="ml-2 text-accent-primary">
              {cyrillicArrow ? <CyrillicArrow /> : <ArrowIcon />}
            </span>
          </div>

          {/* Hidden native select for form submission */}
          <select
            ref={selectRef}
            className="hidden"
            value={selectedValue || ''}
            onChange={(e) => handleSelectChange(e.target.value)}
            {...props}
          />

          {/* Cyberpunk glow effect */}
          {cyberBorder && (
            <div className="absolute inset-0 rounded-cyber border-2 border-accent-primary/20 pointer-events-none animate-[border-pulse_2s_infinite]" />
          )}

          {/* Dropdown list */}
          {isOpen && (
            <ul
              id="select-dropdown"
              className={`
                absolute z-50 w-full mt-1.5 max-h-60 overflow-y-auto
                bg-panel border border-accent-secondary/50
                rounded-cyber shadow-[0_0_20px_rgba(0,0,0,0.8)]
                animate-[slide-down_200ms_ease-out]
              `}
              role="listbox"
            >
              {options.map((option) => (
                <li
                  key={option.value}
                  role="option"
                  aria-selected={selectedValue === option.value}
                  aria-disabled={option.disabled}
                  onClick={() => !option.disabled && handleSelectChange(option.value)}
                  className={`
                    flex items-center gap-3 px-4 py-3
                    cursor-pointer transition-all duration-150
                    ${option.disabled
                      ? 'opacity-50 cursor-not-allowed'
                      : 'hover:bg-accent-primary/10 hover:text-accent-primary focus:bg-accent-primary/20'}
                    ${selectedValue === option.value
                      ? 'bg-accent-primary/10 border-l-4 border-accent-primary'
                      : ''}
                  `}
                >
                  {option.icon && (
                    <span className="text-accent-primary/80">{option.icon}</span>
                  )}
                  <span
                    className={`
                      ${selectedValue === option.value ? 'font-semibold' : 'font-normal'}
                      ${option.disabled ? 'text-text-muted' : 'text-text-primary'}
                    `}
                  >
                    {option.label}
                  </span>
                </li>
              ))}

              {/* Empty state */}
              {options.length === 0 && (
                <li className="px-4 py-8 text-center text-text-muted">
                  No options available
                </li>
              )}
            </ul>
          )}
        </div>

        {/* Helper text */}
        {helpText && !error && (
          <span className="text-xs text-text-secondary flex items-center gap-1">
            <span className="text-accent-info">ℹ</span> {helpText}
          </span>
        )}

        {/* Error message */}
        {error && (
          <span
            className="text-xs font-medium text-accent-danger flex items-center gap-1"
            role="alert"
          >
            <span className="text-lg">⚠</span> {error}
          </span>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';

export { Select };
