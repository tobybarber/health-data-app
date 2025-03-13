'use client';

import { AuthProvider } from '../lib/AuthContext';
import ErrorBoundary from './ErrorBoundary';

export default function ClientWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <AuthProvider>
        {children}
      </AuthProvider>
    </ErrorBoundary>
  );
} 