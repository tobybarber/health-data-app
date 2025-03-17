'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { collection, getDocs, doc, deleteDoc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';
import ProtectedRoute from '../components/ProtectedRoute';
import Navigation from '../components/Navigation';

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
}

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

  // Function to extract content from XML-like tags
  const extractTagContent = (text: string, tagName: string): string | null => {
    if (!text) return null;
    const regex = new RegExp(`<${tagName}>\\s*([\\s\\S]*?)\\s*<\\/${tagName}>`, 'i');
    const match = text.match(regex);
    return match ? match[1].trim() : null;
  };

  // Function to extract brief summary from analysis text
  const extractBriefSummary = (analysis: string): string => {
    if (!analysis) return 'No analysis available';
    
    // First try to extract using XML-like tags (new format)
    const briefSummaryFromXml = extractTagContent(analysis, 'BRIEF_SUMMARY');
    if (briefSummaryFromXml) {
      return briefSummaryFromXml
        .replace(/^[-–—]+\s*/, '')
        .replace(/===\s*[^=]+\s*===/g, '')
        .replace(/\*\*/g, '');
    }
    
    // Try to match the new format with numbered sections
    const numberedBriefSummaryMatch = analysis.match(/2\.?\s*BRIEF SUMMARY:?\s*([\s\S]*?)(?=3\.?\s*DOCUMENT TYPE|DOCUMENT TYPE|$)/i);
    if (numberedBriefSummaryMatch && numberedBriefSummaryMatch[1]) {
      // Remove file headers like "=== Shared Health Summary.pdf ==="
      return numberedBriefSummaryMatch[1].trim()
        .replace(/^[-–—]+\s*/, '')
        .replace(/===\s*[^=]+\s*===/g, '')
        .replace(/\*\*/g, '');
    }
    
    // Try to match with just BRIEF SUMMARY: heading
    const briefSummaryMatch = analysis.match(/BRIEF SUMMARY:?\s*([\s\S]*?)(?=DOCUMENT TYPE|TYPE|DATE|$)/i);
    if (briefSummaryMatch && briefSummaryMatch[1]) {
      // Remove file headers like "=== Shared Health Summary.pdf ==="
      return briefSummaryMatch[1].trim()
        .replace(/^[-–—]+\s*/, '')
        .replace(/===\s*[^=]+\s*===/g, '')
        .replace(/\*\*/g, '');
    }
    
    // Try to extract the brief summary section with double asterisks - more strict pattern
    const doubleAsteriskMatch = analysis.match(/\*\*BRIEF_SUMMARY:\*\*([\s\S]*?)(?=\*\*RECORD_TYPE:|$)/);
    if (doubleAsteriskMatch && doubleAsteriskMatch[1]) {
      // Remove file headers like "=== Shared Health Summary.pdf ==="
      return doubleAsteriskMatch[1].trim()
        .replace(/^[-–—]+\s*/, '')
        .replace(/===\s*[^=]+\s*===/g, '')
        .replace(/\*\*/g, '');
    }
    
    // If we can't find a specific brief summary section, return a default message
    return 'No brief summary available';
  };

  // Function to extract detailed analysis from analysis text
  const extractDetailedAnalysis = (analysis: string): string => {
    if (!analysis) return 'No analysis available';
    
    // First try to extract using XML-like tags (new format)
    const detailedAnalysisFromXml = extractTagContent(analysis, 'DETAILED_ANALYSIS');
    if (detailedAnalysisFromXml) {
      return detailedAnalysisFromXml
        .replace(/^[-–—]+\s*/, '')
        .replace(/===\s*[^=]+\s*===/g, '')
        .replace(/\*\*/g, '');
    }
    
    // Try to match the new format with numbered sections
    const numberedDetailedAnalysisMatch = analysis.match(/1\.?\s*DETAILED ANALYSIS:?\s*([\s\S]*?)(?=2\.?\s*BRIEF SUMMARY|BRIEF SUMMARY|$)/i);
    if (numberedDetailedAnalysisMatch && numberedDetailedAnalysisMatch[1]) {
      // Remove file headers like "=== Shared Health Summary.pdf ==="
      return numberedDetailedAnalysisMatch[1].trim()
        .replace(/^[-–—]+\s*/, '')
        .replace(/===\s*[^=]+\s*===/g, '')
        .replace(/\*\*/g, '');
    }
    
    // Try to match with just DETAILED ANALYSIS: heading
    const detailedAnalysisMatch = analysis.match(/DETAILED ANALYSIS:?\s*([\s\S]*?)(?=BRIEF SUMMARY|SUMMARY|DOCUMENT TYPE|DATE|$)/i);
    if (detailedAnalysisMatch && detailedAnalysisMatch[1]) {
      // Remove file headers like "=== Shared Health Summary.pdf ==="
      return detailedAnalysisMatch[1].trim()
        .replace(/^[-–—]+\s*/, '')
        .replace(/===\s*[^=]+\s*===/g, '')
        .replace(/\*\*/g, '');
    }
    
    // Try to extract the detailed analysis section with double asterisks - more strict pattern
    const doubleAsteriskMatch = analysis.match(/\*\*DETAILED_ANALYSIS:\*\*([\s\S]*?)(?=\*\*BRIEF_SUMMARY:|$)/);
    if (doubleAsteriskMatch && doubleAsteriskMatch[1]) {
      // Remove file headers like "=== Shared Health Summary.pdf ==="
      return doubleAsteriskMatch[1].trim()
        .replace(/^[-–—]+\s*/, '')
        .replace(/===\s*[^=]+\s*===/g, '')
        .replace(/\*\*/g, '');
    }
    
    // If we can't find a specific detailed analysis section, return a default message
    return 'No detailed analysis available';
  };

  // Function to extract record type from analysis text
  const extractRecordType = (analysis: string): string => {
    if (!analysis) return 'Unknown';
    
    // First try to extract using XML-like tags (new format)
    const recordTypeFromXml = extractTagContent(analysis, 'DOCUMENT_TYPE');
    if (recordTypeFromXml) {
      return recordTypeFromXml
        .replace(/^[-–—]+\s*/, '')
        .replace(/\*\*/g, '');
    }
    
    // Try to match the new format with numbered sections
    const numberedRecordTypeMatch = analysis.match(/3\.?\s*DOCUMENT TYPE:?\s*([\s\S]*?)(?=4\.?\s*DATE|DATE|$)/i);
    if (numberedRecordTypeMatch && numberedRecordTypeMatch[1]) {
      return numberedRecordTypeMatch[1].trim()
        .replace(/^[-–—]+\s*/, '')
        .replace(/\*\*/g, '');
    }
    
    // Try to match with just DOCUMENT TYPE: heading
    const recordTypeMatch = analysis.match(/DOCUMENT TYPE:?\s*([\s\S]*?)(?=DATE|$)/i);
    if (recordTypeMatch && recordTypeMatch[1]) {
      return recordTypeMatch[1].trim()
        .replace(/^[-–—]+\s*/, '')
        .replace(/\*\*/g, '');
    }
    
    // Try to extract the record type section with double asterisks - more strict pattern
    const doubleAsteriskMatch = analysis.match(/\*\*RECORD_TYPE:\*\*([\s\S]*?)(?=\*\*DATE:|$)/);
    if (doubleAsteriskMatch && doubleAsteriskMatch[1]) {
      return doubleAsteriskMatch[1].trim()
        .replace(/^[-–—]+\s*/, '')
        .replace(/\*\*/g, '');
    }
    
    // If we can't find a specific record type section, return a default value
    return 'Medical Record';
  };

  // Function to extract record date from analysis text
  const extractRecordDate = (analysis: string): string => {
    if (!analysis) return '';
    
    // First try to extract using XML-like tags (new format)
    const recordDateFromXml = extractTagContent(analysis, 'DATE');
    if (recordDateFromXml) {
      return recordDateFromXml
        .replace(/^[-–—]+\s*/, '')
        .replace(/\*\*/g, '');
    }
    
    // Try to match the new format with numbered sections
    const numberedRecordDateMatch = analysis.match(/4\.?\s*DATE:?\s*([\s\S]*?)(?=$)/i);
    if (numberedRecordDateMatch && numberedRecordDateMatch[1]) {
      return numberedRecordDateMatch[1].trim()
        .replace(/^[-–—]+\s*/, '')
        .replace(/\*\*/g, '');
    }
    
    // Try to match with just DATE: heading
    const recordDateMatch = analysis.match(/DATE:?\s*([\s\S]*?)(?=$)/i);
    if (recordDateMatch && recordDateMatch[1]) {
      return recordDateMatch[1].trim()
        .replace(/^[-–—]+\s*/, '')
        .replace(/\*\*/g, '');
    }
    
    // Try to extract the date section with double asterisks - more strict pattern
    const doubleAsteriskMatch = analysis.match(/\*\*DATE:\*\*([\s\S]*?)(?=$)/);
    if (doubleAsteriskMatch && doubleAsteriskMatch[1]) {
      return doubleAsteriskMatch[1].trim()
        .replace(/^[-–—]+\s*/, '')
        .replace(/\*\*/g, '');
    }
    
    // If we can't find a specific date section, return an empty string
    return '';
  };

  const fetchRecords = async () => {
    try {
      if (!currentUser) return;
      
      setLoading(true);
      
      // Get the Firebase ID token
      const token = await currentUser.getIdToken();
      
      // Use the secure API endpoint to fetch records
      const response = await fetch('/api/records', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Error fetching records: ${response.status}`);
      }
      
      const data = await response.json();
      const recordsList = data.records.map((record: any) => {
        // Process record data
        let recordDate = null;
        if (record.analysis) {
          recordDate = extractRecordDate(record.analysis);
          if (recordDate === 'Unknown' && record.recordDate) {
            recordDate = record.recordDate;
          }
        } else if (record.recordDate) {
          recordDate = record.recordDate;
        }
        
        // Always extract brief summary from analysis if available
        let briefSummary = null;
        if (record.analysis) {
          briefSummary = extractBriefSummary(record.analysis);
        } else if (record.briefSummary) {
          briefSummary = record.briefSummary;
        }
        
        // Clean any record type of ## markers
        if (record.recordType) {
          record.recordType = record.recordType.replace(/##/g, '');
        }
        
        return {
          id: record.id,
          ...record,
          recordDate,
          briefSummary
        } as Record;
      });
      
      // Sort by createdAt if available, newest first
      recordsList.sort((a: Record, b: Record) => {
        if (a.createdAt && b.createdAt) {
          return b.createdAt.seconds - a.createdAt.seconds;
        }
        return 0;
      });
      
      setRecords(recordsList);
    } catch (err) {
      // Only log errors in development mode
      if (process.env.NODE_ENV === 'development') {
        console.error('Error fetching records:', err);
      }
      setError('Failed to load records. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  // Remove the refresh interval and keep the original useEffect
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
      setRecords(records.filter(r => r.id !== record.id));
      
    } catch (err) {
      // Only log errors in development mode
      if (process.env.NODE_ENV === 'development') {
        console.error('Error deleting record:', err);
      }
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
      <div className="p-6 pt-20">
        <Navigation isHomePage={true} />
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
              Upload new
            </Link>
          </div>
        </div>
        
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
                  <h2 className="text-lg font-medium text-blue-600">
                    {record.recordType ? 
                      record.recordType.replace(/##/g, '').replace(/\*\*/g, '') : 
                      (record.name || 'Medical Record')}
                  </h2>
                  <div className="text-sm text-blue-600">
                    {/* Display only the date in mmm yyyy format */}
                    {record.recordDate ? (
                      formatDateToMonthYear(record.recordDate)
                    ) : record.createdAt && record.createdAt.seconds ? (
                      new Date(record.createdAt.seconds * 1000).toLocaleString('default', { month: 'short', year: 'numeric' })
                    ) : (
                      'Date Unknown'
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
                
                <div className="mb-3">
                  <button 
                    onClick={() => toggleSummary(record.id)}
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium mb-2"
                  >
                    {expandedRecords.includes(record.id) ? 'Hide Summary' : 'Show Summary'}
                  </button>
                  
                  {expandedRecords.includes(record.id) && (
                    <div className="mt-2">
                      <div className="flex justify-end items-center mb-2">
                        {viewDetailedAnalysis.includes(record.id) && (
                          <h3 className="text-sm font-medium text-gray-700 mr-auto">
                            Detailed Analysis
                          </h3>
                        )}
                        <button 
                          onClick={() => toggleDetailedView(record.id)}
                          className="text-xs text-blue-600 hover:text-blue-800"
                        >
                          {viewDetailedAnalysis.includes(record.id) ? 'View Brief Summary' : 'View Detailed Analysis'}
                        </button>
                      </div>
                      
                      <p className="text-gray-800 text-sm">
                        {viewDetailedAnalysis.includes(record.id) 
                          ? (record.detailedAnalysis || extractDetailedAnalysis(record.analysis) || 'No detailed analysis available')
                          : (record.briefSummary || 'No brief summary available')}
                      </p>
                      
                      {/* Display comment directly under summary if this is a comment-only record */}
                      {record.comment && !(record.urls && record.urls.length > 0) && !record.url && (
                        <div className="mt-3 p-3 bg-gray-50 rounded-md border border-gray-200">
                          <h3 className="text-sm font-medium text-gray-700 mb-1">Comment:</h3>
                          <p className="text-gray-800 text-sm">{record.comment}</p>
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
                  >
                    {deleting === record.id ? 'Deleting...' : 'Delete'}
                  </button>
                  
                  <div className="flex items-center">
                    <button 
                      onClick={() => {
                        // Toggle the visibility of files or comment without affecting the summary
                        setExpandedRecords((prev) => 
                          prev.includes(record.id) ? prev.filter((id) => id !== record.id) : [...prev, record.id]
                        );
                      }}
                      className={`text-sm font-medium px-2 py-1 rounded-md ${
                        record.isMultiFile || (record.url && (record.url.includes('.pdf') || record.url.includes('pdf'))) 
                          ? 'bg-blue-200 text-blue-800' 
                          : 'bg-green-200 text-green-800'
                      } hover:bg-opacity-80`}
                    >
                      {(() => {
                        // More robust page count display logic
                        if (record.isMultiFile) {
                          // For multi-file records, show the file count or fallback to URLs length
                          return `${record.fileCount || record.urls?.length || 1} pages`;
                        } else if (record.url && (record.url.includes('.pdf') || record.url.includes('pdf'))) {
                          // For PDF files, show the page count if available
                          if (record.fileCount && record.fileCount > 1) {
                            return `${record.fileCount} pages`;
                          } else if (record.fileCount === 1) {
                            return '1 page';
                          } else {
                            // If fileCount is not set yet, show a generic label
                            return 'PDF';
                          }
                        } else if (record.comment) {
                          // For comment-only records
                          return 'Comment';
                        } else {
                          // Default fallback
                          return '1 page';
                        }
                      })()}
                    </button>
                  </div>
                </div>
                
                {expandedRecords.includes(record.id) && (
                  <div className="mt-2">
                    {record.isMultiFile ? (
                      <div>
                        <h3 className="font-semibold">Files:</h3>
                        <ul>
                          {record.urls && record.urls.map((url, index) => (
                            <li key={index}>
                              <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                File {index + 1}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : record.url && (record.url.includes('.pdf') || record.url.includes('pdf')) ? (
                      <div>
                        <h3 className="font-semibold">File:</h3>
                        <ul>
                          <li>
                            <a href={record.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                              View PDF
                            </a>
                          </li>
                        </ul>
                      </div>
                    ) : record.comment && (record.urls && record.urls.length > 0 || record.url) ? (
                      <div>
                        <h3 className="font-semibold">Comment:</h3>
                        <div className="text-gray-800 text-sm mt-2">{record.comment}</div>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
} 