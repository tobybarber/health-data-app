'use client';

import { useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { uploadFirestoreFileToOpenAI, analyzeRecord } from '../lib/openai-utils';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface AnalyzeRecordButtonProps {
  recordId: string;
  recordName: string;
  fileUrl: string;
  fileType: string;
  onAnalysisComplete?: (analysis: string) => void;
}

export default function AnalyzeRecordButton({
  recordId,
  recordName,
  fileUrl,
  fileType,
  onAnalysisComplete
}: AnalyzeRecordButtonProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { currentUser } = useAuth();

  const handleAnalyze = async () => {
    if (!currentUser) {
      setError('You must be logged in to analyze records');
      return;
    }

    try {
      setIsAnalyzing(true);
      setError(null);

      // First, update the record to indicate analysis is in progress
      const recordRef = doc(db, `users/${currentUser.uid}/records/${recordId}`);
      await updateDoc(recordRef, {
        analysis: "Analysis in progress...",
        analysisStartedAt: serverTimestamp(),
      });

      // Upload the file from Firestore to OpenAI via the server
      console.log(`🔒 Securely uploading file to OpenAI via server: ${recordName}`);
      console.log(`File type: ${fileType}`);
      const fileId = await uploadFirestoreFileToOpenAI(
        fileUrl,
        recordName,
        fileType,
        currentUser.uid,
        recordId
      );

      // Analyze the file
      console.log(`🧠 Analyzing file with OpenAI: ${fileId}`);
      const analysisData = await analyzeRecord(
        currentUser.uid,
        recordId,
        fileId,
        fileType,
        recordName
      );

      // Update the record with the analysis results
      // Note: The main update is now handled in the analyzeRecord function
      // This is just a fallback in case that update fails
      let analysis = analysisData.analysis;
      
      // If the analysis is a JSON string, try to parse it and extract the output_text
      if (typeof analysis === 'string' && analysis.startsWith('{') && analysis.includes('output_text')) {
        try {
          console.log('Detected JSON string in analysis field, attempting to parse...');
          const parsedAnalysis = JSON.parse(analysis);
          
          // Extract the output_text if it exists
          if (parsedAnalysis.output_text) {
            console.log('Found output_text in parsed JSON');
            
            // Use the output_text as the analysis
            analysis = parsedAnalysis.output_text;
          }
        } catch (parseError) {
          console.error('Error parsing JSON from analysis field:', parseError);
          // Continue with the original values
        }
      }
      
      await updateDoc(recordRef, {
        analysis: analysis || "Analysis could not be completed.",
        analyzedAt: serverTimestamp(),
        openaiFileId: fileId,
      });

      console.log(`✅ Analysis complete`);
      
      if (onAnalysisComplete && analysisData.analysis) {
        onAnalysisComplete(analysisData.briefSummary || analysisData.analysis);
      }
    } catch (error: any) {
      console.error('Error analyzing record:', error);
      setError(`Error analyzing record: ${error.message}`);
      
      // Update the record with the error
      if (currentUser) {
        try {
          const recordRef = doc(db, `users/${currentUser.uid}/records/${recordId}`);
          await updateDoc(recordRef, {
            analysis: `Error analyzing record: ${error.message}`,
            analyzedAt: serverTimestamp(),
          });
        } catch (updateError) {
          console.error('Error updating record with error:', updateError);
        }
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div>
      <button
        onClick={handleAnalyze}
        disabled={isAnalyzing}
        className={`px-4 py-2 rounded-md text-white font-medium ${
          isAnalyzing ? 'bg-gray-400 cursor-not-allowed' : 'bg-gray-600 hover:bg-gray-700'
        }`}
      >
        {isAnalyzing ? 'Analyzing...' : 'Analyze with AI'}
      </button>
      
      {error && (
        <div className="mt-2 text-red-600 text-sm">
          {error}
        </div>
      )}
    </div>
  );
} 