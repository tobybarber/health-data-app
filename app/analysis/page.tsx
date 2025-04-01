'use client';

import React, { useState, useEffect, FormEvent, useRef } from 'react';
import Link from 'next/link';
import { doc, getDoc, collection, addDoc, getDocs, serverTimestamp, deleteDoc, setDoc, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { isApiKeyValid } from '../lib/openai';
import { useAuth } from '../lib/AuthContext';
import ProtectedRoute from '../components/ProtectedRoute';
import Navigation from '../components/Navigation';
import { useBackgroundLogo } from '../components/ClientWrapper';
import ClientWrapper from '../components/ClientWrapper';
import AnalysisSettings, { AnalysisSettings as AnalysisSettingsType } from '../components/AnalysisSettings';
import BiomarkerSummary from '../components/biomarkers/BiomarkerSummary';

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
  recordType?: string;
  recordDate?: string;
}

export default function Analysis() {
  const [holisticAnalysis, setHolisticAnalysis] = useState<string>('');
  const [profileInfo, setProfileInfo] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState(false);
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
  const { currentUser } = useAuth();
  const [dataLoaded, setDataLoaded] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const { setShowBackgroundLogo } = useBackgroundLogo();
  const [analysisSettings, setAnalysisSettings] = useState<AnalysisSettingsType>({
    useRag: true,
    includeProfile: true,
    includeComments: true
  });
  const [showSettingsModal, setShowSettingsModal] = useState(false);

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
        let comment = '';
        
        // Only check if the record itself has a comment field
        if (record.comment) {
          comment = record.comment;
          console.log(`Found comment for record ${recordName}: ${record.comment.substring(0, 50)}...`);
        } else {
          console.log(`No comment found for record ${recordName}`);
        }
        
        // Add the record details to our array
        recordDetails.push({
          id: recordId,
          name: recordName,
          recordType: record.recordType || '',
          detailedAnalysis: record.detailedAnalysis || '',
          comment: comment,
          recordDate: record.recordDate || ''
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
            timestamp: new Date().getTime(), // Add timestamp to prevent caching
            mode: 'standard',
            useRag: false, // Always use traditional approach
            includeProfile: analysisSettings.includeProfile,
            includeComments: analysisSettings.includeComments
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

  const handleSettingsChange = (newSettings: AnalysisSettingsType) => {
    setAnalysisSettings(newSettings);
    console.log('Analysis settings updated:', newSettings);
    
    // If settings changed and we have analysis, suggest updating
    if (holisticAnalysis && holisticAnalysis !== 'No health records found. Please upload some medical records first.') {
      setNeedsUpdate(true);
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

      // Check for HEALTH_CONCERNS or POTENTIAL_CONCERNS (now optional)
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
      <ClientWrapper>
        <div className="min-h-screen bg-black">
          <Navigation />
          <div className="container mx-auto px-4 pt-20 pb-24 bg-black text-white">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h1 className="text-2xl font-bold text-primary-blue">My Analysis</h1>
                <div className="text-xs text-gray-400 mt-1">
                  Patient ID: {localStorage.getItem('patientId') || 'Not set'} 
                  <button 
                    className="ml-2 text-blue-400 hover:text-blue-300 underline" 
                    onClick={() => {
                      const patients = confirm('Show current patient ID?') && alert(`Current patient ID: ${localStorage.getItem('patientId') || 'Not set'}`);
                    }}
                  >
                    Debug
                  </button>
                </div>
              </div>
              <button
                onClick={() => setShowSettingsModal(true)}
                className="text-blue-500 hover:text-blue-400 text-sm font-medium px-2 py-1 bg-transparent border-none"
              >
                Analysis Settings
              </button>
            </div>
            
            {/* Biomarker Summary Section */}
            <BiomarkerSummary maxBiomarkers={12} />
            
            {/* Analysis Content Section - Changed background to black */}
            <div className="bg-black border border-gray-700 rounded-lg shadow p-6">
              <div className="flex justify-between items-center mb-6 px-1">
                <h2 className="text-lg font-medium text-primary-blue">Analysis Results</h2>
                <div className="flex space-x-2 items-center">
                  <button
                    className={`px-4 py-2 rounded text-white flex items-center space-x-1 ${
                      isUpdating ? 'bg-gray-600' : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                    onClick={handleUpdate}
                    disabled={isUpdating}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>{isUpdating ? 'Updating...' : needsUpdate ? 'Update' : 'Refresh'}</span>
                  </button>
                </div>
              </div>
              
              {/* Analysis display */}
              {isLoading ? (
                <div className="flex justify-center items-center h-64">
                  <div className="animate-pulse text-gray-300">Loading analysis...</div>
                </div>
              ) : (
                <div>
                  {updateError ? (
                    <div className="bg-red-900 text-white p-4 rounded">
                      {updateError}
                    </div>
                  ) : (
                    <div className="prose text-white max-w-none">
                      <div className="mb-4">
                        {lastUpdated && (
                          <div className="text-xs text-gray-400 mb-2">
                            Last updated: {lastUpdated} {recordCount > 0 && `• ${recordCount} record${recordCount === 1 ? '' : 's'}`}
                          </div>
                        )}
                      </div>
                      {formatAnalysisText(holisticAnalysis)}
                      
                      {/* Display info about analysis source */}
                      {analysisSource && (
                        <div className="mt-4 text-xs text-gray-400">
                          <p>Analysis generated using: {
                            analysisSource.includes('structured') 
                              ? `Structured health data${analysisSource.includes('wearables') ? ' with wearables integration' : ''}` 
                              : 'Text summaries from health records'
                          }</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </ClientWrapper>

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 p-4 rounded-lg shadow-md max-w-xs w-full border border-gray-700">
            <AnalysisSettings onChange={handleSettingsChange} />
            <button
              onClick={() => setShowSettingsModal(false)}
              className="mt-3 w-full px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </ProtectedRoute>
  );
} 