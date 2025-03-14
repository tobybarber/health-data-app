'use client';

import { useState, FormEvent, ChangeEvent, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, setDoc, collection, addDoc, serverTimestamp, getDocs, query, limit } from 'firebase/firestore';
import { storage, db, getFirebaseConfig } from '../lib/firebase';
import { isApiKeyValid } from '../lib/openai';
import { useAuth } from '../lib/AuthContext';
import ProtectedRoute from '../components/ProtectedRoute';
import HomeNavigation from '../components/HomeNavigation';

// Log Firebase configuration for debugging
console.log('🔥 Firebase Project ID:', process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
console.log('🔥 Firebase Storage Bucket:', process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET);

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
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { currentUser } = useAuth();

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
        console.error('Error checking API key:', err);
        setApiKeyChecked(true);
        setApiKeyValid(false);
        // Don't set error here to avoid blocking the UI
      }
    }
    
    checkApiKey();
    
    // Test Firestore write access
    async function testFirestoreWrite() {
      if (!currentUser) return;
      
      try {
        console.log('🧪 Testing Firestore write access...');
        const testDocRef = doc(db, `users/${currentUser.uid}/test/firestore-test`);
        await setDoc(testDocRef, {
          timestamp: serverTimestamp(),
          message: 'This is a test document to verify Firestore write access',
          browser: navigator.userAgent,
          testId: Date.now().toString()
        });
        console.log('✅ Test document written successfully to Firestore');
      } catch (err) {
        console.error('❌ Error writing test document to Firestore:', err);
      }
    }
    
    if (currentUser) {
      testFirestoreWrite();
    }
  }, [currentUser]);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const fileArray = Array.from(e.target.files);
      setFiles(fileArray);
      
      if (!recordName && fileArray.length > 0) {
        const firstFile = fileArray[0] as File;
        const fileName = firstFile.name.split('.').slice(0, -1).join('.');
        setRecordName(fileName || 'Medical Record');
      }
      
      setError(null);
      setUploadStatus('idle');
    }
  };

  const handleCameraCapture = () => {
    if (cameraInputRef.current) {
      cameraInputRef.current.click();
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

    if (!recordName.trim()) {
      setError('Please provide a name for this record');
      return;
    }

    const supportedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!files.every((file: File) => supportedTypes.includes(file.type))) {
      setError('Only PDF, JPG, and PNG files are supported.');
      return;
    }

    try {
      setIsLoading(true);
      setIsUploading(true);
      setError(null);
      setUploadProgress(0);
      setUploadStatus('uploading');
      console.log(`📤 Starting upload of ${files.length} files with name: ${recordName}`);

      const fileUrls: string[] = [];
      const totalFiles = files.length;
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        console.log(`📄 Processing file ${i+1}/${totalFiles}: ${file.name} (${file.size} bytes, type: ${file.type})`);
        
        const timestamp = Date.now();
        const safeRecordName = recordName.replace(/[^a-zA-Z0-9.-]/g, '_');
        const filePath = `users/${currentUser.uid}/records/${safeRecordName}_${timestamp}_${i}_${file.name}`;
        console.log(`🔄 Creating storage reference: ${filePath}`);
        
        const storageRef = ref(storage, filePath);
        
        console.log(`📤 Uploading to Firebase Storage...`);
        try {
          await uploadBytes(storageRef, file);
        } catch (uploadError) {
          console.error(`❌ Firebase upload failed for ${file.name}:`, uploadError);
          throw uploadError; // Re-throw to trigger outer catch
        }
        console.log(`✅ Upload successful, getting download URL...`);
        
        const fileUrl = await getDownloadURL(storageRef);
        console.log(`📎 Firebase download URL: ${fileUrl}`);
        fileUrls.push(fileUrl);
        
        // Update progress
        setUploadProgress(Math.round(((i + 1) / totalFiles) * 100));
      }

      console.log(`✅ All files uploaded successfully. Total URLs: ${fileUrls.length}`);

      // If files are uploaded, send them to AI for analysis
      if (fileUrls.length > 0) {
        // Create a record in Firestore for the uploaded files
        console.log(`📝 Creating Firestore record for user: ${currentUser.uid}`);
        console.log(`📝 Record data: name=${recordName}, files=${fileUrls.length}, comment=${comment ? 'provided' : 'none'}`);
        
        try {
          const docRef = await addDoc(collection(db, `users/${currentUser.uid}/records`), {
            name: recordName,
            comment: comment,
            urls: fileUrls,
            fileCount: fileUrls.length,
            isMultiFile: fileUrls.length > 1,
            createdAt: serverTimestamp(),
            analysis: "This record has not been analyzed yet.",
          });
          console.log(`✅ Firestore record created successfully with ID: ${docRef.id}`);
        } catch (firestoreError) {
          console.error('❌ Error creating Firestore record:', firestoreError);
          throw firestoreError; // Re-throw to trigger outer catch
        }
        
        // Call your AI analysis function here, passing the comment and fileUrls
        // Example: await analyzeFiles(fileUrls, comment);
      } else if (comment.trim()) {
        // Handle manual record case
        await addDoc(collection(db, `users/${currentUser.uid}/records`), {
          name: recordName,
          comment: comment,
          createdAt: serverTimestamp(),
          isManualRecord: true,
        });
      }

      setUploadStatus('success');
      setTimeout(() => router.push('/records'), 1500);
    } catch (err) {
      console.error('❌ Error uploading files:', err);
      setError('An error occurred while uploading files. Please try again later.');
      setUploadStatus('error');
      
      // Redirect to records page after a delay even if upload failed
      setTimeout(() => {
        router.push('/records');
      }, 3000);
    } finally {
      setIsLoading(false);
      setIsUploading(false);
    }
  };

  // Update the button's disabled state
  const isUploadDisabled = !(recordName.trim() || comment.trim() || files.length > 0);

  return (
    <ProtectedRoute>
      <div className="p-6 pt-20">
        <HomeNavigation />
        <h1 className="text-2xl font-bold text-primary-blue mb-6">Upload Health Records</h1>
        
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
          <div className="bg-white/80 backdrop-blur-sm p-4 rounded-md shadow-md text-center">
            <div className="mb-4 text-primary-blue">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-primary-blue mb-2">Upload Complete!</h2>
            <p className="mb-6 text-gray-700">Your health records have been uploaded and analyzed successfully.</p>
            <div className="flex justify-center space-x-4">
              <Link 
                href="/records" 
                className="bg-primary-blue text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
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
                className="bg-white text-primary-blue px-4 py-2 rounded-md border border-primary-blue hover:bg-gray-100 transition-colors"
              >
                Upload Another
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white/80 backdrop-blur-sm p-4 rounded-md shadow-md">
            <div className="mb-6">
              <label htmlFor="recordName" className="block text-sm font-medium text-gray-700 mb-1">
                Record Name
              </label>
              <input
                type="text"
                id="recordName"
                value={recordName}
                onChange={(e) => setRecordName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="e.g., Annual Checkup 2023"
                required
              />
            </div>

            <div className="mb-6">
              <label htmlFor="comment" className="block text-sm font-medium text-gray-700 mb-1">
                Comment (optional)
              </label>
              <textarea
                id="comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Add any comments here..."
              />
            </div>

            <div className="mb-6">
              <label htmlFor="files" className="block text-sm font-medium text-gray-700 mb-1">
                Upload Files (PDF, JPG, PNG)
              </label>
              <div className="mt-1">
                <div className="flex flex-wrap gap-3 mb-3">
                  <button
                    type="button"
                    onClick={handleFileUpload}
                    className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-md flex items-center"
                    disabled={isUploading}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Upload Photos/Files
                  </button>
                  
                  <button
                    type="button"
                    onClick={handleCameraCapture}
                    className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-md flex items-center"
                    disabled={isUploading}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Take Photo
                  </button>
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
                
                {/* Camera input for mobile devices */}
                <input
                  type="file"
                  ref={cameraInputRef}
                  accept="image/*"
                  capture={isMobile ? "environment" : undefined}
                  onChange={handleFileChange}
                  className="hidden"
                  disabled={isUploading}
                />
                
                <p className="text-xs text-gray-500 mt-1">PDF, JPG, PNG up to 10MB each</p>
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
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                Cancel
              </Link>
              <button
                type="submit"
                className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${
                  isUploadDisabled ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                disabled={isUploadDisabled}
              >
                {isUploading ? 'Uploading...' : 'Upload'}
              </button>
            </div>
          </form>
        )}

        {(uploadStatus as 'idle' | 'uploading' | 'analyzing' | 'success' | 'error') !== 'idle' && (
          <div className="bg-white shadow-md rounded-lg p-6">
            <h2 className="text-lg font-medium mb-4">Upload Status</h2>
            
            {/* Upload Progress Bar */}
            <div className="mb-4">
              <div className="relative pt-1">
                <div className="flex mb-2 items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-indigo-600 bg-indigo-200">
                      Uploading Files
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-semibold inline-block text-indigo-600">
                      {uploadProgress}%
                    </span>
                  </div>
                </div>
                <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-indigo-200">
                  <div
                    style={{ width: `${uploadProgress}%` }}
                    className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center ${
                      (uploadStatus as 'idle' | 'uploading' | 'analyzing' | 'success' | 'error') === 'error' ? 'bg-red-500' : 'bg-indigo-500'
                    }`}
                  ></div>
                </div>
              </div>
            </div>
            
            {/* Analysis Progress Bar - Only show when analyzing or complete */}
            {((uploadStatus as 'idle' | 'uploading' | 'analyzing' | 'success' | 'error') === 'analyzing' || 
              (uploadStatus as 'idle' | 'uploading' | 'analyzing' | 'success' | 'error') === 'success') && (
              <div className="mb-4">
                <div className="relative pt-1">
                  <div className="flex mb-2 items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-purple-600 bg-purple-200">
                        Analyzing Documents
                      </span>
                    </div>
                    <div className="text-right">
                      <span className={`text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full ${
                        (uploadStatus as 'idle' | 'uploading' | 'analyzing' | 'success' | 'error') === 'error' ? 'bg-red-500' : 'bg-indigo-500'
                      } text-white`}>
                        {analysisProgress}%
                      </span>
                    </div>
                  </div>
                  <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-purple-200">
                    <div
                      style={{ width: `${analysisProgress}%` }}
                      className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center ${
                        (uploadStatus as 'idle' | 'uploading' | 'analyzing' | 'success' | 'error') === 'error' ? 'bg-red-500' : 'bg-purple-500'
                      }`}
                    ></div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Overall Status */}
            <div className="text-center">
              <span className={`inline-block px-3 py-1 text-sm font-semibold rounded-full ${
                (uploadStatus as 'idle' | 'uploading' | 'analyzing' | 'success' | 'error') === 'uploading' ? 'bg-blue-100 text-blue-800' :
                (uploadStatus as 'idle' | 'uploading' | 'analyzing' | 'success' | 'error') === 'analyzing' ? 'bg-purple-100 text-purple-800' :
                (uploadStatus as 'idle' | 'uploading' | 'analyzing' | 'success' | 'error') === 'success' ? 'bg-green-100 text-green-800' :
                'bg-red-100 text-red-800'
              }`}>
                {(uploadStatus as 'idle' | 'uploading' | 'analyzing' | 'success' | 'error') === 'uploading' && 'Uploading Files...'}
                {(uploadStatus as 'idle' | 'uploading' | 'analyzing' | 'success' | 'error') === 'analyzing' && 'Analyzing Documents...'}
                {(uploadStatus as 'idle' | 'uploading' | 'analyzing' | 'success' | 'error') === 'success' && 'Complete!'}
                {(uploadStatus as 'idle' | 'uploading' | 'analyzing' | 'success' | 'error') === 'error' && 'Error'}
              </span>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}