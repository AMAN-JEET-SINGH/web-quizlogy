'use client';

import React, { ButtonHTMLAttributes, forwardRef, MouseEvent, useCallback } from 'react';

interface RippleButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  rippleColor?: 'default' | 'dark' | 'purple' | 'green' | 'pink' | 'gold';
  rippleSubtle?: boolean;
  children: React.ReactNode;
}

const RippleButton = forwardRef<HTMLButtonElement, RippleButtonProps>(
  ({
    rippleColor = 'default',
    rippleSubtle = false,
    children,
    onClick,
    className = '',
    disabled,
    ...props
  }, ref) => {

    const handleClick = useCallback((event: MouseEvent<HTMLButtonElement>) => {
      if (disabled) return;

      const element = event.currentTarget;
      const rect = element.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height) * 2;
      const x = event.clientX - rect.left - size / 2;
      const y = event.clientY - rect.top - size / 2;

      // Create ripple element
      const ripple = document.createElement('span');
      ripple.className = `ripple-effect${rippleColor !== 'default' ? ` ${rippleColor}` : ''}${rippleSubtle ? ' subtle' : ''}`;
      ripple.style.width = `${size}px`;
      ripple.style.height = `${size}px`;
      ripple.style.left = `${x}px`;
      ripple.style.top = `${y}px`;

      // Remove existing ripples
      const existingRipples = element.querySelectorAll('.ripple-effect');
      existingRipples.forEach(r => r.remove());

      // Add ripple
      element.appendChild(ripple);

      // Remove after animation
      setTimeout(() => {
        ripple.remove();
      }, 600);

      // Call original onClick
      if (onClick) {
        onClick(event);
      }
    }, [disabled, rippleColor, rippleSubtle, onClick]);

    return (
      <button
        ref={ref}
        className={`ripple-btn ${className}`}
        onClick={handleClick}
        disabled={disabled}
        {...props}
      >
        {children}
      </button>
    );
  }
);

RippleButton.displayName = 'RippleButton';

export default RippleButton;
