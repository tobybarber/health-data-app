'use client';

import { useState, createContext, useContext, useEffect } from 'react';
import { AuthProvider } from '../lib/AuthContext';
import ErrorBoundary from './ErrorBoundary';
import BottomNavigation from './BottomNavigation';
import { useAuth } from '../lib/AuthContext';
import HomeScreenDetect from './HomeScreenDetect';
import AppleSplashScreen from './AppleSplashScreen';
import Image from 'next/image';

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
    const setVHVariable = () => {
      // First we get the viewport height and we multiply it by 1% to get a value for a vh unit
      let vh = window.innerHeight * 0.01;
      // Then we set the value in the --vh custom property to the root of the document
      document.documentElement.style.setProperty('--vh', `${vh}px`);
      document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`);
    };

    // Set the initial value
    setVHVariable();

    // Reset on orientation change and resize
    window.addEventListener('resize', setVHVariable);
    window.addEventListener('orientationchange', setVHVariable);

    // Update immediately after load to handle Safari's address bar
    setTimeout(setVHVariable, 100);
    
    return () => {
      window.removeEventListener('resize', setVHVariable);
      window.removeEventListener('orientationchange', setVHVariable);
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