'use client';

import React from 'react';
import { usePreferences } from '../hooks/usePreferences';

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  fullScreen?: boolean;
  message?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'medium',
  fullScreen = false,
  message,
}) => {
  const { theme } = usePreferences();

  const spinnerSizes = {
    small: 'h-6 w-6 border-2',
    medium: 'h-12 w-12 border-3',
    large: 'h-16 w-16 border-4',
  };

  const spinnerColors = {
    light: 'border-blue-500',
    dark: 'border-blue-400',
    system: typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'border-blue-400'
      : 'border-blue-500',
  };

  const containerClasses = fullScreen
    ? 'fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50'
    : 'flex items-center justify-center';

  return (
    <div className={containerClasses}>
      <div className="flex flex-col items-center">
        <div
          className={`
            animate-spin rounded-full
            border-t-transparent border-l-transparent
            ${spinnerSizes[size]}
            ${spinnerColors[theme]}
          `}
        />
        {message && (
          <p className={`mt-4 text-${theme === 'dark' ? 'white' : 'gray-800'}`}>
            {message}
          </p>
        )}
      </div>
    </div>
  );
};

export default LoadingSpinner; 