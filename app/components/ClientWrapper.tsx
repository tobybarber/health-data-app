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

// Create a context for the standalone mode state
export const StandaloneModeContext = createContext({
  isStandalone: false
});

// Hook to use background logo context
export function useBackgroundLogo() {
  return useContext(BackgroundLogoContext);
}

// Create a wrapper component that includes BottomNavigation
function AppContent({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth();
  const pathname = usePathname();
  const [showBackgroundLogo, setShowBackgroundLogo] = useState(true);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if we're in standalone mode
    const checkStandalone = () => {
      const inStandaloneMode = 
        typeof window !== 'undefined' && 
        (
          (window.navigator as any).standalone === true || 
          window.matchMedia('(display-mode: standalone)').matches
        );
      
      setIsStandalone(inStandaloneMode);
    };

    // Initial check
    checkStandalone();

    // Monitor display mode changes
    const displayModeQuery = window.matchMedia('(display-mode: standalone)');
    displayModeQuery.addEventListener('change', checkStandalone);

    return () => {
      displayModeQuery.removeEventListener('change', checkStandalone);
    };
  }, []);

  // Handle background logo visibility based on path
  useEffect(() => {
    const shouldShowLogo = pathname === '/';
    setShowBackgroundLogo(shouldShowLogo);
  }, [pathname]);

  return (
    <BackgroundLogoContext.Provider value={{ showBackgroundLogo, setShowBackgroundLogo }}>
      <StandaloneModeContext.Provider value={{ isStandalone }}>
        <ErrorBoundary>
          <div className="min-h-screen bg-black relative">
            {/* Background Logo */}
            {showBackgroundLogo && (
              <div className="fixed inset-0 flex items-center justify-center pointer-events-none">
                <div className="relative w-64 h-64 opacity-5">
                  <Image
                    src="/images/logo.png"
                    alt="Background Logo"
                    fill
                    style={{ objectFit: 'contain' }}
                    priority
                  />
                </div>
              </div>
            )}

            {/* Main Content */}
            <main className="relative z-10">
              {children}
            </main>

            {/* Bottom Navigation */}
            {currentUser && <BottomNavigation />}

            {/* Toast Notifications */}
            <Toaster
              position="top-center"
              toastOptions={{
                duration: 3000,
                style: {
                  background: '#333',
                  color: '#fff',
                },
                success: {
                  duration: 3000,
                  style: {
                    background: '#4ade80',
                    color: '#fff',
                  },
                },
                error: {
                  duration: 4000,
                  style: {
                    background: '#ff4b4b',
                    color: '#fff',
                  },
                },
              }}
            />
          </div>
        </ErrorBoundary>
      </StandaloneModeContext.Provider>
    </BackgroundLogoContext.Provider>
  );
}

export default function ClientWrapper({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AppContent>{children}</AppContent>
    </AuthProvider>
  );
} 