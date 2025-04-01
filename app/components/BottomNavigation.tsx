'use client';

import { usePathname } from 'next/navigation';
import { FaUpload, FaComments, FaHeartbeat, FaClipboardList, FaHome, FaPlus, FaFileAlt, FaChartLine } from 'react-icons/fa';
import StandaloneLink from './StandaloneLink';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function BottomNavigation() {
  const [isStandalone, setIsStandalone] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    // Check if the app is running in standalone mode
    const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches || 
                            (window.navigator as any).standalone || 
                            document.referrer.includes('android-app://');
    setIsStandalone(isStandaloneMode);
  }, []);

  const isActive = (path: string) => {
    return pathname === path ? 'text-primary-blue' : 'text-gray-400';
  };

  return (
    <nav 
      className={`fixed bottom-0 left-0 right-0 bg-gray-950/80 backdrop-blur-md z-50 ${
        isStandalone ? 'standalone-nav' : ''
      }`}
      style={{
        height: isStandalone ? 'calc(60px + env(safe-area-inset-bottom))' : '60px',
        borderTop: '1px solid rgba(31, 41, 55, 0.5)'
      }}
    >
      <div className="flex justify-around items-center h-full max-w-7xl mx-auto px-4">
        <Link 
          href="/" 
          className={`flex flex-col items-center ${isActive('/') ? 'text-primary-blue' : 'text-gray-400'} hover:text-white transition-colors`}
        >
          <FaHome className="text-xl" />
          <span className="text-xs mt-1">Home</span>
        </Link>
        <Link 
          href="/upload" 
          className={`flex flex-col items-center ${isActive('/upload') ? 'text-primary-blue' : 'text-gray-400'} hover:text-white transition-colors`}
        >
          <FaPlus className="text-xl" />
          <span className="text-xs mt-1">Upload</span>
        </Link>
        <Link 
          href="/records" 
          className={`flex flex-col items-center ${isActive('/records') ? 'text-primary-blue' : 'text-gray-400'} hover:text-white transition-colors`}
        >
          <FaFileAlt className="text-xl" />
          <span className="text-xs mt-1">Records</span>
        </Link>
        <Link 
          href="/analysis" 
          className={`flex flex-col items-center ${isActive('/analysis') ? 'text-primary-blue' : 'text-gray-400'} hover:text-white transition-colors`}
        >
          <FaChartLine className="text-xl" />
          <span className="text-xs mt-1">Analysis</span>
        </Link>
        <Link 
          href="/wearables" 
          className={`flex flex-col items-center ${isActive('/wearables') ? 'text-primary-blue' : 'text-gray-400'} hover:text-white transition-colors`}
        >
          <FaHeartbeat className="text-xl" />
          <span className="text-xs mt-1">Wearables</span>
        </Link>
      </div>
    </nav>
  );
} 