'use client';

import React, { useEffect, useState } from 'react';

interface TransitionProps {
  show: boolean;
  children: React.ReactNode;
  type?: 'fade' | 'slide' | 'scale' | 'collapse';
  duration?: number;
  className?: string;
}

const Transition: React.FC<TransitionProps> = ({
  show,
  children,
  type = 'fade',
  duration = 200,
  className = '',
}) => {
  const [shouldRender, setShouldRender] = useState(show);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (show) {
      setShouldRender(true);
      // Wait a frame to ensure the element is rendered before starting animation
      requestAnimationFrame(() => setIsAnimating(true));
    } else {
      setIsAnimating(false);
      // Wait for animation to complete before unmounting
      const timer = setTimeout(() => setShouldRender(false), duration);
      return () => clearTimeout(timer);
    }
  }, [show, duration]);

  const baseStyles = {
    transition: `all ${duration}ms ease-in-out`,
  };

  const transitionStyles = {
    fade: {
      entering: { opacity: 0 },
      entered: { opacity: 1 },
    },
    slide: {
      entering: { transform: 'translateY(20px)', opacity: 0 },
      entered: { transform: 'translateY(0)', opacity: 1 },
    },
    scale: {
      entering: { transform: 'scale(0.95)', opacity: 0 },
      entered: { transform: 'scale(1)', opacity: 1 },
    },
    collapse: {
      entering: { maxHeight: '0', opacity: 0, overflow: 'hidden' },
      entered: { maxHeight: '1000px', opacity: 1, overflow: 'hidden' },
    },
  };

  const currentStyles = {
    ...baseStyles,
    ...transitionStyles[type][isAnimating ? 'entered' : 'entering'],
  };

  if (!shouldRender) {
    return null;
  }

  return (
    <div style={currentStyles} className={className}>
      {children}
    </div>
  );
};

export default Transition; 