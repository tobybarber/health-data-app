'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../lib/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { currentUser, loading, authInitialized } = useAuth();
  const router = useRouter();
  const [hasCachedAuth, setHasCachedAuth] = useState(false);

  // Check for cached auth on mount to prevent unnecessary redirects
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const cachedAuthUser = localStorage.getItem('authUser');
      if (cachedAuthUser && cachedAuthUser !== 'null') {
        try {
          setHasCachedAuth(true);
        } catch (e) {
          // Error with cached auth state
        }
      }
    }
  }, []);

  useEffect(() => {
    // Only redirect if we're sure there's no authentication
    // and there's no cached authentication data
    if (!loading && !currentUser && !hasCachedAuth && authInitialized) {
      router.push('/login');
    }
  }, [currentUser, loading, router, hasCachedAuth, authInitialized]);

  // Show children immediately if there's cached auth data
  if (hasCachedAuth) {
    return <>{children}</>;
  }

  // Show loading spinner only if we don't have cached auth data
  if (loading && !hasCachedAuth) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return currentUser ? <>{children}</> : null;
} 