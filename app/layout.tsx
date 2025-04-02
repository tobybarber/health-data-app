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
    icon: '/images/black leaf.png',
    apple: [
      {
        url: '/images/black leaf.png',
        sizes: '180x180',
        type: 'image/png',
      },
      {
        url: '/images/black leaf.png',
        sizes: '152x152',
        type: 'image/png',
      },
      {
        url: '/images/black leaf.png',
        sizes: '120x120',
        type: 'image/png',
      }
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Elyna Health',
    startupImage: [
      {
        url: '/images/black leaf.png',
        media: '(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2)',
      }
    ]
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
  viewportFit: 'cover'
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
        <meta name="apple-mobile-web-app-title" content="Elyna Health" />
        <meta name="theme-color" content="#000000" />
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="apple-touch-icon" href="/images/black leaf.png" />
        <link rel="apple-touch-icon" sizes="152x152" href="/images/black leaf.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/images/black leaf.png" />
        <link rel="apple-touch-icon" sizes="167x167" href="/images/black leaf.png" />
        <link rel="apple-touch-startup-image" href="/images/black leaf.png" />
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