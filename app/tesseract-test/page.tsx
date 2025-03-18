'use client';

import { useState, useRef, FormEvent, ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage, db } from '../lib/firebase';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from '../lib/AuthContext';
import ProtectedRoute from '../components/ProtectedRoute';
import Navigation from '../components/Navigation';

export default function TesseractTest() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'processing' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState<string>('');
  const [analysis, setAnalysis] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { currentUser } = useAuth();

  /**
   * Handle file selection
   */
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0] || null;
    
    // Reset states
    setFile(selectedFile);
    setStatus('idle');
    setError(null);
    setExtractedText('');
    setAnalysis('');
    
    if (selectedFile) {
      // Validate file type (only images for this test)
      const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/gif', 'image/webp'];
      if (!validTypes.includes(selectedFile.type)) {
        setError('For this test, please select only image files (JPEG, PNG, GIF, WebP)');
        setFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    }
  };

  /**
   * Handle form submission
   */
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!file) {
      setError('Please select a file to upload');
      return;
    }
    
    if (!currentUser) {
      setError('You must be logged in to use this feature');
      return;
    }
    
    try {
      setIsUploading(true);
      setStatus('uploading');
      setError(null);
      
      // Generate a unique ID for the file
      const fileId = uuidv4();
      const userId = currentUser.uid;
      const fileName = `tesseract-test/${userId}/${fileId}-${file.name}`;
      
      // Upload file to Firebase Storage
      const storageRef = ref(storage, fileName);
      await uploadBytes(storageRef, file);
      
      // Get the download URL
      const downloadURL = await getDownloadURL(storageRef);
      
      console.log('Uploading to OpenAI with URL:', downloadURL);
      
      // Upload to OpenAI Files API
      const uploadResponse = await fetch('/api/openai/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          fileUrl: downloadURL,
          fileType: file.type
        })
      });
      
      const uploadData = await uploadResponse.json();
      
      if (!uploadResponse.ok) {
        throw new Error(uploadData.message || 'Error uploading file to OpenAI');
      }
      
      // Extract fileId from the response data
      const openaiFileId = uploadData.id;
      
      // Add additional debug to check fileId
      console.log('Raw OpenAI response:', uploadData);
      console.log('Received OpenAI fileId:', openaiFileId);
      
      if (!openaiFileId) {
        throw new Error('No file ID received from OpenAI upload');
      }
      
      // Process with Tesseract OCR
      setIsUploading(false);
      setIsProcessing(true);
      setStatus('processing');
      
      // Create the payload with the fileId
      const tesseractPayload = {
        fileId: openaiFileId,
        fileType: file.type,
        userId: userId,
        // Note: No recordId is provided as this is just a test
      };
      
      console.log('Sending to Tesseract with fileId:', openaiFileId);
      console.log('Tesseract payload:', JSON.stringify(tesseractPayload));
      
      const tesseractResponse = await fetch('/api/tesseract-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tesseractPayload)
      });
      
      const tesseractData = await tesseractResponse.json();
      console.log('Tesseract response:', tesseractData);
      
      if (!tesseractResponse.ok) {
        throw new Error(tesseractData.message || 'Error processing with Tesseract OCR');
      }
      
      // Display results
      setExtractedText(tesseractData.extractedText || '');
      setAnalysis(tesseractData.analysis || '');
      setStatus('success');
      
    } catch (error: any) {
      console.error('Error in Tesseract test:', error);
      setError(error.message || 'An unexpected error occurred');
      setStatus('error');
    } finally {
      setIsUploading(false);
      setIsProcessing(false);
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-100">
        <Navigation />
        
        <main className="container mx-auto px-4 py-8">
          <div className="max-w-3xl mx-auto">
            <div className="bg-white shadow-md rounded-lg p-6 mb-6">
              <h1 className="text-2xl font-bold mb-4">Tesseract OCR Test</h1>
              <p className="mb-4 text-gray-600">
                This is a test page for Tesseract OCR. Upload an image file to extract text using Tesseract,
                then send the extracted text to OpenAI for analysis.
              </p>
              
              <form onSubmit={handleSubmit} className="mb-6">
                <div className="mb-4">
                  <label className="block text-gray-700 mb-2">Select an image file:</label>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="block w-full text-sm text-gray-500
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-md file:border-0
                      file:text-sm file:font-semibold
                      file:bg-blue-50 file:text-blue-700
                      hover:file:bg-blue-100"
                    accept="image/*"
                    disabled={isUploading || isProcessing}
                  />
                  {file && (
                    <p className="mt-2 text-sm text-gray-600">
                      Selected file: {file.name} ({Math.round(file.size / 1024)} KB)
                    </p>
                  )}
                </div>
                
                {error && (
                  <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md">
                    {error}
                  </div>
                )}
                
                <button
                  type="submit"
                  className="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  disabled={!file || isUploading || isProcessing}
                >
                  {isUploading ? 'Uploading...' : isProcessing ? 'Processing...' : 'Process with Tesseract OCR'}
                </button>
              </form>
              
              {status === 'success' && (
                <div className="mt-8">
                  <h2 className="text-xl font-semibold mb-3">Results</h2>
                  
                  <div className="mb-6">
                    <h3 className="text-lg font-medium mb-2">Extracted Text (Tesseract OCR):</h3>
                    <div className="bg-gray-50 p-4 rounded-md text-sm max-h-60 overflow-y-auto font-mono whitespace-pre-wrap border border-gray-200 text-gray-800">
                      {extractedText || 'No text extracted'}
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-medium mb-2">OpenAI Analysis:</h3>
                    <div className="bg-gray-50 p-4 rounded-md text-sm max-h-96 overflow-y-auto whitespace-pre-wrap border border-gray-200 text-gray-800">
                      {analysis || 'No analysis available'}
                    </div>
                  </div>
                </div>
              )}
              
              <div className="mt-8 text-center">
                <Link href="/" className="text-blue-600 hover:text-blue-800">
                  ← Back to Home
                </Link>
              </div>
            </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
} 