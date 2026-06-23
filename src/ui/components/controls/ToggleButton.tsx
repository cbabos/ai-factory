import React, { forwardRef } from 'react';

export interface ToggleButtonProps {
  /**
   * Is button currently toggled on
   */
  checked?: boolean;
  
  /**
   * Callback for toggle events
   */
  onChange?: (checked: boolean) => void;
  
  /**
   * Label text
   */
  label?: string;
  
  /**
   * Icon for on state
   */
  iconOn?: React.ReactNode;
  
  /**
   * Icon for off state
   */
  iconOff?: React.ReactNode;
  
  /**
   * Cyberpunk border color
   */
  cyberBorder?: boolean;
  
  /**
   * Glitch effect on toggle
   */
  glitchEffect?: boolean;
  
  /**
   * Button size
   */
  size?: 'sm' | 'md' | 'lg';
  
  /**
   * Variant
   */
  variant?: 'default' | 'cyber';
  
  /**
   * Button type
   */
  type?: 'button' | 'submit' | 'reset';
  
  /**
   * Disabled state
   */
  disabled?: boolean;
  
  /**
   * CSS class name
   */
  className?: string;
}

/**
 * Cyberpunk toggle button component (on/off switch style)
 */
const ToggleButton = forwardRef<HTMLButtonElement, ToggleButtonProps>(
  (
    {
      checked,
      onChange,
      label,
      iconOn,
      iconOff,
      cyberBorder,
      glitchEffect,
      size = 'md',
      variant = 'default',
      type = 'button',
      disabled,
      className,
      ...props
    },
    ref
  ) => {
    const toggle = () => {
      if (!disabled) {
        onChange?.(!checked);
      }
    };

    // Size classes
    const sizeClasses = {
      sm: 'px-2 py-1 text-xs',
      md: 'px-3 py-1.5 text-sm',
      lg: 'px-4 py-2 text-base',
    };

    // variant classes
    const variantClasses = {
      default: `
        transition-all duration-200 ease-[cubic-bezier(0.68,-0.55,0.27,1.55)]
      `,
      cyber: `
        bg-[linear-gradient(135deg,theme(colors.bg.panel),theme(colors.bg.secondary))]
        border border-accent-primary/40
        shadow-[0_0_6px_rgba(0,243,255,0.2)]
        rounded-cyber
      `,
    };

    // Checked state (ON)
    const checkedClasses = `
      bg-accent-primary text-black
      border-accent-primary
      shadow-[0_0_8px_rgba(0,243,255,0.5)]
      active:scale-95
    `;

    // Unchecked state (OFF)
    const uncheckedClasses = `
      bg-panel text-text-secondary
      border-accent-primary/30
      active:scale-95
    `;

    // Glitch classes
    const glitchClasses = glitchEffect
      ? 'animate-[glitch-text_3s_infinite]'
      : '';

    return (
      <button
        ref={ref}
        type={type}
        className={`
          relative inline-flex items-center gap-2
          font-semibold tracking-wide
          transition-all duration-200 ease-[cubic-bezier(0.68,-0.55,0.27,1.55)]
          disabled:opacity-50 disabled:cursor-not-allowed
          active:scale-95
          ${sizeClasses[size]}
          ${checked ? checkedClasses : uncheckedClasses}
          ${variantClasses[variant]}
          ${cyberBorder ? 'border-accent-primary' : ''}
          ${glitchClasses}
          ${className || ''}
        `}
        onClick={toggle}
        disabled={disabled}
        role="switch"
        aria-checked={checked}
        aria-label={label}
        {...props}
      >
        {/* Custom checkbox/knob indicator */}
        <div
          className={`
            absolute left-1.5 w-4 h-4 rounded-full
            transition-all duration-200 ease-[cubic-bezier(0.68,-0.55,0.27,1.55)]
            ${checked ? 'translate-x-full' : 'translate-x-0'}
            ${checked ? 'bg-accent-primary shadow-[0_0_6px_rgba(0,243,255,0.6)]' : 'bg-accent-primary/30'}
          `}
        />

        {/* Icons */}
        {iconOn && checked && (
          <span className="text-lg">{iconOn}</span>
        )}
        {iconOff && !checked && (
          <span className="text-lg">{iconOff}</span>
        )}

        {/* Label */}
        {label && (
          <span className={checked ? 'font-bold' : 'font-medium'}>
            {label}
          </span>
        )}

        {/* Checked indicator dot */}
        {checked && size !== 'sm' && (
          <div className="absolute right-1.5 w-2 h-2 bg-black rounded-full shadow-[0_0_4px_rgba(0,0,0,0.5)]" />
        )}
      </button>
    );
  }
);

ToggleButton.displayName = 'ToggleButton';

export { ToggleButton };
