'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { collection, getDocs, doc, deleteDoc, getDoc, setDoc, serverTimestamp, onSnapshot, query, orderBy } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import ProtectedRoute from '../components/ProtectedRoute';
import Navigation from '../components/Navigation';
import { FaPlus, FaFileAlt } from 'react-icons/fa';
import { invalidateRecordsCache, isRecordsCacheValid } from '../lib/cache-utils';
import { extractTagContent, extractBriefSummary, extractDetailedAnalysis, extractRecordType, extractRecordDate } from '../lib/analysis-utils';

interface Record {
  id: string;
  name: string;
  url?: string;
  urls?: string[];
  isMultiFile?: boolean;
  fileCount?: number;
  analysis: string;
  briefSummary?: string;
  detailedAnalysis?: string;
  recordType?: string;
  recordDate?: string;
  createdAt?: any;
  isManual?: boolean;
  hasPhoto?: boolean;
  comment?: string;
  openaiFileId?: string;
  openaiFileIds?: string[];
  combinedImagesToPdf?: boolean;
  simpleTestResult?: string;
  analyzed?: boolean;
}

// Cache duration in milliseconds (5 minutes)
const CACHE_DURATION = 300000;

export default function Records() {
  const [records, setRecords] = useState<Record[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [expandedRecords, setExpandedRecords] = useState<string[]>([]);
  const [viewDetailedAnalysis, setViewDetailedAnalysis] = useState<string[]>([]);
  const { currentUser } = useAuth();

  // Function to format date to month year format
  const formatDateToMonthYear = (dateStr: string): string => {
    // Try to parse the date string
    const date = new Date(dateStr);
    
    // Check if the date is valid
    if (!isNaN(date.getTime())) {
      // Return formatted date (e.g., "Jan 2023")
      return date.toLocaleString('default', { month: 'short', year: 'numeric' });
    }
    
    // If we can't parse it as a date, try to extract month and year using regex
    const monthYearRegex = /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{4}\b/i;
    const match = dateStr.match(monthYearRegex);
    if (match) {
      return match[0];
    }
    
    // If all else fails, return the original string
    return dateStr;
  };

  // Setup real-time listener to Firestore records collection
  useEffect(() => {
    if (!currentUser) return;
    
    setLoading(true);
    
    // Reference to the user's records collection
    const recordsRef = collection(db, 'users', currentUser.uid, 'records');
    
    // Create a query to order by createdAt (newest first)
    const recordsQuery = query(recordsRef, orderBy('createdAt', 'desc'));
    
    // Set up the snapshot listener
    const unsubscribe = onSnapshot(recordsQuery, 
      (snapshot) => {        
        const recordsList = snapshot.docs.map(doc => {
          const data = doc.data();
          
          // Process record data
          let recordDate = null;
          if (data.recordDate) {
            recordDate = data.recordDate;
          } else if (data.analysis) {
            recordDate = extractRecordDate(data.analysis);
          }
          
          // If we still don't have a valid recordDate but have createdAt, use it
          if ((!recordDate || recordDate === 'Unknown') && data.createdAt) {
            recordDate = new Date(data.createdAt.seconds * 1000).toISOString().split('T')[0];
          }
          
          // Use briefSummary field if available, otherwise extract from analysis
          let briefSummary = null;
          if (data.briefSummary) {
            briefSummary = data.briefSummary;
          } else if (data.analysis) {
            briefSummary = extractBriefSummary(data.analysis);
          }
          
          // Clean any record type of ## markers
          if (data.recordType) {
            data.recordType = data.recordType.replace(/##/g, '');
          }
          
          return {
            id: doc.id,
            ...data,
            recordDate,
            briefSummary
          } as Record;
        });
        
        setRecords(recordsList);
        setLoading(false);
      },
      (error) => {
        setError("Error loading records. Please try again.");
        setLoading(false);
      }
    );
    
    // Clean up the listener when component unmounts
    return () => {
      unsubscribe();
    };
  }, [currentUser]);

  // Update displayedRecord function to prioritize detailedAnalysis and briefSummary fields
  const displayedSummary = (record: Record, isDetailed: boolean): string => {
    // Check if analysis is pending but don't return a message (will show content as it updates)
    if (isDetailed) {
      // For detailed view, first check detailedAnalysis field, then fallback to extraction
      return record.detailedAnalysis || extractDetailedAnalysis(record.analysis) || 'No detailed analysis available';
    } else {
      // For brief view, first check briefSummary field, then fallback to extraction
      return record.briefSummary || extractBriefSummary(record.analysis) || 'No brief summary available';
    }
  };

  const handleDelete = async (record: Record) => {
    if (!currentUser) return;
    if (!confirm('Are you sure you want to delete this record? This action cannot be undone.')) {
      return;
    }

    try {
      setDeleting(record.id);
      
      // Get the Firebase ID token
      const token = await currentUser.getIdToken();
      
      // Use the secure API endpoint to delete the record
      const response = await fetch(`/api/records/${record.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Error deleting record: ${response.status}`);
      }
      
      // Remove the record from the UI
      const updatedRecords = records.filter(r => r.id !== record.id);
      setRecords(updatedRecords);
      
      // Update the cache after deletion
      try {
        localStorage.setItem(`records_${currentUser.uid}`, JSON.stringify(updatedRecords));
        localStorage.setItem(`records_${currentUser.uid}_timestamp`, Date.now().toString());
      } catch (storageError) {
        // Silent error handling for localStorage failures
      }
      
    } catch (err) {
      setError('Failed to delete record. Please try again later.');
    } finally {
      setDeleting(null);
    }
  };

  const toggleSummary = (recordId: string) => {
    setExpandedRecords((prev: string[]) => 
      prev.includes(recordId) 
        ? prev.filter((id: string) => id !== recordId) 
        : [...prev, recordId]
    );
  };

  const toggleDetailedView = (recordId: string) => {
    setViewDetailedAnalysis(prev => 
      prev.includes(recordId) 
        ? prev.filter((id) => id !== recordId) 
        : [...prev, recordId]
    );
  };

  return (
    <ProtectedRoute>
      <div className="pb-safe pt-safe">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-primary-blue">My Records</h1>
            <div className="flex items-center gap-2">
              <Link 
                href="/upload" 
                className="bg-black/80 backdrop-blur-sm px-4 py-2 rounded-md text-primary-blue border border-primary-blue hover:bg-black/90 transition-colors flex items-center"
              >
                <FaPlus className="mr-2" /> New
              </Link>
            </div>
          </div>
          
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-12 h-12 rounded-full border-4 border-gray-300 border-t-primary-blue animate-spin mb-4"></div>
              <p className="text-gray-300 text-lg font-medium">Loading your records</p>
            </div>
          ) : records.length === 0 ? (
            <div className="text-center py-8 bg-black/80 backdrop-blur-sm p-4 rounded-md shadow-md border border-gray-800">
              <FaFileAlt className="mx-auto text-4xl text-gray-400 mb-2" />
              <h2 className="text-xl font-semibold text-gray-300 mb-2">No Records Found</h2>
              <p className="text-gray-400 mb-4">You haven't uploaded any health records yet.</p>
              <Link 
                href="/upload" 
                className="inline-flex items-center px-4 py-2 bg-primary-blue text-white rounded-md hover:bg-gray-700 transition-colors"
              >
                <FaPlus className="mr-2" /> Upload Your First Record
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {records.map(record => (
                <div key={record.id} className="bg-gray-800 p-3 rounded-md shadow-md border border-gray-700">
                  <div className="flex justify-between items-start mb-1">
                    <div>
                      <h2 className="text-lg font-medium text-white">
                        {record.recordType ? 
                          record.recordType.replace(/##/g, '').replace(/\*\*/g, '') : 
                          (record.name || 'Medical Record')}
                      </h2>
                    </div>
                    <div className="text-sm text-white">
                      {/* Display only the date in mmm yyyy format */}
                      {record.recordDate ? (
                        formatDateToMonthYear(record.recordDate)
                      ) : record.createdAt && record.createdAt.seconds ? (
                        new Date(record.createdAt.seconds * 1000).toLocaleString('default', { month: 'short', year: 'numeric' })
                      ) : record.createdAt ? (
                        // Handle string ISO dates
                        new Date(record.createdAt).toLocaleString('default', { month: 'short', year: 'numeric' })
                      ) : (
                        'Date Unknown'
                      )}
                    </div>
                  </div>
                  
                  {record.hasPhoto && record.url && (
                    <div className="mb-2 mt-1">
                      <div className="h-32 w-32 relative overflow-hidden rounded border border-gray-300">
                        <img 
                          src={record.url} 
                          alt={`Photo for ${record.name}`} 
                          className="object-cover w-full h-full"
                        />
                      </div>
                    </div>
                  )}
                  
                  <div className="mb-2">
                    <button 
                      onClick={() => toggleSummary(record.id)}
                      className="text-white hover:text-white text-sm font-medium mb-2"
                    >
                      {expandedRecords.includes(record.id) ? 'Hide Summary' : 'Show Summary'}
                    </button>
                    
                    {expandedRecords.includes(record.id) && (
                      <div className="mt-2">
                        <div className="flex justify-end items-center mb-1">
                          {viewDetailedAnalysis.includes(record.id) && (
                            <h3 className="text-sm font-medium text-white mr-auto">
                              Detailed Analysis
                            </h3>
                          )}
                          <button 
                            onClick={() => toggleDetailedView(record.id)}
                            className="text-xs text-blue-400 hover:text-blue-300"
                          >
                            {viewDetailedAnalysis.includes(record.id) ? 'View Brief Summary' : 'View Detailed Analysis'}
                          </button>
                        </div>
                        
                        <p className="text-gray-300 text-sm">
                          {displayedSummary(record, viewDetailedAnalysis.includes(record.id))}
                        </p>
                        
                        {/* Display comment directly under summary if this is a comment-only record */}
                        {record.comment && !(record.urls && record.urls.length > 0) && !record.url && (
                          <div className="mt-2 p-2 bg-gray-700 rounded-md border border-gray-600">
                            <h3 className="text-sm font-medium text-white mb-1">Comment:</h3>
                            <p className="text-gray-300 text-sm">{record.comment}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <button 
                      onClick={() => handleDelete(record)}
                      disabled={deleting === record.id}
                      className={`text-red-500 hover:text-red-700 text-sm ${deleting === record.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                      style={{ touchAction: 'manipulation' }}
                    >
                      {deleting === record.id ? 'Deleting...' : 'Delete'}
                    </button>
                    
                    {(record.isMultiFile || record.url || record.comment) && (
                      <button 
                        onClick={() => {
                          setExpandedRecords((prev) => 
                            prev.includes(record.id) ? prev.filter((id) => id !== record.id) : [...prev, record.id]
                          );
                        }}
                        className="text-white hover:text-gray-300 text-sm ml-2"
                      >
                        {expandedRecords.includes(record.id) ? '▲' : '▼'}
                      </button>
                    )}
                  </div>
                  
                  {expandedRecords.includes(record.id) && (
                    <div className="mt-2 border-t border-gray-700 pt-2">
                      {record.isMultiFile ? (
                        <div>
                          <h3 className="font-semibold text-white text-sm">Files:</h3>
                          <ul className="mt-1">
                            {record.urls && record.urls.map((url, index) => (
                              <li key={index}>
                                <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 text-sm">
                                  File {index + 1}
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : (record.url || (record.urls && record.urls.length === 1)) ? (
                        <div>
                          <h3 className="font-semibold text-white text-sm">File:</h3>
                          <ul className="mt-1">
                            <li>
                              <a 
                                href={record.url || (record.urls ? record.urls[0] : '')} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="text-blue-400 hover:text-blue-300 text-sm"
                              >
                                {(record.url || (record.urls && record.urls[0] || '')).includes('.pdf') || 
                                 (record.url || (record.urls && record.urls[0] || '')).includes('pdf') ? 
                                  'View PDF' : 'View File'}
                              </a>
                            </li>
                          </ul>
                        </div>
                      ) : record.comment && (record.urls && record.urls.length > 0 || record.url) ? (
                        <div>
                          <h3 className="font-semibold text-white text-sm">Comment:</h3>
                          <div className="text-gray-300 text-sm mt-1">{record.comment}</div>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
} 