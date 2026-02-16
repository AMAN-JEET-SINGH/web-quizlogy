'use client';

import { useEffect } from 'react';

interface GlobalRippleProps {
  color?: 'default' | 'dark' | 'purple' | 'green' | 'pink' | 'gold';
  subtle?: boolean;
}

export default function GlobalRipple({ color = 'default', subtle = false }: GlobalRippleProps) {
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;

      // Find the closest button or clickable element
      const button = target.closest('button, .btn, .ripple-btn, [role="button"]') as HTMLElement;

      if (!button) return;

      // Skip if disabled
      if (button.hasAttribute('disabled') || button.classList.contains('disabled')) return;

      // Skip if it already has a ripple being processed
      if (button.dataset.rippling === 'true') return;

      // Mark as rippling
      button.dataset.rippling = 'true';

      const rect = button.getBoundingClientRect();
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

      // Store original styles to restore after animation
      const computedStyle = window.getComputedStyle(button);
      const originalPosition = button.style.position;
      const originalOverflow = button.style.overflow;

      // Temporarily set positioning for ripple to work
      if (computedStyle.position === 'static') {
        button.style.position = 'relative';
      }
      button.style.overflow = 'hidden';

      // Add ripple
      button.appendChild(ripple);

      // Remove after animation and restore original styles
      setTimeout(() => {
        ripple.remove();
        delete button.dataset.rippling;
        // Restore original styles
        button.style.position = originalPosition;
        button.style.overflow = originalOverflow;
      }, 600);
    };

    // Add event listener
    document.addEventListener('click', handleClick, true);

    return () => {
      document.removeEventListener('click', handleClick, true);
    };
  }, [color, subtle]);

  return null;
}
