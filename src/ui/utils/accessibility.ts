/**
 * Accessibility utilities for UI components
 */

/**
 * Check if text contrast meets WCAG AA requirements
 */
export function meetsWcagContrast(
  foreground: string,
  background: string
): boolean {
  // TODO: Implement contrast calculation
  return true;
}

/**
 * Generate accessible ID for form labels
 */
export function generateAccessibleId(prefix: string = 'ai-form'): string {
  return `${prefix}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Screen reader only styles
 */
export const srOnlyStyle: React.CSSProperties = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: '0',
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: '0',
};

/**
 * Generate aria-label from props
 */
export function getAriaLabel(
  props: { 'aria-label'?: string; label?: string; title?: string } = {}
): string | undefined {
  return props['aria-label'] || props.label || props.title || undefined;
}

/**
 * Generate aria-describedby from helper/error text
 */
export function getAriaDescribedBy(
  helpText?: string,
  error?: string
): string | undefined {
  const elements: string[] = [];
  if (helpText) elements.push('help-text');
  if (error) elements.push('error-text');
  return elements.length > 0 ? elements.join(' ') : undefined;
}

/**
 * Get role based on element type
 */
export function getRole(
  type: string,
  role?: string
): string | undefined {
  if (role) return role;
  
  switch (type) {
    case 'button':
    case 'submit':
    case 'reset':
      return 'button';
    case 'checkbox':
      return 'checkbox';
    case 'radio':
      return 'radio';
    case 'switch':
      return 'switch';
    case 'select':
      return 'combobox';
    case 'input':
      return 'searchbox';
    default:
      return undefined;
  }
}

/**
 * Get aria-invalid based on error state
 */
export function getAriaInvalid(error?: string): boolean | undefined {
  return error ? true : undefined;
}

/**
 * Keyboard navigation helpers
 */
export interface KeyboardNavigation {
  enabled: boolean;
  arrowKeyNavigation?: boolean;
  typeaheadNavigation?: boolean;
  pagination?: boolean;
}

export const defaultKeyboardNavigation: KeyboardNavigation = {
  enabled: true,
  arrowKeyNavigation: true,
  typeaheadNavigation: true,
  pagination: false,
};
