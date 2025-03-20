'use client';

import React, { useState, useEffect, FormEvent, useRef } from 'react';
import Link from 'next/link';
import { doc, getDoc, collection, addDoc, getDocs, serverTimestamp, deleteDoc, setDoc, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { isApiKeyValid } from '../lib/openai';
import { useAuth } from '../lib/AuthContext';
import ProtectedRoute from '../components/ProtectedRoute';
import Navigation from '../components/Navigation';
import { useBackgroundLogo } from '../layout';

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
  comment?: string;
  comments?: string[] | string | { [key: string]: any };
  analysis?: string;
  detailedAnalysis?: string;
  recordDate?: string;
  recordType?: string;
}

interface RecordDetail {
  id: string;
  name: string;
  detailedAnalysis: string;
  comment: string;
  comments: string[];
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
  const [apiKeyValid, setApiKeyValid] = useState<boolean | null>(null);
  const [question, setQuestion] = useState<string>('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isAskingQuestion, setIsAskingQuestion] = useState<boolean>(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { currentUser } = useAuth();
  const [dataLoaded, setDataLoaded] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const { setShowBackgroundLogo } = useBackgroundLogo();

  // Hide background logo
  useEffect(() => {
    setShowBackgroundLogo(false);
    return () => setShowBackgroundLogo(true);
  }, [setShowBackgroundLogo]);

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
        // Set loading state
        setDataLoaded(false);
        setIsLoading(true);
        
        // Check localStorage first for cached analysis data
        const cachedData = localStorage.getItem(`analysis_${currentUser.uid}`);
        if (cachedData) {
          const parsedData = JSON.parse(cachedData);
          setHolisticAnalysis(parsedData.text || 'No analysis available yet.');
          setAnalysisSource(parsedData.generatedBy || '');
          setRecordCount(parsedData.recordCount || 0);
          setLastUpdated(parsedData.updatedAt || '');
          setSummariesUsed(parsedData.summariesUsed === true);
          setCommentsUsed(parsedData.commentsUsed === true);
          setNeedsUpdate(parsedData.needsUpdate === true);
          
          // Show cached data immediately
          setIsLoading(false);
        }
        
        // Fetch holistic analysis from Firestore
        const analysisDoc = await getDoc(doc(db, `users/${currentUser.uid}/analysis`, 'holistic'));
        if (analysisDoc.exists()) {
          const analysisData = analysisDoc.data();
          
          // Only update state if there's actual text content
          if (analysisData.text) {
            setHolisticAnalysis(analysisData.text);
            
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
            
            // Cache the analysis data in localStorage
            localStorage.setItem(`analysis_${currentUser.uid}`, JSON.stringify({
              text: analysisData.text,
              generatedBy: analysisData.generatedBy || '',
              recordCount: analysisData.recordCount || 0,
              updatedAt: analysisData.updatedAt ? analysisData.updatedAt.toDate().toLocaleString() : '',
              summariesUsed: analysisData.summariesUsed === true,
              commentsUsed: analysisData.commentsUsed === true,
              needsUpdate: analysisData.needsUpdate === true
            }));
          }
        } else if (!cachedData) {
          // Only set default message if we don't have cached data
          setHolisticAnalysis('No analysis available yet. Please upload some medical records first.');
          setNeedsUpdate(false);
          setAnalysisSource('');
          setRecordCount(0);
          setLastUpdated('');
          
          // Clear cached data if no analysis exists and no cached data
          localStorage.removeItem(`analysis_${currentUser.uid}`);
        }
      } catch (err) {
        console.error('Error fetching analysis:', err);
        // Don't clear existing data on error
      } finally {
        setDataLoaded(true);
        setIsLoading(false);
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

  // Function to process AI chat responses and remove XML tags
  const processChatResponse = (response: string) => {
    if (!response) return '';
    
    // Extract content from XML-like tags
    const extractTagContent = (text: string, tagName: string) => {
      const regex = new RegExp(`<${tagName}>\\s*([\\s\\S]*?)\\s*<\\/${tagName}>`, 'i');
      const match = text.match(regex);
      return match ? match[1].trim() : null;
    };

    // Check if the text contains XML-like tags
    const hasXmlTags = /<[A-Z_]+>[\s\S]*?<\/[A-Z_]+>/i.test(response);
    
    if (hasXmlTags) {
      // Extract content from each section
      const answer = extractTagContent(response, 'ANSWER') || '';
      const relevantRecords = extractTagContent(response, 'RELEVANT_RECORDS');
      const additionalContext = extractTagContent(response, 'ADDITIONAL_CONTEXT');
      
      // Combine sections with proper formatting
      let formattedResponse = answer;
      
      if (relevantRecords) {
        formattedResponse += '\n\nRelevant Records:\n' + relevantRecords;
      }
      
      if (additionalContext) {
        formattedResponse += '\n\nAdditional Context:\n' + additionalContext;
      }
      
      return formattedResponse;
    }
    
    // If no XML tags, return the original response
    return response;
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

      // Process the AI response to remove XML tags
      const processedResponse = processChatResponse(aiResponse);

      // Update the last message with processed AI response
      setMessages((prev) => {
        const newMessages = [...prev];
        newMessages[newMessages.length - 1].ai = processedResponse;
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
      // Get the chat button element
      const chatButton = document.querySelector('button[aria-label="Chat with AI"]');
      
      // Only close if the click is outside the chat AND not on the chat button
      if (chatRef.current && 
          !chatRef.current.contains(event.target as Node) && 
          chatButton !== event.target && 
          !chatButton?.contains(event.target as Node)) {
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
      
      // Reset the needsUpdate flag in the analysis document
      const analysisRef = doc(db, 'users', currentUser.uid, 'analysis', 'holistic');
      await setDoc(analysisRef, {
        needsUpdate: false,
        lastUpdated: serverTimestamp()
      }, { merge: true });
      
      // Fetch all records for the user to get their names
      const recordsCollection = collection(db, 'users', currentUser.uid, 'records');
      const recordsSnapshot = await getDocs(recordsCollection);
      
      console.log(`Fetched ${recordsSnapshot.docs.length} records`);
      
      // If no records, update the UI and return early
      if (recordsSnapshot.docs.length === 0) {
        console.log('No records found, updating UI');
        setHolisticAnalysis('No health records found. Please upload some medical records first.');
        setIsUpdating(false);
        
        // Update localStorage to reflect no records
        localStorage.setItem(`analysis_${currentUser.uid}`, JSON.stringify({
          text: 'No health records found. Please upload some medical records first.',
          generatedBy: '',
          recordCount: 0,
          updatedAt: new Date().toLocaleString(),
          summariesUsed: false,
          commentsUsed: false,
          needsUpdate: false
        }));
        
        return;
      }
      
      // Prepare record names for the prompt
      const recordNames = recordsSnapshot.docs.map(doc => doc.data().name || doc.id).join(', ');
      console.log('Sending record names for analysis:', recordNames);
      
      // Prepare record details for the prompt
      const recordDetails: RecordDetail[] = [];
      
      // Process each record
      for (const docSnapshot of recordsSnapshot.docs) {
        const recordId = docSnapshot.id;
        const record = docSnapshot.data();
        const recordName = record.name || recordId;
        
        console.log(`Processing record: ${recordName}`);
        console.log(`Full record data for ${recordName}:`, JSON.stringify(record, null, 2));
        
        // Get the summary for this record
        let summary = '';
        try {
          const summaryDocRef = doc(db, 'users', currentUser.uid, 'records', recordId, 'summary', 'latest');
          const summaryDoc = await getDoc(summaryDocRef);
          if (summaryDoc.exists()) {
            const summaryData = summaryDoc.data();
            summary = summaryData.text || '';
            console.log(`Found summary for record ${recordName}: ${summary.substring(0, 50)}...`);
          } else {
            console.log(`No summary found for record ${recordName}`);
          }
        } catch (summaryError) {
          console.error(`Error fetching summary for record ${recordName}:`, summaryError);
        }
        
        // Get comments for this record (include all comments)
        const comments: string[] = [];
        
        // First check if the record itself has a comment field
        if (record.comment) {
          comments.push(record.comment);
          console.log(`Found comment directly in record ${recordName}: ${record.comment.substring(0, 50)}...`);
        }
        
        // Check if the record has a comments field (plural)
        if (record.comments) {
          if (Array.isArray(record.comments)) {
            comments.push(...record.comments);
            console.log(`Found comments array directly in record ${recordName} with ${record.comments.length} items`);
          } else if (typeof record.comments === 'string') {
            comments.push(record.comments);
            console.log(`Found comments string directly in record ${recordName}: ${record.comments.substring(0, 50)}...`);
          } else if (typeof record.comments === 'object') {
            comments.push(JSON.stringify(record.comments));
            console.log(`Found comments object directly in record ${recordName}`);
          }
        }
        
        // Then check the comments collection
        try {
          const commentsCollection = collection(db, 'users', currentUser.uid, 'records', recordId, 'comments');
          const commentsSnapshot = await getDocs(commentsCollection);
          
          // Log the raw comments data for debugging
          console.log(`Raw comments data for ${recordName}:`, commentsSnapshot.docs.map(doc => doc.data()));
          
          commentsSnapshot.forEach(commentDoc => {
            const comment = commentDoc.data();
            // Check for both 'text' field and direct comment content
            if (comment.text) {
              comments.push(comment.text);
              console.log(`Found comment with text field for record ${recordName}: ${comment.text.substring(0, 50)}...`);
            } else if (typeof comment === 'object' && Object.keys(comment).length > 0) {
              // If there's no text field but there is content, stringify it
              const commentContent = JSON.stringify(comment);
              comments.push(commentContent);
              console.log(`Found comment without text field for record ${recordName}: ${commentContent.substring(0, 50)}...`);
            }
          });
          
          if (comments.length === 0) {
            console.log(`No comments found for record ${recordName}`);
          } else {
            console.log(`Found ${comments.length} comments for record ${recordName}`);
          }
        } catch (commentsError) {
          console.error(`Error fetching comments for record ${recordName}:`, commentsError);
        }
        
        // Add the record details to our array
        recordDetails.push({
          id: recordId,
          name: recordName,
          detailedAnalysis: record.detailedAnalysis || '',
          comment: record.comment || '',
          comments: comments
        });
      }
      
      // Limit the number of records if there are too many (to prevent timeouts)
      const MAX_RECORDS = 15;
      let recordDetailsToSend = recordDetails;
      if (recordDetails.length > MAX_RECORDS) {
        console.log(`Limiting records from ${recordDetails.length} to ${MAX_RECORDS} to prevent timeout`);
        // Take the first MAX_RECORDS records
        recordDetailsToSend = recordDetails.slice(0, MAX_RECORDS);
      }
      
      // Add a delay to ensure Firestore operations are complete
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Log the record details being sent
      console.log('Record details being sent:', JSON.stringify(recordDetailsToSend, null, 2));
      
      // Make API call to generate new analysis
      console.log('Making API call to /api/analyze...');
      try {
        // Log the record details being sent
        console.log('Sending record details to API:', recordDetailsToSend.length);
        console.log('First record details:', recordDetailsToSend.length > 0 ? JSON.stringify(recordDetailsToSend[0], null, 2) : 'No records');
        
        // Create an AbortController to handle timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 50000); // 50 second timeout
        
        const response = await fetch('/api/analyze', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate'
          },
          body: JSON.stringify({
            userId: currentUser.uid,
            recordNames: recordNames,
            recordDetails: recordDetailsToSend, // Send the limited record details
            timestamp: new Date().getTime() // Add timestamp to prevent caching
          }),
          signal: controller.signal
        });
        
        // Clear the timeout since the request completed
        clearTimeout(timeoutId);

        console.log('API response status:', response.status);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`API request failed with status ${response.status}:`, errorText);
          throw new Error(`API request failed with status ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        console.log('Received analysis response:', data);
        
        if (data && data.analysis) {
          // Store the current analysis before updating
          const previousAnalysis = holisticAnalysis;
          
          console.log('Analysis received from API:', data.analysis.substring(0, 100) + '...');
          console.log('Firestore saved status:', data.firestoreSaved);
          
          setHolisticAnalysis(data.analysis);
          
          // Set the record count
          setRecordCount(recordsSnapshot.docs.length);
          
          // Set the last updated timestamp
          setLastUpdated(new Date().toLocaleString());
          
          // Set the analysis source if available
          if (data.generatedBy) {
            setAnalysisSource(data.generatedBy);
          }
          
          // Set performance metrics if available
          if (data.performance) {
            setPerformanceMetrics(data.performance);
          }
          
          // Set information about summaries and comments used
          setSummariesUsed(data.summariesUsed === true);
          setCommentsUsed(data.commentsUsed === true);
          
          // Save the analysis to Firestore if the API didn't already do it
          try {
            if (!data.firestoreSaved) {
              console.log('API did not save to Firestore, saving locally');
              // Save the analysis locally as a fallback
              await setDoc(doc(db, `users/${currentUser.uid}/analysis`, 'holistic'), {
                text: data.analysis,
                updatedAt: serverTimestamp(),
                needsUpdate: false,
                recordCount: recordsSnapshot.docs.length,
                generatedBy: data.generatedBy || 'openai',
                summariesUsed: data.summariesUsed === true,
                commentsUsed: data.commentsUsed === true
              });
              console.log('Analysis saved locally as fallback');
            } else {
              // The API already saved to Firestore, so we just need to update the UI
              console.log('Analysis saved by API, updating UI');
              
              // Verify the data was saved correctly by fetching it
              const verifyDoc = await getDoc(doc(db, `users/${currentUser.uid}/analysis`, 'holistic'));
              if (verifyDoc.exists() && verifyDoc.data().text === data.analysis) {
                console.log('Verified analysis was saved correctly to Firestore');
              } else {
                console.warn('Analysis verification failed, saving locally as backup');
                await setDoc(doc(db, `users/${currentUser.uid}/analysis`, 'holistic'), {
                  text: data.analysis,
                  updatedAt: serverTimestamp(),
                  needsUpdate: false,
                  recordCount: recordsSnapshot.docs.length,
                  generatedBy: data.generatedBy || 'openai',
                  summariesUsed: data.summariesUsed === true,
                  commentsUsed: data.commentsUsed === true
                });
              }
            }
            setNeedsUpdate(false);
            
            // Update localStorage with the new analysis data
            const cacheData = {
              text: data.analysis,
              generatedBy: data.generatedBy || '',
              recordCount: recordsSnapshot.docs.length,
              updatedAt: new Date().toLocaleString(),
              summariesUsed: data.summariesUsed === true,
              commentsUsed: data.commentsUsed === true,
              needsUpdate: false
            };
            
            localStorage.setItem(`analysis_${currentUser.uid}`, JSON.stringify(cacheData));
            console.log('Analysis data cached in localStorage:', cacheData);
          } catch (saveError) {
            console.error('Error updating UI after analysis:', saveError);
            // Revert to previous analysis on error
            setHolisticAnalysis(previousAnalysis);
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

  // Function to format analysis text by parsing XML-like tags and applying proper styling
  const formatAnalysisText = (text: string) => {
    if (!text) return null;

    // Function to extract content from XML-like tags
    const extractTagContent = (text: string, tagName: string) => {
      const regex = new RegExp(`<${tagName}>\\s*([\\s\\S]*?)\\s*<\\/${tagName}>`, 'i');
      const match = text.match(regex);
      return match ? match[1].trim() : null;
    };

    // Function to clean bullet points (remove dashes and dots at the beginning of lines)
    const cleanBulletPoints = (line: string) => {
      return line.replace(/^[\s]*[-•·.]+[\s]+/, '');
    };

    // Check if the text contains XML-like tags
    const hasXmlTags = /<[A-Z_]+>[\s\S]*?<\/[A-Z_]+>/i.test(text);

    if (hasXmlTags) {
      // Parse XML-like tags
      const sections = [];
      let sectionIndex = 0;

      // Check for OVERVIEW
      const overview = extractTagContent(text, 'OVERVIEW');
      if (overview) {
        sections.push(
          <div key={`section-${sectionIndex++}`}>
            <h3 className="text-xl font-semibold text-white mt-4 mb-2">Overview</h3>
            {overview.split('\n').map((line, idx) => 
              line.trim() ? <p key={idx} className="text-white font-normal mb-2">{cleanBulletPoints(line)}</p> : <br key={idx} />
            )}
          </div>
        );
      }

      // Check for KEY_FINDINGS
      const keyFindings = extractTagContent(text, 'KEY_FINDINGS');
      if (keyFindings) {
        sections.push(
          <div key={`section-${sectionIndex++}`}>
            <h3 className="text-xl font-semibold text-white mt-4 mb-2">Key Findings</h3>
            {keyFindings.split('\n').map((line, idx) => 
              line.trim() ? <p key={idx} className="text-white font-normal mb-2">{cleanBulletPoints(line)}</p> : <br key={idx} />
            )}
          </div>
        );
      }

      // Check for HEALTH_CONCERNS or POTENTIAL_CONCERNS
      const healthConcerns = extractTagContent(text, 'HEALTH_CONCERNS') || extractTagContent(text, 'POTENTIAL_CONCERNS');
      if (healthConcerns) {
        sections.push(
          <div key={`section-${sectionIndex++}`}>
            <h3 className="text-xl font-semibold text-white mt-4 mb-2">Health Concerns</h3>
            {healthConcerns.split('\n').map((line, idx) => 
              line.trim() ? <p key={idx} className="text-white font-normal mb-2">{cleanBulletPoints(line)}</p> : <br key={idx} />
            )}
          </div>
        );
      }

      // Check for PATTERNS
      const patterns = extractTagContent(text, 'PATTERNS');
      if (patterns) {
        sections.push(
          <div key={`section-${sectionIndex++}`}>
            <h3 className="text-xl font-semibold text-white mt-4 mb-2">Patterns & Trends</h3>
            {patterns.split('\n').map((line, idx) => 
              line.trim() ? <p key={idx} className="text-white font-normal mb-2">{cleanBulletPoints(line)}</p> : <br key={idx} />
            )}
          </div>
        );
      }

      // Check for RECOMMENDATIONS or FOLLOW_UP
      const recommendations = extractTagContent(text, 'RECOMMENDATIONS') || extractTagContent(text, 'FOLLOW_UP');
      if (recommendations) {
        sections.push(
          <div key={`section-${sectionIndex++}`}>
            <h3 className="text-xl font-semibold text-white mt-4 mb-2">Recommendations</h3>
            {recommendations.split('\n').map((line, idx) => 
              line.trim() ? <p key={idx} className="text-white font-normal mb-2">{cleanBulletPoints(line)}</p> : <br key={idx} />
            )}
          </div>
        );
      }

      // Check for QUESTIONS
      const questions = extractTagContent(text, 'QUESTIONS');
      if (questions) {
        sections.push(
          <div key={`section-${sectionIndex++}`}>
            <h3 className="text-xl font-semibold text-white mt-4 mb-2">Questions to Ask Your Doctor</h3>
            {questions.split('\n').map((line, idx) => 
              line.trim() ? <p key={idx} className="text-white font-normal mb-2">{cleanBulletPoints(line)}</p> : <br key={idx} />
            )}
          </div>
        );
      }

      // Check for ANSWER (from question API)
      const answer = extractTagContent(text, 'ANSWER');
      if (answer) {
        sections.push(
          <div key={`section-${sectionIndex++}`}>
            {answer.split('\n').map((line, idx) => 
              line.trim() ? <p key={idx} className="text-white font-normal mb-2">{cleanBulletPoints(line)}</p> : <br key={idx} />
            )}
          </div>
        );
      }

      // Check for RELEVANT_RECORDS
      const relevantRecords = extractTagContent(text, 'RELEVANT_RECORDS');
      if (relevantRecords) {
        sections.push(
          <div key={`section-${sectionIndex++}`}>
            <h3 className="text-xl font-semibold text-white mt-4 mb-2">Relevant Records</h3>
            {relevantRecords.split('\n').map((line, idx) => 
              line.trim() ? <p key={idx} className="text-white font-normal mb-2">{cleanBulletPoints(line)}</p> : <br key={idx} />
            )}
          </div>
        );
      }

      // Check for ADDITIONAL_CONTEXT
      const additionalContext = extractTagContent(text, 'ADDITIONAL_CONTEXT');
      if (additionalContext) {
        sections.push(
          <div key={`section-${sectionIndex++}`}>
            <h3 className="text-xl font-semibold text-white mt-4 mb-2">Additional Context</h3>
            {additionalContext.split('\n').map((line, idx) => 
              line.trim() ? <p key={idx} className="text-white font-normal mb-2">{cleanBulletPoints(line)}</p> : <br key={idx} />
            )}
          </div>
        );
      }

      // If we found and processed XML tags, return the formatted sections
      if (sections.length > 0) {
        return sections;
      }
    }

    // Fallback to the original formatting if no XML tags were found or processed
    // Split the text into lines
    const lines = text.split('\n');
    
    return lines.map((line, index) => {
      // Check if line is a heading (starts with ** and ends with **)
      if (line.trim().startsWith('**') && line.trim().endsWith('**')) {
        // Remove the stars and create a heading
        const headingText = line.trim().replace(/^\*\*|\*\*$/g, '');
        return (
          <h3 key={index} className="text-xl font-semibold text-white mt-4 mb-2">
            {headingText}
          </h3>
        );
      } 
      // Check if line is a subheading (starts with * and ends with *)
      else if (line.trim().startsWith('*') && line.trim().endsWith('*')) {
        // Remove the stars and create a subheading
        const subheadingText = line.trim().replace(/^\*|\*$/g, '');
        return (
          <h4 key={index} className="text-lg font-medium text-white mt-3 mb-1">
            {subheadingText}
          </h4>
        );
      }
      // Regular paragraph
      else if (line.trim()) {
        return (
          <p key={index} className="text-white font-normal mb-2">
            {cleanBulletPoints(line)}
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
      <div className="pb-safe pt-safe">
        <Navigation />
        <div className="container mx-auto px-2 py-8">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold text-primary-blue"></h1>
            {/* Update Button positioned on the right side */}
            <div className="flex space-x-2">
              <button
                onClick={handleUpdate}
                disabled={isUpdating}
                className={`${
                  needsUpdate 
                    ? "bg-yellow-100 text-yellow-700 border border-yellow-500" 
                    : "bg-black text-white border border-primary-blue"
                } rounded-md p-2 hover:bg-gray-800 transition`}
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
                    <svg className={`h-5 w-5 mr-1 ${needsUpdate ? "text-yellow-500" : ""}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    {needsUpdate ? "Update required" : "Refresh"}
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

          <div className="mb-6 p-6">
            {isLoading ? (
              <div className="flex justify-center items-center py-8">
                <svg className="animate-spin h-8 w-8 text-primary-blue" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v2a6 6 0 100 12v2a8 8 0 01-8-8z"></path>
                </svg>
                <span className="ml-2 text-gray-600">Loading your health analysis...</span>
              </div>
            ) : holisticAnalysis === 'No analysis available yet. Please upload some medical records first.' || 
               holisticAnalysis === 'No health records found. Please upload some medical records first.' ? (
              <p className="text-white text-lg font-normal">{holisticAnalysis}</p>
            ) : (
              <div className="text-white">
                <div className="mb-4 text-sm text-gray-500 flex justify-between">
                  <div>
                    Analysis by: <span className="font-semibold">{analysisSource === 'openai' ? 'OpenAI' : 'Health App'}</span>
                    {recordCount > 0 && <div className="mt-1">Based on {recordCount} health records</div>}
                  </div>
                  {lastUpdated && (
                    <div>
                      Updated: <span className="font-semibold">{lastUpdated.split(',')[0]}</span>
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
            className="fixed bottom-28 right-4 bg-primary-blue text-white rounded-full p-3 shadow-lg hover:bg-gray-700 transition z-30"
            aria-label="Chat with AI"
          >
            <span className="flex items-center">
              <span className="mr-1">💬</span>
              <span>Chat</span>
            </span>
          </button>

          {/* Bottom overlay to prevent seeing content */}
          <div className="fixed bottom-0 left-0 right-0 h-16 bg-black z-10"></div>

          {/* Chat Window */}
          {isChatOpen && (
            <div ref={chatRef} className="fixed bottom-0 right-4 bg-black shadow-lg rounded-t-lg p-4 w-80 border border-gray-800 border-b-0 z-20">
              <h3 className="font-bold mb-2">Chat with AI</h3>
              <div className="overflow-y-auto h-96 mb-2">
                {messages.map((msg, index) => (
                  <div key={index} className="mb-2">
                    <div className="font-semibold">You:</div>
                    <div>{msg.user}</div>
                    {msg.ai ? (
                      <>
                        <div className="font-semibold">AI:</div>
                        <div className="whitespace-pre-line bg-pink-600 border-2 border-pink-400 p-2 rounded-lg text-white">{msg.ai}</div>
                      </>
                    ) : (
                      <>
                        <div className="font-semibold">AI:</div>
                        <div className="flex items-center text-white bg-pink-600 border-2 border-pink-400 p-2 rounded-lg">
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
                  className={`bg-primary-blue text-white rounded-r-md p-2 ${isAiResponding ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-700'}`}
                  disabled={isAiResponding}
                >
                  Send
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
} 