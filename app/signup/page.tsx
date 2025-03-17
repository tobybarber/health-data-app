'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../lib/AuthContext';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export default function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { signup } = useAuth();

  // The required verification code
  const REQUIRED_CODE = '78435';

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    
    if (!email || !password || !confirmPassword || !verificationCode) {
      setError('Please fill in all fields');
      return;
    }
    
    if (verificationCode !== REQUIRED_CODE) {
      setError('Invalid verification code');
      return;
    }
    
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    
    try {
      setError(null);
      setLoading(true);
      
      // Create user in Firebase Auth
      const userCredential = await signup(email, password);
      const user = userCredential.user;
      
      // Create user profile document with approved status
      await setDoc(doc(db, 'users', user.uid), {
        email: user.email,
        createdAt: new Date().toISOString(),
        status: 'approved',
        approved: true
      });
      
      // Create empty profile document
      await setDoc(doc(db, 'profile', user.uid), {
        name: '',
        age: '',
        gender: '',
        height: '',
        weight: '',
        smoking: '',
        alcohol: '',
        diet: '',
        exercise: '',
        familyHistory: ''
      });
      
      // Redirect to profile page instead of home page
      router.push('/profile');
    } catch (err: any) {
      console.error('Signup error:', err);
      setError(err.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto p-4">
      <h1 className="text-2xl font-bold text-white mb-6 text-center">Create Account</h1>
      
      <form onSubmit={handleSubmit} className="w-full max-w-md">
        <div className="bg-black p-6 rounded-lg shadow-sm border border-gray-800">
          <h1 className="text-2xl font-bold text-primary-blue mb-6 text-center">Create an Account</h1>
          
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
          
          <div className="mb-4">
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
          
          <div className="mb-6">
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-1">
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-700 rounded-md bg-gray-900 text-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500"
              required
            />
          </div>
          
          <div className="mb-4">
            <label htmlFor="verificationCode" className="block text-sm font-medium text-gray-300 mb-1">
              Verification Code
            </label>
            <input
              id="verificationCode"
              type="text"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
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
              {loading ? 'Creating Account...' : 'Sign Up'}
            </button>
            
            <div className="text-center text-sm">
              Already have an account?{' '}
              <Link href="/login" className="text-white hover:underline">
                Log In
              </Link>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
} 