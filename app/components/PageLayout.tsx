import { ReactNode, useEffect, useState } from 'react';
import Navigation from './Navigation';

interface PageLayoutProps {
  children: ReactNode;
  isHomePage?: boolean;
  title?: string;
  subtitle?: string;
  showBackgroundLogo?: boolean;
}

export default function PageLayout({
  children,
  isHomePage = false,
  title,
  subtitle,
  showBackgroundLogo = false
}: PageLayoutProps) {
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if the app is running in standalone mode
    const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches || 
                            (window.navigator as any).standalone || 
                            document.referrer.includes('android-app://');
    setIsStandalone(isStandaloneMode);
  }, []);

  return (
    <div className="min-h-screen bg-gray-950">
      <Navigation isHomePage={isHomePage} isStandalone={isStandalone} />
      <main 
        className={`${isStandalone ? 'pt-0' : 'pt-16'} pb-24 transition-all duration-200`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-4">
            {title && (
              <h1 className={`text-2xl font-bold text-white ${isStandalone ? 'mt-2' : 'mt-0'}`}>
                {title}
              </h1>
            )}
            {subtitle && (
              <p className="mt-1 text-gray-400">{subtitle}</p>
            )}
            <div className={`${title ? 'mt-4' : ''} ${isStandalone ? 'space-y-4' : 'space-y-6'}`}>
              {children}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
} 