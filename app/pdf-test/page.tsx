'use client';

import PdfUploader from '../components/PdfUploader';

export default function PdfTestPage() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8 text-center">PDF Upload and Analysis Test</h1>
      <PdfUploader />
    </div>
  );
} 