'use client';

import { useState, FormEvent, useRef, ChangeEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import Image from 'next/image';
import { useAuth } from '../lib/AuthContext';
import ProtectedRoute from '../components/ProtectedRoute';

export default function ManualRecord() {
  const [recordName, setRecordName] = useState('');
  const [recordContent, setRecordContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [photoURL, setPhotoURL] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
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

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }
    
    setPhotoFile(file);
    setPhotoURL(URL.createObjectURL(file));
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

  const handleRemovePhoto = () => {
    setPhotoURL(null);
    setPhotoFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!currentUser) {
      setError('You must be logged in to create a record');
      return;
    }
    
    if (!recordName.trim()) {
      setError('Please provide a name for this record');
      return;
    }

    if (!recordContent.trim() && !photoFile) {
      setError('Please provide content or a photo for this record');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      setIsUploading(true);
      
      let photoDownloadURL = null;
      
      // Upload photo if exists
      if (photoFile) {
        const storageRef = ref(storage, `users/${currentUser.uid}/manual-records/${Date.now()}-${photoFile.name}`);
        await uploadBytes(storageRef, photoFile);
        photoDownloadURL = await getDownloadURL(storageRef);
      }
      
      // Save to Firestore
      const docRef = await addDoc(collection(db, 'users', currentUser.uid, 'records'), {
        name: recordName,
        analysis: recordContent,
        isManual: true,
        hasPhoto: !!photoDownloadURL,
        url: photoDownloadURL,
        createdAt: serverTimestamp(),
      });
      
      console.log(`Manual record saved with ID: ${docRef.id}`);
      
      setSuccess(true);
      
      // Redirect to records page after a short delay
      setTimeout(() => {
        router.push('/records');
      }, 2000);
    } catch (err) {
      console.error('Error saving manual record:', err);
      setError('Failed to save record. Please try again.');
    } finally {
      setIsSubmitting(false);
      setIsUploading(false);
    }
  };

  return (
    <ProtectedRoute>
      <div className="max-w-2xl mx-auto p-4">
        <h1 className="text-2xl font-bold text-blue-600 mb-6">Add Manual Record</h1>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="space-y-4">
              <div>
                <label htmlFor="recordName" className="block text-sm font-medium text-gray-700 mb-1">
                  Record Name
                </label>
                <input
                  type="text"
                  id="recordName"
                  value={recordName}
                  onChange={(e) => setRecordName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter a name for this record (e.g., 'Recent Symptoms', 'Medication Notes')"
                  disabled={isSubmitting}
                />
              </div>
              
              <div>
                <label htmlFor="recordContent" className="block text-sm font-medium text-gray-700 mb-1">
                  Record Content
                </label>
                <textarea
                  id="recordContent"
                  value={recordContent}
                  onChange={(e) => setRecordContent(e.target.value)}
                  rows={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter any health information you want to record (e.g., symptoms, medications, notes from doctor visits, etc.)"
                  disabled={isSubmitting}
                ></textarea>
                <p className="text-xs text-gray-500 mt-1">
                  This information will be included in your holistic health analysis.
                </p>
              </div>
              
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Add Photo (Optional)
                </label>
                
                <div className="flex flex-wrap gap-3 mb-3">
                  <button
                    type="button"
                    onClick={handleFileUpload}
                    className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-md flex items-center"
                    disabled={isSubmitting || !!photoURL}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Upload Photo
                  </button>
                  
                  <button
                    type="button"
                    onClick={handleCameraCapture}
                    className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-md flex items-center"
                    disabled={isSubmitting || !!photoURL}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Take Photo
                  </button>
                  
                  {photoURL && (
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      className="bg-red-100 hover:bg-red-200 text-red-700 px-4 py-2 rounded-md flex items-center"
                      disabled={isSubmitting}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Remove Photo
                    </button>
                  )}
                </div>
                
                {/* File input for gallery photos */}
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                  disabled={isSubmitting}
                />
                
                {/* Camera input for mobile devices */}
                <input
                  type="file"
                  ref={cameraInputRef}
                  accept="image/*"
                  capture={isMobile ? "environment" : undefined}
                  onChange={handleFileChange}
                  className="hidden"
                  disabled={isSubmitting}
                />
                
                {photoURL && (
                  <div className="mt-3 relative">
                    <div className="relative h-48 w-full overflow-hidden rounded-md border border-gray-300">
                      <Image
                        src={photoURL}
                        alt="Selected photo"
                        fill
                        style={{ objectFit: 'contain' }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      This photo will be included with your record.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}
          
          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
              Record saved successfully! Redirecting to Records...
            </div>
          )}
          
          <div className="flex justify-between">
            <Link href="/records" className="text-blue-600 hover:underline">
              Back to Records
            </Link>
            
            <button
              type="submit"
              disabled={isSubmitting}
              className={`bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                isSubmitting ? 'opacity-70 cursor-not-allowed' : ''
              }`}
            >
              {isSubmitting ? (isUploading ? 'Uploading...' : 'Saving...') : 'Save Record'}
            </button>
          </div>
        </form>
      </div>
    </ProtectedRoute>
  );
} 