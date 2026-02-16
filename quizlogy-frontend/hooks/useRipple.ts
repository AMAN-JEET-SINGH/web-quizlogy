'use client';

import { useCallback, MouseEvent } from 'react';

interface RippleOptions {
  color?: 'default' | 'dark' | 'purple' | 'green' | 'pink' | 'gold';
  subtle?: boolean;
  duration?: number;
}

export function useRipple(options: RippleOptions = {}) {
  const { color = 'default', subtle = false, duration = 600 } = options;

  const createRipple = useCallback((event: MouseEvent<HTMLElement>) => {
    const element = event.currentTarget;

    // Don't create ripple on disabled elements
    if (element.hasAttribute('disabled')) return;

    const rect = element.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 2;
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;

    // Create ripple element
    const ripple = document.createElement('span');
    ripple.className = `ripple-effect${color !== 'default' ? ` ${color}` : ''}${subtle ? ' subtle' : ''}`;
    ripple.style.width = `${size}px`;
    ripple.style.height = `${size}px`;
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;

    // Remove any existing ripples (optional - for cleaner look)
    const existingRipples = element.querySelectorAll('.ripple-effect');
    existingRipples.forEach(r => r.remove());

    // Add ripple to element
    element.appendChild(ripple);

    // Remove ripple after animation
    setTimeout(() => {
      ripple.remove();
    }, duration);
  }, [color, subtle, duration]);

  return { createRipple };
}

// Helper function to add ripple to any element (for use without hook)
export function addRipple(
  event: MouseEvent<HTMLElement> | React.MouseEvent<HTMLElement>,
  options: RippleOptions = {}
) {
  const { color = 'default', subtle = false, duration = 600 } = options;
  const element = event.currentTarget;

  if (element.hasAttribute('disabled')) return;

  const rect = element.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height) * 2;
  const x = event.clientX - rect.left - size / 2;
  const y = event.clientY - rect.top - size / 2;

  const ripple = document.createElement('span');
  ripple.className = `ripple-effect${color !== 'default' ? ` ${color}` : ''}${subtle ? ' subtle' : ''}`;
  ripple.style.width = `${size}px`;
  ripple.style.height = `${size}px`;
  ripple.style.left = `${x}px`;
  ripple.style.top = `${y}px`;

  element.appendChild(ripple);

  setTimeout(() => {
    ripple.remove();
  }, duration);
}

export default useRipple;
