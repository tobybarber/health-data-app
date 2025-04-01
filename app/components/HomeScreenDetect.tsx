'use client';

import { useEffect, useState } from 'react';

export default function HomeScreenDetect() {
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Function to check if the app is in standalone (PWA) mode
    const checkStandalone = () => {
      // All possible ways to detect if app is running in standalone mode
      const isRunningStandalone = 
        // iOS detection
        (window.navigator as any).standalone === true ||
        // Modern standard detection 
        window.matchMedia('(display-mode: standalone)').matches ||
        // Backup detection via URL parameters (if we control app launch)
        window.location.search.includes('standalone=true');
      
      setIsStandalone(isRunningStandalone);
      
      // Apply or remove the standalone mode class
      if (isRunningStandalone) {
        // Add both classes for maximum compatibility
        document.body.classList.add('standalone-mode');
        document.documentElement.classList.add('standalone-mode');
        document.documentElement.style.setProperty('--standalone-mode', '1');
        
        // Set minimal-ui viewport to properly handle iOS status bar
        const metaViewport = document.querySelector('meta[name="viewport"]');
        if (metaViewport) {
          metaViewport.setAttribute('content', 
            'width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no'
          );
        }
        
        // Ensure body sizing is correct in standalone mode
        document.body.style.height = '-webkit-fill-available';
        document.body.style.minHeight = 'calc(var(--vh, 1vh) * 100)';
        
        // Prevent overscroll/bounce effects in iOS
        document.body.style.overscrollBehavior = 'none';
        
        // Fix scrolling issues by allowing proper touch events
        document.addEventListener('touchmove', (e) => {
          // Allow default touchmove behavior unless explicitly blocked
          if ((e.target as HTMLElement)?.closest('[data-block-touch="true"]')) {
            e.preventDefault();
          }
        }, { passive: false });
        
        // Monitor for visibility changes (app switching)
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            // Recalculate on return to app
            setTimeout(() => {
              const vh = window.innerHeight * 0.01;
              document.documentElement.style.setProperty('--vh', `${vh}px`);
            }, 100);
          }
        });
      } else {
        document.body.classList.remove('standalone-mode');
        document.documentElement.classList.remove('standalone-mode');
        document.documentElement.style.removeProperty('--standalone-mode');
      }
    };

    // Call immediately after component mounts
    checkStandalone();
    
    // Also check when display mode changes
    const displayModeQuery = window.matchMedia('(display-mode: standalone)');
    displayModeQuery.addEventListener('change', checkStandalone);
    
    // Recalculate on orientation changes which might affect Safari UI
    window.addEventListener('orientationchange', () => {
      setTimeout(checkStandalone, 100);
    });
    
    // Cleanup
    return () => {
      displayModeQuery.removeEventListener('change', checkStandalone);
      window.removeEventListener('orientationchange', () => {
        setTimeout(checkStandalone, 100);
      });
    };
  }, []);

  return null; // No UI rendered
} 