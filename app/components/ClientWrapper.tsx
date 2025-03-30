'use client';

import { useState, createContext, useContext } from 'react';
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
  
  return (
    <>
      {/* Base black background - always present */}
      <div className="fixed inset-0 z-0 bg-black" style={{ touchAction: 'none' }} />
      
      {/* Logo overlay - conditionally rendered */}
      {showBackgroundLogo && (
        <div className="absolute inset-0 z-0 fixed" style={{ touchAction: 'none' }}>
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
      <div className="relative z-10">
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