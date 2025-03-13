'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

export default function ErrorBoundary({ children }: ErrorBoundaryProps) {
  const [hasError, setHasError] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [errorInfo, setErrorInfo] = useState<string>('');

  useEffect(() => {
    // Add global error handler
    const errorHandler = (event: ErrorEvent) => {
      console.error('Caught in ErrorBoundary:', event.error);
      setError(event.error);
      setHasError(true);
      
      // Check for OpenAI API key errors
      if (event.error && event.error.message && 
          (event.error.message.includes('OPENAI_API_KEY') || 
           event.error.message.includes('API key'))) {
        setErrorInfo('You need to set up your OpenAI API key in the .env.local file.');
      }
      
      // Prevent the error from bubbling up
      event.preventDefault();
    };

    // Add unhandled promise rejection handler
    const rejectionHandler = (event: PromiseRejectionEvent) => {
      console.error('Unhandled promise rejection caught in ErrorBoundary:', event.reason);
      
      const errorMessage = String(event.reason);
      setError(new Error(errorMessage));
      setHasError(true);
      
      // Check for OpenAI API key errors
      if (errorMessage.includes('OPENAI_API_KEY') || errorMessage.includes('API key')) {
        setErrorInfo('You need to set up your OpenAI API key in the .env.local file.');
      }
      
      // Prevent the rejection from bubbling up
      event.preventDefault();
    };

    window.addEventListener('error', errorHandler);
    window.addEventListener('unhandledrejection', rejectionHandler);

    return () => {
      window.removeEventListener('error', errorHandler);
      window.removeEventListener('unhandledrejection', rejectionHandler);
    };
  }, []);

  if (hasError) {
    // Check if it's an OpenAI API key error
    const isApiKeyError = error?.message?.includes('OPENAI_API_KEY') || 
                          error?.message?.includes('API key');
    
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-md">
        <h2 className="text-xl font-bold text-red-700 mb-2">Something went wrong</h2>
        
        <p className="text-red-600 mb-2">
          {error?.message || 'An unknown error occurred'}
        </p>
        
        {isApiKeyError && (
          <div className="bg-yellow-50 p-3 border border-yellow-200 rounded mb-4">
            <h3 className="font-bold text-yellow-800 mb-1">OpenAI API Key Issue</h3>
            <p className="text-yellow-700 mb-2">
              The OpenAI API key is missing or invalid. To fix this:
            </p>
            <ol className="list-decimal ml-5 text-yellow-700 text-sm">
              <li className="mb-1">Create or edit the <code className="bg-yellow-100 px-1 rounded">.env.local</code> file in the project root</li>
              <li className="mb-1">Add your OpenAI API key: <code className="bg-yellow-100 px-1 rounded">OPENAI_API_KEY=your_api_key_here</code></li>
              <li className="mb-1">Restart the development server</li>
            </ol>
          </div>
        )}
        
        {errorInfo && (
          <p className="text-gray-700 mb-4">{errorInfo}</p>
        )}
        
        <div className="flex space-x-3">
          <Link href="/" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">
            Go to Home Page
          </Link>
          
          <button
            onClick={() => {
              setHasError(false);
              setError(null);
              setErrorInfo('');
              window.location.reload();
            }}
            className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
} 