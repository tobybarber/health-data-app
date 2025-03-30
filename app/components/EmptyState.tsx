'use client';

import React from 'react';
import { usePreferences } from '../hooks/usePreferences';
import { IconType } from 'react-icons';

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: IconType;
  action?: {
    label: string;
    onClick: () => void;
  };
  image?: string;
  variant?: 'default' | 'compact';
}

const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon: Icon,
  action,
  image,
  variant = 'default',
}) => {
  const { theme } = usePreferences();

  const isDark = theme === 'dark' || (theme === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const containerClasses = variant === 'default'
    ? 'py-12 px-4 sm:px-6 lg:px-8'
    : 'py-6 px-4';

  return (
    <div className={containerClasses}>
      <div className="text-center">
        {Icon && (
          <div className={`mx-auto h-12 w-12 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            <Icon className="h-full w-full" />
          </div>
        )}
        {image && (
          <div className="mx-auto h-32 w-32 mb-4">
            <img src={image} alt="Empty state illustration" className="h-full w-full" />
          </div>
        )}
        <h3 className={`mt-2 text-lg font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
          {title}
        </h3>
        <p className={`mt-1 ${variant === 'default' ? 'text-base' : 'text-sm'} ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>
          {description}
        </p>
        {action && (
          <div className="mt-6">
            <button
              onClick={action.onClick}
              className={`
                inline-flex items-center px-4 py-2 border border-transparent
                text-sm font-medium rounded-md shadow-sm
                ${isDark
                  ? 'text-white bg-blue-600 hover:bg-blue-700'
                  : 'text-white bg-blue-500 hover:bg-blue-600'}
                focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
              `}
            >
              {action.label}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmptyState; 