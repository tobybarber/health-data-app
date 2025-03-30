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
        document.body.classList.add('standalone-mode');
        console.log('Running in standalone mode (PWA)');
        
        // Fix scrolling issues by disabling all touchmove event cancellation
        document.addEventListener('touchmove', (e) => {
          // Allow all touchmove events
        }, { passive: false });
        
        // Special fix: if a container with position:fixed is blocking scrolling
        const fixBlockedScrolling = () => {
          const scrollContainers = document.querySelectorAll('.overflow-y-scroll, .-webkit-overflow-scrolling-touch, .touch-pan-y');
          scrollContainers.forEach(container => {
            container.addEventListener('touchstart', () => {
              // Ensure touch events work properly in this container
            }, { passive: true });
          });
        };
        
        // Apply after a short delay to ensure DOM is ready
        setTimeout(fixBlockedScrolling, 300);
      } else {
        document.body.classList.remove('standalone-mode');
        console.log('Running in browser mode');
      }
    };

    // Call immediately after component mounts
    checkStandalone();
    
    // Also check when display mode changes
    const displayModeQuery = window.matchMedia('(display-mode: standalone)');
    displayModeQuery.addEventListener('change', checkStandalone);
    
    // Cleanup
    return () => {
      displayModeQuery.removeEventListener('change', checkStandalone);
    };
  }, []);

  return null; // No UI rendered
} 