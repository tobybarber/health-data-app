'use client';

import { useAuth } from './lib/AuthContext';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { FaUpload, FaComments, FaWatchmanMonitoring, FaClipboardList, FaHeartbeat } from 'react-icons/fa';
import Navigation from './components/Navigation';
import ChatContainer from './components/chat/ChatContainer';
import ClientWrapper from './components/ClientWrapper';

export default function Home() {
  const { currentUser, loading, authInitialized } = useAuth();
  const [skipAuth, setSkipAuth] = useState(false);
  const [previouslyAuthenticated, setPreviouslyAuthenticated] = useState<boolean>(false);

  // Check for cached auth state on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const cachedAuthUser = localStorage.getItem('authUser');
      if (cachedAuthUser && cachedAuthUser !== 'null') {
        try {
          setPreviouslyAuthenticated(true);
        } catch (e) {
          console.error('Error with cached auth state:', e);
        }
      }
    }
  }, []);

  // Generate a new session ID on app load
  useEffect(() => {
    if (typeof window !== 'undefined' && !sessionStorage.getItem('app_session_id')) {
      const sessionId = `session_${Date.now()}`;
      sessionStorage.setItem('app_session_id', sessionId);
      console.log('New app session started:', sessionId);
    }
  }, []);

  if (loading || !authInitialized) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (!currentUser && !skipAuth && !previouslyAuthenticated) {
    return (
      <div className="min-h-screen bg-black flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <h2 className="mt-6 text-center text-3xl font-extrabold text-white">
            Welcome to Wattle Health
          </h2>
          <p className="mt-2 text-center text-sm text-gray-400">
            Your personal health assistant
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-black/80 backdrop-blur-sm py-8 px-4 shadow-lg sm:rounded-lg sm:px-10 border border-gray-800">
            <div className="space-y-6">
              <Link
                href="/login"
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                Create account
              </Link>
              <button
                onClick={() => setSkipAuth(true)}
                className="w-full flex justify-center py-2 px-4 border border-gray-700 rounded-md shadow-sm text-sm font-medium text-gray-300 bg-black hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Continue as guest
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ClientWrapper>
      <div className="flex flex-col min-h-screen bg-black">
        <Navigation isHomePage={true} />
        <main className="flex-1 flex flex-col overflow-hidden pt-14">
          <ChatContainer />
        </main>
      </div>
    </ClientWrapper>
  );
} 