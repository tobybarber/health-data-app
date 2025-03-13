import './globals.css';
import type { Metadata } from 'next';
import Navigation from './components/Navigation';
import ErrorBoundary from './components/ErrorBoundary';

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
        <main className="container mx-auto max-w-md p-4">
          <ErrorBoundary>
            <Navigation />
            {children}
          </ErrorBoundary>
        </main>
      </body>
    </html>
  );
} 