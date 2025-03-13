import Link from 'next/link';

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh]">
      <h1 className="text-2xl font-bold text-blue-600 mb-4">My Health Data</h1>
      <p className="text-gray-600 mb-8 text-center">
        Upload and analyze your medical records with AI
      </p>
      <div className="flex flex-col sm:flex-row gap-4">
        <Link href="/upload" className="bg-primary-green hover:bg-green-600 text-white px-4 py-2 rounded text-center">
          Upload Files
        </Link>
        <Link href="/records" className="bg-primary-blue hover:bg-blue-600 text-white px-4 py-2 rounded text-center">
          View Records
        </Link>
      </div>
    </div>
  );
} 