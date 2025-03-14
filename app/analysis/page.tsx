'use client';

import React, { useState, useEffect, FormEvent, useRef } from 'react';
import Link from 'next/link';
import { doc, getDoc, collection, addDoc, getDocs, serverTimestamp, deleteDoc, setDoc } from 'firebase/firestore';
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
  const [profileInfo, setProfileInfo] = useState<string>('');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [messages, setMessages] = useState<{ user: string; ai: string }[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isAiResponding, setIsAiResponding] = useState(false);
  const [needsUpdate, setNeedsUpdate] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [analysisSource, setAnalysisSource] = useState<string>('');
  const [recordCount, setRecordCount] = useState<number>(0);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [showDebug, setShowDebug] = useState<boolean>(false);
  const [performanceMetrics, setPerformanceMetrics] = useState<any>(null);
  const [summariesUsed, setSummariesUsed] = useState<boolean>(false);
  const [commentsUsed, setCommentsUsed] = useState<boolean>(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { currentUser } = useAuth();

  useEffect(() => {
    // Check if OpenAI API key is valid
    async function checkApiKey() {
      try {
        const isValid = await isApiKeyValid();
        if (!isValid) {
          console.error('OpenAI API key is invalid or not configured properly.');
        }
      } catch (err) {
        console.error('Error checking API key:', err);
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
          const analysisData = analysisDoc.data();
          setHolisticAnalysis(analysisData.text || 'No analysis available yet.');
          
          // Set the analysis source if available
          if (analysisData.generatedBy) {
            setAnalysisSource(analysisData.generatedBy);
          } else {
            setAnalysisSource('');
          }
          
          // Set record count if available
          if (analysisData.recordCount) {
            setRecordCount(analysisData.recordCount);
          } else {
            setRecordCount(0);
          }
          
          // Set last updated timestamp if available
          if (analysisData.updatedAt) {
            const timestamp = analysisData.updatedAt.toDate();
            setLastUpdated(timestamp.toLocaleString());
          } else {
            setLastUpdated('');
          }
          
          // Set summaries and comments used flags if available
          setSummariesUsed(analysisData.summariesUsed === true);
          setCommentsUsed(analysisData.commentsUsed === true);
          
          // Check if analysis needs update
          if (analysisData.needsUpdate) {
            console.log('Analysis needs update flag detected');
            setNeedsUpdate(true);
          } else {
            setNeedsUpdate(false);
          }
        } else {
          setHolisticAnalysis('No analysis available yet. Please upload some medical records first.');
          setNeedsUpdate(false);
          setAnalysisSource('');
          setRecordCount(0);
          setLastUpdated('');
        }
      } catch (err) {
        console.error('Error fetching analysis:', err);
      }
    }

    fetchAnalysis();
  }, [currentUser]);

  useEffect(() => {
    async function fetchProfile() {
      if (!currentUser) return;

      try {
        const profileDoc = await getDoc(doc(db, 'profile', 'user'));
        if (profileDoc.exists()) {
          const profileData = profileDoc.data();
          setProfileInfo(`Name: ${profileData.name || 'Not specified'}, Age: ${profileData.age || 'Not specified'}`);
        }
      } catch (err) {
        console.error('Error fetching profile:', err);
      }
    }

    fetchProfile();
  }, [currentUser]);

  // Auto-scroll to bottom of chat when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleChatToggle = () => {
    setIsChatOpen(!isChatOpen);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim() || !currentUser || isAiResponding) return;

    // Add user message to chat
    setMessages((prev) => [...prev, { user: userInput, ai: '' }]);
    
    // Clear input field immediately
    const question = userInput;
    setUserInput('');
    
    // Set loading state
    setIsAiResponding(true);

    // Call the API endpoint for follow-up questions
    try {
      const response = await fetch('/api/question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          question: question,
          userId: currentUser.uid,
          context: holisticAnalysis
        }),
      });
      const data = await response.json();
      const aiResponse = data.answer || 'No response from AI';

      // Update the last message with AI response
      setMessages((prev) => {
        const newMessages = [...prev];
        newMessages[newMessages.length - 1].ai = aiResponse;
        return newMessages;
      });
    } catch (error) {
      console.error('Error communicating with AI:', error);
      // Update with error message
      setMessages((prev) => {
        const newMessages = [...prev];
        newMessages[newMessages.length - 1].ai = 'Sorry, there was an error processing your question. Please try again.';
        return newMessages;
      });
    } finally {
      setIsAiResponding(false);
    }
  };

  // Close chat when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (chatRef.current && !chatRef.current.contains(event.target as Node)) {
        setIsChatOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleUpdate = async () => {
    if (!currentUser) {
      console.error('No user logged in');
      setHolisticAnalysis('Please log in to update your health analysis.');
      return;
    }
    
    setIsUpdating(true);
    setUpdateError(null);
    
    try {
      console.log('Updating holistic analysis...');
      console.log('Current user:', currentUser.uid);
      
      // Fetch all records for the user to get their names
      const recordsCollection = collection(db, 'users', currentUser.uid, 'records');
      const recordsSnapshot = await getDocs(recordsCollection);
      
      console.log(`Fetched ${recordsSnapshot.docs.length} records`);
      
      // If no records, update the UI and return early
      if (recordsSnapshot.docs.length === 0) {
        console.log('No records found, updating UI');
        setHolisticAnalysis('No health records found. Please upload some medical records first.');
        setIsUpdating(false);
        return;
      }
      
      // Prepare record names for the prompt
      const recordNames = recordsSnapshot.docs.map(doc => doc.data().name || doc.id).join(', ');
      console.log('Sending record names for analysis:', recordNames);
      
      // Fetch detailed record information including summaries and comments
      interface RecordDetail {
        id: string;
        name: string;
        summary: string;
        comments: string[];
        date: string;
        type: string;
      }
      
      const recordDetails: RecordDetail[] = [];
      
      // Fetch summaries and comments for each record
      for (const recordDoc of recordsSnapshot.docs) {
        const record = recordDoc.data();
        const recordId = recordDoc.id;
        const recordName = record.name || recordId;
        
        // Fetch the record's summary if it exists
        let summary = '';
        try {
          // First check if the record has an analysis field directly
          if (record.analysis) {
            summary = record.analysis;
            console.log(`Found analysis directly on record ${recordName}: ${summary.substring(0, 50)}...`);
          } else {
            // If not, try to fetch from the summaries collection
            const summaryDoc = await getDoc(doc(db, `users/${currentUser.uid}/records/${recordId}/summaries`, 'main'));
            if (summaryDoc.exists()) {
              summary = summaryDoc.data()?.text || '';
              console.log(`Found summary for record ${recordName}: ${summary.substring(0, 50)}...`);
            } else {
              console.log(`No summary found for record ${recordName}`);
            }
          }
        } catch (summaryError) {
          console.error(`Error fetching summary for record ${recordName}:`, summaryError);
        }
        
        // Fetch the record's comments if they exist
        const comments: string[] = [];
        try {
          const commentsCollection = collection(db, `users/${currentUser.uid}/records/${recordId}/comments`);
          const commentsSnapshot = await getDocs(commentsCollection);
          commentsSnapshot.forEach(commentDoc => {
            const comment = commentDoc.data();
            if (comment.text) {
              comments.push(comment.text);
              console.log(`Found comment for record ${recordName}: ${comment.text.substring(0, 50)}...`);
            }
          });
          if (comments.length === 0) {
            console.log(`No comments found for record ${recordName}`);
          }
        } catch (commentsError) {
          console.error(`Error fetching comments for record ${recordName}:`, commentsError);
        }
        
        // Add the record details to our array
        recordDetails.push({
          id: recordId,
          name: recordName,
          summary: summary || (record.analysis ? record.analysis : ''),
          comments: comments,
          date: record.date || 'Unknown date',
          type: record.type || 'Unknown type'
        });
      }
      
      // Add a delay to ensure Firestore operations are complete
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Log the record details being sent
      console.log('Record details being sent:', JSON.stringify(recordDetails, null, 2));
      
      // Make API call to generate new analysis
      console.log('Making API call to /api/analyze-simple...');
      try {
        // Log the record details being sent
        console.log('Sending record details to API:', recordDetails.length);
        console.log('First record details:', recordDetails.length > 0 ? JSON.stringify(recordDetails[0], null, 2) : 'No records');
        
        const response = await fetch('/api/analyze-simple', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate'
          },
          body: JSON.stringify({
            userId: currentUser.uid,
            recordNames: recordNames,
            recordDetails: recordDetails, // Include the detailed record information
            timestamp: new Date().getTime() // Add timestamp to prevent caching
          }),
        });

        console.log('API response status:', response.status);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`API request failed with status ${response.status}:`, errorText);
          throw new Error(`API request failed with status ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        console.log('Received analysis response:', data);
        
        if (data.analysis) {
          setHolisticAnalysis(data.analysis);
          
          // Set the analysis source
          if (data.generatedBy) {
            setAnalysisSource(data.generatedBy);
          }
          
          // Set the record count
          if (data.recordCount) {
            setRecordCount(data.recordCount);
          }
          
          // Set last updated timestamp
          setLastUpdated(new Date().toLocaleString());
          
          // Set performance metrics if available
          if (data.performance) {
            setPerformanceMetrics(data.performance);
          }
          
          // Set information about summaries and comments used
          setSummariesUsed(data.summariesUsed === true);
          setCommentsUsed(data.commentsUsed === true);
          
          // Save the analysis to Firestore and clear the needsUpdate flag
          try {
            // Check if the API reported any Firestore errors
            if (data.firestoreError) {
              console.log('API reported Firestore error, saving locally');
              // Save the analysis locally as a fallback
              await setDoc(doc(db, `users/${currentUser.uid}/analysis`, 'holistic'), {
                text: data.analysis,
                updatedAt: serverTimestamp(),
                needsUpdate: false,
                summariesUsed: data.summariesUsed === true,
                commentsUsed: data.commentsUsed === true
              });
              console.log('Analysis saved locally as fallback');
            } else {
              // The API already saved to Firestore, so we just need to update the UI
              console.log('Analysis saved by API, updating UI');
            }
            setNeedsUpdate(false);
          } catch (saveError) {
            console.error('Error updating UI after analysis:', saveError);
          }
        } else {
          console.error('No analysis data received from API');
          setUpdateError('No analysis data received from API');
        }
      } catch (apiError) {
        console.error('API call error:', apiError);
        setUpdateError(`API call error: ${apiError instanceof Error ? apiError.message : 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error updating holistic analysis:', error);
      setUpdateError(`Error updating holistic analysis: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsUpdating(false);
    }
  };

  // Function to format analysis text by removing stars from headings and applying proper styling
  const formatAnalysisText = (text: string) => {
    if (!text) return null;

    // Split the text into lines
    const lines = text.split('\n');
    
    return lines.map((line, index) => {
      // Check if line is a heading (starts with ** and ends with **)
      if (line.trim().startsWith('**') && line.trim().endsWith('**')) {
        // Remove the stars and create a heading
        const headingText = line.trim().replace(/^\*\*|\*\*$/g, '');
        return (
          <h3 key={index} className="text-xl font-semibold text-primary-blue mt-4 mb-2">
            {headingText}
          </h3>
        );
      } 
      // Check if line is a subheading (starts with * and ends with *)
      else if (line.trim().startsWith('*') && line.trim().endsWith('*')) {
        // Remove the stars and create a subheading
        const subheadingText = line.trim().replace(/^\*|\*$/g, '');
        return (
          <h4 key={index} className="text-lg font-medium text-primary-blue mt-3 mb-1">
            {subheadingText}
          </h4>
        );
      }
      // Regular paragraph
      else if (line.trim()) {
        return (
          <p key={index} className="text-gray-800 mb-2">
            {line}
          </p>
        );
      }
      // Empty line
      else {
        return <br key={index} />;
      }
    });
  };

  return (
    <ProtectedRoute>
      <div className="p-6 pt-20">
        <HomeNavigation />
        
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-primary-blue">My Health Analysis</h1>
          {/* Update Button positioned on the right side */}
          <div className="flex space-x-2">
            <button
              onClick={handleUpdate}
              disabled={isUpdating}
              className="bg-white text-primary-blue border border-primary-blue rounded-md p-2 hover:bg-blue-100 transition"
              title="Refresh data and generate a new analysis based on your current records"
            >
              {isUpdating ? (
                <span className="flex items-center">
                  <svg className="animate-spin h-5 w-5 mr-2 text-primary-blue" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v2a6 6 0 100 12v2a8 8 0 01-8-8z"></path>
                  </svg>
                  Updating...
                </span>
              ) : (
                <span className="flex items-center">
                  <svg className="h-5 w-5 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Refresh
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Add this after the Update button */}
        {updateError && (
          <div className="mt-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded-md">
            <p className="flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {updateError}
            </p>
          </div>
        )}

        {/* Debug Information */}
        {showDebug && (
          <div className="mt-4 p-4 bg-gray-100 border border-gray-300 rounded-md">
            <h3 className="text-lg font-semibold mb-2">Debug Information</h3>
            
            <div className="mb-2">
              <p><strong>Analysis Source:</strong> {analysisSource || 'None'}</p>
              <p><strong>Record Count:</strong> {recordCount}</p>
              <p><strong>Last Updated:</strong> {lastUpdated || 'Never'}</p>
              <p><strong>Needs Update:</strong> {needsUpdate ? 'Yes' : 'No'}</p>
            </div>
            
            {performanceMetrics && (
              <div className="mb-2">
                <h4 className="font-medium mb-1">Performance Metrics:</h4>
                <p><strong>Total Time:</strong> {performanceMetrics.totalTime}ms</p>
                <p><strong>Records Fetched:</strong> {performanceMetrics.recordsFetched}</p>
              </div>
            )}
            
            {updateError && (
              <div className="mb-2">
                <h4 className="font-medium mb-1">Error:</h4>
                <p className="text-red-600">{updateError}</p>
              </div>
            )}
          </div>
        )}

        <div className="bg-white/90 backdrop-blur-sm p-6 rounded-md shadow-md mb-6">
          {holisticAnalysis === 'No analysis available yet. Please upload some medical records first.' || 
           holisticAnalysis === 'No health records found. Please upload some medical records first.' ? (
            <p className="text-gray-800 text-lg">{holisticAnalysis}</p>
          ) : (
            <div className="text-gray-800">
              <div className="mb-4 text-sm text-gray-500 flex justify-between">
                <div>
                  Analysis generated by: <span className="font-semibold">{analysisSource === 'openai' ? 'OpenAI' : 'Health App'}</span>
                  {recordCount > 0 && <span className="ml-2">| Based on {recordCount} health records</span>}
                </div>
                {lastUpdated && (
                  <div>
                    Last updated: <span className="font-semibold">{lastUpdated.split(',')[0]}</span>
                  </div>
                )}
              </div>
              {formatAnalysisText(holisticAnalysis)}
            </div>
          )}
        </div>

        {/* Floating Chat Button */}
        <button
          onClick={handleChatToggle}
          className="fixed bottom-4 right-4 bg-primary-blue text-white rounded-full p-3 shadow-lg hover:bg-blue-700 transition"
          aria-label="Chat with AI"
        >
          <span className="flex items-center">
            <span className="mr-1">💬</span>
            <span>Chat</span>
          </span>
        </button>

        {/* Chat Window */}
        {isChatOpen && (
          <div ref={chatRef} className="fixed bottom-16 right-4 bg-white shadow-lg rounded-lg p-4 w-80">
            <h3 className="font-bold mb-2">Chat with AI</h3>
            <div className="overflow-y-auto h-60 mb-2">
              {messages.map((msg, index) => (
                <div key={index} className="mb-2">
                  <div className="font-semibold">You:</div>
                  <div>{msg.user}</div>
                  {msg.ai ? (
                    <>
                      <div className="font-semibold">AI:</div>
                      <div>{msg.ai}</div>
                    </>
                  ) : (
                    <>
                      <div className="font-semibold">AI:</div>
                      <div className="flex items-center text-gray-500">
                        <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v2a6 6 0 100 12v2a8 8 0 01-8-8z"></path>
                        </svg>
                        Thinking...
                      </div>
                    </>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} /> {/* Scroll anchor */}
            </div>
            <form onSubmit={handleSendMessage} className="flex">
              <input
                type="text"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                className="border border-gray-300 rounded-l-md p-2 flex-grow"
                placeholder="Type your message..."
                disabled={isAiResponding}
              />
              <button 
                type="submit" 
                className={`bg-primary-blue text-white rounded-r-md p-2 ${isAiResponding ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-700'}`}
                disabled={isAiResponding}
              >
                Send
              </button>
            </form>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
} 