import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { isImageFile } from './pdf-utils';

/**
 * Analyzes a record using the OpenAI Responses API
 * @param userId The user ID
 * @param recordId The record ID
 * @param fileId The OpenAI file ID
 * @param fileType The file type
 * @param recordName The record name
 * @param question Optional custom question to ask
 * @returns The analysis result
 */
export async function analyzeRecord(
  userId: string,
  recordId: string,
  fileId: string,
  fileType: string,
  recordName: string,
  question?: string
) {
  try {
    console.log(`🧠 Analyzing record ${recordId} with file ${fileId}`);
    
    const analysisResponse = await fetch('/api/openai/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileId,
        fileType,
        recordName,
        question,
        userId,
        recordId
      }),
    });
    
    if (!analysisResponse.ok) {
      const errorData = await analysisResponse.json();
      console.error('❌ Analysis failed:', errorData);
      throw new Error(`Analysis failed: ${errorData.message || errorData.error || 'Unknown error'}`);
    }
    
    const analysisData = await analysisResponse.json();
    console.log(`✅ Analysis complete:`, analysisData);
    
    // Update the record in Firestore with the new fields
    try {
      const recordRef = doc(db, `users/${userId}/records/${recordId}`);
      
      // Check if the analysis field contains a JSON string (new OpenAI response format)
      let analysis = analysisData.analysis;
      let recordType = analysisData.recordType;
      let recordDate = analysisData.recordDate;
      let briefSummary = '';
      let detailedAnalysis = '';
      
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
      
      // Extract sections from the analysis text
      if (typeof analysis === 'string') {
        // Extract detailed analysis using XML-like tags (new format)
        const detailedAnalysisMatch = analysis.match(/<DETAILED_ANALYSIS>\s*([\s\S]*?)\s*<\/DETAILED_ANALYSIS>/i);
        
        if (detailedAnalysisMatch && detailedAnalysisMatch[1]) {
          detailedAnalysis = detailedAnalysisMatch[1].trim();
          // Remove any file headers
          detailedAnalysis = detailedAnalysis.replace(/===\s*[^=]+\s*===/g, '');
        } else {
          // Fallback to old format
          const oldDetailedAnalysisMatch = analysis.match(/1\.?\s*DETAILED ANALYSIS:?\s*([\s\S]*?)(?=2\.?\s*BRIEF SUMMARY|BRIEF SUMMARY|$)/i) || 
                                         analysis.match(/DETAILED ANALYSIS:?\s*([\s\S]*?)(?=BRIEF SUMMARY|SUMMARY|DOCUMENT TYPE|DATE|$)/i);
          
          if (oldDetailedAnalysisMatch && oldDetailedAnalysisMatch[1]) {
            detailedAnalysis = oldDetailedAnalysisMatch[1].trim();
            // Remove any file headers
            detailedAnalysis = detailedAnalysis.replace(/===\s*[^=]+\s*===/g, '');
          }
        }
        
        // Extract brief summary using XML-like tags (new format)
        const briefSummaryMatch = analysis.match(/<BRIEF_SUMMARY>\s*([\s\S]*?)\s*<\/BRIEF_SUMMARY>/i);
        
        if (briefSummaryMatch && briefSummaryMatch[1]) {
          briefSummary = briefSummaryMatch[1].trim();
          // Remove any leading dashes or hyphens
          briefSummary = briefSummary.replace(/^[-–—]+\s*/, '');
        } else {
          // Fallback to old format
          const oldBriefSummaryMatch = analysis.match(/2\.?\s*BRIEF SUMMARY:?\s*([\s\S]*?)(?=3\.?\s*DOCUMENT TYPE|DOCUMENT TYPE|$)/i) || 
                                     analysis.match(/BRIEF SUMMARY:?\s*([\s\S]*?)(?=DOCUMENT TYPE|TYPE|DATE|$)/i);
          
          if (oldBriefSummaryMatch && oldBriefSummaryMatch[1]) {
            briefSummary = oldBriefSummaryMatch[1].trim();
            // Remove any leading dashes or hyphens
            briefSummary = briefSummary.replace(/^[-–—]+\s*/, '');
          }
        }
        
        // Extract record type using XML-like tags (new format)
        if (!recordType) {
          const recordTypeMatch = analysis.match(/<DOCUMENT_TYPE>\s*([\s\S]*?)\s*<\/DOCUMENT_TYPE>/i);
          
          if (recordTypeMatch && recordTypeMatch[1]) {
            recordType = recordTypeMatch[1].trim();
            // Remove any leading dashes or hyphens
            recordType = recordType.replace(/^[-–—]+\s*/, '');
          } else {
            // Fallback to old format
            const oldRecordTypeMatch = analysis.match(/3\.?\s*DOCUMENT TYPE:?\s*([\s\S]*?)(?=4\.?\s*DATE|DATE|$)/i) || 
                                     analysis.match(/DOCUMENT TYPE:?\s*([\s\S]*?)(?=DATE|$)/i);
            
            if (oldRecordTypeMatch && oldRecordTypeMatch[1]) {
              recordType = oldRecordTypeMatch[1].trim();
              // Remove any leading dashes or hyphens
              recordType = recordType.replace(/^[-–—]+\s*/, '');
            }
          }
        }
        
        // Extract record date using XML-like tags (new format)
        if (!recordDate) {
          const recordDateMatch = analysis.match(/<DATE>\s*([\s\S]*?)\s*<\/DATE>/i);
          
          if (recordDateMatch && recordDateMatch[1]) {
            recordDate = recordDateMatch[1].trim();
            // Remove any leading dashes or hyphens
            recordDate = recordDate.replace(/^[-–—]+\s*/, '');
          } else {
            // Fallback to old format
            const oldRecordDateMatch = analysis.match(/4\.?\s*DATE:?\s*([\s\S]*?)(?=$)/i) || 
                                     analysis.match(/DATE:?\s*([\s\S]*?)(?=$)/i);
            
            if (oldRecordDateMatch && oldRecordDateMatch[1]) {
              recordDate = oldRecordDateMatch[1].trim();
              // Remove any leading dashes or hyphens
              recordDate = recordDate.replace(/^[-–—]+\s*/, '');
            }
          }
        }
      }
      
      // Log the final analysis value
      console.log('Final analysis value before Firestore update:');
      console.log('- analysis:', analysis ? analysis.substring(0, 100) + '...' : 'None');
      console.log('- recordType:', recordType);
      console.log('- recordDate:', recordDate);
      console.log('- briefSummary:', briefSummary ? briefSummary.substring(0, 100) + '...' : 'None');
      console.log('- detailedAnalysis:', detailedAnalysis ? detailedAnalysis.substring(0, 100) + '...' : 'None');
      
      const updateData = {
        analysis: analysis || "Analysis could not be completed.",
        analyzedAt: serverTimestamp(),
        recordType: recordType || "Medical Record",
        recordDate: recordDate || "",
        briefSummary: briefSummary || "",
        detailedAnalysis: detailedAnalysis || ""
      };
      
      console.log('Updating Firestore with data:', updateData);
      
      await updateDoc(recordRef, updateData);
      
      console.log(`✅ Record updated with analysis`);
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
    
    const response = await fetch('/api/openai/upload', {
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
      console.error('❌ OpenAI upload from Firestore failed:', errorData);
      throw new Error(`OpenAI upload failed: ${errorData.message || errorData.error || 'Unknown error'}`);
    }
    
    const data = await response.json();
    console.log(`✅ OpenAI upload from Firestore successful, file ID: ${data.id}`);
    
    return data.id;
  } catch (error: any) {
    console.error('❌ Error uploading file from Firestore to OpenAI:', error);
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