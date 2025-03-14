import './globals.css';
import type { Metadata } from 'next';
import ClientWrapper from './components/ClientWrapper';
import Image from 'next/image';

export const metadata: Metadata = {
  title: 'My Health Data',
  description: 'Upload and analyze your medical records with AI',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-white min-h-screen">
        <main className="min-h-screen">
          <div className="relative min-h-screen">
            {/* Background Image with increased opacity */}
            <div className="absolute inset-0 z-0 bg-black/40">
              <Image
                src="/images/logo.jpg"
                alt="Wattle Health Logo"
                fill
                className="object-cover opacity-60"
                sizes="100vw"
                style={{ objectPosition: 'center' }}
                priority
              />
            </div>
            
            {/* Content */}
            <div className="relative z-10">
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