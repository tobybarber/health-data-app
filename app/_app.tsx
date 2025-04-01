import React, { useEffect } from 'react';
import { AppProps } from 'next/app';

// Extend Window interface to include our custom property
declare global {
  interface Window {
    __restoreConsole?: () => void;
  }
}

// Global log suppression
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

function MyApp({ Component, pageProps }: AppProps) {
  useEffect(() => {
    suppressLogs();
  }, []);

  return <Component {...pageProps} />;
}

export default MyApp; 