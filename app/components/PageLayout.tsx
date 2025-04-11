import { ReactNode, useContext, useEffect } from 'react';
import Navigation from './Navigation';
import { usePathname } from 'next/navigation';
import { StandaloneModeContext } from './ClientWrapper';
import { useAuth } from '../lib/AuthContext';

interface PageLayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
}

export default function PageLayout({
  children,
  title,
  subtitle,
}: PageLayoutProps) {
  const pathname = usePathname();
  const { isStandalone } = useContext(StandaloneModeContext);
  const { currentUser } = useAuth();
  
  useEffect(() => {
    if (currentUser) {
      console.log('Current user UID:', currentUser.uid);
    } else {
      console.log('No user is currently signed in');
    }
  }, [currentUser]);

  return (
    <div className="min-h-screen bg-gray-950">
      <Navigation />
      <main className={`relative ${isStandalone ? 'pt-15' : 'pt-16'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-8">
            {title && (
              <h1 className="text-2xl font-bold text-white">
                {title}
              </h1>
            )}
            {subtitle && (
              <p className="mt-1 text-gray-400">{subtitle}</p>
            )}
            <div className={`${title ? 'mt-4' : ''} space-y-6`}>
              {children}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
} 