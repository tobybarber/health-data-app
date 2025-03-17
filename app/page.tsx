'use client';

import { useAuth } from './lib/AuthContext';
import Link from 'next/link';
import { FaUpload, FaComments, FaWatchmanMonitoring, FaClipboardList } from 'react-icons/fa';
import Navigation from './components/Navigation';

export default function Home() {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-blue"></div>
      </div>
    );
  }

  return (
    <div>
      {/* Content */}
      <div className="pt-20">
        {/* Navigation Header */}
        <Navigation isHomePage={true} />

        {/* Main Content */}
        {!currentUser ? (
          <div className="flex flex-col items-center justify-center h-screen px-4">
            <div className="bg-white/80 p-6 rounded-lg shadow-lg text-center max-w-sm w-full backdrop-blur-sm">
              <h1 className="text-3xl font-bold text-primary-blue mb-6">Welcome to Wattle Health</h1>
              <p className="mb-8 text-gray-700">Your personal health assistant powered by AI</p>
              <div className="space-y-4">
                <Link 
                  href="/signup" 
                  className="block w-full bg-primary-blue text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
                >
                  Sign Up
                </Link>
                <Link 
                  href="/login" 
                  className="block w-full bg-white text-primary-blue py-2 px-4 rounded-md border border-primary-blue hover:bg-gray-100 transition-colors"
                >
                  Login
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-6">
            <div className="grid grid-cols-2 gap-6 mt-4">
              <Link
                href="/upload"
                className="bg-white/80 backdrop-blur-sm p-5 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 flex flex-col items-center text-center hover:bg-white/90 hover:scale-105"
              >
                <div className="text-primary-blue text-3xl mb-3">
                  <FaUpload />
                </div>
                <h2 className="text-lg font-semibold text-primary-blue">Upload Records</h2>
              </Link>
              
              <Link
                href="/records"
                className="bg-white/80 backdrop-blur-sm p-5 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 flex flex-col items-center text-center hover:bg-white/90 hover:scale-105"
              >
                <div className="text-primary-blue text-3xl mb-3">
                  <FaClipboardList />
                </div>
                <h2 className="text-lg font-semibold text-primary-blue">View Records</h2>
              </Link>
              
              <Link
                href="/analysis"
                className="bg-white/80 backdrop-blur-sm p-5 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 flex flex-col items-center text-center hover:bg-white/90 hover:scale-105"
              >
                <div className="text-primary-blue text-3xl mb-3">
                  <FaComments />
                </div>
                <h2 className="text-lg font-semibold text-primary-blue">Health Analysis</h2>
              </Link>
              
              <Link
                href="/wearables"
                className="bg-white/80 backdrop-blur-sm p-5 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 flex flex-col items-center text-center hover:bg-white/90 hover:scale-105"
              >
                <div className="text-primary-blue text-3xl mb-3">
                  <FaWatchmanMonitoring />
                </div>
                <h2 className="text-lg font-semibold text-primary-blue">Wearables</h2>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 