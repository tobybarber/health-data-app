'use client';

import { Inter } from 'next/font/google';
import './globals.css';
import Image from 'next/image';
import ClientWrapper from './components/ClientWrapper';
import { usePathname } from 'next/navigation';
import { AuthProvider } from './lib/AuthContext';
import { useState, useEffect } from 'react';
import HomeScreenDetect from './components/HomeScreenDetect';
import AppleSplashScreen from './components/AppleSplashScreen';

const inter = Inter({ subsets: ['latin'] });

// Create a context for the background logo visibility
import { createContext, useContext } from 'react';

export const BackgroundLogoContext = createContext({
  showBackgroundLogo: true,
  setShowBackgroundLogo: (show: boolean) => {}
});

export function useBackgroundLogo() {
  return useContext(BackgroundLogoContext);
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [showBackgroundLogo, setShowBackgroundLogo] = useState(true);

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
        <meta name="theme-color" content="#000000" />
        <meta name="description" content="Upload and analyze your medical records with AI" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' rx='20' fill='%23000'/%3E%3Cimage href='/images/logo.png' x='20' y='20' height='60' width='60' preserveAspectRatio='xMidYMid meet'/%3E%3C/svg%3E" />
        <link rel="manifest" href="/manifest.json" />
        <title>Wattle</title>
        <HomeScreenDetect />
        <AppleSplashScreen />
        <link
          href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-black min-h-screen">
        <main className="min-h-screen" data-scrollable="true">
          <BackgroundLogoContext.Provider value={{ showBackgroundLogo, setShowBackgroundLogo }}>
            <AuthProvider>
              <div className="relative min-h-screen">
                {/* Black background with centered logo */}
                {showBackgroundLogo && (
                  <div className="absolute inset-0 z-0 bg-black fixed" style={{ touchAction: 'none' }}>
                    <div className="absolute inset-0 flex items-center justify-center opacity-15" style={{ paddingBottom: '15vh' }}>
                      <div className="w-48 h-48 relative grayscale">
                        <Image
                          src="/images/logo.png"
                          alt="Wattle Logo"
                          fill
                          style={{ objectFit: 'contain' }}
                          priority
                        />
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Content */}
                <div className="relative z-10" data-scrollable="true">
                  <ClientWrapper>
                    {children}
                  </ClientWrapper>
                </div>
              </div>
            </AuthProvider>
          </BackgroundLogoContext.Provider>
        </main>
      </body>
    </html>
  );
} 