'use client';

import { useState, createContext, useContext, useEffect } from 'react';
import { AuthProvider } from '../lib/AuthContext';
import ErrorBoundary from './ErrorBoundary';
import BottomNavigation from './BottomNavigation';
import { useAuth } from '../lib/AuthContext';
import HomeScreenDetect from './HomeScreenDetect';
import AppleSplashScreen from './AppleSplashScreen';
import Image from 'next/image';

// Extend Window interface to include our custom properties
declare global {
  interface Window {
    initialViewportHeight?: number;
  }
}

// Create a context for the background logo visibility
export const BackgroundLogoContext = createContext({
  showBackgroundLogo: true,
  setShowBackgroundLogo: (show: boolean) => {}
});

// Hook to use background logo context
export function useBackgroundLogo() {
  return useContext(BackgroundLogoContext);
}

// Create a wrapper component that includes BottomNavigation
function AppContent({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth();
  const { showBackgroundLogo } = useBackgroundLogo();
  
  // Fix for iOS viewport height issues
  useEffect(() => {
    // Helper function to fix iOS Safari's 100vh issue
    const fixIOSViewportHeight = () => {
      // First we get the viewport height and we multiply it by 1% to get a value for a vh unit
      let vh = window.innerHeight * 0.01;
      // Then we set the value in the --vh custom property to the root of the document
      document.documentElement.style.setProperty('--vh', `${vh}px`);
      document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`);
      
      // Store the initial height to detect keyboard appearance
      if (!window.initialViewportHeight) {
        window.initialViewportHeight = window.innerHeight;
      }
    };

    // Initial call
    fixIOSViewportHeight();

    // Add event listeners for resize and orientation change
    window.addEventListener('resize', fixIOSViewportHeight);
    window.addEventListener('orientationchange', fixIOSViewportHeight);
    
    // Check if we're in iOS
    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
    
    if (isIOS) {
      // Wait for any UI to settle and then re-measure
      setTimeout(fixIOSViewportHeight, 100);
      
      // Fix for standalone mode specifically
      const isStandalone = 
        (window.navigator as any).standalone === true || 
        window.matchMedia('(display-mode: standalone)').matches;
      
      if (isStandalone) {
        // Special handling for standalone mode
        document.addEventListener('touchmove', (e) => {
          // This prevents iOS from blocking touchmove events
        }, { passive: true });
        
        // Perform additional fixes for standalone mode
        const fixStandaloneScrolling = () => {
          // Remove any scroll blocking elements
          document.querySelectorAll('.fixed').forEach(el => {
            if (!(el as HTMLElement).classList.contains('bottom-0') && 
                !(el as HTMLElement).classList.contains('top-0')) {
              // Make sure fixed position elements don't block scrolling
              (el as HTMLElement).style.position = 'absolute';
            }
          });
        };
        
        // Apply standalone fixes with a delay to ensure DOM is ready
        setTimeout(fixStandaloneScrolling, 200);
        
        // Re-apply on resize or orientation change
        window.addEventListener('resize', fixStandaloneScrolling);
        window.addEventListener('orientationchange', fixStandaloneScrolling);
        
        // Cleanup for standalone-specific events
        return () => {
          window.removeEventListener('resize', fixStandaloneScrolling);
          window.removeEventListener('orientationchange', fixStandaloneScrolling);
        };
      }
      
      // Standard iOS fixes
      window.addEventListener('scroll', () => {
        setTimeout(fixIOSViewportHeight, 100);
      });
      
      // Handle iOS keyboard
      window.addEventListener('focusin', () => {
        // When keyboard appears
        document.body.classList.add('keyboard-open');
      });
      
      window.addEventListener('focusout', () => {
        // When keyboard disappears
        document.body.classList.remove('keyboard-open');
        // Fix height after keyboard closes
        setTimeout(fixIOSViewportHeight, 100);
      });
    }

    return () => {
      window.removeEventListener('resize', fixIOSViewportHeight);
      window.removeEventListener('orientationchange', fixIOSViewportHeight);
      if (isIOS) {
        window.removeEventListener('scroll', () => {
          setTimeout(fixIOSViewportHeight, 100);
        });
        window.removeEventListener('focusin', () => {
          document.body.classList.add('keyboard-open');
        });
        window.removeEventListener('focusout', () => {
          document.body.classList.remove('keyboard-open');
        });
      }
    };
  }, []);
  
  return (
    <>
      {/* Base black background - always present */}
      <div className="fixed inset-0 z-0 bg-black" />
      
      {/* Logo overlay - conditionally rendered */}
      {showBackgroundLogo && (
        <div className="absolute inset-0 z-0 fixed">
          <div className="absolute inset-0 flex items-center justify-center opacity-15" style={{ paddingBottom: '15vh' }}>
            <div className="w-48 h-48 relative grayscale">
              <Image
                src="/images/logo.png"
                alt="Wattle Logo"
                fill
                style={{ objectFit: 'contain' }}
                priority
              />
            </div>
          </div>
        </div>
      )}
      
      <HomeScreenDetect />
      <AppleSplashScreen />
      <div className="relative z-10 h-full">
        {children}
        {currentUser && <BottomNavigation />}
      </div>
    </>
  );
}

export default function ClientWrapper({ children }: { children: React.ReactNode }) {
  const [showBackgroundLogo, setShowBackgroundLogo] = useState(true);

  return (
    <ErrorBoundary>
      <BackgroundLogoContext.Provider value={{ showBackgroundLogo, setShowBackgroundLogo }}>
        <AuthProvider>
          <AppContent>
            {children}
          </AppContent>
        </AuthProvider>
      </BackgroundLogoContext.Provider>
    </ErrorBoundary>
  );
} 