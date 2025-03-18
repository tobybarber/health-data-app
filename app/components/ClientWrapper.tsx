'use client';

import { AuthProvider } from '../lib/AuthContext';
import ErrorBoundary from './ErrorBoundary';
import BottomNavigation from './BottomNavigation';
import { useAuth } from '../lib/AuthContext';
import HomeScreenDetect from './HomeScreenDetect';
import AppleSplashScreen from './AppleSplashScreen';

// Create a wrapper component that includes BottomNavigation
function AppContent({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth();
  
  return (
    <>
      <HomeScreenDetect />
      <AppleSplashScreen />
      {children}
      {currentUser && <BottomNavigation />}
    </>
  );
}

export default function ClientWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent>
          {children}
        </AppContent>
      </AuthProvider>
    </ErrorBoundary>
  );
} 