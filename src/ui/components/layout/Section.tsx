import React, { forwardRef } from 'react';

export interface SectionProps {
  /**
   * Section title
   */
  title?: React.ReactNode;
  
  /**
   * Section subtitle
   */
  subtitle?: React.ReactNode;
  
  /**
   * Section content
   */
  children?: React.ReactNode;
  
  /**
   * Section actions
   */
  actions?: React.ReactNode[];
  
  /**
   * Background variant
   */
  bg?: 'default' | 'panel' | 'card' | 'cyber';
  
  /**
   * Padding variant
   */
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
  
  /**
   * Cyberpunk style
   */
  cyber?: boolean;
  
  /**
   * Section border
   */
  border?: 'none' | 'top' | 'bottom' | 'all' | 'cyber';
  
  /**
   * Section divider
   */
  divider?: boolean;
  
  /**
   * Animation
   */
  animation?: 'none' | 'fade' | 'slide' | 'glitch';
  
  /**
   * CSS class name
   */
  className?: string;
}

export interface SectionGroupProps {
  /**
   * Sections to render
   */
  sections: SectionProps[];
  
  /**
   * Card content variant
   */
  contentVariant?: 'default' | 'cyber' | 'minimal';
  
  /**
   * Section gap
   */
  gap?: 'sm' | 'md' | 'lg' | 'xl';
}

/**
 * Cyberpunk-themed section component
 */
const Section = forwardRef<HTMLElement, SectionProps>(
  (
    {
      title,
      subtitle,
      children,
      actions = [],
      bg = 'default',
      padding = 'md',
      cyber = false,
      border = 'none',
      divider = false,
      animation = 'fade',
      className,
      ...props
    },
    ref
  ) => {
    // Background classes
    const bgClasses = {
      default: 'bg-panel',
      panel: 'bg-panel',
      card: 'bg-card rounded-cyber p-6',
      cyber: `
        bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNCIgaGVpZ2h0PSI0IiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IiMwNTA1MDgiLz48L3N2Zz4=')] bg-[length:4px_4px]
        shadow-[0_0_20px_rgba(0,243,255,0.1)]
      `,
    };

    // Padding classes
    const paddingClasses = {
      none: '',
      sm: 'py-4 px-6',
      md: 'py-6 px-8',
      lg: 'py-8 px-10',
      xl: 'py-10 px-12',
      '2xl': 'py-12 px-14',
      '3xl': 'py-16 px-16',
    };

    // Border classes
    const borderClasses = {
      none: '',
      top: 'border-t border-accent-primary/20',
      bottom: 'border-b border-accent-primary/20',
      all: 'border border-accent-primary/20 rounded-cyber',
      cyber: `
        border-t border-accent-primary/30
        shadow-[0_-1px_0_rgba(0,243,255,0.2)]
      `,
    };

    // Animation classes
    const animationClasses = {
      none: '',
      fade: 'animate-[fade-in_500ms_ease-out]',
      slide: 'animate-[slide-up_500ms_ease-out]',
      glitch: 'animate-[glitch-overlay_5s_infinite]',
    };

    // Cyber section border
    const cyberSection = cyber
      ? 'animate-[border-glow_2s_infinite]'
      : '';

    return (
      <section
        ref={ref}
        className={`
          flex flex-col gap-4
          ${bgClasses[bg]}
          ${paddingClasses[padding]}
          ${borderClasses[border]}
          ${animationClasses[animation]}
          ${cyberSection}
          ${divider ? 'border-accent-primary/10' : ''}
          ${className || ''}
        `}
        {...props}
      >
        {/* Header */}
        {(title || subtitle || actions.length > 0) && (
          <div
            className={`
              flex items-center justify-between gap-4
            `}
          >
            <div className="flex flex-col gap-1">
              {title && (
                <h2
                  className={`
                    text-xl font-bold tracking-wide
                    ${cyber ? 'text-accent-primary' : 'text-text-primary'}
                  `}
                >
                  {title}
                </h2>
              )}
              {subtitle && (
                <span
                  className={`
                    text-sm text-text-secondary
                    ${cyber ? 'text-accent-secondary' : ''}
                  `}
                >
                  {subtitle}
                </span>
              )}
            </div>

            {/* Actions */}
            {actions.length > 0 && (
              <div className="flex items-center gap-2">
                {actions.map((action, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-center"
                  >
                    {action}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Divider */}
        {divider && (
          <div
            className={`
              w-full h-px
              bg-gradient-to-r from-transparent via-accent-primary to-transparent
              ${cyber ? 'shadow-[0_0_8px_rgba(0,243,255,0.5)]' : ''}
            `}
          />
        )}

        {/* Content */}
        <div className="flex-1">
          {children}
        </div>
      </section>
    );
  }
);

Section.displayName = 'Section';

/**
 * Section group with consistent styling
 */
const SectionGroup: React.FC<SectionGroupProps> = ({
  sections,
  contentVariant = 'default',
  gap = 'md',
}) => {
  const gapClasses = {
    sm: 'gap-4',
    md: 'gap-6',
    lg: 'gap-8',
    xl: 'gap-10',
  };

  return (
    <div
      className={`
        flex flex-col
        ${gapClasses[gap]}
      `}
    >
      {sections.map((section, index) => (
        <Section
          key={index}
          {...section}
          cyber={contentVariant === 'cyber'}
        />
      ))}
    </div>
  );
};

export { Section, SectionGroup };
