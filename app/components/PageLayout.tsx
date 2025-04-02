import { ReactNode, useEffect, useState } from 'react';
import Navigation from './Navigation';
import { usePathname } from 'next/navigation';

interface PageLayoutProps {
  children: ReactNode;
  isHomePage?: boolean;
  title?: string;
  subtitle?: string;
}

export default function PageLayout({
  children,
  isHomePage = false,
  title,
  subtitle,
}: PageLayoutProps) {
  const [isStandalone, setIsStandalone] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    // Check if the app is running in standalone mode
    const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches || 
                            (window.navigator as any).standalone || 
                            document.referrer.includes('android-app://');
    setIsStandalone(isStandaloneMode);
  }, []);

  return (
    <div className={`min-h-screen ${!isHomePage ? 'bg-gray-950' : ''}`}>
      <Navigation isHomePage={isHomePage} isStandalone={isStandalone} />
      <main className="relative pt-16">
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