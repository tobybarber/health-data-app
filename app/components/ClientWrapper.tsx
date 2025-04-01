'use client';

import { useState, createContext, useContext, useEffect } from 'react';
import { AuthProvider } from '../lib/AuthContext';
import ErrorBoundary from './ErrorBoundary';
import BottomNavigation from './BottomNavigation';
import { useAuth } from '../lib/AuthContext';
import HomeScreenDetect from './HomeScreenDetect';
import AppleSplashScreen from './AppleSplashScreen';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Toaster } from 'react-hot-toast';

// Extend Window interface to include our custom properties
declare global {
  interface Window {
    initialViewportHeight?: number;
    fixIOSStandalone?: () => void;
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
  const pathname = usePathname();
  
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
        // Define a global function to fix standalone mode issues that can be called from anywhere
        const fixIOSStandalone = () => {
          console.log('Applying iOS standalone mode fixes');
          
          // Apply viewport-fit=cover again to ensure status bar is handled correctly
          const metaViewport = document.querySelector('meta[name="viewport"]');
          if (metaViewport) {
            const content = metaViewport.getAttribute('content') || '';
            if (!content.includes('viewport-fit=cover')) {
              metaViewport.setAttribute('content', 
                'width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no'
              );
            }
          }
          
          // Re-add standalone mode classes
          document.body.classList.add('standalone-mode');
          document.documentElement.classList.add('standalone-mode');
          document.documentElement.style.setProperty('--standalone-mode', '1');
          
          // Handle iOS safe areas properly
          document.documentElement.style.setProperty('--safe-area-top', 'env(safe-area-inset-top)');
          document.documentElement.style.setProperty('--safe-area-bottom', 'env(safe-area-inset-bottom)');
          
          // Fix Safari height calculation
          document.body.style.height = '-webkit-fill-available';
          document.body.style.minHeight = 'calc(var(--vh, 1vh) * 100)';
          
          // Force viewport height recalculation
          fixIOSViewportHeight();
          
          // Force-hide Safari UI
          if (window.scrollY === 0) {
            window.scrollTo(0, 1);
            setTimeout(() => window.scrollTo(0, 0), 50);
          }
        };
        
        // Make the function globally available
        window.fixIOSStandalone = fixIOSStandalone;
        
        // Call immediately
        fixIOSStandalone();
        
        // Apply viewport-fit=cover again to ensure status bar is handled correctly
        const metaViewport = document.querySelector('meta[name="viewport"]');
        if (metaViewport) {
          const content = metaViewport.getAttribute('content') || '';
          if (!content.includes('viewport-fit=cover')) {
            metaViewport.setAttribute('content', content + ', viewport-fit=cover');
          }
        }
        
        // Handle iOS safe areas properly
        document.documentElement.style.setProperty('--safe-area-top', 'env(safe-area-inset-top)');
        document.documentElement.style.setProperty('--safe-area-bottom', 'env(safe-area-inset-bottom)');
        
        // Fix for status bar issues in landscape
        const handleOrientationChange = () => {
          setTimeout(() => {
            // Force re-layout to fix status bar issues
            document.body.style.display = 'none';
            document.body.offsetHeight; // Trigger reflow
            document.body.style.display = '';
            
            fixIOSViewportHeight();
            
            // Call our global fix function
            if (window.fixIOSStandalone) {
              window.fixIOSStandalone();
            }
          }, 300);
        };
        
        window.addEventListener('orientationchange', handleOrientationChange);
        
        // Cleanup for standalone-specific events
        return () => {
          window.removeEventListener('orientationchange', handleOrientationChange);
          window.removeEventListener('resize', fixIOSViewportHeight);
          window.removeEventListener('orientationchange', fixIOSViewportHeight);
        };
      }
      
      // Standard iOS fixes
      const handleScroll = () => setTimeout(fixIOSViewportHeight, 100);
      window.addEventListener('scroll', handleScroll);
      
      const handleFocusIn = () => document.body.classList.add('keyboard-open');
      window.addEventListener('focusin', handleFocusIn);
      
      const handleFocusOut = () => {
        document.body.classList.remove('keyboard-open');
        setTimeout(fixIOSViewportHeight, 100);
      };
      window.addEventListener('focusout', handleFocusOut);
      
      return () => {
        window.removeEventListener('resize', fixIOSViewportHeight);
        window.removeEventListener('orientationchange', fixIOSViewportHeight);
        window.removeEventListener('scroll', handleScroll);
        window.removeEventListener('focusin', handleFocusIn);
        window.removeEventListener('focusout', handleFocusOut);
      };
    }

    return () => {
      window.removeEventListener('resize', fixIOSViewportHeight);
      window.removeEventListener('orientationchange', fixIOSViewportHeight);
    };
  }, []);
  
  // Apply fixes after page navigation
  useEffect(() => {
    // If we're in standalone mode, reapply fixes after each page navigation
    if (window.fixIOSStandalone) {
      window.fixIOSStandalone();
    }
  }, [pathname]);
  
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
          <Toaster 
            position="top-center"
            toastOptions={{
              duration: 3000,
              style: {
                background: '#333',
                color: '#fff',
                borderRadius: '8px',
              },
            }}
          />
        </AuthProvider>
      </BackgroundLogoContext.Provider>
    </ErrorBoundary>
  );
} 