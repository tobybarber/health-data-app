'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../lib/AuthContext';
import { useState, useRef, useEffect } from 'react';
import { FaUserCircle } from 'react-icons/fa';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import Image from 'next/image';
import StandaloneLink from './StandaloneLink';

interface NavigationProps {
  isHomePage?: boolean;
  isStandalone?: boolean;
}

interface UserProfile {
  name: string;
  // Other profile fields not needed for this component
}

export default function Navigation({ isHomePage = false, isStandalone = false }: NavigationProps) {
  const pathname = usePathname();
  const { currentUser, loading, authInitialized } = useAuth();
  const firstName = currentUser?.displayName?.split(' ')[0];

  const isActive = (path: string) => {
    return pathname === path ? 'bg-white/20' : '';
  };

  // Home page navigation layout
  if (isHomePage) {
    return (
      <>
        <header className="bg-gray-950/80 backdrop-blur-sm flex justify-between items-center shadow-md w-full fixed left-0 right-0 z-20 px-4 standalone-nav-top">
          <div className="flex items-center">
            <StandaloneLink href="/about" className="flex items-center">
              <div className="mr-2 relative w-8 h-8">
                <Image 
                  src="/images/logo.png" 
                  alt="Wattle Logo"
                  fill
                  style={{ objectFit: 'contain' }}
                  priority
                />
              </div>
              <span className="text-2xl font-bold text-white">Wattle</span>
            </StandaloneLink>
          </div>
          <div className="flex items-center space-x-4">
            {currentUser && (
              <StandaloneLink href="/profile" className="text-white flex items-center border border-gray-600 rounded-full py-1 px-3 hover:border-gray-400 transition-colors">
                <FaUserCircle size={22} />
                {firstName && (
                  <span className="ml-2 text-white">
                    {firstName}
                  </span>
                )}
              </StandaloneLink>
            )}
          </div>
        </header>
      </>
    );
  }

  // Standard navigation layout for other pages
  return (
    <nav className="bg-gray-950/80 backdrop-blur-sm flex justify-between items-center shadow-md fixed left-0 right-0 z-20 px-4 standalone-nav-top">
      <div className="flex items-center">
        <StandaloneLink href="/about" className="flex items-center">
          <div className="mr-2 relative w-8 h-8">
            <Image 
              src="/images/logo.png" 
              alt="Wattle Logo"
              fill
              style={{ objectFit: 'contain' }}
              priority
            />
          </div>
          <span className="text-2xl font-bold text-primary-blue hover:text-gray-300 transition-colors">Wattle</span>
        </StandaloneLink>
      </div>
      <div className="flex items-center space-x-4">
        {currentUser ? (
          <StandaloneLink 
            href="/profile" 
            className="text-primary-blue flex items-center border border-gray-600 rounded-full py-1 px-3 hover:border-gray-400 transition-colors"
            title="Profile"
          >
            <FaUserCircle size={22} />
            {firstName && (
              <span className="ml-2 text-white">
                {firstName}
              </span>
            )}
          </StandaloneLink>
        ) : !loading && authInitialized ? (
          <>
            <StandaloneLink 
              href="/login" 
              className={`px-4 py-2 rounded-md text-white ${isActive('/login')}`}
            >
              Login
            </StandaloneLink>
            <StandaloneLink 
              href="/signup" 
              className="bg-primary-blue hover:bg-gray-700 text-white px-4 py-2 rounded-md transition-colors"
            >
              Sign Up
            </StandaloneLink>
          </>
        ) : null}
      </div>
    </nav>
  );
} 