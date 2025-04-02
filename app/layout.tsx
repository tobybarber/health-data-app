import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Providers } from './providers';
import { Inter } from 'next/font/google';
import dynamic from 'next/dynamic';

const inter = Inter({ subsets: ['latin'] });

// Import the ClientWrapper component dynamically with no SSR
const ClientWrapper = dynamic(() => import('./components/ClientWrapper'), {
  ssr: false,
});

// Import the StandaloneModeHandler component dynamically with no SSR
const StandaloneModeHandler = dynamic(() => import('./components/StandaloneModeHandler'), {
  ssr: false,
});

export const metadata: Metadata = {
  title: 'Elyna Health',
  description: 'Personal health assistant powered by AI',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/images/leaf.png',
    apple: '/images/leaf.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Elyna Health',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  }
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-touch-fullscreen" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Elyna" />
        <meta name="theme-color" content="#000000" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="bg-black min-h-screen">
        <Providers>
          <StandaloneModeHandler />
          <ClientWrapper>
            {children}
          </ClientWrapper>
        </Providers>
      </body>
    </html>
  );
} 