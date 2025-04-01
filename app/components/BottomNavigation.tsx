'use client';

import { usePathname } from 'next/navigation';
import { FaUpload, FaComments, FaHeartbeat, FaClipboardList, FaHome } from 'react-icons/fa';
import StandaloneLink from './StandaloneLink';

export default function BottomNavigation() {
  const pathname = usePathname();
  
  const isActive = (path: string) => {
    return pathname === path ? 'text-primary-blue' : 'text-gray-400';
  };

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 h-[1px] bg-gray-800 z-10"></div>
      <div 
        className="fixed bottom-0 left-0 right-0 bg-black/90 backdrop-blur-sm p-3 pt-3 pb-4 flex justify-around items-center z-10 border-t border-gray-800 pb-safe" 
        style={{ 
          height: 'calc(70px + env(safe-area-inset-bottom, 0px))', 
          paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))', 
          paddingTop: '12px' 
        }}
      >
        <StandaloneLink
          href="/"
          className="flex flex-col items-center justify-center text-center hover:scale-110 transition-all duration-200"
          style={{ height: '45px' }}
        >
          <div className={`${isActive('/')} text-xl mb-1`}>
            <FaHome />
          </div>
          <h2 className={`text-xs font-medium ${isActive('/')}`}>Home</h2>
        </StandaloneLink>
        
        <StandaloneLink
          href="/upload"
          className="flex flex-col items-center justify-center text-center hover:scale-110 transition-all duration-200"
          style={{ height: '45px' }}
        >
          <div className={`${isActive('/upload')} text-xl mb-1`}>
            <FaUpload />
          </div>
          <h2 className={`text-xs font-medium ${isActive('/upload')}`}>Upload</h2>
        </StandaloneLink>
        
        <StandaloneLink
          href="/records"
          className="flex flex-col items-center justify-center text-center hover:scale-110 transition-all duration-200"
          style={{ height: '45px' }}
        >
          <div className={`${isActive('/records')} text-xl mb-1`}>
            <FaClipboardList />
          </div>
          <h2 className={`text-xs font-medium ${isActive('/records')}`}>Records</h2>
        </StandaloneLink>
        
        <StandaloneLink
          href="/analysis"
          className="flex flex-col items-center justify-center text-center hover:scale-110 transition-all duration-200"
          style={{ height: '45px' }}
        >
          <div className={`${isActive('/analysis')} text-xl mb-1`}>
            <FaComments />
          </div>
          <h2 className={`text-xs font-medium ${isActive('/analysis')}`}>Analysis</h2>
        </StandaloneLink>
        
        <StandaloneLink
          href="/wearables"
          className="flex flex-col items-center justify-center text-center hover:scale-110 transition-all duration-200"
          style={{ height: '45px' }}
        >
          <div className={`${isActive('/wearables')} text-xl mb-1`}>
            <FaHeartbeat />
          </div>
          <h2 className={`text-xs font-medium ${isActive('/wearables')}`}>Wearables</h2>
        </StandaloneLink>
      </div>
    </>
  );
} 