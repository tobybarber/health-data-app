'use client';

import React from 'react';
import { usePreferences } from '../hooks/usePreferences';
import { FaExclamationCircle } from 'react-icons/fa';

interface ErrorMessageProps {
  message: string;
  onRetry?: () => void;
  onDismiss?: () => void;
  variant?: 'inline' | 'toast' | 'banner';
}

const ErrorMessage: React.FC<ErrorMessageProps> = ({
  message,
  onRetry,
  onDismiss,
  variant = 'inline',
}) => {
  const { theme } = usePreferences();

  const variantStyles = {
    inline: 'rounded-md p-4',
    toast: 'fixed bottom-4 right-4 rounded-lg p-4 shadow-lg z-50 max-w-md',
    banner: 'w-full p-4',
  };

  const baseClasses = `
    ${variantStyles[variant]}
    ${theme === 'dark' ? 'bg-red-900 text-white' : 'bg-red-50 text-red-800'}
    flex items-center justify-between
  `;

  return (
    <div className={baseClasses}>
      <div className="flex items-center">
        <FaExclamationCircle className={`mr-3 h-5 w-5 ${theme === 'dark' ? 'text-red-400' : 'text-red-500'}`} />
        <p className="text-sm font-medium">{message}</p>
      </div>
      <div className="ml-4 flex-shrink-0">
        {onRetry && (
          <button
            onClick={onRetry}
            className={`
              mr-2 text-sm font-medium
              ${theme === 'dark' ? 'text-red-400 hover:text-red-300' : 'text-red-700 hover:text-red-600'}
            `}
          >
            Retry
          </button>
        )}
        {onDismiss && (
          <button
            onClick={onDismiss}
            className={`
              text-sm font-medium
              ${theme === 'dark' ? 'text-red-400 hover:text-red-300' : 'text-red-700 hover:text-red-600'}
            `}
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
};

export default ErrorMessage; 