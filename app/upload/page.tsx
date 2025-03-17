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

    try {
      setIsLoading(true);
      setIsUploading(true);
      setError(null);
      setUploadProgress(0);
      setUploadStatus('uploading');
      console.log(`📤 Starting upload of ${files.length} files with name: ${recordName}`);

      const fileUrls: string[] = [];
      const fileTypes: string[] = [];
      const totalFiles = files.length;
      
      // First, upload all files to Firebase for storage/backup
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        console.log(`📄 Processing file ${i+1}/${totalFiles}: ${file.name} (${file.size} bytes, type: ${file.type})`);
        
        // Upload to Firebase for storage/backup
        const timestamp = Date.now();
        const safeRecordName = recordName.replace(/[^a-zA-Z0-9.-]/g, '_');
        const filePath = `users/${currentUser.uid}/records/${safeRecordName}_${timestamp}_${i}_${file.name}`;
        console.log(`🔄 Creating Firebase storage reference: ${filePath}`);
        
        const storageRef = ref(storage, filePath);
        
        console.log(`📤 Uploading to Firebase Storage...`);
        try {
          await uploadBytes(storageRef, file);
        } catch (uploadError) {
          console.error(`❌ Firebase upload failed for ${file.name}:`, uploadError);
          throw uploadError; // Re-throw to trigger outer catch
        }
        console.log(`✅ Firebase upload successful, getting download URL...`);
        
        const fileUrl = await getDownloadURL(storageRef);
        console.log(`📎 Firebase download URL: ${fileUrl}`);
        fileUrls.push(fileUrl);
        fileTypes.push(file.type);
        
        // Update progress
        setUploadProgress(Math.round(((i + 1) / totalFiles) * 100));
      }

      console.log(`✅ All files uploaded successfully to Firebase. Total URLs: ${fileUrls.length}`);

      // If files are uploaded, create a record in Firestore
      if (fileUrls.length > 0) {
        console.log(`📝 Creating Firestore record for user: ${currentUser.uid}`);
        console.log(`📝 Record data: name=${recordName}, files=${fileUrls.length}, comment=${comment ? 'provided' : 'none'}`);
        
        try {
          // Create the record in Firestore first
          const docRef = await addDoc(collection(db, `users/${currentUser.uid}/records`), {
            name: recordName.trim() || 'Medical Record', // Use a default name if empty
            comment: comment,
            urls: fileUrls,
            fileCount: fileUrls.length, // This will be updated with actual page count for PDFs
            isMultiFile: fileUrls.length > 1,
            createdAt: serverTimestamp(),
            analysis: "This record is being analyzed...",
            briefSummary: "This record is being analyzed...",
            detailedAnalysis: "This record is being analyzed...",
            recordType: "Medical Record", // Default record type
            recordDate: "", // Default empty date
            fileTypes: files.map(file => file.type),
          });
          console.log(`✅ Firestore record created successfully with ID: ${docRef.id}`);
          
          // Now upload files to OpenAI
          setUploadStatus('analyzing');
          setAnalysisProgress(10);
          
          try {
            console.log(`🔄 Uploading files to OpenAI...`);
            
            // Process files individually
            const secureFileIds: string[] = [];
            const secureFileTypes: string[] = [];
            let combinedAnalysis = '';
            let combinedDetailedAnalysis = '';
            let combinedBriefSummary = '';
            let recordTypes: string[] = [];
            let recordDates: string[] = [];
            
            // Calculate progress increment per file
            const progressIncrement = 80 / fileUrls.length;
            
            for (let i = 0; i < fileUrls.length; i++) {
              const fileUrl = fileUrls[i];
              const fileName = files[i].name;
              const fileType = files[i].type;
              
              console.log(`🔒 Securely uploading file ${i+1}/${fileUrls.length} to OpenAI via server: ${fileName} (${fileType})`);
              
              try {
                // Upload the file from Firestore to OpenAI via the server
                const fileId = await uploadFirestoreFileToOpenAI(
                  fileUrl,
                  fileName,
                  fileType,
                  currentUser.uid,
                  docRef.id
                );
                
                secureFileIds.push(fileId);
                secureFileTypes.push(fileType);
                
                // Update progress
                setAnalysisProgress(10 + Math.round((i + 1) * progressIncrement / 2));
                
                // Analyze the file
                console.log(`🧠 Analyzing file ${i+1}/${fileUrls.length}: ${fileName}`);
                
                try {
                  const analysisResult = await analyzeRecord(
                    currentUser.uid,
                    docRef.id,
                    fileId,
                    fileType,
                    fileName
                  );
                  
                  // Extract the analysis text
                  const analysisText = analysisResult.analysis || '';
                  // Add file content without the === filename === header
                  combinedAnalysis += `\n\n${analysisText}`;
                  
                  // Extract other fields if available
                  if (analysisResult.detailedAnalysis) {
                    combinedDetailedAnalysis += `\n\n${analysisResult.detailedAnalysis}`;
                  }
                  
                  if (analysisResult.briefSummary) {
                    combinedBriefSummary += `\n\n${analysisResult.briefSummary}`;
                  }
                  
                  if (analysisResult.recordType) {
                    recordTypes.push(analysisResult.recordType);
                  }
                  
                  if (analysisResult.recordDate) {
                    recordDates.push(analysisResult.recordDate);
                  }
                  
                  // Update progress
                  setAnalysisProgress(10 + Math.round((i + 1) * progressIncrement));
                } catch (analysisError) {
                  console.error(`❌ Error analyzing file ${fileName}:`, analysisError);
                  combinedAnalysis += `\n\n${analysisError instanceof Error ? analysisError.message : 'Unknown error'}`;
                }
              } catch (uploadError) {
                console.error(`❌ Error uploading file ${fileName} to OpenAI:`, uploadError);
                // Continue with other files even if one fails
              }
            }
            
            // Update the record with the combined analysis
            await updateDoc(doc(db, `users/${currentUser.uid}/records/${docRef.id}`), {
              analysis: combinedAnalysis || 'Analysis could not be completed.',
              openaiFileIds: secureFileIds,
              analyzedAt: serverTimestamp(),
              recordType: recordTypes.length > 0 ? recordTypes[0] : 'Medical Record',
              recordDate: recordDates.length > 0 ? recordDates[0] : '',
              briefSummary: combinedBriefSummary || '',
              detailedAnalysis: combinedDetailedAnalysis || ''
            });
            
            // Set success status
            setUploadStatus('success');
            setIsUploading(false);
            setIsLoading(false);
            
            // Redirect to the records page
            router.push('/records');
          } catch (openaiError) {
            console.error('❌ Error with OpenAI processing:', openaiError);
            setError(`Error with OpenAI processing: ${openaiError instanceof Error ? openaiError.message : 'Unknown error'}`);
            setUploadStatus('error');
            setIsUploading(false);
            setIsLoading(false);
          }
        } catch (firestoreError) {
          console.error('❌ Error creating Firestore record:', firestoreError);
          setError(`Error creating record: ${firestoreError instanceof Error ? firestoreError.message : 'Unknown error'}`);
          setUploadStatus('error');
          setIsUploading(false);
          setIsLoading(false);
        }
      } else if (comment.trim()) {
        // Handle case where there are no files but there is a comment
        console.log(`📝 Creating comment-only Firestore record for user: ${currentUser.uid}`);
        
        try {
          // Create a record with just the comment
          const docRef = await addDoc(collection(db, `users/${currentUser.uid}/records`), {
            name: recordName.trim() || 'Note', // Use a default name if empty
            comment: comment,
            urls: [],
            fileCount: 0,
            isMultiFile: false,
            createdAt: serverTimestamp(),
            analysis: "",
            briefSummary: "",
            detailedAnalysis: "",
            recordType: recordName.trim() || 'Note', // Use record name as record type
            recordDate: new Date().toISOString().split('T')[0], // Today's date
          });
          
          console.log(`✅ Comment-only record created successfully with ID: ${docRef.id}`);
          
          // Set success status
          setUploadStatus('success');
          setIsUploading(false);
          setIsLoading(false);
          
          // Redirect to the records page
          router.push('/records');
        } catch (firestoreError) {
          console.error('❌ Error creating comment-only Firestore record:', firestoreError);
          setError(`Error creating record: ${firestoreError instanceof Error ? firestoreError.message : 'Unknown error'}`);
          setUploadStatus('error');
          setIsUploading(false);
          setIsLoading(false);
        }
      }
    } catch (error) {
      console.error('❌ Upload error:', error);
      setError(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setUploadStatus('error');
      setIsUploading(false);
      setIsLoading(false);
    }
  };

  // Update the button's disabled state
  const isUploadDisabled = !(recordName.trim() || comment.trim() || files.length > 0);

  return (
    <ProtectedRoute>
      <div className="p-6 pt-20">
        <Navigation isHomePage={true} />
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
                Record Name (optional)
              </label>
              <input
                type="text"
                id="recordName"
                value={recordName}
                onChange={(e) => setRecordName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="e.g., Annual Checkup 2023"
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

        {(uploadStatus as 'idle' | 'uploading' | 'analyzing' | 'success' | 'error') !== 'idle' && uploadStatus !== 'success' && (
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
            
            {/* Analysis Progress Bar - Only show when analyzing */}
            {(uploadStatus as 'idle' | 'uploading' | 'analyzing' | 'success' | 'error') === 'analyzing' && (
              <div className="mb-4">
                <div className="relative pt-1">
                  <div className="flex mb-2 items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-purple-600 bg-purple-200">
                        Analyzing Documents
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-semibold inline-block text-purple-600">
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
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}