'use client';

import { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../lib/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { login, currentUser, authInitialized } = useAuth();
  const [redirecting, setRedirecting] = useState(false);

  // Check for cached auth on mount
  useEffect(() => {
    const checkCachedAuth = () => {
      if (typeof window !== 'undefined') {
        const cachedAuthUser = localStorage.getItem('authUser');
        if (cachedAuthUser && cachedAuthUser !== 'null') {
          try {
            console.log('Found cached auth user, redirecting to home');
            setRedirecting(true);
            router.replace('/');
          } catch (e) {
            console.error('Error with cached auth state:', e);
          }
        }
      }
    };
    
    checkCachedAuth();
  }, [router]);
  
  // Redirect if user is already logged in
  useEffect(() => {
    if (currentUser) {
      router.replace('/');
    }
  }, [currentUser, router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    
    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }
    
    try {
      setError(null);
      setLoading(true);
      
      // Login with Firebase Auth
      await login(email, password);
      
      // Redirect to home page
      router.push('/');
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Failed to log in');
    } finally {
      setLoading(false);
    }
  }

  // Show loading state when redirecting to prevent flash
  if (redirecting) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-blue mb-4"></div>
        <p className="text-white">Redirecting to home...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6">
      <Link href="/" className="mb-8 text-3xl font-bold text-primary-blue">Elyna Health</Link>
      
      <form onSubmit={handleSubmit} className="w-full max-w-md">
        <div className="bg-black p-6 rounded-lg shadow-sm border border-gray-800">
          <h1 className="text-2xl font-bold text-primary-blue mb-6 text-center">Log In</h1>
          
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}
          
          <div className="mb-4">
            <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-700 rounded-md bg-gray-900 text-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500"
              required
            />
          </div>
          
          <div className="mb-6">
            <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-700 rounded-md bg-gray-900 text-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500"
              required
            />
          </div>
          
          <div className="flex flex-col space-y-4">
            <button
              type="submit"
              disabled={loading}
              className={`bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 ${
                loading ? 'opacity-70 cursor-not-allowed' : ''
              }`}
            >
              {loading ? 'Logging in...' : 'Log In'}
            </button>
            
            <div className="text-center text-sm">
              <Link href="/forgot-password" className="text-white hover:underline">
                Forgot Password?
              </Link>
            </div>
            
            <div className="text-center text-sm">
              Don't have an account?{' '}
              <Link href="/signup" className="text-white hover:underline">
                Sign Up
              </Link>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
} 