'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { collection, getDocs, doc, deleteDoc, getDoc } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import ProtectedRoute from '../components/ProtectedRoute';
import HomeNavigation from '../components/HomeNavigation';

interface Record {
  id: string;
  name: string;
  url?: string;
  urls?: string[];
  isMultiFile?: boolean;
  fileCount?: number;
  analysis: string;
  createdAt?: any;
  isManual?: boolean;
  hasPhoto?: boolean;
}

export default function Records() {
  const [records, setRecords] = useState<Record[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [debugMode, setDebugMode] = useState(false);
  const [expandedRecords, setExpandedRecords] = useState<string[]>([]);
  const { currentUser } = useAuth();

  const fetchRecords = async () => {
    try {
      if (!currentUser) return;
      
      console.log('📂 Fetching records from Firestore...');
      const recordsCollection = collection(db, 'users', currentUser.uid, 'records');
      const recordsSnapshot = await getDocs(recordsCollection);
      
      console.log(`📊 Found ${recordsSnapshot.docs.length} records in Firestore`);
      
      const recordsList = recordsSnapshot.docs.map(doc => {
        const data = doc.data();
        console.log(`📄 Record ID: ${doc.id}, Name: ${data.name || 'unnamed'}`);
        return {
          id: doc.id,
          ...data
        } as Record;
      });
      
      // Sort by createdAt if available, newest first
      recordsList.sort((a, b) => {
        if (a.createdAt && b.createdAt) {
          return b.createdAt.seconds - a.createdAt.seconds;
        }
        return 0;
      });
      
      setRecords(recordsList);
    } catch (err) {
      console.error('❌ Error fetching records:', err);
      setError('Failed to load records. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchRecords();
    }
  }, [currentUser]);

  const handleDelete = async (record: Record) => {
    if (!currentUser) return;
    if (!confirm('Are you sure you want to delete this record? This action cannot be undone.')) {
      return;
    }

    try {
      setDeleting(record.id);
      console.log(`🗑️ Deleting record: ${record.id}, Name: ${record.name || 'unnamed'}`);
      
      // Check if record exists in Firestore
      const recordRef = doc(db, 'users', currentUser.uid, 'records', record.id);
      const recordDoc = await getDoc(recordRef);
      
      if (!recordDoc.exists()) {
        console.warn(`⚠️ Record ${record.id} not found in Firestore, removing from UI only`);
        // If record doesn't exist in Firestore, just remove it from UI
        setRecords(records.filter(r => r.id !== record.id));
        return;
      }
      
      // Delete from Firestore
      await deleteDoc(recordRef);
      console.log(`✅ Deleted record ${record.id} from Firestore`);
      
      // Delete from Storage - handle both single and multi-file records
      if (record.isMultiFile && record.urls && record.urls.length > 0) {
        // Delete all files in the record
        console.log(`🗑️ Deleting ${record.urls.length} files from Storage`);
        for (const url of record.urls) {
          try {
            if (url && typeof url === 'string') {
              if (url.startsWith('http')) {
                // Extract the path from the URL
                const path = url.split('firebase.storage.googleapis.com/')[1];
                if (path) {
                  const decodedPath = decodeURIComponent(path.split('?')[0]);
                  console.log(`🗑️ Deleting file: ${decodedPath}`);
                  const fileRef = ref(storage, decodedPath);
                  await deleteObject(fileRef);
                  console.log(`✅ Deleted file: ${decodedPath}`);
                } else {
                  console.warn(`⚠️ Could not extract path from URL: ${url}`);
                }
              } else {
                console.warn(`⚠️ URL does not start with http: ${url}`);
              }
            } else {
              console.warn(`⚠️ Invalid URL: ${url}`);
            }
          } catch (err) {
            console.error(`❌ Error deleting file: ${url}`, err);
            // Continue with other files even if one fails
          }
        }
      } else if (record.url && typeof record.url === 'string') {
        // Delete single file
        try {
          if (record.url.startsWith('http')) {
            // Extract the path from the URL
            const path = record.url.split('firebase.storage.googleapis.com/')[1];
            if (path) {
              const decodedPath = decodeURIComponent(path.split('?')[0]);
              console.log(`🗑️ Deleting file: ${decodedPath}`);
              const fileRef = ref(storage, decodedPath);
              await deleteObject(fileRef);
              console.log(`✅ Deleted file: ${decodedPath}`);
            } else {
              console.warn(`⚠️ Could not extract path from URL: ${record.url}`);
            }
          } else {
            console.warn(`⚠️ URL does not start with http: ${record.url}`);
          }
        } catch (err) {
          console.error(`❌ Error deleting file: ${record.url}`, err);
        }
      }
      
      // Update the records list
      setRecords(records.filter(r => r.id !== record.id));
      console.log(`✅ Removed record ${record.id} from UI`);
      
      // Check if we need to update the holistic analysis
      const remainingRecords = await getDocs(collection(db, 'users', currentUser.uid, 'records'));
      if (remainingRecords.docs.length === 0) {
        // If no records left, clear the holistic analysis
        try {
          await deleteDoc(doc(db, 'users', currentUser.uid, 'analysis', 'holistic'));
          console.log(`✅ Deleted holistic analysis`);
        } catch (err) {
          console.error('❌ Error deleting holistic analysis:', err);
          // Continue even if this fails
        }
      }
      
    } catch (err) {
      console.error('❌ Error deleting record:', err);
      
      // Force delete from UI if user confirms
      if (confirm('Error deleting record. Would you like to remove it from the list anyway?')) {
        setRecords(records.filter(r => r.id !== record.id));
        console.log(`⚠️ Force removed record ${record.id} from UI`);
      } else {
        alert('Failed to delete record. Please try again.');
      }
    } finally {
      setDeleting(null);
    }
  };

  const toggleDebugMode = () => {
    setDebugMode(!debugMode);
  };

  const toggleSummary = (recordId: string) => {
    setExpandedRecords((prev: string[]) => 
      prev.includes(recordId) 
        ? prev.filter((id: string) => id !== recordId) 
        : [...prev, recordId]
    );
  };

  return (
    <ProtectedRoute>
      <div className="p-6 pt-20">
        <HomeNavigation />
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-primary-blue">My Records</h1>
          <div className="flex items-center gap-3">
            <Link 
              href="/upload" 
              className="bg-white/80 backdrop-blur-sm px-4 py-2 rounded-md text-primary-blue border border-primary-blue hover:bg-white/90 transition-colors flex items-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              Upload
            </Link>
            <Link 
              href="/manual-record" 
              className="bg-white/80 backdrop-blur-sm px-4 py-2 rounded-md text-primary-blue border border-primary-blue hover:bg-white/90 transition-colors flex items-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Manual Record
            </Link>
            <button 
              onClick={toggleDebugMode} 
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              {debugMode ? 'Hide Debug' : 'Debug'}
            </button>
          </div>
        </div>
        
        {debugMode && (
          <div className="bg-white/80 backdrop-blur-sm p-4 mb-4 rounded-md shadow-md text-xs">
            <h3 className="font-bold mb-1">Debug Info:</h3>
            <p>Records in state: {records.length}</p>
            <button 
              onClick={fetchRecords}
              className="bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded mt-1"
            >
              Refresh Records
            </button>
          </div>
        )}
        
        {loading && <p className="text-gray-600 p-4">Loading records...</p>}
        
        {error && <p className="text-red-500 mb-4 p-4">{error}</p>}
        
        {!loading && records.length === 0 && (
          <div className="text-center py-8 bg-white/80 backdrop-blur-sm p-4 rounded-md shadow-md">
            <p className="text-gray-600 mb-4">No records found.</p>
            <Link 
              href="/upload" 
              className="bg-primary-blue text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors inline-flex items-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              Upload Your First Record
            </Link>
          </div>
        )}
        
        {!loading && records.length > 0 && (
          <div className="space-y-4">
            {records.map(record => (
              <div key={record.id} className="bg-white/80 backdrop-blur-sm p-4 rounded-md shadow-md">
                <div className="flex justify-between items-start mb-2">
                  <h2 className="text-lg font-medium text-blue-600">{record.name || 'Unnamed Record'}</h2>
                  <div className="flex gap-2">
                    {record.isManual && (
                      <span className="bg-purple-100 text-purple-800 text-xs font-medium px-2.5 py-0.5 rounded">
                        Manual
                      </span>
                    )}
                    {record.hasPhoto && (
                      <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        Photo
                      </span>
                    )}
                    {record.isMultiFile && record.fileCount && (
                      <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded">
                        {record.fileCount} pages
                      </span>
                    )}
                  </div>
                </div>
                
                {record.hasPhoto && record.url && (
                  <div className="mb-3 mt-2">
                    <div className="h-32 w-32 relative overflow-hidden rounded border border-gray-300">
                      <img 
                        src={record.url} 
                        alt={`Photo for ${record.name}`} 
                        className="object-cover w-full h-full"
                      />
                    </div>
                  </div>
                )}
                
                {debugMode && (
                  <div className="bg-gray-50 p-2 mb-2 text-xs font-mono">
                    <p>ID: {record.id}</p>
                    <p>Created: {record.createdAt?.toDate?.().toLocaleString() || 'Unknown'}</p>
                    <p>URL: {record.url ? (record.url.length > 30 ? record.url.substring(0, 30) + '...' : record.url) : 'None'}</p>
                    <p>Multi-file: {record.isMultiFile ? 'Yes' : 'No'}</p>
                    <p>Files: {record.urls?.length || 1}</p>
                  </div>
                )}
                
                <div className="mb-3">
                  <button 
                    onClick={() => toggleSummary(record.id)}
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium mb-2"
                  >
                    {expandedRecords.includes(record.id) ? 'Hide Summary' : 'Show Summary'}
                  </button>
                  
                  {expandedRecords.includes(record.id) && (
                    <p className="text-gray-800 text-sm mt-2">{record.analysis || 'No analysis available'}</p>
                  )}
                </div>
                
                <div className="flex justify-between items-center">
                  <button 
                    onClick={() => handleDelete(record)}
                    disabled={deleting === record.id}
                    className={`text-red-500 hover:text-red-700 text-sm ${deleting === record.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {deleting === record.id ? 'Deleting...' : 'Delete'}
                  </button>
                  <Link href="/analysis" className="text-primary-blue hover:underline text-sm">
                    View Analysis
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
} 