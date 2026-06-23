import React, { forwardRef } from 'react';

export interface ToggleCheckboxProps {
  /**
   * Is checkbox checked
   */
  checked: boolean;
  
  /**
   * Callback for change events
   */
  onChange?: (checked: boolean) => void;
  
  /**
   * Checkbox label
   */
  label?: string;
  
  /**
   * Description text
   */
  description?: string;
  
  /**
   * Disabled state
   */
  disabled?: boolean;
  
  /**
   * Cyberpunk style
   */
  cyber?: boolean;
  
  /**
   * Custom checkbox icon
   */
  icon?: React.ReactNode;
  
  /**
   * Checkbox size
   */
  size?: 'sm' | 'md' | 'lg';
  
  /**
   * Type
   */
  type?: 'checkbox';
  
  /**
   * CSS class name
   */
  className?: string;
}

export interface ToggleCheckboxGroupProps {
  /**
   * Selected values
   */
  value?: string[];
  
  /**
   * Callback for value changes
   */
  onChange?: (values: string[]) => void;
  
  /**
   * Checkbox options
   */
  options: CheckboxOptionProps[];
  
  /**
   * Label
   */
   label?: string;
   
  /**
   * CSS class name
   */
   className?: string;
  
  /**
   * Max selections
   */
  max?: number;
  
  /**
   * Direction
   */
  direction?: 'vertical' | 'horizontal';
  
  /**
   * Cyberpunk style
   */
  cyber?: boolean;
  
  /**
   * Disabled state
   */
  disabled?: boolean;
}

export interface CheckboxOptionProps {
  value: string;
  label: string;
  disabled?: boolean;
  description?: string;
  cyber?: boolean;
}

/**
 * Cyberpunk toggle checkbox component
 */
const ToggleCheckbox = forwardRef<HTMLInputElement, ToggleCheckboxProps>(
  (
    {
      checked,
      onChange,
      label,
      description,
      disabled,
      cyber,
      size = 'md',
      type = 'checkbox',
      className,
      ...props
    },
    ref
  ) => {
    const handleToggle = () => {
      if (!disabled) {
        onChange?.(!checked);
      }
    };

    // Size classes
    const sizeClasses = {
      sm: 'w-4 h-4',
      md: 'w-5 h-5',
      lg: 'w-6 h-6',
    };

    // Cyber option classes
    const cyberClasses = cyber
      ? `
        rounded-cyber
        bg-[linear-gradient(135deg,theme(colors.bg.panel),theme(colors.bg.secondary))]
        shadow-[0_0_6px_rgba(0,243,255,0.2)]
        hover:shadow-[0_0_8px_rgba(0,243,255,0.3)]
      `
      : '';

    // Base container classes
    const containerClasses = `
      relative flex items-start gap-3
      cursor-pointer transition-all duration-200 ease-[cubic-bezier(0.68,-0.55,0.27,1.55)]
      disabled:opacity-50 disabled:cursor-not-allowed
      hover:bg-accent-primary/5
      ${cyberClasses}
      ${className || ''}
    `;

    // Checkbox box classes
    const checkboxClasses = `
      relative flex items-center justify-center
      ${sizeClasses[size]}
      border-2 rounded-cyber transition-all duration-200
      ${checked
        ? 'border-accent-primary bg-accent-primary/20'
        : 'border-accent-primary/30'}
      disabled:opacity-50
    `;

    // Checked checkbox styles
    const checkedClasses = '';

    // Checkmark style
    const Checkmark: React.FC<{ checked: boolean }> = ({ checked }) => (
      <div
        className={`
          absolute w-2.5 h-4
          border-r-2 border-b-2 border-black
          rotate-45 -ml-1.5 -mt-1
          transition-all duration-200
          ${checked ? 'opacity-100' : 'opacity-0'}
        `}
      />
    );

    return (
      <div
        className={containerClasses}
        onClick={handleToggle}
        role="checkbox"
        aria-checked={checked}
        aria-label={label}
        aria-disabled={disabled}
        {...props}
      >
        <input
          ref={ref}
          type={type}
          checked={checked}
          disabled={disabled}
          onChange={() => handleToggle()}
          className="hidden"
          {...props}
        />

        {/* Checkbox box */}
        <div className={checkboxClasses}>
          <Checkmark checked={checked} />
        </div>

        {/* Content */}
        <div className="flex flex-col gap-1">
          <span
            className={`
              text-sm font-medium transition-colors duration-200
              ${checked ? 'text-accent-primary' : 'text-text-primary'}
            `}
          >
            {label}
          </span>

          {description && (
            <span className="text-xs text-text-secondary">
              {description}
            </span>
          )}
        </div>

        {/* Cyber glow effect */}
        {cyber && checked && (
          <div
            className="absolute inset-0 rounded-cyber border border-accent-primary pointer-events-none
              animate-[border-glow_2s_infinite]"
          />
        )}

        {/* Cyber border highlight */}
        {cyber && !checked && (
          <div
            className="absolute inset-0 rounded-cyber border border-accent-primary/30 pointer-events-none"
            style={{ opacity: 0 }}
          />
        )}
      </div>
    );
  }
);

ToggleCheckbox.displayName = 'ToggleCheckbox';

/**
 * Cyberpunk toggle checkbox group component
 */
const ToggleCheckboxGroup: React.FC<ToggleCheckboxGroupProps> = ({
  value = [],
  onChange,
  options,
  label,
  max,
  direction = 'vertical',
  cyber = false,
  disabled = false,
  className,
}) => {
  const handleToggle = (optionValue: string) => {
    if (disabled) return;

    const newValue = value.includes(optionValue)
      ? value.filter((v) => v !== optionValue)
      : [...value, optionValue];

    // Check max constraint
    if (max && newValue.length > max) {
      return;
    }

    onChange?.(newValue);
  };

  const directionClasses = {
    vertical: 'flex flex-col gap-3',
    horizontal: 'flex flex-row gap-4',
  };

  return (
    <div
      className={`
        ${directionClasses[direction]}
        ${cyber ? 'animate-[border-glow_2s_infinite]' : ''}
        ${className || ''}
      `}
      role="group"
      aria-label={label}
    >
      {options.map((option) => {
        const isSelected = value.includes(option.value);
        return (
          <ToggleCheckbox
            key={option.value}
            checked={isSelected}
            onChange={() => handleToggle(option.value)}
            label={option.label}
            description={option.description}
            disabled={option.disabled || disabled}
            cyber={option.cyber || cyber}
          />
        );
      })}
    </div>
  );
};

export { ToggleCheckbox, ToggleCheckboxGroup };
