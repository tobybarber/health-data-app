'use client';

import { usePathname } from 'next/navigation';
import Navigation from './Navigation';

export default function ClientNavigationWrapper() {
  const pathname = usePathname();
  
  // Don't show the navigation bar on the home page
  if (pathname === '/') {
    return null;
  }
  
  return <Navigation isHomePage={false} />;
} 