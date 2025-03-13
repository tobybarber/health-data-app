'use client';

import { useState, FormEvent, ChangeEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, setDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { storage, db } from '../lib/firebase';
import { isApiKeyValid } from '../lib/openai';

export default function Upload() {
  const [files, setFiles] = useState<File[]>([]);
  const [recordName, setRecordName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'analyzing' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [apiKeyValid, setApiKeyValid] = useState<boolean | null>(null);
  const [apiKeyChecked, setApiKeyChecked] = useState(false);
  const router = useRouter();

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
            '1. Create or edit the .env.local file in the project root\n' +
            '2. Add your OpenAI API key: OPENAI_API_KEY=your_api_key_here\n' +
            '3. Restart the development server.'
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
  }, []);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      // Convert FileList to array
      const fileArray = Array.from(e.target.files);
      setFiles(fileArray);
      
      // If no record name set yet, use the first file name as default
      if (!recordName && fileArray.length > 0) {
        // Remove extension from filename
        const fileName = fileArray[0].name.split('.').slice(0, -1).join('.');
        setRecordName(fileName || 'Medical Record');
      }
      
      setError(null);
      setUploadStatus('idle');
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (files.length === 0) {
      setError('Please select at least one file to upload');
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
      console.log(`📤 Starting upload of ${files.length} files with name: ${recordName}`);

      // Upload all files to Firebase Storage and get URLs
      const fileUrls: string[] = [];
      const totalFiles = files.length;
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        console.log(`📄 Processing file ${i+1}/${totalFiles}: ${file.name} (${file.size} bytes, type: ${file.type})`);
        
        const timestamp = Date.now();
        const safeRecordName = recordName.replace(/[^a-zA-Z0-9.-]/g, '_');
        const filePath = `records/${safeRecordName}_${timestamp}_${i}_${file.name}`;
        console.log(`🔄 Creating storage reference: ${filePath}`);
        
        const storageRef = ref(storage, filePath);
        
        console.log(`📤 Uploading to Firebase Storage...`);
        await uploadBytes(storageRef, file);
        console.log(`✅ Upload successful, getting download URL...`);
        
        const fileUrl = await getDownloadURL(storageRef);
        console.log(`📎 Firebase download URL: ${fileUrl}`);
        fileUrls.push(fileUrl);
        
        // Update progress
        setUploadProgress(Math.round(((i + 1) / totalFiles) * 100));
      }

      console.log(`✅ All files uploaded successfully. Total URLs: ${fileUrls.length}`);

      // Files are uploaded, now analyzing (if API key is valid)
      if (apiKeyValid === true) {
        setUploadStatus('analyzing');
        setUploadProgress(100);
        console.log(`🧠 Starting analysis with OpenAI...`);

        // Call API to analyze the files
        try {
          const requestBody = { 
            fileName: recordName,
            fileUrls: fileUrls,
            isMultiFile: files.length > 1
          };
          console.log(`📦 Sending to /api/analyze:`, requestBody);
          
          const response = await fetch('/api/analyze', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
          });

          console.log(`📊 API response status: ${response.status}`);
          
          if (!response.ok) {
            const errorData = await response.json();
            console.error('❌ API error:', errorData);
            
            // Check if the API created a record despite the error
            if (errorData.recordId) {
              console.log(`ℹ️ API created record with ID: ${errorData.recordId} despite error`);
              setError(`Files were uploaded successfully, but analysis failed: ${errorData.message || errorData.error || 'Unknown error'}. You can still view them in Records.`);
              setUploadStatus('error');
              
              // Redirect to records page after a delay
              setTimeout(() => {
                router.push('/records');
              }, 3000);
              return;
            }
            
            // Store the record ourselves if the API didn't create one
            console.log(`💾 Storing record in Firestore (with error)`);
            await addDoc(collection(db, 'records'), {
              name: recordName,
              url: fileUrls[0],
              urls: fileUrls,
              isMultiFile: files.length > 1,
              fileCount: files.length,
              analysis: "Error analyzing files. The files were uploaded successfully, but analysis failed.",
              createdAt: serverTimestamp(),
              analysisError: true,
              errorDetails: errorData.message || errorData.error || errorData.details || 'Unknown error'
            });
            
            throw new Error(errorData.message || errorData.error || errorData.details || 'Failed to analyze files');
          }

          const responseData = await response.json();
          console.log(`✅ Analysis successful:`, responseData);
          
          setUploadStatus('success');
          
          // Redirect to records page after a short delay to show success message
          setTimeout(() => {
            router.push('/records');
          }, 1500);
        } catch (err) {
          console.error('❌ Error analyzing files:', err);
          setError(`Files were uploaded successfully, but analysis failed: ${err instanceof Error ? err.message : 'Unknown error'}. You can still view them in Records.`);
          setUploadStatus('error');
          
          // Redirect to records page after a delay even if analysis failed
          setTimeout(() => {
            router.push('/records');
          }, 3000);
        }
      } else {
        // Skip analysis if API key is invalid
        // Just save the record with a note
        await addDoc(collection(db, 'records'), {
          name: recordName,
          url: fileUrls[0],
          urls: fileUrls,
          isMultiFile: files.length > 1,
          fileCount: files.length,
          analysis: "Files uploaded successfully. Analysis skipped due to missing or invalid OpenAI API key.",
          createdAt: serverTimestamp(),
          analysisSkipped: true
        });
        
        setUploadStatus('success');
        setError('Files uploaded successfully, but analysis was skipped due to API key issues.');
        
        // Redirect to records page after a delay
        setTimeout(() => {
          router.push('/records');
        }, 3000);
      }
    } catch (err) {
      console.error('Error uploading files:', err);
      setError(`Error uploading files: ${err instanceof Error ? err.message : 'Unknown error'}. Please try again.`);
      setUploadStatus('error');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-center">
      <h1 className="text-2xl font-bold text-blue-600 mb-6">Upload Records</h1>
      
      {!apiKeyValid && apiKeyChecked && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
          <h3 className="font-bold text-yellow-800 mb-1">OpenAI API Key Issue</h3>
          <p className="mb-2">
            The OpenAI API key is missing or invalid. Files will be uploaded but analysis will be skipped.
          </p>
          <details className="text-sm">
            <summary className="cursor-pointer font-medium">How to fix this</summary>
            <ol className="list-decimal ml-5 mt-2">
              <li className="mb-1">Create or edit the <code className="bg-yellow-100 px-1 rounded">.env.local</code> file in the project root</li>
              <li className="mb-1">Add your OpenAI API key: <code className="bg-yellow-100 px-1 rounded">OPENAI_API_KEY=your_api_key_here</code></li>
              <li className="mb-1">Restart the development server</li>
            </ol>
          </details>
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="w-full">
        <div className="mb-4">
          <label className="block text-gray-700 mb-2">Record Name:</label>
          <input
            type="text"
            value={recordName}
            onChange={(e) => setRecordName(e.target.value)}
            placeholder="Enter a name for this record"
            className="w-full border border-gray-300 p-2 rounded mb-4"
            disabled={isUploading}
            required
          />
          
          <label className="block text-gray-700 mb-2">
            Select file(s) - you can select multiple files for multi-page documents:
          </label>
          <input
            type="file"
            onChange={handleFileChange}
            className="w-full border border-gray-300 p-2 rounded"
            accept=".pdf,.jpg,.jpeg,.png"
            disabled={isUploading}
            multiple
          />
          <p className="text-xs text-gray-500 mt-1">Accepted formats: PDF, JPG, PNG</p>
          
          {files.length > 0 && (
            <div className="mt-3">
              <p className="text-sm font-medium text-gray-700">Selected files ({files.length}):</p>
              <ul className="text-xs text-gray-600 mt-1 ml-4 list-disc">
                {files.map((file, index) => (
                  <li key={index}>{file.name}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {error && <p className="text-red-500 mb-4">{error}</p>}
        
        {isUploading && (
          <div className="mb-4">
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div 
                className="bg-primary-green h-2.5 rounded-full" 
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
            <p className="text-xs text-gray-500 mt-1 text-center">
              {uploadStatus === 'uploading' && `Uploading... ${uploadProgress}%`}
              {uploadStatus === 'analyzing' && 'Analyzing files with AI...'}
            </p>
          </div>
        )}
        
        {uploadStatus === 'success' && (
          <div className="mb-4 p-3 bg-green-100 text-green-700 rounded">
            Files uploaded successfully! {apiKeyValid === false && 'Analysis was skipped due to API key issues.'} Redirecting to Records...
          </div>
        )}
        
        {uploadStatus === 'error' && !isUploading && (
          <div className="mb-4 p-3 bg-yellow-100 text-yellow-700 rounded">
            {error || 'There was an issue with the upload. Redirecting to Records...'}
          </div>
        )}

        <button
          type="submit"
          disabled={files.length === 0 || !recordName.trim() || isUploading}
          className={`w-full bg-primary-green hover:bg-green-600 text-white py-2 px-4 rounded ${
            (files.length === 0 || !recordName.trim() || isUploading) ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          {isUploading ? (
            uploadStatus === 'analyzing' ? 'Analyzing...' : 'Uploading...'
          ) : 'Upload'}
        </button>
      </form>
    </div>
  );
} 