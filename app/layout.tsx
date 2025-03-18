import './globals.css';
import type { Metadata } from 'next';
import ClientWrapper from './components/ClientWrapper';
import Image from 'next/image';

export const metadata: Metadata = {
  title: 'Wattle',
  description: 'Upload and analyze your medical records with AI',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Wattle',
  },
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
  },
  other: {
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black-translucent',
  },
  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="manifest" href="/manifest.json" />
        <link
          href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-black min-h-screen">
        <main className="min-h-screen" data-scrollable="true">
          <div className="relative min-h-screen">
            {/* Plain black background */}
            <div className="absolute inset-0 z-0 bg-black fixed" style={{ touchAction: 'none' }}>
              {/* Background image removed */}
            </div>
            
            {/* Content */}
            <div className="relative z-10" data-scrollable="true">
              <ClientWrapper>
                {children}
              </ClientWrapper>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
} 