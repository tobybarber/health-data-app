import './globals.css';
import type { Metadata, Viewport } from 'next';
import { AuthProvider } from './lib/AuthContext';
import dynamic from 'next/dynamic';

// Import the ClientWrapper component dynamically with no SSR
const ClientWrapper = dynamic(() => import('./components/ClientWrapper'), { ssr: false });

// Define metadata with minimal properties and only ASCII characters
export const metadata: Metadata = {
  title: 'Health Data App',
  description: 'Track and manage your health data'
};

// Define viewport with minimal properties
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  userScalable: false, // Disable pinch zooming for better touch handling
  minimumScale: 1,
  maximumScale: 1
};

// RootLayout is a server component
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no, viewport-fit=cover" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className="bg-black min-h-screen">
        <ClientWrapper>
          <AuthProvider>
            {children}
          </AuthProvider>
        </ClientWrapper>
      </body>
    </html>
  );
} 