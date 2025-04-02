'use client';

import { useState, createContext, useContext, useEffect } from 'react';
import { AuthProvider } from '../lib/AuthContext';
import ErrorBoundary from './ErrorBoundary';
import BottomNavigation from './BottomNavigation';
import { useAuth } from '../lib/AuthContext';
import HomeScreenDetect from './HomeScreenDetect';
import AppleSplashScreen from './AppleSplashScreen';
import { usePathname } from 'next/navigation';
import { Toaster } from 'react-hot-toast';

// Extend Window interface to include our custom properties
declare global {
  interface Window {
    initialViewportHeight?: number;
    fixIOSStandalone?: () => void;
  }
}

// Create a context for the standalone mode state
export const StandaloneModeContext = createContext({
  isStandalone: false
});

// Create a wrapper component that includes BottomNavigation
function AppContent({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth();
  const pathname = usePathname();
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

  return (
    <StandaloneModeContext.Provider value={{ isStandalone }}>
      <ErrorBoundary>
        <div className="min-h-screen bg-gray-950 relative">
          {/* Main Content */}
          <main className="relative">
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
  );
}

export default function ClientWrapper({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AppContent>{children}</AppContent>
    </AuthProvider>
  );
} 