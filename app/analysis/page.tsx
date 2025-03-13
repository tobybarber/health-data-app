'use client';

import React, { useState, useEffect, FormEvent } from 'react';
import Link from 'next/link';
import { doc, getDoc, collection, addDoc, getDocs, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { isApiKeyValid } from '../lib/openai';
import { useAuth } from '../lib/AuthContext';
import ProtectedRoute from '../components/ProtectedRoute';
import HomeNavigation from '../components/HomeNavigation';

interface Question {
  id: string;
  question: string;
  answer: string;
  timestamp: any;
}

interface Record {
  id?: string;
  name: string;
  url?: string;
  urls?: string[];
  isMultiFile?: boolean;
  isManual?: boolean;
  hasPhoto?: boolean;
}

export default function Analysis() {
  const [holisticAnalysis, setHolisticAnalysis] = useState<string>('');
  const [question, setQuestion] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiKeyValid, setApiKeyValid] = useState<boolean | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const { currentUser } = useAuth();

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
      if (!currentUser) return;
      
      try {
        // Fetch holistic analysis
        const analysisDoc = await getDoc(doc(db, `users/${currentUser.uid}/analysis`, 'holistic'));
        if (analysisDoc.exists()) {
          setHolisticAnalysis(analysisDoc.data().text || 'No analysis available yet.');
        } else {
          setHolisticAnalysis('No analysis available yet. Please upload some medical records first.');
        }

        // Fetch previous questions
        const questionsCollection = collection(db, `users/${currentUser.uid}/analysis/questions/items`);
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
  }, [currentUser]);

  const handleSubmitQuestion = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!question.trim()) return;
    
    if (!currentUser) {
      setError('You must be logged in to ask questions');
      return;
    }
    
    // Check if API key is valid before proceeding
    if (apiKeyValid === false) {
      setError('Cannot process question: OpenAI API key is invalid or not configured properly.');
      return;
    }
    
    try {
      setSubmitting(true);
      setError(null);

      // Call API to analyze the question
      const response = await fetch('/api/question', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          question,
          userId: currentUser.uid
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || errorData.error || 'Failed to analyze question');
      }

      const data = await response.json();
      
      // Add question and answer to Firestore
      const questionsCollection = collection(db, `users/${currentUser.uid}/analysis/questions/items`);
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

  const handleDeleteQuestion = async (questionId: string) => {
    if (!currentUser) return;
    if (!confirm('Are you sure you want to delete this question?')) {
      return;
    }

    try {
      setDeleting(questionId);
      const questionRef = doc(db, `users/${currentUser.uid}/analysis/questions/items`, questionId);
      await deleteDoc(questionRef);
      
      // Update the questions list
      setQuestions(questions.filter(q => q.id !== questionId));
    } catch (err) {
      console.error('Error deleting question:', err);
      setError('Failed to delete question. Please try again.');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <ProtectedRoute>
      <div className="p-6 pt-20">
        <HomeNavigation />
        <h1 className="text-2xl font-bold text-primary-blue mb-6">Health Analysis</h1>
        
        {apiKeyValid === false && (
          <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-md shadow-md">
            Warning: OpenAI API key is invalid or not configured properly. Analysis features may not work correctly.
          </div>
        )}
        
        {loading ? (
          <p className="text-gray-600 p-4">Loading analysis...</p>
        ) : (
          <>
            <div className="bg-white/80 backdrop-blur-sm p-4 rounded-md shadow-md mb-6">
              <h2 className="text-lg font-medium text-primary-blue mb-2">Holistic Analysis</h2>
              <p className="text-gray-800 whitespace-pre-line">{holisticAnalysis}</p>
            </div>

            <div className="mb-8">
              <h2 className="text-lg font-medium text-primary-blue mb-4">Ask Follow-up Questions</h2>
              
              <form onSubmit={handleSubmitQuestion} className="mb-6">
                <div className="mb-4">
                  <input
                    type="text"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="Ask a question about your health records..."
                    className="w-full border border-gray-300 p-3 rounded-md"
                    disabled={submitting}
                  />
                </div>
                <button
                  type="submit"
                  className="bg-primary-blue text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                  disabled={submitting || !question.trim()}
                >
                  {submitting ? 'Submitting...' : 'Ask Question'}
                </button>
              </form>
              
              {error && <p className="text-red-500 mb-4">{error}</p>}
              
              <div className="space-y-4">
                {questions.map((q) => (
                  <div key={q.id} className="bg-white/80 backdrop-blur-sm p-4 rounded-md shadow-md">
                    <div className="flex justify-between items-start">
                      <p className="font-medium text-primary-blue mb-2">{q.question}</p>
                      <button 
                        onClick={() => handleDeleteQuestion(q.id)}
                        disabled={deleting === q.id}
                        className={`text-red-500 hover:text-red-700 text-sm ${deleting === q.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {deleting === q.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                    <p className="text-gray-800 whitespace-pre-line">{q.answer}</p>
                    <p className="text-xs text-gray-500 mt-2">
                      {q.timestamp && new Date(q.timestamp.seconds * 1000).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </ProtectedRoute>
  );
} 