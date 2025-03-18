import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { isImageFile } from './pdf-utils';
import { extractTagContent, extractBriefSummary, extractDetailedAnalysis, extractRecordType, extractRecordDate } from './analysis-utils';

/**
 * Analyzes a record using the OpenAI Responses API
 * @param userId The user ID
 * @param recordId The record ID
 * @param fileId The OpenAI file ID
 * @param fileType The file type
 * @param recordName The record name
 * @param question Optional custom question to ask
 * @param additionalFileIds Optional array of additional file IDs to analyze together
 * @returns The analysis result
 */
export async function analyzeRecord(
  userId: string,
  recordId: string,
  fileId: string,
  fileType: string,
  recordName: string,
  question?: string,
  additionalFileIds?: string[]
) {
  try {
    console.log(`🧠 Analyzing record ${recordId} with file ${fileId}`);
    
    // Log additional files only if they exist
    if (additionalFileIds?.length) {
      console.log(`Including ${additionalFileIds.length} additional files in analysis`);
    }
    
    // Check if running on server side and use absolute URL
    const isServer = typeof window === 'undefined';
    const baseUrl = isServer 
      ? process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
      : '';
    
    const analysisResponse = await fetch(`${baseUrl}/api/openai/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileId,
        fileType,
        recordName,
        question,
        userId,
        recordId,
        additionalFileIds
      }),
    });
    
    if (!analysisResponse.ok) {
      const errorData = await analysisResponse.json();
      console.error('❌ Analysis failed:', errorData);
      throw new Error(`Analysis failed: ${errorData.message || errorData.error || 'Unknown error'}`);
    }
    
    const analysisData = await analysisResponse.json();
    console.log(`✅ Analysis complete for record ${recordId}`);
    
    // Update the record in Firestore with the new fields
    try {
      const recordRef = doc(db, `users/${userId}/records/${recordId}`);
      
      // Check if the analysis field contains a JSON string (new OpenAI response format)
      let analysis = analysisData.analysis;
      let recordType = analysisData.recordType;
      let recordDate = analysisData.recordDate;
      let briefSummary = '';
      let detailedAnalysis = '';
      
      // Check if the analysis is a JSON string, try to parse it and extract the output_text
      if (typeof analysis === 'string' && analysis.startsWith('{') && analysis.includes('output_text')) {
        try {
          const parsedAnalysis = JSON.parse(analysis);
          
          // Extract the output_text if it exists
          if (parsedAnalysis.output_text) {
            analysis = parsedAnalysis.output_text;
          }
        } catch (parseError) {
          console.error('Error parsing JSON from analysis field:', parseError);
          // Continue with the original values
        }
      }
      
      // Extract sections from the analysis text only if we have a string
      if (typeof analysis === 'string') {
        // Extract all sections at once to avoid redundant regex operations
        detailedAnalysis = extractDetailedAnalysis(analysis);
        briefSummary = extractBriefSummary(analysis);
        
        // Extract additional fields only if not already provided
        if (!recordType) recordType = extractRecordType(analysis);
        if (!recordDate) recordDate = extractRecordDate(analysis);
      }
      
      const updateData = {
        analysis: analysis || "Analysis could not be completed.",
        analyzedAt: serverTimestamp(),
        recordType: recordType || "Medical Record",
        recordDate: recordDate || "",
        briefSummary: briefSummary || "",
        detailedAnalysis: detailedAnalysis || ""
      };
      
      await updateDoc(recordRef, updateData);
      console.log(`✅ Record ${recordId} updated with analysis`);
    } catch (updateError) {
      console.error('❌ Error updating record with analysis:', updateError);
      // Continue even if update fails, so we still return the analysis
    }
    
    return analysisData;
  } catch (error: any) {
    console.error('❌ Error analyzing record:', error);
    throw error;
  }
}

/**
 * Uploads a file from Firestore to OpenAI for enhanced security
 * @param fileUrl The Firestore URL of the file
 * @param fileName The name of the file
 * @param fileType The type of the file
 * @param userId The user ID
 * @param recordId The record ID
 * @returns The OpenAI file ID
 */
export async function uploadFirestoreFileToOpenAI(
  fileUrl: string,
  fileName: string,
  fileType: string,
  userId: string,
  recordId: string
) {
  try {
    console.log(`📤 Uploading file from Firestore to OpenAI: ${fileName}`);
    
    // Check if running on server side and use absolute URL
    const isServer = typeof window === 'undefined';
    const baseUrl = isServer 
      ? process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
      : '';
    
    const response = await fetch(`${baseUrl}/api/openai/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileUrl,
        fileName,
        fileType,
        userId,
        recordId
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ OpenAI upload failed:', errorData);
      throw new Error(`OpenAI upload failed: ${errorData.message || errorData.error || 'Unknown error'}`);
    }
    
    const data = await response.json();
    console.log(`✅ File uploaded to OpenAI, ID: ${data.id}`);
    
    return data.id;
  } catch (error: any) {
    console.error('❌ Error uploading file to OpenAI:', error);
    throw error;
  }
}

/**
 * Uploads multiple files to OpenAI
 * @param files Array of files to upload
 * @param userId The user ID
 * @param recordId The record ID (optional)
 * @returns Object containing the OpenAI file IDs
 */
export async function uploadFilesToOpenAI(files: File[], userId?: string, recordId?: string) {
  try {
    console.log(`📤 Uploading ${files.length} files to OpenAI`);
    
    // Process files individually
    const fileIds = await Promise.all(
      files.map(file => uploadFirestoreFileToOpenAI(
        URL.createObjectURL(file), // Create a temporary URL for the file
        file.name,
        file.type,
        userId || '',
        recordId || ''
      ))
    );
    
    return {
      fileId: fileIds[0],
      additionalFileIds: fileIds.slice(1),
      isCombinedPdf: false
    };
  } catch (error: any) {
    console.error('❌ Error uploading files to OpenAI:', error);
    throw error;
  }
} 