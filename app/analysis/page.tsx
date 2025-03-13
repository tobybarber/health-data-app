'use client';

import { useState, useEffect, FormEvent } from 'react';
import Link from 'next/link';
import { doc, getDoc, collection, addDoc, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { isApiKeyValid } from '../lib/openai';

interface Question {
  id: string;
  question: string;
  answer: string;
  timestamp: any;
}

interface Record {
  id: string;
  name: string;
  url: string;
  urls?: string[];
  isMultiFile?: boolean;
  fileCount?: number;
  analysis: string;
  createdAt?: any;
}

export default function Analysis() {
  const [holisticAnalysis, setHolisticAnalysis] = useState<string>('');
  const [question, setQuestion] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiKeyValid, setApiKeyValid] = useState<boolean | null>(null);

  useEffect(() => {
    // Check if OpenAI API key is valid
    async function checkApiKey() {
      try {
        const isValid = await isApiKeyValid();
        setApiKeyValid(isValid);
        if (!isValid) {
          setError('OpenAI API key is invalid or not configured properly. Analysis features may not work correctly.');
        }
      } catch (err) {
        console.error('Error checking API key:', err);
        // Don't set error here to avoid blocking the UI
      }
    }
    
    checkApiKey();
  }, []);

  useEffect(() => {
    async function fetchAnalysis() {
      try {
        // Fetch holistic analysis
        const analysisDoc = await getDoc(doc(db, 'analysis', 'holistic'));
        if (analysisDoc.exists()) {
          setHolisticAnalysis(analysisDoc.data().text || 'No analysis available yet.');
        } else {
          setHolisticAnalysis('No analysis available yet. Please upload some medical records first.');
        }

        // Fetch previous questions
        const questionsCollection = collection(db, 'analysis', 'questions', 'items');
        const questionsSnapshot = await getDocs(questionsCollection);
        
        const questionsList = questionsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Question));
        
        // Sort by timestamp, newest first
        questionsList.sort((a, b) => {
          if (a.timestamp && b.timestamp) {
            return b.timestamp.seconds - a.timestamp.seconds;
          }
          return 0;
        });
        
        setQuestions(questionsList);
      } catch (err) {
        console.error('Error fetching analysis:', err);
        setError('Failed to load analysis. Please try again later.');
      } finally {
        setLoading(false);
      }
    }

    fetchAnalysis();
  }, []);

  const handleSubmitQuestion = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!question.trim()) return;
    
    // Check if API key is valid before proceeding
    if (apiKeyValid === false) {
      setError('Cannot process question: OpenAI API key is invalid or not configured properly.');
      return;
    }
    
    try {
      setSubmitting(true);
      setError(null);

      // Get all record URLs
      const recordsCollection = collection(db, 'records');
      const recordsSnapshot = await getDocs(recordsCollection);
      
      // Collect all file IDs and URLs from records
      const fileIds: string[] = [];
      const fileUrls: string[] = [];
      
      recordsSnapshot.docs.forEach(doc => {
        const record = doc.data() as Record;
        
        // Add the record ID to fileIds
        fileIds.push(doc.id);
        
        // Handle multi-file records
        if (record.isMultiFile && record.urls && record.urls.length > 0) {
          fileUrls.push(...record.urls.filter(url => url && typeof url === 'string' && url.startsWith('http')));
        } 
        // Handle single file records
        else if (record.url && typeof record.url === 'string' && record.url.startsWith('http')) {
          fileUrls.push(record.url);
        }
      });
      
      if (fileIds.length === 0) {
        throw new Error('No valid medical records found to analyze.');
      }

      // Call API to analyze the question
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          question,
          fileIds
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || 'Failed to analyze question');
      }

      const data = await response.json();
      
      // Add question and answer to Firestore
      const questionsCollection = collection(db, 'analysis', 'questions', 'items');
      await addDoc(questionsCollection, {
        question,
        answer: data.answer,
        timestamp: serverTimestamp()
      });

      // Refresh questions
      const newQuestionsSnapshot = await getDocs(questionsCollection);
      const newQuestionsList = newQuestionsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Question));
      
      // Sort by timestamp, newest first
      newQuestionsList.sort((a, b) => {
        if (a.timestamp && b.timestamp) {
          return b.timestamp.seconds - a.timestamp.seconds;
        }
        return 0;
      });
      
      setQuestions(newQuestionsList);
      setQuestion('');
    } catch (err) {
      console.error('Error submitting question:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit question. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-blue-600 mb-6">Health Analysis</h1>
      
      {apiKeyValid === false && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
          Warning: OpenAI API key is invalid or not configured properly. Analysis features may not work correctly.
        </div>
      )}
      
      {loading ? (
        <p className="text-gray-600">Loading analysis...</p>
      ) : (
        <>
          <div className="bg-gray-50 p-4 rounded-lg mb-6">
            <h2 className="text-lg font-medium text-gray-800 mb-2">Holistic Analysis</h2>
            <p className="text-gray-800 whitespace-pre-line">{holisticAnalysis}</p>
          </div>

          <div className="mb-8">
            <h2 className="text-lg font-medium text-gray-800 mb-4">Ask Follow-up Questions</h2>
            
            <form onSubmit={handleSubmitQuestion} className="mb-6">
              <div className="mb-4">
                <input
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Ask a question about your health records..."
                  className="w-full border border-gray-300 p-2 rounded"
                  disabled={submitting || apiKeyValid === false}
                />
              </div>
              
              {error && <p className="text-red-500 mb-4">{error}</p>}
              
              <button
                type="submit"
                disabled={!question.trim() || submitting || apiKeyValid === false}
                className={`w-full bg-primary-green hover:bg-green-600 text-white py-2 px-4 rounded ${
                  (!question.trim() || submitting || apiKeyValid === false) ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {submitting ? 'Processing...' : 'Ask'}
              </button>
            </form>
            
            <div>
              <h3 className="text-md font-medium text-gray-700 mb-3">Previous Questions</h3>
              
              {questions.length === 0 ? (
                <p className="text-gray-600 italic">No questions asked yet.</p>
              ) : (
                questions.map(q => (
                  <div key={q.id} className="border-b border-gray-200 py-3 last:border-b-0">
                    <p className="font-medium text-blue-600 mb-1">Q: {q.question}</p>
                    <p className="text-gray-800">A: {q.answer}</p>
                  </div>
                ))
              )}
            </div>
          </div>
          
          <div className="mt-6 flex justify-center">
            <Link href="/records" className="bg-primary-blue hover:bg-blue-600 text-white px-4 py-2 rounded inline-block">
              Back to Records
            </Link>
          </div>
        </>
      )}
    </div>
  );
} 