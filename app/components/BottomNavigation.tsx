'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FaUpload, FaComments, FaHeartbeat, FaClipboardList, FaHome } from 'react-icons/fa';

export default function BottomNavigation() {
  const pathname = usePathname();
  
  const isActive = (path: string) => {
    return pathname === path ? 'text-primary-blue' : 'text-gray-400';
  };

  // Define the navigation routes in order
  const routes = ['/', '/upload', '/records', '/analysis', '/wearables'];
  const currentIndex = routes.indexOf(pathname);

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-black/80 backdrop-blur-sm p-4 flex justify-around items-center border-t border-gray-800 z-10">
      <Link
        href="/"
        className="flex flex-col items-center text-center hover:scale-110 transition-all duration-200"
      >
        <div className={`${isActive('/')} text-2xl mb-1`}>
          <FaHome />
        </div>
        <h2 className={`text-sm font-medium ${isActive('/')}`}>Home</h2>
      </Link>
      
      <Link
        href="/upload"
        className="flex flex-col items-center text-center hover:scale-110 transition-all duration-200"
      >
        <div className={`${isActive('/upload')} text-2xl mb-1`}>
          <FaUpload />
        </div>
        <h2 className={`text-sm font-medium ${isActive('/upload')}`}>Upload</h2>
      </Link>
      
      <Link
        href="/records"
        className="flex flex-col items-center text-center hover:scale-110 transition-all duration-200"
      >
        <div className={`${isActive('/records')} text-2xl mb-1`}>
          <FaClipboardList />
        </div>
        <h2 className={`text-sm font-medium ${isActive('/records')}`}>Records</h2>
      </Link>
      
      <Link
        href="/analysis"
        className="flex flex-col items-center text-center hover:scale-110 transition-all duration-200"
      >
        <div className={`${isActive('/analysis')} text-2xl mb-1`}>
          <FaComments />
        </div>
        <h2 className={`text-sm font-medium ${isActive('/analysis')}`}>Analysis</h2>
      </Link>
      
      <Link
        href="/wearables"
        className="flex flex-col items-center text-center hover:scale-110 transition-all duration-200"
      >
        <div className={`${isActive('/wearables')} text-2xl mb-1`}>
          <FaHeartbeat />
        </div>
        <h2 className={`text-sm font-medium ${isActive('/wearables')}`}>Wearables</h2>
      </Link>
    </div>
  );
} 