'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FaUpload, FaComments, FaHeartbeat, FaClipboardList, FaHome } from 'react-icons/fa';

export default function BottomNavigation() {
  const pathname = usePathname();
  
  const isActive = (path: string) => {
    return pathname === path ? 'text-primary-blue' : 'text-gray-400';
  };

  return (
    <>
      <div className="fixed bottom-[16px] left-0 right-0 h-[1px] bg-gray-800 z-10"></div>
      <div className="fixed bottom-[10px] left-0 right-0 bg-black/80 backdrop-blur-sm p-3 pt-3 pb-4 flex justify-around items-center z-10">
        <Link
          href="/"
          className="flex flex-col items-center text-center hover:scale-110 transition-all duration-200"
        >
          <div className={`${isActive('/')} text-xl mb-1`}>
            <FaHome />
          </div>
          <h2 className={`text-xs font-medium ${isActive('/')}`}>Home</h2>
        </Link>
        
        <Link
          href="/upload"
          className="flex flex-col items-center text-center hover:scale-110 transition-all duration-200"
        >
          <div className={`${isActive('/upload')} text-xl mb-1`}>
            <FaUpload />
          </div>
          <h2 className={`text-xs font-medium ${isActive('/upload')}`}>Upload</h2>
        </Link>
        
        <Link
          href="/records"
          className="flex flex-col items-center text-center hover:scale-110 transition-all duration-200"
        >
          <div className={`${isActive('/records')} text-xl mb-1`}>
            <FaClipboardList />
          </div>
          <h2 className={`text-xs font-medium ${isActive('/records')}`}>Records</h2>
        </Link>
        
        <Link
          href="/analysis"
          className="flex flex-col items-center text-center hover:scale-110 transition-all duration-200"
        >
          <div className={`${isActive('/analysis')} text-xl mb-1`}>
            <FaComments />
          </div>
          <h2 className={`text-xs font-medium ${isActive('/analysis')}`}>Analysis</h2>
        </Link>
        
        <Link
          href="/wearables"
          className="flex flex-col items-center text-center hover:scale-110 transition-all duration-200"
        >
          <div className={`${isActive('/wearables')} text-xl mb-1`}>
            <FaHeartbeat />
          </div>
          <h2 className={`text-xs font-medium ${isActive('/wearables')}`}>Wearables</h2>
        </Link>
      </div>
    </>
  );
} 