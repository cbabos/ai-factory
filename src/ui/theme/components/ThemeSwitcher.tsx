import React from 'react';
import { useTheme } from '../hooks/useTheme.js';

export interface ThemeSwitcherProps {
  showLabel?: boolean;
  className?: string;
}

export const ThemeSwitcher: React.FC<ThemeSwitcherProps> = ({
  showLabel = false,
  className = '',
}) => {
  const { currentTheme, setTheme, themeOptions } = useTheme();
  const [isOpen, setIsOpen] = React.useState(false);

  const toggleOpen = (): void => {
    setIsOpen(!isOpen);
  };

  const close = (): void => {
    setIsOpen(false);
  };

  const handleThemeChange = (themeId: string): void => {
    setTheme(themeId as any);
    close();
  };

  const themeLabels: Record<string, { icon: string; label: string }> = {
    synthwave84: { icon: '⚡', label: 'Synthwave' },
    tokyonight: { icon: '🌙', label: 'Tokyo Night' },
    zenburn: { icon: '🕯️', label: 'Zenburn' },
  };

  const currentLabel = themeLabels[currentTheme.id] || { icon: '❓', label: currentTheme.id };

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={toggleOpen}
        className={`
          flex items-center gap-2
          px-3 py-2
          bg-panel
          border border-accent-primary/20
          rounded-lg
          shadow-[0_0_6px_rgba(0,243,255,0.2)]
          transition-all duration-200
          active:scale-95
        `}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="text-lg">{currentLabel.icon}</span>
        {showLabel && (
          <span className="text-sm font-medium text-text-primary">
            {currentLabel.label}
          </span>
        )}
        <svg
          className={`
            w-4 h-4 transition-transform duration-200
            ${isOpen ? 'rotate-180' : ''}
          `}
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
      </button>

      {isOpen && (
        <div
          className="absolute z-50 w-48 mt-2
            bg-panel border border-accent-secondary/50
            rounded-lg shadow-[0_0_20px_rgba(0,0,0,0.8)]
            animate-[slide-down_200ms_ease-out]
          "
          role="listbox"
        >
          {themeOptions.map((theme) => {
            const isSelected = theme.id === currentTheme.id;
            const label = themeLabels[theme.id] || { icon: '❓', label: theme.id };
            return (
              <div
                key={theme.id}
                role="option"
                aria-selected={isSelected}
                onClick={() => handleThemeChange(theme.id)}
                className={`
                  flex items-center gap-3 px-4 py-3
                  cursor-pointer transition-all duration-150
                  ${isSelected
                    ? 'bg-accent-primary/10 border-l-4 border-accent-primary'
                    : 'hover:bg-accent-primary/5 hover:text-accent-primary'}
                `}
              >
                <span className="text-lg">{label.icon}</span>
                <span
                  className={`
                    ${isSelected ? 'font-semibold text-accent-primary' : 'text-text-primary'}
                  `}
                >
                  {label.label}
                </span>
                {isSelected && (
                  <span className="ml-auto text-lg">✓</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
