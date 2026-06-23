/**
 * Animation utilities for cyberpunk effects
 */
import type { CSSProperties } from 'react';

/**
 * Generate CSS keyframes for glitch effect
 */
export function generateGlitchKeyframes(): string {
  return `
    @keyframes glitch-overlay {
      0% { transform: translate(0, 0); }
      20% { transform: translate(-2px, 2px); }
      40% { transform: translate(-2px, -2px); }
      60% { transform: translate(2px, 2px); }
      80% { transform: translate(2px, -2px); }
      100% { transform: translate(0, 0); }
    }
    
    @keyframes glitch-text {
      0% { clip-path: inset(0 0 0 0); }
      25% { clip-path: inset(0 0 50% 0); transform: translateX(-2px); }
      50% { clip-path: inset(50% 0 0 0); transform: translateX(2px); }
      75% { clip-path: inset(0 0 0 50%); transform: translateX(-2px); }
      100% { clip-path: inset(0 50% 0 0); transform: translateX(2px); }
    }
    
    @keyframes neon-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.7; }
    }
    
    @keyframes scanline {
      0% { top: -100%; }
      100% { top: 100%; }
    }
    
    @keyframes float-cyber {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-3px); }
    }
    
    @keyframes cable-sway {
      0%, 100% { transform: translateX(0); }
      50% { transform: translateX(5px); }
    }
  `;
}

/**
 * Generate CSS for cyberpunk border styles
 */
export function generateCyberBorders(): string {
  return `
    @keyframes border-glow {
      0%, 100% {
        box-shadow: 0 0 8px rgba(0, 243, 255, 0.5),
                     0 0 16px rgba(0, 243, 255, 0.3),
                     inset 0 0 4px rgba(0, 243, 255, 0.3);
      }
      50% {
        box-shadow: 0 0 4px rgba(0, 243, 255, 0.7),
                     0 0 8px rgba(0, 243, 255, 0.5),
                     inset 0 0 2px rgba(0, 243, 255, 0.5);
      }
    }
    
    @keyframes border-shimmer {
      0% { background-position: 0% 50%; }
      100% { background-position: 100% 50%; }
    }
  `;
}

/**
 * Animation duration presets
 */
export const animationDurations = {
  fast: '150ms',
  normal: '250ms',
  slow: '400ms',
  glitch: '75ms',
  cyberslow: '800ms',
};

/**
 * Animation timing functions (easing)
 */
export const animationEasing = {
  linear: 'linear',
  cyber: 'cubic-bezier(0.68, -0.55, 0.27, 1.55)',
  glitch: 'cubic-bezier(0.6, 0.04, 0.98, 0.335)',
  smooth: 'cubic-bezier(0.25, 1, 0.5, 1)',
  bounce: 'cubic-bezier(0.68, -0.55, 0.27, 1.55)',
};

/**
 * Reduced motion preferences
 */
export const prefersReducedMotion = (motion: 'reduce' | 'enhance' = 'reduce'): boolean => {
  try {
    // Use matchMedia if available
    // @ts-ignore - matchMedia available in browsers
    if (typeof window !== 'undefined' && window.matchMedia) {
      const query = window.matchMedia('(prefers-reduced-motion: reduce)');
      return query.matches;
    }
  } catch {
    // Fallback for server-side rendering
  }
  return false;
};

/**
 * Get transition styles for cyberpunk components
 */
export function getTransitionStyles(
  duration: number = 250,
  delay: number = 0,
  property: string = 'all',
  easing: string = animationEasing.cyber
): CSSProperties {
  return {
    transition: `${property} ${duration}ms ${easing} ${delay}ms`,
  };
}

/**
 * Get animation styles
 */
export function getAnimationStyles(
  name: string,
  duration: number = 2000,
  iterationCount: number | 'infinite' = 'infinite',
  timingFunction: string = 'linear'
): CSSProperties {
  return {
    animation: `${name} ${duration}ms ${timingFunction} ${iterationCount}`,
  };
}

/**
 * Generate grid background patterns
 */
export function generateGridPattern(
  size: number = 4,
  color: string = '#00f3ff'
): string {
  return `linear-gradient(${color} 1px, transparent 1px), linear-gradient(90deg, ${color} 1px, transparent 1px)`;
}

/**
 * Generate scanline overlay
 */
export function generateScanlineOverlay(
  opacity: number = 0.05,
  frequency: number = 2
): string {
  const lines = Math.floor(100 / frequency);
  let css = '';
  for (let i = 0; i < lines; i++) {
    const top = (i * 100) / lines;
    css += `rgba(0, 243, 255, ${opacity}) ${top}%, transparent ${top + 1}%`;
    if (i < lines - 1) css += ', ';
  }
  return `linear-gradient(${css})`;
}

/**
 * Generate neon glow shadows
 */
export function generateNeonGlow(
  color: string,
  blur: number = 8,
  spread: number = 4,
  opacity: number = 0.5
): string {
  return `0 0 ${blur}px ${color}, 0 0 ${spread * 2}px ${color}`;
}

/**
 * Glitch effect configuration
 */
export interface GlitchConfig {
  intensity: number;
  color1: string;
  color2: string;
  frequency: number;
}

export const defaultGlitchConfig: GlitchConfig = {
  intensity: 0.02,
  color1: '#00f3ff',
  color2: '#ff00ff',
  frequency: 2,
};

export const strongGlitchConfig: GlitchConfig = {
  intensity: 0.05,
  color1: '#ff3131',
  color2: '#ff00ff',
  frequency: 5,
};
