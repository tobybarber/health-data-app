'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { FaUpload, FaComments, FaHeartbeat, FaClipboardList, FaHome } from 'react-icons/fa';

export default function BottomNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  
  const isActive = (path: string) => {
    return pathname === path ? 'text-primary-blue' : 'text-gray-400';
  };

  // Define the navigation routes in order
  const routes = ['/', '/upload', '/records', '/analysis', '/wearables'];
  const currentIndex = routes.indexOf(pathname);

  // Function to navigate without triggering Safari bars
  const navigateWithoutBars = (path: string, e: React.MouseEvent) => {
    e.preventDefault();
    
    // Use replaceState to change the URL without triggering a full navigation
    // This helps prevent Safari from showing the navigation bars
    window.history.replaceState(null, '', path);
    
    // Then use Next.js router to update the UI
    router.push(path);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-black/80 backdrop-blur-sm p-3 flex justify-around items-center border-t border-gray-800 z-10">
      <a
        href="/"
        onClick={(e) => navigateWithoutBars('/', e)}
        className="flex flex-col items-center text-center hover:scale-110 transition-all duration-200"
      >
        <div className={`${isActive('/')} text-xl mb-0.5`}>
          <FaHome />
        </div>
        <h2 className={`text-xs font-medium ${isActive('/')}`}>Home</h2>
      </a>
      
      <a
        href="/upload"
        onClick={(e) => navigateWithoutBars('/upload', e)}
        className="flex flex-col items-center text-center hover:scale-110 transition-all duration-200"
      >
        <div className={`${isActive('/upload')} text-xl mb-0.5`}>
          <FaUpload />
        </div>
        <h2 className={`text-xs font-medium ${isActive('/upload')}`}>Upload</h2>
      </a>
      
      <a
        href="/records"
        onClick={(e) => navigateWithoutBars('/records', e)}
        className="flex flex-col items-center text-center hover:scale-110 transition-all duration-200"
      >
        <div className={`${isActive('/records')} text-xl mb-0.5`}>
          <FaClipboardList />
        </div>
        <h2 className={`text-xs font-medium ${isActive('/records')}`}>Records</h2>
      </a>
      
      <a
        href="/analysis"
        onClick={(e) => navigateWithoutBars('/analysis', e)}
        className="flex flex-col items-center text-center hover:scale-110 transition-all duration-200"
      >
        <div className={`${isActive('/analysis')} text-xl mb-0.5`}>
          <FaComments />
        </div>
        <h2 className={`text-xs font-medium ${isActive('/analysis')}`}>Analysis</h2>
      </a>
      
      <a
        href="/wearables"
        onClick={(e) => navigateWithoutBars('/wearables', e)}
        className="flex flex-col items-center text-center hover:scale-110 transition-all duration-200"
      >
        <div className={`${isActive('/wearables')} text-xl mb-0.5`}>
          <FaHeartbeat />
        </div>
        <h2 className={`text-xs font-medium ${isActive('/wearables')}`}>Wearables</h2>
      </a>
    </div>
  );
} 