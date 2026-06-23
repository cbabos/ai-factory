import React from 'react';

export interface StatusIndicatorProps {
  /**
   * Status type
   */
  status: 'online' | 'offline' | 'warning' | 'error' | 'busy' | 'idle';
  
  /**
   * Show status text
   */
  showLabel?: boolean;
  
  /**
   * Status text to display
   */
  label?: string;
  
  /**
   * Animation speed (fast, normal, slow)
   */
  animationSpeed?: 'fast' | 'normal' | 'slow';
  
  /**
   * Size
   */
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Cyberpunk-themed status indicator component
 */
const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  showLabel = false,
  label,
  animationSpeed = 'normal',
  size = 'md',
}) => {
  // Status colors
  const statusColors = {
    online: 'bg-accent-tertiary',
    offline: 'bg-accent-danger',
    warning: 'bg-accent-warning',
    error: 'bg-accent-danger',
    busy: 'bg-accent-secondary',
    idle: 'bg-accent-primary',
  };

  // Status labels
  const statusLabels = {
    online: { label: 'ONLINE', text: 'text-accent-tertiary' },
    offline: { label: 'OFFLINE', text: 'text-accent-danger' },
    warning: { label: 'WARNING', text: 'text-accent-warning' },
    error: { label: 'ERROR', text: 'text-accent-danger' },
    busy: { label: 'BUSY', text: 'text-accent-secondary' },
    idle: { label: 'IDLE', text: 'text-accent-primary' },
  };

  // Size classes
  const sizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-6 h-6',
  };

  // Animation durations
  const animationDurations = {
    fast: '500ms',
    normal: '1500ms',
    slow: '3000ms',
  };

  // Blink animation class
  const blinkClass = `animate-[neon-pulse_${animationDurations[animationSpeed]}_infinite]`;

  return (
    <div
      className="flex items-center gap-2"
      role="status"
      aria-live="polite"
    >
      {/* Status indicator dot */}
      <div
        className={`
          rounded-full
          ${statusColors[status]}
          ${blinkClass}
          ${sizeClasses[size]}
        `}
      />

      {/* Status label */}
      {showLabel && (
        <span
          className={`
            text-xs font-bold tracking-wide
            ${statusLabels[status].text}
            ${animationSpeed === 'fast' ? 'animate-[glitch-text_3s_infinite]' : ''}
          `}
        >
          {label || statusLabels[status].label}
        </span>
      )}
    </div>
  );
};

export { StatusIndicator };
