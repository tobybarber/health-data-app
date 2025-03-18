'use client';

import { useState, FormEvent, ChangeEvent, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, setDoc, collection, addDoc, serverTimestamp, getDocs, query, limit, updateDoc } from 'firebase/firestore';
import { storage, db, getFirebaseConfig } from '../lib/firebase';
import { isApiKeyValid } from '../lib/openai';
import { analyzeRecord, uploadFirestoreFileToOpenAI } from '../lib/openai-utils';
import { useAuth } from '../lib/AuthContext';
import ProtectedRoute from '../components/ProtectedRoute';
import Navigation from '../components/Navigation';
import { invalidateRecordsCache } from '../lib/cache-utils';
import { testFirestoreWrite } from '../lib/test-utils';

interface ErrorResponse {
  message?: string;
  error?: string;
  details?: string;
  recordId?: string;
}

export default function Upload() {
  const [files, setFiles] = useState<File[]>([]);
  const [recordName, setRecordName] = useState('');
  const [comment, setComment] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'analyzing' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [apiKeyValid, setApiKeyValid] = useState<boolean | null>(null);
  const [apiKeyChecked, setApiKeyChecked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { currentUser } = useAuth();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // Check if device is mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  useEffect(() => {
    // Check if OpenAI API key is valid
    async function checkApiKey() {
      try {
        const isValid = await isApiKeyValid();
        setApiKeyValid(isValid);
        setApiKeyChecked(true);
        if (!isValid) {
          setError(
            'OpenAI API Key Issue\n\n' +
            'The OpenAI API key is missing or invalid. Files will be uploaded but analysis will be skipped.\n\n' +
            'How to fix this\n' +
            '1. Check the .env.local file in the project root\n' +
            '2. Ensure your OpenAI API key is correctly configured\n' +
            '3. Restart the development server if you make changes'
          );
        }
      } catch (err) {
        // Only log errors in development mode
        if (process.env.NODE_ENV === 'development') {
          console.error('Error checking API key:', err);
        }
        setApiKeyChecked(true);
        setApiKeyValid(false);
        // Don't set error here to avoid blocking the UI
      }
    }
    
    checkApiKey();
    
    // Test Firestore write access in development mode only
    if (currentUser) {
      testFirestoreWrite(currentUser.uid);
    }
  }, [currentUser]);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const fileArray = Array.from(e.target.files);
      setFiles(fileArray);
      
      setError(null);
      setUploadStatus('idle');
    }
  };

  const handleFileUpload = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!currentUser) {
      setError('You must be logged in to upload files');
      return;
    }
    
    if (files.length === 0 && !comment.trim()) {
      setError('Please select at least one file to upload or provide a comment.');
      return;
    }

    const supportedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!files.every((file: File) => supportedTypes.includes(file.type))) {
      setError('Only PDF, JPG, and PNG files are supported.');
      return;
    }
    
    // Add size and count checks
    const MAX_FILES = 20;
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    
    if (files.length > MAX_FILES) {
      setError(`You can upload a maximum of ${MAX_FILES} files at once.`);
      return;
    }
    
    const oversizedFiles = files.filter(file => file.size > MAX_FILE_SIZE);
    if (oversizedFiles.length > 0) {
      setError(`The following files exceed the 10MB size limit: ${oversizedFiles.map(f => f.name).join(', ')}`);
      return;
    }

    try {
      setIsLoading(true);
      setIsUploading(true);
      setError(null);
      setUploadProgress(0);
      setUploadStatus('uploading');
      
      // Get the Firebase ID token
      const token = await currentUser.getIdToken();
      
      // Create form data for the API request
      const formData = new FormData();
      files.forEach(file => formData.append('files', file));
      formData.append('recordName', recordName);
      formData.append('comment', comment);
      
      // Set up timeout for long requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minute timeout
      
      try {
        // Upload files using the secure API endpoint with timeout
        const response = await fetch('/api/records/upload', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData,
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Upload failed with status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Invalidate the records cache to ensure fresh data on next load
        if (currentUser.uid) {
          invalidateRecordsCache(currentUser.uid);
        }
        
        setUploadStatus('success');
        setUploadProgress(100);
        
        // Reset form
        setFiles([]);
        setRecordName('');
        setComment('');
        
        // Remove auto-navigation to records page
        // router.push('/records');
      } catch (fetchError: any) {
        // Handle abort/timeout specifically
        if (fetchError.name === 'AbortError') {
          throw new Error('Upload timed out. Try uploading fewer or smaller files at once.');
        }
        throw fetchError;
      }
      
    } catch (err: any) {
      // Only log errors in development mode
      if (process.env.NODE_ENV === 'development') {
        console.error('Error uploading files:', err);
      }
      setUploadStatus('error');
      setError(err.message || 'Failed to upload files. Please try again.');
    } finally {
      setIsLoading(false);
      setIsUploading(false);
    }
  };

  // Update the button's disabled state
  const isUploadDisabled = !(recordName.trim() || comment.trim() || files.length > 0);

  return (
    <ProtectedRoute>
      <div className="pb-safe pt-safe">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <h1 className="text-2xl font-bold text-primary-blue mb-6"></h1>
          
          {apiKeyValid === false && !isLoading && (
            <div className="mb-6 p-4 bg-red-100 text-red-700 rounded-md shadow-md">
              <p className="font-medium">OpenAI API Key Issue</p>
              <p>The OpenAI API key is invalid or not configured properly. You can still upload files, but analysis may not work correctly.</p>
            </div>
          )}
          
          {error && (
            <div className="mb-6 p-4 bg-red-100 text-red-700 rounded-md shadow-md">
              <p className="font-medium">Error</p>
              <p>{error}</p>
            </div>
          )}
          
          {(uploadStatus as 'idle' | 'uploading' | 'analyzing' | 'success' | 'error') === 'success' ? (
            <div className="bg-gradient-to-br from-blue-900 to-indigo-900 p-6 rounded-md shadow-lg text-center">
              <div className="mb-4 text-green-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-20 w-20 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-white mb-3">Upload Complete!</h2>
              <p className="mb-8 text-blue-100">Your health records have been uploaded and are being analyzed.</p>
              <div className="flex justify-center space-x-6">
                <Link 
                  href="/records" 
                  className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-md shadow-md transition-colors font-medium"
                >
                  View Records
                </Link>
                <button 
                  onClick={() => {
                    setFiles([]);
                    setRecordName('');
                    setComment('');
                    setUploadStatus('idle');
                    setUploadProgress(0);
                    setAnalysisProgress(0);
                  }}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-md shadow-md transition-colors font-medium"
                >
                  Upload Another
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-black/80 backdrop-blur-sm p-4 rounded-md shadow-md text-left">
              <button
                onClick={handleFileUpload}
                className="text-white px-4 py-2 rounded-md border border-primary-blue hover:bg-black/20 transition-colors"
              >
                Upload File/Photo
              </button>
              <p className="mt-2 text-sm text-gray-400">
                Supported formats: PDF, JPG, PNG (Max 10MB per file)
              </p>
            </div>
          )}

          {/* Upload Form */}
          <form onSubmit={handleSubmit} className="bg-black/80 backdrop-blur-sm p-4 rounded-md shadow-md border border-gray-800 mt-4">
            <div className="mb-6">
              <label htmlFor="recordName" className="block text-sm font-medium text-gray-300 mb-1">
                Record Name (optional)
              </label>
              <input
                type="text"
                id="recordName"
                value={recordName}
                onChange={(e) => setRecordName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 bg-gray-800 text-white"
                placeholder="e.g., Annual Checkup 2023"
              />
            </div>

            <div className="mb-6">
              <label htmlFor="comment" className="block text-sm font-medium text-gray-300 mb-1">
                Comment (optional)
              </label>
              <textarea
                id="comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="w-full px-3 py-2 border border-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 bg-gray-800 text-white"
                placeholder="Add any comments here..."
              />
            </div>

            <div className="mb-6">
              <div className="mt-1">
                <div className="flex flex-wrap gap-3 mb-3">
                </div>
                
                {/* File input for gallery photos/files */}
                <input
                  id="file-upload"
                  name="file-upload"
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  multiple
                  onChange={handleFileChange}
                  accept=".pdf,.jpg,.jpeg,.png"
                  disabled={isUploading}
                />
              </div>
              {files.length > 0 && (
                <div className="mt-2">
                  <p className="text-sm text-gray-500">
                    {files.length} {files.length === 1 ? 'file' : 'files'} selected:
                  </p>
                  <ul className="mt-1 text-sm text-gray-500 list-disc list-inside">
                    {files.map((file: File, index: number) => (
                      <li key={index}>
                        {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <Link
                href="/records"
                className="inline-flex items-center px-4 py-2 border border-gray-700 text-sm font-medium rounded-md text-gray-300 bg-black hover:bg-gray-900"
              >
                Cancel
              </Link>
              <button
                type="submit"
                className={`inline-flex items-center px-4 py-2 rounded-md text-white border border-primary-blue hover:bg-black/20 transition-colors ${
                  isUploadDisabled ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                disabled={isUploadDisabled}
              >
                {isUploading ? 'Uploading...' : 'Upload'}
              </button>
            </div>
          </form>

          {(uploadStatus as 'idle' | 'uploading' | 'analyzing' | 'success' | 'error') !== 'idle' && uploadStatus !== 'success' && (
            <div className="bg-black shadow-md rounded-lg p-6 border border-gray-800">
              <h2 className="text-lg font-medium mb-4">Upload Status</h2>
              
              {/* Upload Progress Bar */}
              <div className="mb-4">
                <div className="relative pt-1">
                  <div className="flex mb-2 items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-blue-100 bg-blue-800">
                        Uploading Files
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-semibold inline-block text-blue-100">
                        {uploadProgress}%
                      </span>
                    </div>
                  </div>
                  <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-blue-900">
                    <div
                      style={{ width: `${uploadProgress}%` }}
                      className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center ${
                        (uploadStatus as 'idle' | 'uploading' | 'analyzing' | 'success' | 'error') === 'error' ? 'bg-red-500' : 'bg-blue-500'
                      }`}
                    ></div>
                  </div>
                </div>
              </div>
              
              {/* Analysis Progress Bar - Only show when analyzing */}
              {(uploadStatus as 'idle' | 'uploading' | 'analyzing' | 'success' | 'error') === 'analyzing' && (
                <div className="mb-4">
                  <div className="relative pt-1">
                    <div className="flex mb-2 items-center justify-between">
                      <div>
                        <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-blue-100 bg-indigo-800">
                          Analyzing Documents
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-semibold inline-block text-blue-100">
                          {analysisProgress}%
                        </span>
                      </div>
                    </div>
                    <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-indigo-900">
                      <div
                        style={{ width: `${analysisProgress}%` }}
                        className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center ${
                          (uploadStatus as 'idle' | 'uploading' | 'analyzing' | 'success' | 'error') === 'error' ? 'bg-red-500' : 'bg-indigo-500'
                        }`}
                      ></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}