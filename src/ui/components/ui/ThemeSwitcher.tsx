import React, {forwardRef, useState, useEffect} from 'react';

export interface ThemeSwitcherProps {
  /**
   * Current theme
   */
  currentTheme?: string;
  
  /**
   * Callback for theme changes
   */
  onChange?: (theme: string) => void;
  
  /**
   * Show label
   */
  showLabel?: boolean;
  
  /**
   * Theme options to show
   */
  availableThemes?: string[];
}

/**
 * Cyberpunk-themed theme switcher component
 */
const ThemeSwitcher: React.FC<ThemeSwitcherProps> = ({
  currentTheme = 'cyberpunk-aether',
  onChange,
  showLabel = false,
  availableThemes = ['cyberpunk-aether', 'dark', 'light', 'system'],
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentLabel, setCurrentLabel] = useState(currentTheme);

  // Update current label when theme changes
  useEffect(() => {
    const labels: Record<string, string> = {
      'cyberpunk-aether': 'Cyber',
      dark: 'Dark',
      light: 'Light',
      system: 'System',
    };
    setCurrentLabel(labels[currentTheme] || currentTheme);
  }, [currentTheme]);

  const toggleOpen = () => setIsOpen(!isOpen);
  const close = () => setIsOpen(false);

  const handleThemeChange = (theme: string) => {
    onChange?.(theme);
    setCurrentLabel(theme);
    close();
  };

  // Theme options with icons
  const themeOptions = [
    { value: 'cyberpunk-aether', label: 'Cyber', icon: '⚡' },
    { value: 'dark', label: 'Dark', icon: '🌑' },
    { value: 'light', label: 'Light', icon: '☀️' },
    { value: 'system', label: 'System', icon: '💻' },
  ].filter((t) => availableThemes.includes(t.value));

  return (
    <div className="relative">
      {/* Main toggle button */}
      <button
        type="button"
        onClick={toggleOpen}
        className={`
          flex items-center gap-2
          px-3 py-2
          bg-panel
          border border-accent-primary/20
          rounded-cyber
          shadow-[0_0_6px_rgba(0,243,255,0.2)]
          transition-all duration-200
          active:scale-95
        `}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        {/* Current theme icon */}
        <span className="text-lg">{currentLabel}</span>
        
        {showLabel && (
          <span className="text-sm font-medium">{currentLabel}</span>
        )}

        {/* Chevron icon */}
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

      {/* Dropdown menu */}
      {isOpen && (
        <div
          className="absolute z-50 w-48 mt-2
            bg-panel border border-accent-secondary/50
            rounded-cyber shadow-[0_0_20px_rgba(0,0,0,0.8)]
            animate-[slide-down_200ms_ease-out]
          "
          role="listbox"
        >
          {themeOptions.map((theme, index) => {
            const isSelected = currentLabel === theme.label;
            return (
              <div
                key={theme.value}
                role="option"
                aria-selected={isSelected}
                onClick={() => handleThemeChange(theme.value)}
                className={`
                  flex items-center gap-3 px-4 py-3
                  cursor-pointer transition-all duration-150
                  ${isSelected
                    ? 'bg-accent-primary/10 border-l-4 border-accent-primary'
                    : 'hover:bg-accent-primary/5 hover:text-accent-primary'}
                `}
              >
                <span className="text-lg">{theme.icon}</span>
                <span
                  className={`
                    ${isSelected ? 'font-semibold text-accent-primary' : 'text-text-primary'}
                  `}
                >
                  {theme.label}
                </span>
                {isSelected && (
                  <span className="ml-auto text-lg">
                    ✓
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export { ThemeSwitcher };
