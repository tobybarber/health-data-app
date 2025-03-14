'use client';

import { useState, FormEvent, ChangeEvent, useRef } from 'react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';

export default function PdfUploader() {
  const [file, setFile] = useState<File | null>(null);
  const [recordName, setRecordName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'analyzing' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { currentUser } = useAuth();

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      if (selectedFile.type !== 'application/pdf') {
        setError('Only PDF files are supported.');
        return;
      }
      setFile(selectedFile);
      setError(null);
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
    
    if (!file) {
      setError('Please select a PDF file to upload');
      return;
    }

    if (!recordName.trim()) {
      setError('Please provide a name for this record');
      return;
    }

    try {
      setIsUploading(true);
      setError(null);
      setUploadProgress(0);
      setUploadStatus('uploading');
      console.log(`📤 Starting upload of ${file.name} with name: ${recordName}`);

      // Upload file to Firebase Storage
      const timestamp = Date.now();
      const safeRecordName = recordName.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filePath = `users/${currentUser.uid}/records/${safeRecordName}_${timestamp}_${file.name}`;
      console.log(`🔄 Creating storage reference: ${filePath}`);
      
      const storageRef = ref(storage, filePath);
      
      console.log(`📤 Uploading to Firebase Storage...`);
      await uploadBytes(storageRef, file);
      console.log(`✅ Upload successful, getting download URL...`);
      
      const fileUrl = await getDownloadURL(storageRef);
      console.log(`📎 Firebase download URL: ${fileUrl}`);
      
      // Update progress
      setUploadProgress(100);
      setUploadStatus('analyzing');
      setAnalysisProgress(0);

      // Simulate analysis progress
      const analysisProgressInterval = setInterval(() => {
        setAnalysisProgress((prev: number) => {
          const newProgress = prev + 5;
          if (newProgress >= 90) {
            clearInterval(analysisProgressInterval);
            return 90; // Cap at 90% until we get the actual response
          }
          return newProgress;
        });
      }, 500);

      // Call API to analyze the PDF
      try {
        const requestBody = { 
          fileName: recordName,
          fileUrl: fileUrl,
          userId: currentUser.uid
        };
        console.log(`📦 Sending to /api/analyze-pdf:`, requestBody);
        
        const response = await fetch('/api/analyze-pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });

        clearInterval(analysisProgressInterval);
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to analyze PDF');
        }
        
        const data = await response.json();
        console.log(`📊 Analysis complete:`, data);
        
        setAnalysis(data.analysis);
        setAnalysisProgress(100);
        setUploadStatus('success');
      } catch (analysisError: any) {
        console.error('Analysis error:', analysisError);
        setError(`Analysis error: ${analysisError.message}`);
        setUploadStatus('error');
      }
    } catch (uploadError: any) {
      console.error('Upload error:', uploadError);
      setError(`Upload error: ${uploadError.message}`);
      setUploadStatus('error');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4">Upload PDF Medical Record</h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="recordName" className="block text-sm font-medium text-gray-700">
            Record Name
          </label>
          <input
            type="text"
            id="recordName"
            value={recordName}
            onChange={(e) => setRecordName(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            placeholder="e.g., Blood Test Results"
            disabled={isUploading}
          />
        </div>
        
        <div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="application/pdf"
            className="hidden"
            disabled={isUploading}
          />
          
          <button
            type="button"
            onClick={handleFileUpload}
            className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            disabled={isUploading}
          >
            {file ? file.name : 'Select PDF File'}
          </button>
        </div>
        
        {error && (
          <div className="text-red-500 text-sm">{error}</div>
        )}
        
        <button
          type="submit"
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          disabled={isUploading || !file || !recordName.trim()}
        >
          {isUploading ? 'Processing...' : 'Upload and Analyze'}
        </button>
      </form>
      
      {uploadStatus !== 'idle' && (
        <div className="mt-4">
          <h3 className="text-lg font-medium">
            {uploadStatus === 'uploading' && 'Uploading...'}
            {uploadStatus === 'analyzing' && 'Analyzing...'}
            {uploadStatus === 'success' && 'Analysis Complete'}
            {uploadStatus === 'error' && 'Error'}
          </h3>
          
          {uploadStatus === 'uploading' && (
            <div className="mt-2">
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${uploadProgress}%` }}></div>
              </div>
              <p className="text-sm text-gray-500 mt-1">Upload progress: {uploadProgress}%</p>
            </div>
          )}
          
          {uploadStatus === 'analyzing' && (
            <div className="mt-2">
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div className="bg-green-600 h-2.5 rounded-full" style={{ width: `${analysisProgress}%` }}></div>
              </div>
              <p className="text-sm text-gray-500 mt-1">Analysis progress: {analysisProgress}%</p>
            </div>
          )}
          
          {uploadStatus === 'success' && analysis && (
            <div className="mt-4 p-4 bg-gray-50 rounded-md">
              <h4 className="text-md font-medium mb-2">Analysis Results:</h4>
              <div className="text-sm whitespace-pre-wrap">{analysis}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 