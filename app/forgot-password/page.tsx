'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useAuth } from '../lib/AuthContext';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { resetPassword } = useAuth();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    
    if (!email) {
      setError('Please enter your email');
      return;
    }
    
    try {
      setError(null);
      setMessage(null);
      setLoading(true);
      await resetPassword(email);
      setMessage('Check your email for password reset instructions');
    } catch (err: any) {
      console.error('Password reset error:', err);
      setError(err.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6">
      <Link href="/" className="mb-8 text-3xl font-bold text-primary-blue">Wombat</Link>
      
      <form onSubmit={handleSubmit} className="w-full max-w-md">
        <div className="bg-black p-6 rounded-lg shadow-sm border border-gray-800">
          <h1 className="text-2xl font-bold text-primary-blue mb-6 text-center">Reset Password</h1>
          
          {message && (
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
              {message}
            </div>
          )}
          
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}
          
          <div className="mb-6">
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
          
          <div className="flex flex-col space-y-4">
            <button
              type="submit"
              disabled={loading}
              className={`bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 ${
                loading ? 'opacity-70 cursor-not-allowed' : ''
              }`}
            >
              {loading ? 'Sending...' : 'Reset Password'}
            </button>
            
            <div className="text-center text-sm">
              <Link href="/login" className="text-white hover:underline">
                Back to Login
              </Link>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
} 