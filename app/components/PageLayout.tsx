import { ReactNode } from 'react';
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
  return (
    <div className="min-h-screen bg-black">
      <Navigation isHomePage={isHomePage} />
      
      {/* Main content container with consistent padding */}
      <main className="container mx-auto px-4 pt-16 pb-24">
        {/* Optional header section */}
        {(title || subtitle) && (
          <header className="mb-6 pt-8">
            {title && <h1 className="text-2xl font-bold text-primary-blue">{title}</h1>}
            {subtitle && <p className="text-gray-400 mt-1">{subtitle}</p>}
          </header>
        )}
        
        {/* Page content */}
        <div className="relative z-10">
          {children}
        </div>
      </main>
    </div>
  );
} 