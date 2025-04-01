'use client';

import { useEffect, useState } from 'react';

// Extend Window interface to include our custom properties
declare global {
  interface Window {
    fixIOSStandalone?: () => void;
  }
}

export default function StandaloneModeHandler() {
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Function to check if the app is in standalone mode
    const checkStandalone = () => {
      const isRunningStandalone = 
        (window.navigator as any).standalone === true ||
        window.matchMedia('(display-mode: standalone)').matches;
      
      setIsStandalone(isRunningStandalone);
      
      if (isRunningStandalone) {
        // Apply standalone mode classes
        document.body.classList.add('standalone-mode');
        document.documentElement.classList.add('standalone-mode');
        document.documentElement.style.setProperty('--standalone-mode', '1');
        
        // Configure viewport for iOS
        const metaViewport = document.querySelector('meta[name="viewport"]');
        if (metaViewport) {
          metaViewport.setAttribute('content', 
            'width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no'
          );
        }
        
        // Set up iOS-specific styles
        document.body.style.height = '-webkit-fill-available';
        document.body.style.minHeight = 'calc(var(--vh, 1vh) * 100)';
        document.body.style.overscrollBehavior = 'none';
        
        // Handle touch events properly
        document.addEventListener('touchmove', handleTouchMove, { passive: false });
        
        // Monitor visibility changes
        document.addEventListener('visibilitychange', handleVisibilityChange);
        
        // Handle orientation changes
        window.addEventListener('orientationchange', handleOrientationChange);
      } else {
        // Remove standalone mode classes and event listeners
        document.body.classList.remove('standalone-mode');
        document.documentElement.classList.remove('standalone-mode');
        document.documentElement.style.removeProperty('--standalone-mode');
        
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('orientationchange', handleOrientationChange);
      }
    };

    // Touch event handler
    const handleTouchMove = (e: TouchEvent) => {
      if ((e.target as HTMLElement)?.closest('[data-block-touch="true"]')) {
        e.preventDefault();
      }
    };

    // Visibility change handler
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setTimeout(() => {
          const vh = window.innerHeight * 0.01;
          document.documentElement.style.setProperty('--vh', `${vh}px`);
        }, 100);
      }
    };

    // Orientation change handler
    const handleOrientationChange = () => {
      setTimeout(() => {
        // Force re-layout to fix status bar issues
        document.body.style.display = 'none';
        document.body.offsetHeight; // Trigger reflow
        document.body.style.display = '';
        
        // Recalculate viewport height
        const vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
        
        // Force-hide Safari UI
        if (window.scrollY === 0) {
          window.scrollTo(0, 1);
          setTimeout(() => window.scrollTo(0, 0), 50);
        }
      }, 300);
    };

    // Global fix function for iOS standalone mode
    const fixIOSStandalone = () => {
      console.log('Applying iOS standalone mode fixes');
      
      // Re-apply viewport configuration
      const metaViewport = document.querySelector('meta[name="viewport"]');
      if (metaViewport) {
        metaViewport.setAttribute('content', 
          'width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no'
        );
      }
      
      // Re-apply standalone mode classes
      document.body.classList.add('standalone-mode');
      document.documentElement.classList.add('standalone-mode');
      document.documentElement.style.setProperty('--standalone-mode', '1');
      
      // Handle iOS safe areas
      document.documentElement.style.setProperty('--safe-area-top', 'env(safe-area-inset-top)');
      document.documentElement.style.setProperty('--safe-area-bottom', 'env(safe-area-inset-bottom)');
      
      // Fix Safari height calculation
      document.body.style.height = '-webkit-fill-available';
      document.body.style.minHeight = 'calc(var(--vh, 1vh) * 100)';
      
      // Force-hide Safari UI
      if (window.scrollY === 0) {
        window.scrollTo(0, 1);
        setTimeout(() => window.scrollTo(0, 0), 50);
      }
    };

    // Make the fix function globally available
    window.fixIOSStandalone = fixIOSStandalone;

    // Initial check
    checkStandalone();

    // Monitor display mode changes
    const displayModeQuery = window.matchMedia('(display-mode: standalone)');
    displayModeQuery.addEventListener('change', checkStandalone);

    // Cleanup
    return () => {
      displayModeQuery.removeEventListener('change', checkStandalone);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }, []);

  return null; // No UI rendered
} 