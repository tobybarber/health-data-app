'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../lib/AuthContext';
import { useState, useRef, useEffect } from 'react';
import { FaUser, FaBars } from 'react-icons/fa';

interface NavigationProps {
  isHomePage?: boolean;
}

export default function Navigation({ isHomePage = false }: NavigationProps) {
  const pathname = usePathname();
  const { currentUser } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  
  const isActive = (path: string) => {
    return pathname === path ? 'bg-white/20' : '';
  };

  const toggleMenu = () => {
    setMenuOpen(!menuOpen);
  };

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        menuRef.current && 
        buttonRef.current && 
        !menuRef.current.contains(event.target as Node) && 
        !buttonRef.current.contains(event.target as Node)
      ) {
        setMenuOpen(false);
      }
    }
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Home page navigation layout
  if (isHomePage) {
    return (
      <>
        {/* Navigation Header */}
        <header className="bg-white/80 backdrop-blur-sm p-4 flex justify-between items-center shadow-md w-full absolute top-0 left-0 right-0">
          <Link href="/" className="text-2xl font-bold text-primary-blue">Wattle</Link>
          <div className="flex items-center space-x-4">
            {currentUser && (
              <Link href="/profile" className="text-primary-blue">
                <FaUser size={24} />
              </Link>
            )}
            <button 
              ref={buttonRef}
              onClick={toggleMenu} 
              className={`text-primary-blue focus:outline-none transition-transform duration-200 ${menuOpen ? 'rotate-90' : ''}`}
              aria-label="Menu"
            >
              <FaBars size={24} />
            </button>
          </div>
        </header>

        {/* Dropdown Menu */}
        {menuOpen && (
          <div 
            ref={menuRef}
            className="bg-white/90 backdrop-blur-sm shadow-md absolute right-4 top-16 w-48 rounded-md z-20 py-2 px-3 transition-all duration-300 ease-in-out"
          >
            <ul>
              <li className="py-2 border-b border-gray-200">
                <Link href="/upload" className="block text-primary-blue hover:text-blue-700 transition-colors">
                  Upload Records
                </Link>
              </li>
              <li className="py-2 border-b border-gray-200">
                <Link href="/records" className="block text-primary-blue hover:text-blue-700 transition-colors">
                  View Records
                </Link>
              </li>
              <li className="py-2 border-b border-gray-200">
                <Link href="/analysis" className="block text-primary-blue hover:text-blue-700 transition-colors">
                  Health Analysis
                </Link>
              </li>
              <li className="py-2 border-b border-gray-200">
                <Link href="/wearables" className="block text-primary-blue hover:text-blue-700 transition-colors">
                  Wearables
                </Link>
              </li>
              <li className="py-2 border-b border-gray-200">
                <Link href="/about" className="block text-primary-blue hover:text-blue-700 transition-colors">
                  About
                </Link>
              </li>
              {currentUser && (
                <li className="py-2">
                  <Link href="/profile" className="block text-primary-blue hover:text-blue-700 transition-colors">
                    Profile
                  </Link>
                </li>
              )}
            </ul>
          </div>
        )}
      </>
    );
  }

  // Standard navigation layout for other pages
  return (
    <nav className="bg-white/80 backdrop-blur-sm p-4 mb-6 shadow-md">
      <div className="flex justify-between items-center">
        {currentUser ? (
          // Authenticated navigation
          <>
            <Link href="/" className="text-2xl font-bold text-primary-blue hover:text-blue-700 transition-colors">Wattle</Link>
            <div className="flex items-center space-x-4">
              <Link 
                href="/profile" 
                className="text-primary-blue"
                title="Profile"
              >
                <FaUser size={24} />
              </Link>
              <div className="relative" ref={menuRef}>
                <button 
                  ref={buttonRef}
                  onClick={toggleMenu}
                  className={`text-primary-blue focus:outline-none transition-transform duration-200 ${menuOpen ? 'rotate-90' : ''}`}
                  aria-label="Menu"
                >
                  <FaBars size={24} />
                </button>
                
                {menuOpen && (
                  <div className="bg-white/90 backdrop-blur-sm shadow-md absolute right-0 top-10 w-48 rounded-md z-20 py-2 px-3">
                    <ul>
                      <li className="py-2 border-b border-gray-200">
                        <Link 
                          href="/" 
                          className="block text-primary-blue hover:text-blue-700 transition-colors"
                          onClick={() => setMenuOpen(false)}
                        >
                          Home
                        </Link>
                      </li>
                      <li className="py-2 border-b border-gray-200">
                        <Link 
                          href="/upload" 
                          className="block text-primary-blue hover:text-blue-700 transition-colors"
                          onClick={() => setMenuOpen(false)}
                        >
                          Upload Records
                        </Link>
                      </li>
                      <li className="py-2 border-b border-gray-200">
                        <Link 
                          href="/records" 
                          className="block text-primary-blue hover:text-blue-700 transition-colors"
                          onClick={() => setMenuOpen(false)}
                        >
                          View Records
                        </Link>
                      </li>
                      <li className="py-2 border-b border-gray-200">
                        <Link 
                          href="/analysis" 
                          className="block text-primary-blue hover:text-blue-700 transition-colors"
                          onClick={() => setMenuOpen(false)}
                        >
                          Analysis
                        </Link>
                      </li>
                      <li className="py-2 border-b border-gray-200">
                        <Link 
                          href="/wearables" 
                          className="block text-primary-blue hover:text-blue-700 transition-colors"
                          onClick={() => setMenuOpen(false)}
                        >
                          Wearables
                        </Link>
                      </li>
                      <li className="py-2 border-b border-gray-200">
                        <Link 
                          href="/about" 
                          className="block text-primary-blue hover:text-blue-700 transition-colors"
                          onClick={() => setMenuOpen(false)}
                        >
                          About
                        </Link>
                      </li>
                      <li className="py-2">
                        <Link 
                          href="/profile" 
                          className="block text-primary-blue hover:text-blue-700 transition-colors"
                          onClick={() => setMenuOpen(false)}
                        >
                          Profile
                        </Link>
                      </li>
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          // Unauthenticated navigation
          <div className="w-full flex justify-between items-center">
            <Link href="/" className="text-2xl font-bold text-primary-blue">Wattle</Link>
            <div className="flex gap-4">
              <Link 
                href="/login" 
                className="text-primary-blue hover:text-blue-700 transition-colors"
              >
                Log In
              </Link>
              <Link 
                href="/signup" 
                className="text-primary-blue hover:text-blue-700 transition-colors"
              >
                Sign Up
              </Link>
              <Link 
                href="/about" 
                className="text-primary-blue hover:text-blue-700 transition-colors font-bold"
              >
                About
              </Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
} 