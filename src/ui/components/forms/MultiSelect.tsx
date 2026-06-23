import React, {
  MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

export interface MultiSelectOptionProps {
  value: string;
  label: string;
  disabled?: boolean;
  icon?: React.ReactNode;
  badgeColor?: string;
}

export interface MultiSelectProps {
  /**
   * Label text displayed above multiselect
   */
  label?: string;
  
  /**
   * Helper text displayed below multiselect
   */
  helpText?: string;
  
  /**
   * Error message to display
   */
  error?: string;
  
  /**
   * Selected values
   */
  value: string[];
  
  /**
   * Callback for value changes
   */
  onChange?: (values: string[]) => void;
  
  /**
   * Available options
   */
  options: MultiSelectOptionProps[];
  
  /**
   * Maximum selected items
   */
  maxItems?: number;
  
  /**
   * Show search input
   */
  searchable?: boolean;
  
  /**
   * Filter options
   */
  filter?: (options: MultiSelectOptionProps[], search: string) => MultiSelectOptionProps[];
  
  /**
   * Placeholder text
   */
  placeholder?: string;
  
  /**
   * Clear button visibility
   */
  clearable?: boolean;
  
  /**
   * Cyberpunk border style
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
 * Cyberpunk-themed multi-select component
 */
const MultiSelect: React.FC<MultiSelectProps> = ({
  label,
  helpText,
  error,
  value = [],
  onChange,
  options,
  maxItems,
  searchable = false,
  filter,
  placeholder = 'Select options...',
  clearable = true,
  cyberBorder,
  glitchEffect,
  size = 'md',
  variant = 'outline',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Handle click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent | KeyboardEvent) {
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

  // Filter options based on search
  const filteredOptions = useCallback(() => {
    let filtered = options;

    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(
        (opt) =>
          opt.label.toLowerCase().includes(searchLower) ||
          opt.value.toLowerCase().includes(searchLower)
      );
    }

    // If filter function provided, use it
    if (filter) {
      filtered = filter(filtered, search);
    }

    return filtered;
  }, [options, search, filter]);

  // Handle selection change
   const handleSelectChange = (option: MultiSelectOptionProps) => {
    if (option.disabled) return;

    const newValue = value.includes(option.value)
      ? value.filter((v) => v !== option.value)
      : [...value, option.value];

    // Check maxItems constraint
    if (maxItems && newValue.length > maxItems) {
      return;
    }

    onChange?.(newValue);
  };

  // Handle clear all
  const handleClearAll = (e: ReactMouseEvent) => {
    e.stopPropagation();
    onChange?.([]);
  };

  // Handle clear single
  const handleClearSingle = (valueToRemove: string, e: ReactMouseEvent) => {
    e.stopPropagation();
    onChange?.(value.filter((v) => v !== valueToRemove));
  };

  // Handle input focus
  const handleInputFocus = () => {
    setIsOpen(true);
    inputRef.current?.focus();
  };

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

  return (
    <div
      className="flex flex-col gap-1.5"
      ref={dropdownRef}
    >
      {label && (
        <label className="text-xs font-medium text-text-primary tracking-wider uppercase">
          {label}
        </label>
      )}

      <div
        className={`
          relative w-full cursor-pointer
          ${variantClasses[variant]}
          ${sizeClasses[size]}
          rounded-cyber border
          transition-all duration-200 ease-[cubic-bezier(0.68,-0.55,0.27,1.55)]
          ${glitchEffect ? 'animate-[glitch-text_3s_infinite]' : ''}
        `}
        onClick={() => setIsOpen(!isOpen)}
        role="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls="multiselect-dropdown"
      >
        {/* Selected items */}
        <div className="flex flex-wrap items-center gap-1.5 px-2 py-1 min-h-[2.5rem]">
          {value.length > 0 ? (
            value.map((itemValue) => {
              const option = options.find((opt) => opt.value === itemValue);
              return (
                <span
                  key={itemValue}
                  className={`
                    inline-flex items-center gap-1
                    bg-accent-primary/20 text-accent-primary
                    border border-accent-primary/30
                    rounded-full px-2 py-1 text-xs
                    transition-all duration-200
                    hover:bg-accent-primary/30
                    hover:border-accent-primary/50
                    active:scale-95
                    ${option?.badgeColor
                      ? `bg-[${option.badgeColor}] text-white border-[${option.badgeColor}]`
                      : ''}
                  `}
                >
                  {option?.icon && (
                    <span className="text-xs">{option.icon}</span>
                  )}
                  <span className="font-medium">{option?.label || itemValue}</span>
                  {clearable && (
                    <button
                      type="button"
                      onClick={(e) => handleClearSingle(itemValue, e)}
                      className="ml-1 hover:text-accent-danger focus:outline-none"
                      aria-label={`Remove ${option?.label || itemValue}`}
                    >
                      <svg
                        className="w-3 h-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  )}
                </span>
              );
            })
          ) : (
            <span className="text-text-muted truncate flex-1">
              {placeholder}
            </span>
          )}

          {/* Search input (visible when opened) */}
          {searchable && isOpen && (
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setIsOpen(false);
                  setSearch('');
                }
              }}
              className="flex-1 bg-transparent border-none focus:ring-0 text-sm px-2 py-1 placeholder:text-text-muted/50"
              placeholder="Search..."
              onClick={(e) => e.stopPropagation()}
            />
          )}
        </div>

        {/* Chevron icon */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-accent-primary">
          <svg
            className="w-4 h-4 transition-transform duration-200"
            style={{
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>

        {/* Clear all button */}
        {value.length > 0 && clearable && (
          <button
            type="button"
            onClick={handleClearAll}
            className="absolute right-8 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-accent-danger transition-colors"
            aria-label="Clear all selections"
          >
            <svg
              className="w-3 h-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}

        {/* Cyberpunk glow effect */}
        {cyberBorder && (
          <div className="absolute inset-0 rounded-cyber border-2 border-accent-primary/20 pointer-events-none animate-[border-pulse_2s_infinite]" />
        )}
      </div>

      {/* Dropdown list */}
      {isOpen && (
        <ul
          id="multiselect-dropdown"
          className={`
            absolute z-50 w-full mt-1.5 max-h-80 overflow-y-auto
            bg-panel border border-accent-secondary/50
            rounded-cyber shadow-[0_0_20px_rgba(0,0,0,0.8)]
            animate-[slide-down_200ms_ease-out]
          `}
          role="listbox"
        >
          {filteredOptions().map((option, index) => {
            const isSelected = value.includes(option.value);
            return (
              <li
                key={option.value}
                role="option"
                aria-selected={isSelected}
                aria-disabled={option.disabled}
                onClick={() => handleSelectChange(option)}
                className={`
                  flex items-center gap-3 px-4 py-3
                  cursor-pointer transition-all duration-150
                  ${option.disabled
                    ? 'opacity-50 cursor-not-allowed'
                    : 'hover:bg-accent-primary/10 hover:text-accent-primary'}
                  ${isSelected
                    ? 'bg-accent-primary/10 border-l-4 border-accent-primary'
                    : ''}
                `}
              >
                {/* Checkbox */}
                <div
                  className={`
                    flex items-center justify-center w-5 h-5
                    border rounded-cyber
                    ${isSelected
                      ? 'bg-accent-primary border-accent-primary'
                      : 'border-accent-primary/50'}
                  `}
                >
                  {isSelected && (
                    <svg
                      className="w-3 h-3 text-black"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </div>

                {option.icon && (
                  <span className="text-accent-primary/80">{option.icon}</span>
                )}

                <span
                  className={`
                    ${isSelected ? 'font-semibold' : 'font-normal'}
                    ${option.disabled ? 'text-text-muted' : 'text-text-primary'}
                  `}
                >
                  {option.label}
                </span>

                {option.disabled && (
                  <span className="ml-auto text-xs text-text-muted">
                    Unavailable
                  </span>
                )}
              </li>
            );
          })}

          {/* Empty state */}
          {filteredOptions().length === 0 && (
            <li className="px-4 py-8 text-center text-text-muted">
              {search ? 'No matching options found' : 'No options available'}
            </li>
          )}
        </ul>
      )}

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
};

export { MultiSelect };
