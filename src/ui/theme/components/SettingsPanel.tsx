import React from 'react';
import { useTheme } from '../hooks/useTheme.js';
import type { Theme } from '../types.js';

export interface SettingsPanelProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  className?: string;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  title,
  subtitle,
  className = '',
}) => {
  const { currentTheme, setTheme, themeOptions } = useTheme();
  const [isExpanded, setIsExpanded] = React.useState(true);

  const themeLabels: Record<string, { icon: string; label: string }> = {
    synthwave84: { icon: '⚡', label: 'Synthwave 84' },
    tokyonight: { icon: '🌙', label: 'Tokyo Night' },
    zenburn: { icon: '🕯️', label: 'Zenburn' },
  };

  const handleSubmit = (event: React.FormEvent): void => {
    event.preventDefault();
  };

  return (
    <div
      className={`
        flex flex-col
        bg-panel
        border border-accent-primary/30
        rounded-lg
        overflow-hidden
        shadow-[0_0_20px_rgba(0,243,255,0.1)]
        ${className}
      `}
    >
      <div
        className={`
          px-6 py-4
          bg-accent-primary/5
          border-b border-accent-primary/20
          flex justify-between items-center
          cursor-pointer
        `}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex flex-col">
          {title && (
            <h3 className="text-lg font-semibold text-accent-primary tracking-wide">
              {title}
            </h3>
          )}
          {subtitle && (
            <p className="text-xs text-text-secondary mt-1">{subtitle}</p>
          )}
        </div>
        <div
          className={`
            text-accent-primary transition-transform duration-300
            ${isExpanded ? 'rotate-180' : ''}
          `}
        >
          <svg
            className="w-5 h-5"
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
      </div>

      {isExpanded && (
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="space-y-4">
            <label className="block text-sm font-medium text-text-primary">
              Theme Selection
            </label>
            <div className="grid grid-cols-1 gap-3">
              {themeOptions.map((theme: Theme) => {
                const isSelected = theme.id === currentTheme.id;
                const label = themeLabels[theme.id] || { icon: '❓', label: theme.id };
                return (
                  <div
                    key={theme.id}
                    onClick={() => setTheme(theme.id)}
                    className={`
                      cursor-pointer transition-all duration-150
                      ${isSelected
                        ? 'bg-accent-primary/10 border border-accent-primary/50 ring-2 ring-accent-primary/30'
                        : 'bg-panel border border-accent-primary/20 hover:border-accent-primary/50'}
                      rounded-lg p-4 flex items-center gap-4
                    `}
                  >
                    <div
                      className={`
                        flex-shrink-0 w-10 h-10 rounded-full
                        flex items-center justify-center
                        ${isSelected
                          ? 'bg-accent-primary/20'
                          : 'bg-panel'}
                      `}
                    >
                      <span className="text-xl">{label.icon}</span>
                    </div>
                    <div className="flex-1">
                      <div
                        className={`
                          font-semibold
                          ${isSelected
                            ? 'text-accent-primary'
                            : 'text-text-primary'}
                        `}
                      >
                        {label.label}
                      </div>
                      <div className="text-xs text-text-secondary mt-1">
                        {theme.description}
                      </div>
                    </div>
                    <div
                      className={`
                        w-5 h-5 rounded-full border
                        flex items-center justify-center
                        ${isSelected
                          ? 'bg-accent-primary border-accent-primary'
                          : 'border-accent-primary/30'}
                      `}
                    >
                      {isSelected && (
                        <div className="w-2 h-2 bg-white rounded-full" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-4 border-t border-accent-primary/20">
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-secondary">
                Current theme preview
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-primary">
                  {themeLabels[currentTheme.id]?.label}
                </span>
                <div
                  className={`
                    w-3 h-3 rounded-full
                    ${currentTheme.id === 'synthwave84' ? 'bg-[#00f3ff]' : ''}
                    ${currentTheme.id === 'tokyonight' ? 'bg-[#7aa2f7]' : ''}
                    ${currentTheme.id === 'zenburn' ? 'bg-[#dcdccc]' : ''}
                  `}
                />
              </div>
            </div>
          </div>
        </form>
      )}
    </div>
  );
};
