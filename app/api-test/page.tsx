'use client';

import React, { useState } from 'react';
import Link from 'next/link';

export default function ApiTest() {
  const [testResult, setTestResult] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const testHelloApi = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/hello');
      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }
      const data = await response.json();
      setTestResult(JSON.stringify(data, null, 2));
    } catch (err) {
      console.error('Error testing API:', err);
      setError(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const testTestApi = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/test');
      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }
      const data = await response.json();
      setTestResult(JSON.stringify(data, null, 2));
    } catch (err) {
      console.error('Error testing API:', err);
      setError(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const testAnalyzeApi = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // First test the GET endpoint
      const getResponse = await fetch('/api/analyze');
      if (!getResponse.ok) {
        throw new Error(`Analyze API GET request failed with status ${getResponse.status}`);
      }
      const getData = await getResponse.json();
      console.log('Analyze API GET response:', getData);
      
      // Then test the POST endpoint with minimal data
      const postResponse = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: 'test-user-id',
          recordNames: 'Test Record',
          timestamp: new Date().getTime()
        })
      });
      
      let resultText = `GET Response: ${JSON.stringify(getData, null, 2)}\n\n`;
      
      if (postResponse.ok) {
        const postData = await postResponse.json();
        console.log('Analyze API POST response:', postData);
        resultText += `POST Response: ${JSON.stringify(postData, null, 2)}`;
      } else {
        const errorText = await postResponse.text();
        console.error('Analyze API POST error:', errorText);
        resultText += `POST Error (${postResponse.status}): ${errorText}`;
      }
      
      setTestResult(resultText);
    } catch (err) {
      console.error('Error testing Analyze API:', err);
      setError(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const testSimpleAnalyzeApi = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // First test the GET endpoint
      const getResponse = await fetch('/api/analyze-simple');
      if (!getResponse.ok) {
        throw new Error(`Simple Analyze API GET request failed with status ${getResponse.status}`);
      }
      const getData = await getResponse.json();
      console.log('Simple Analyze API GET response:', getData);
      
      // Then test the POST endpoint with minimal data
      const postResponse = await fetch('/api/analyze-simple', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          testData: 'This is a test',
          timestamp: new Date().getTime()
        })
      });
      
      let resultText = `GET Response: ${JSON.stringify(getData, null, 2)}\n\n`;
      
      if (postResponse.ok) {
        const postData = await postResponse.json();
        console.log('Simple Analyze API POST response:', postData);
        resultText += `POST Response: ${JSON.stringify(postData, null, 2)}`;
      } else {
        const errorText = await postResponse.text();
        console.error('Simple Analyze API POST error:', errorText);
        resultText += `POST Error (${postResponse.status}): ${errorText}`;
      }
      
      setTestResult(resultText);
    } catch (err) {
      console.error('Error testing Simple Analyze API:', err);
      setError(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const testFirebaseAdminApi = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/firebase-test');
      if (!response.ok) {
        throw new Error(`Firebase Admin API request failed with status ${response.status}`);
      }
      const data = await response.json();
      console.log('Firebase Admin API response:', data);
      setTestResult(JSON.stringify(data, null, 2));
    } catch (err) {
      console.error('Error testing Firebase Admin API:', err);
      setError(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">API Test Page</h1>
      
      <div className="mb-6">
        <Link href="/" className="text-blue-500 hover:underline">
          Back to Home
        </Link>
      </div>
      
      <div className="flex space-x-4 mb-6">
        <button
          onClick={testHelloApi}
          disabled={isLoading}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          Test Hello API
        </button>
        
        <button
          onClick={testTestApi}
          disabled={isLoading}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
        >
          Test Test API
        </button>
        
        <button
          onClick={testAnalyzeApi}
          disabled={isLoading}
          className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50"
        >
          Test Analyze API
        </button>
        
        <button
          onClick={testSimpleAnalyzeApi}
          disabled={isLoading}
          className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 disabled:opacity-50"
        >
          Test Simple Analyze API
        </button>
        
        <button
          onClick={testFirebaseAdminApi}
          disabled={isLoading}
          className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-50"
        >
          Test Firebase Admin
        </button>
      </div>
      
      {isLoading && (
        <div className="mb-4">
          <p className="text-gray-600">Loading...</p>
        </div>
      )}
      
      {error && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          <p>{error}</p>
        </div>
      )}
      
      {testResult && (
        <div className="mb-4">
          <h2 className="text-xl font-semibold mb-2">API Response:</h2>
          <pre className="bg-gray-100 p-4 rounded overflow-auto max-h-96">
            {testResult}
          </pre>
        </div>
      )}
      
      <div className="mt-8 p-4 bg-yellow-100 border border-yellow-400 text-yellow-800 rounded">
        <h2 className="text-lg font-semibold mb-2">Troubleshooting Tips:</h2>
        <ul className="list-disc pl-5 space-y-2">
          <li>Make sure your Next.js development server is running</li>
          <li>Check the browser console for any errors</li>
          <li>Verify that your API routes are properly exported</li>
          <li>Check that your environment variables are correctly set</li>
          <li>Try clearing your browser cache or using incognito mode</li>
        </ul>
      </div>
    </div>
  );
} 