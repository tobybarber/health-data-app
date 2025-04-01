'use client';

import React, { ReactNode, useEffect } from 'react';
import { AuthProvider } from './lib/AuthContext';
import dynamic from 'next/dynamic';

// Import ClientWrapper
const ClientWrapper = dynamic(() => import('./components/ClientWrapper'), {
  ssr: false,
});

// Extend Window interface to include our custom property
declare global {
  interface Window {
    __restoreConsole?: () => void;
  }
}

// Global log suppression function
function suppressLogs() {
  if (process.env.NEXT_PUBLIC_DISABLE_LOGS === 'true' && typeof window !== 'undefined') {
    // Store original console methods
    const originalConsole = {
      log: console.log,
      warn: console.warn,
      error: console.error,
      info: console.info,
      debug: console.debug,
    };

    // Silent versions that do nothing
    const noop = () => {};
    
    // Override non-critical console methods
    console.log = noop;
    console.info = noop;
    console.debug = noop;
    
    // Keep warnings and errors for critical issues
    // Uncomment these lines to suppress these as well
    // console.warn = noop;
    // console.error = noop;
    
    // Provide a way to restore console if needed
    window.__restoreConsole = () => {
      console.log = originalConsole.log;
      console.warn = originalConsole.warn;
      console.error = originalConsole.error;
      console.info = originalConsole.info;
      console.debug = originalConsole.debug;
      console.log('Console logging restored');
    };
  }
}

// Override the React DevTools message
if (typeof window !== 'undefined') {
  // Silence the React DevTools message
  Object.defineProperty(window, '__REACT_DEVTOOLS_GLOBAL_HOOK__', {
    value: { isDisabled: true }
  });
}

export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    suppressLogs();
  }, []);

  return (
    <AuthProvider>
      <ClientWrapper>
        {children}
      </ClientWrapper>
    </AuthProvider>
  );
}

export default Providers; 