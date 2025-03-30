'use client';

import { useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import ProtectedRoute from '../components/ProtectedRoute';
import Navigation from '../components/Navigation';
import Link from 'next/link';

export default function CleanupPage() {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string>('');
  const [deletedCount, setDeletedCount] = useState(0);

  const callCleanupOperation = async (operation: string) => {
    if (!currentUser) {
      setMessage('You must be logged in to perform this operation');
      return;
    }

    if (operation === 'delete_all_fhir' && !confirm('Are you sure you want to delete ALL FHIR resources? This cannot be undone.')) {
      return;
    }
    
    if (operation === 'delete_lab_reports' && !confirm('Are you sure you want to delete all laboratory-related resources? This cannot be undone.')) {
      return;
    }

    setLoading(true);
    setMessage(`Running operation: ${operation}...`);

    try {
      // Get the authentication token
      const token = await currentUser.getIdToken();
      
      // Call the API
      const response = await fetch('/api/fhir/cleanup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ operation })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        setMessage(result.message || 'Operation completed successfully');
        if (result.deletedCount) {
          setDeletedCount(prev => prev + result.deletedCount);
        }
        
        // Add instruction to refresh page
        if (operation !== 'find_orphaned') {
          setMessage(prev => `${prev}\n\nPlease refresh your health records page to see the changes.`);
        }
      } else {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (error) {
      console.error('Error during cleanup operation:', error);
      setMessage(`Error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-black">
        <Navigation />
        <div className="h-16"></div>
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold text-primary-blue mb-6">FHIR Resources Cleanup</h1>
          
          <div className="bg-gray-800 rounded-md p-6 mb-6">
            <p className="text-white mb-6">
              This page allows you to clean up FHIR resources that may be causing issues with your health records. 
              If you're seeing records that won't disappear after deletion, this utility can help.
            </p>
            
            <div className="flex flex-col space-y-4 mb-6">
              <button 
                onClick={() => callCleanupOperation('delete_orphaned')}
                disabled={loading}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-3 rounded-md disabled:opacity-50"
              >
                Delete Orphaned Resources
              </button>
              
              <button 
                onClick={() => callCleanupOperation('delete_lab_reports')}
                disabled={loading}
                className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-3 rounded-md disabled:opacity-50"
              >
                Delete All Laboratory Reports
              </button>
              
              <button 
                onClick={() => callCleanupOperation('delete_all_fhir')}
                disabled={loading}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-3 rounded-md disabled:opacity-50"
              >
                Delete ALL FHIR Resources (Use with caution!)
              </button>
            </div>
            
            {loading && (
              <div className="flex items-center justify-center mb-4">
                <div className="w-8 h-8 border-t-2 border-blue-500 rounded-full animate-spin"></div>
                <span className="ml-2 text-white">Processing...</span>
              </div>
            )}
            
            {message && (
              <div className="bg-gray-700 p-4 rounded-md text-white whitespace-pre-line">
                {message}
              </div>
            )}
            
            {deletedCount > 0 && (
              <div className="mt-4 text-gray-300">
                Total resources deleted this session: {deletedCount}
              </div>
            )}
          </div>
          
          <div className="flex justify-between items-center">
            <Link href="/health-records" className="text-blue-400 hover:text-blue-300">
              ← Back to Health Records
            </Link>
            
            <div>
              <button 
                onClick={() => window.location.reload()}
                className="text-white bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-md"
              >
                Refresh Page
              </button>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
} 