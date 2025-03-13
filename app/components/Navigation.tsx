'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Navigation() {
  const pathname = usePathname();
  
  const isActive = (path: string) => {
    return pathname === path ? 'bg-blue-700' : '';
  };

  return (
    <nav className="bg-primary-blue text-white p-3 mb-6 rounded-md shadow-md">
      <div className="flex justify-between items-center">
        <ul className="flex flex-wrap justify-center gap-2 sm:gap-4">
          <li>
            <Link 
              href="/" 
              className={`px-3 py-2 rounded hover:bg-blue-700 transition-colors ${isActive('/')}`}
            >
              Home
            </Link>
          </li>
          <li>
            <Link 
              href="/records" 
              className={`px-3 py-2 rounded hover:bg-blue-700 transition-colors ${isActive('/records')}`}
            >
              Records
            </Link>
          </li>
          <li>
            <Link 
              href="/analysis" 
              className={`px-3 py-2 rounded hover:bg-blue-700 transition-colors ${isActive('/analysis')}`}
            >
              Analysis
            </Link>
          </li>
        </ul>
        <Link 
          href="/profile" 
          className={`px-2 py-2 rounded hover:bg-blue-700 transition-colors ${isActive('/profile')}`}
          title="Profile"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </Link>
      </div>
    </nav>
  );
} 