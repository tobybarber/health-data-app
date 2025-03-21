'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../lib/AuthContext';
import { useState, useRef, useEffect } from 'react';
import { FaUserCircle } from 'react-icons/fa';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import Image from 'next/image';

interface NavigationProps {
  isHomePage?: boolean;
}

interface UserProfile {
  name: string;
  // Other profile fields not needed for this component
}

export default function Navigation({ isHomePage = false }: NavigationProps) {
  const pathname = usePathname();
  const { currentUser } = useAuth();
  const [firstName, setFirstName] = useState<string>('');
  
  useEffect(() => {
    const fetchUserName = async () => {
      if (!currentUser) return;
      
      // Check if we have the name in localStorage first
      const cachedName = localStorage.getItem(`user_firstName_${currentUser.uid}`);
      if (cachedName) {
        setFirstName(cachedName);
        return;
      }
      
      try {
        const profileDoc = await getDoc(doc(db, 'profile', currentUser.uid));
        
        if (profileDoc.exists()) {
          const data = profileDoc.data() as UserProfile;
          // Extract first name from the full name
          const firstNameOnly = data.name?.split(' ')[0] || '';
          setFirstName(firstNameOnly);
          
          // Cache the name in localStorage
          localStorage.setItem(`user_firstName_${currentUser.uid}`, firstNameOnly);
        }
      } catch (err) {
        console.error('Error fetching user profile:', err);
      }
    };

    fetchUserName();
  }, [currentUser]);

  const isActive = (path: string) => {
    return pathname === path ? 'bg-white/20' : '';
  };

  // Home page navigation layout
  if (isHomePage) {
    return (
      <>
        {/* Navigation Header */}
        <header className="bg-black/80 backdrop-blur-sm p-4 flex justify-between items-center shadow-md w-full fixed top-0 left-0 right-0 z-20">
          <div className="flex items-center">
            <Link href="/about" className="flex items-center">
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
            </Link>
          </div>
          <div className="flex items-center space-x-4">
            {currentUser && (
              <Link href="/profile" className="text-white flex items-center border border-gray-600 rounded-full py-1 px-3 hover:border-gray-400 transition-colors">
                <FaUserCircle size={24} />
                {firstName && <span className="ml-2">{firstName}</span>}
              </Link>
            )}
          </div>
        </header>
      </>
    );
  }

  // Standard navigation layout for other pages
  return (
    <nav className="bg-black/80 backdrop-blur-sm p-4 mb-6 shadow-md fixed top-0 left-0 right-0 z-20">
      <div className="flex justify-between items-center">
        {currentUser ? (
          // Authenticated navigation
          <>
            <div className="flex items-center">
              <Link href="/about" className="flex items-center">
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
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              <Link 
                href="/profile" 
                className="text-primary-blue flex items-center border border-gray-600 rounded-full py-1 px-3 hover:border-gray-400 transition-colors"
                title="Profile"
              >
                <FaUserCircle size={24} />
                {firstName && <span className="ml-2">{firstName}</span>}
              </Link>
            </div>
          </>
        ) : (
          // Unauthenticated navigation
          <>
            <div className="flex items-center">
              <Link href="/about" className="flex items-center">
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
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              <Link 
                href="/login" 
                className={`px-4 py-2 rounded-md text-white ${isActive('/login')}`}
              >
                Login
              </Link>
              <Link 
                href="/signup" 
                className="bg-primary-blue hover:bg-gray-700 text-white px-4 py-2 rounded-md transition-colors"
              >
                Sign Up
              </Link>
            </div>
          </>
        )}
      </div>
    </nav>
  );
} 