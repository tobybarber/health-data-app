'use client';

import { useState, FormEvent, ChangeEvent, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, setDoc, collection, addDoc, serverTimestamp, getDocs, query, limit, updateDoc, getDoc } from 'firebase/firestore';
import { storage, db, getFirebaseConfig } from '../lib/firebase';
import { isApiKeyValid } from '../lib/openai';
import { analyzeRecord, uploadFirestoreFileToOpenAI } from '../lib/openai-utils';
import { useAuth } from '../lib/AuthContext';
import ProtectedRoute from '../components/ProtectedRoute';
import Navigation from '../components/Navigation';
import { invalidateRecordsCache } from '../lib/cache-utils';
import { testFirestoreWrite } from '../lib/test-utils';
import MicrophoneButton from '../components/MicrophoneButton';
import ClientWrapper from '../components/ClientWrapper';
import { processMedicalDocument } from '../lib/fhir-processor';
import toast from 'react-hot-toast';
import PageLayout from '../components/PageLayout';

interface ErrorResponse {
  message?: string;
  error?: string;
  details?: string;
  recordId?: string;
}

export default function Upload() {
  const { currentUser } = useAuth();
  const router = useRouter();
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
  const [isLoading, setIsLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [myHealthToastShown, setMyHealthToastShown] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [analysisStatus, setAnalysisStatus] = useState<string>('');

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
        // Only check if we haven't checked before or if the cache is invalid
        if (!apiKeyChecked) {
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
  }, []); // Remove currentUser dependency since it's not needed for API key check

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
      
      try {
        // Instead of fetch, use XMLHttpRequest to track upload progress
        const uploadPromise = new Promise<{success: boolean, recordId: string, fileUrls: string[]}>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          
          // Set up progress tracking with simulated progress for large files
          let progressInterval: NodeJS.Timeout | null = null;
          
          xhr.upload.addEventListener('progress', (event) => {
            if (event.lengthComputable) {
              // Calculate the actual progress
              const actualProgress = Math.round((event.loaded / event.total) * 100);
              
              // Clear any existing interval when we get real progress
              if (progressInterval) {
                clearInterval(progressInterval);
                progressInterval = null;
              }
              
              // If we're getting real progress updates, use them directly up to 95%
              if (actualProgress < 95) {
                setUploadProgress(actualProgress);
              } else {
                // Cap at 95% until fully complete
                setUploadProgress(95);
              }
              
              console.log(`Upload progress: ${actualProgress}%`);
            }
          });
          
          // For large files, particularly on fast connections, simulate progress
          // This helps provide visual feedback even when the progress event doesn't
          // fire with intermediate values
          if (files.some(file => file.size > 1024 * 1024)) { // If any file is over 1MB
            let simulatedProgress = 0;
            
            progressInterval = setInterval(() => {
              // Increase by smaller amounts as we get higher
              let increment = 10;
              if (simulatedProgress > 50) increment = 5;
              if (simulatedProgress > 80) increment = 2;
              
              simulatedProgress = Math.min(90, simulatedProgress + increment);
              setUploadProgress(simulatedProgress);
              
              console.log(`Simulated progress: ${simulatedProgress}%`);
              
              // Stop at 90% and let the real progress take over
              if (simulatedProgress >= 90) {
                if (progressInterval) {
                  clearInterval(progressInterval);
                  progressInterval = null;
                }
              }
            }, 300); // Update every 300ms
          }
          
          // Handle completion
          xhr.addEventListener('load', () => {
            // Clean up interval if it exists
            if (progressInterval) {
              clearInterval(progressInterval);
              progressInterval = null;
            }
            
            // Set to 100% when truly complete
            setUploadProgress(100);
            
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const response = JSON.parse(xhr.responseText);
                resolve(response);
              } catch (e) {
                reject(new Error('Invalid response format'));
              }
            } else {
              try {
                const errorData = JSON.parse(xhr.responseText);
                reject(new Error(errorData.error || `Upload failed with status: ${xhr.status}`));
              } catch (e) {
                reject(new Error(`Upload failed with status: ${xhr.status}`));
              }
            }
          });
          
          // Handle network errors
          xhr.addEventListener('error', () => {
            reject(new Error('Network error occurred during upload'));
          });
          
          // Handle timeouts
          xhr.addEventListener('timeout', () => {
            reject(new Error('Upload timed out after 5 minutes'));
          });
          
          // Open the request and set timeout
          xhr.open('POST', '/api/records/upload', true);
          xhr.timeout = 300000; // 5 minute timeout
          xhr.setRequestHeader('Authorization', `Bearer ${token}`);
          
          // Send the form data
          xhr.send(formData);
        });
        
        // Wait for upload to complete
        const data = await uploadPromise;
        
        if (currentUser.uid) {
          invalidateRecordsCache(currentUser.uid);
        }
        
        // For multiple files, show better feedback about the analysis process
        if (files.length > 1) {
          setUploadStatus('analyzing');
          setAnalysisStatus('Processing multiple files individually...');
          
          // Simulate progress for better UX during multi-file analysis
          const totalSteps = files.length + 2; // analyze each file + combination step + final step
          let currentStep = 0;
          
          const updateAnalysisProgress = () => {
            currentStep++;
            const percent = Math.min(95, Math.round((currentStep / totalSteps) * 100));
            setAnalysisProgress(percent);
            
            // Update status message based on progress
            if (currentStep <= files.length) {
              setAnalysisStatus(`Analyzing file ${currentStep} of ${files.length}...`);
            } else if (currentStep === files.length + 1) {
              setAnalysisStatus('Combining analysis results...');
            }
          };
          
          // Start progress simulation
          const progressInterval = setInterval(() => {
            updateAnalysisProgress();
            
            // When complete, clear interval and finish
            if (currentStep >= totalSteps) {
              clearInterval(progressInterval);
              setAnalysisProgress(100);
              setAnalysisStatus('Analysis complete!');
              setTimeout(() => {
                setUploadStatus('success');
                setUploadProgress(100);
              }, 1000);
            }
          }, files.length > 5 ? 4000 : 3000); // Pace depends on number of files
          
          // Clear interval if component unmounts
          return () => clearInterval(progressInterval);
        } else {
          // For single file, just show success immediately
          setUploadStatus('success');
          setUploadProgress(100);
        }
        
        // Reset form
        setFiles([]);
        setRecordName('');
        setComment('');
        
        // After OpenAI API analysis is complete, process the document into FHIR resources
        if (data.recordId) {
          try {
            console.log('Processing document into FHIR resources...');
            
            // Use the Firebase SDK methods we're already importing
            const recordDocRef = doc(db, `users/${currentUser.uid}/records/${data.recordId}`);
            const recordDocSnap = await getDoc(recordDocRef);
            
            if (recordDocSnap.exists()) {
              const recordData = recordDocSnap.data();
              const analysisText = typeof recordData.analysis === 'string' ? recordData.analysis : '';
              
              const fhirResources = await processMedicalDocument(
                currentUser.uid,
                analysisText,
                {
                  name: recordName,
                  recordType: recordData.recordType || '',
                  comment: comment
                },
                data.fileUrls[0],
                currentUser.uid // use user ID as patient ID for now
              );
              
              console.log('FHIR resources created:', fhirResources);
              
              // Update the UI to show that FHIR resources were created
              if (Object.keys(fhirResources).length > 0) {
                toast.success(`Created ${Object.keys(fhirResources).filter(k => 
                  k !== 'summary' && k !== 'detectedDocumentType').length} FHIR resources from your document.`);
              }
            }
          } catch (error) {
            console.error('Error processing document into FHIR resources:', error);
            // Don't show an error to the user, just log it
          }
        }
        
      } catch (uploadError: any) {
        // Handle errors
        console.error('Error uploading files:', uploadError);
        setError(`Error uploading files: ${uploadError.message || 'Unknown error'}`);
        setUploadStatus('error');
        
        // Test Firestore write to check if that's working
        if (process.env.NODE_ENV === 'development') {
          console.log('Testing Firestore write...');
          try {
            const testResult = await testFirestoreWrite(currentUser.uid);
            console.log('Firestore test result:', testResult);
          } catch (testError) {
            console.error('Firestore test failed:', testError);
          }
        }
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
      <PageLayout title="Upload Record">
        <div className="space-y-6">
          <p className="text-gray-300">Upload your medical records for analysis</p>

          <div>
            <button
              onClick={handleFileUpload}
              className="bg-primary-blue hover:bg-primary-blue/90 text-white px-4 py-2 rounded-md transition-colors"
            >
              Upload File/Photo
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              multiple
              accept=".pdf,.jpg,.jpeg,.png"
            />
            <p className="mt-2 text-sm text-gray-400">
              Supported formats: PDF, JPG, PNG (Max 10MB per file)
            </p>
            <p className="text-sm text-gray-400">
              My Health Record Integration coming soon
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <input
                type="text"
                value={recordName}
                onChange={(e) => setRecordName(e.target.value)}
                placeholder="e.g., Blood Test, MRI, Prescription"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-blue text-white placeholder-gray-500"
              />
              <p className="mt-1 text-sm text-gray-400">Record Type (optional)</p>
            </div>

            <div>
              <div className="relative flex items-center space-x-2">
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Add any comments here..."
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-blue text-white placeholder-gray-500 min-h-[100px]"
                />
                <MicrophoneButton 
                  onTranscription={(text) => setComment(prev => prev ? `${prev} ${text}` : text)}
                />
              </div>
              <p className="mt-1 text-sm text-gray-400">Comment (optional)</p>
            </div>
          </div>

          <div className="flex justify-between">
            <button
              onClick={() => router.back()}
              className="text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isUploading}
              className={`bg-primary-blue hover:bg-primary-blue/90 text-white px-4 py-2 rounded-md transition-colors ${
                isUploading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {isUploading ? 'Uploading...' : 'Upload'}
            </button>
          </div>

          {error && (
            <div className="text-red-500 whitespace-pre-wrap">{error}</div>
          )}

          {uploadStatus === 'uploading' && (
            <div className="mt-4">
              <p className="text-gray-300">Uploading: {uploadProgress}%</p>
              <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
                <div
                  className="bg-primary-blue h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </PageLayout>
    </ProtectedRoute>
  );
}