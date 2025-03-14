'use client';

import Link from 'next/link';

export default function MenuTestPage() {
  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">Menu Test Page</h1>
      
      <div className="relative">
        <button className="bg-blue-500 text-white px-4 py-2 rounded">
          Menu Button (Not Functional)
        </button>
        
        <div className="bg-red-500 absolute right-0 top-12 w-48 rounded-md z-50 py-2 px-3">
          <ul>
            <li className="py-2 border-b border-white">
              <Link href="/" className="block text-white hover:text-blue-200 transition-colors">
                Home
              </Link>
            </li>
            <li className="py-2 border-b border-white">
              <Link href="/upload" className="block text-white hover:text-blue-200 transition-colors">
                Upload Records
              </Link>
            </li>
            <li className="py-2 border-b border-white">
              <Link href="/records" className="block text-white hover:text-blue-200 transition-colors">
                View Records
              </Link>
            </li>
            <li className="py-2 border-b border-white">
              <Link href="/analysis" className="block text-white hover:text-blue-200 transition-colors">
                Analysis
              </Link>
            </li>
            <li className="py-2 border-b border-white">
              <Link href="/wearables" className="block text-white hover:text-blue-200 transition-colors">
                Wearables
              </Link>
            </li>
            <li className="py-2 border-b border-white">
              <Link href="/about" className="block text-white hover:text-blue-200 transition-colors font-bold">
                About
              </Link>
            </li>
            <li className="py-2">
              <Link href="/profile" className="block text-white hover:text-blue-200 transition-colors">
                Profile
              </Link>
            </li>
          </ul>
        </div>
      </div>
      
      <p className="mt-8">
        <Link href="/about" className="text-blue-500 hover:underline">
          Direct link to About page
        </Link>
      </p>
    </div>
  );
} 