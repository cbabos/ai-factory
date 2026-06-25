/**
 * Color utilities for cyberpunk theme
 */

/**
 * Convert hex to RGB
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) {
    throw new Error(`Invalid hex color: ${hex}`);
  }
  return {
    r: result[1] !== undefined ? parseInt(result[1], 16) : 0,
    g: result[2] !== undefined ? parseInt(result[2], 16) : 0,
    b: result[3] !== undefined ? parseInt(result[3], 16) : 0,
  };
}

/**
 * Convert RGB to hex
 */
export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((x) => {
    const hex = x.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

/**
 * Darken hex color
 */
export function darkenColor(
  hex: string,
  amount: number
): string {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(
    Math.max(0, r - Math.round(255 * amount)),
    Math.max(0, g - Math.round(255 * amount)),
    Math.max(0, b - Math.round(255 * amount))
  );
}

/**
 * Lighten hex color
 */
export function lightenColor(
  hex: string,
  amount: number
): string {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(
    Math.min(255, r + Math.round(255 * amount)),
    Math.min(255, g + Math.round(255 * amount)),
    Math.min(255, b + Math.round(255 * amount))
  );
}

/**
 * Generate cyberpunk color palette
 */
export interface CyberpunkPalette {
  primary: string;
  primaryDark: string;
  primaryLight: string;
  secondary: string;
  secondaryDark: string;
  secondaryLight: string;
  accent: string;
  warning: string;
  danger: string;
  success: string;
  info: string;
  background: string;
  surface: string;
  text: string;
  textMuted: string;
}

export const getBasePalette = (): CyberpunkPalette => ({
  primary: '#00f3ff',
  primaryDark: '#00b3c2',
  primaryLight: '#33ffdd',
  secondary: '#ff00ff',
  secondaryDark: '#cc00cc',
  secondaryLight: '#ff33ff',
  accent: '#39ff14',
  warning: '#ffd700',
  danger: '#ff3131',
  success: '#39ff14',
  info: '#5e5ce6',
  background: '#050508',
  surface: '#0e0e15',
  text: '#e0e0e0',
  textMuted: '#707070',
});

export const getHighContrastPalette = (): CyberpunkPalette => ({
  ...getBasePalette(),
  primary: '#00f3ff',
  primaryDark: '#008a9e',
  primaryLight: '#66ffef',
  danger: '#ff0000',
  warning: '#ffff00',
});

/**
 * Check color visibility on background
 */
export function checkContrast(
  foreground: string,
  background: string
): 'visible' | 'warning' | 'invisible' {
  // Simplified contrast check
  const fgRgb = hexToRgb(foreground);
  const bgRgb = hexToRgb(background);
  
  // Calculate luminance
  const fgLuminance = 0.2126 * fgRgb.r + 0.7152 * fgRgb.g + 0.0722 * fgRgb.b;
  const bgLuminance = 0.2126 * bgRgb.r + 0.7152 * bgRgb.g + 0.0722 * bgRgb.b;
  
  const contrastRatio = (Math.max(fgLuminance, bgLuminance) + 0.05) / 
                        (Math.min(fgLuminance, bgLuminance) + 0.05);
  
  if (contrastRatio >= 7) return 'visible';
  if (contrastRatio >= 4.5) return 'warning';
  return 'invisible';
}

/**
 * Generate gradient backgrounds
 */
export function generateCyberGradient(
  colors: string[],
  direction: string = '135deg'
): string {
  return `linear-gradient(${direction}, ${colors.join(', ')})`;
}

export const cyberGradients = {
  primary: generateCyberGradient(['#00f3ff', '#0099ff']),
  secondary: generateCyberGradient(['#ff00ff', '#ff3333']),
  accent: generateCyberGradient(['#39ff14', '#00f3ff']),
  glitch: generateCyberGradient(['#ff3131', '#ff00ff', '#00f3ff']),
  metallic: generateCyberGradient(['#1a1a1a', '#2d2d2d', '#1a1a1a']),
  glass: generateCyberGradient(
    ['rgba(0, 243, 255, 0.2)', 'rgba(255, 0, 255, 0.1)'],
    '45deg'
  ),
};

/**
 * Generate border styles
 */
export function generateCyberBorder(
  color: string = '#00f3ff',
  width: number = 2,
  style: 'solid' | 'glitch' | 'scan' = 'solid'
): string {
  const base = `${width}px ${style === 'scan' ? 'dashed' : 'solid'} ${color}`;
  
  if (style === 'glitch') {
    return `
      border: ${width}px solid ${color};
      box-shadow: 2px 0 0 #ff00ff, -2px 0 0 #00f3ff;
      mask-image: repeating-linear-gradient(45deg, transparent, transparent 5px, #000 5px, #000 10px);
    `;
  }
  
  return base;
}

/**
 * Generate text styles
 */
export const cyberTextStyles = {
  primary: {
    color: '#00f3ff',
    textShadow: '0 0 8px rgba(0, 243, 255, 0.5)',
    fontWeight: 600,
  },
  accent: {
    color: '#ff00ff',
    textShadow: '0 0 8px rgba(255, 0, 255, 0.5)',
    fontWeight: 600,
  },
  glitch: {
    color: '#ff3131',
    animation: 'glitch-text 3s infinite',
  },
  holographic: {
    background: 'linear-gradient(90deg, #00f3ff, #ff00ff, #39ff14)',
    backgroundSize: '200% auto',
    color: 'transparent',
    backgroundClip: 'text',
    animation: 'holographic 3s linear infinite',
  },
};
