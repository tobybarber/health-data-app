import './globals.css';
import type { Metadata } from 'next';
import ClientWrapper from './components/ClientWrapper';
import Image from 'next/image';

export const metadata: Metadata = {
  title: 'Wattle',
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
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link
          href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-black min-h-screen">
        <main className="min-h-screen">
          <div className="relative min-h-screen">
            {/* Plain black background */}
            <div className="absolute inset-0 z-0 bg-black fixed" style={{ touchAction: 'none' }}>
              {/* Background image removed */}
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