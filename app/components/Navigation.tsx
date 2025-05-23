'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../lib/AuthContext';
import { useState, useRef, useEffect, useContext } from 'react';
import { FaUserCircle } from 'react-icons/fa';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import Image from 'next/image';
import StandaloneLink from './StandaloneLink';
import { StandaloneModeContext } from './ClientWrapper';

interface NavigationProps {}

interface UserProfile {
  name: string;
  // Other profile fields not needed for this component
}

export default function Navigation({}: NavigationProps) {
  const pathname = usePathname();
  const { currentUser, loading, authInitialized } = useAuth();
  const firstName = currentUser?.displayName?.split(' ')[0];
  const { isStandalone } = useContext(StandaloneModeContext);

  const isActive = (path: string) => {
    return pathname === path ? 'bg-white/20' : '';
  };

  return (
    <nav 
      className={`bg-gray-950/80 backdrop-blur-sm flex justify-between items-center shadow-md fixed left-0 right-0 h-14 z-50`}
      style={isStandalone ? { top: '55px' } : { top: '0' }}
    >
      <div className="flex items-center px-4">
        <StandaloneLink href="/about" className="flex items-center">
          <div className="mr-2 relative w-8 h-8">
            <Image 
              src="/images/leaf.png" 
              alt="Elyna Health Logo"
              fill
              style={{ objectFit: 'contain' }}
              priority
            />
          </div>
          <div className="flex items-baseline">
            <span className="text-2xl font-light tracking-wider text-[#16B981]">ELYNA</span>
            <span className="ml-2 text-2xl font-light tracking-wider text-[#16B981]">HEALTH</span>
          </div>
        </StandaloneLink>
      </div>
      <div className="flex items-center space-x-4">
        {currentUser ? (
          <StandaloneLink 
            href="/profile" 
            className="text-primary-blue flex items-center py-1 px-3 hover:bg-gray-800/50 rounded-full transition-colors"
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