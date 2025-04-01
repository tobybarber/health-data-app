import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { db, storage } from '../../../lib/firebase-admin';
import { verifyTokenAndGetUserId } from '../../../lib/auth-middleware';
import fs from 'fs';
import { FieldValue } from 'firebase-admin/firestore';
import { 
  analyzeDocumentText 
} from '../../../lib/openai-utils';
import {
  extractDocumentReference,
  extractProcedure,
  extractFamilyMemberHistory,
  extractImagingStudy,
  extractDiagnosticReportImaging,
  extractAllFromDocument
} from '../../../lib/data-extraction';
import {
  createDocumentReference,
  createProcedure,
  createFamilyMemberHistory,
  createImagingStudy,
  createDiagnosticReportImaging
} from '../../../lib/fhir-service';
import { extractTextFromPdf, performOCR } from '../../../lib/pdf-utils';
import { updateDoc } from 'firebase/firestore';
import { buildUserVectorIndex } from '../../../lib/rag-service';

/**
 * POST handler for uploading files and creating records
 * This endpoint ensures users can only upload to their own storage space
 */
export async function POST(request: NextRequest) {
  // Define userId at the top level so it's available in the finally block
  let userId: string | null = null;
  
  try {
    // Parse the form data first, before any other operations
    const formData = await request.formData();
    
    // Debug logging to see all form field names
    console.log('Form data keys:', Array.from(formData.keys()));
    
    const files = formData.getAll('files') as File[];
    
    // Get the record name (which is used as the record type)
    // The field is labeled "Record Type" in the UI but the input name is "recordName"
    const recordName = formData.get('recordName') as string || '';
    console.log('Received recordName:', recordName); // Debug log
    
    const comment = formData.get('comment') as string || '';
    console.log('Received comment:', comment); // Debug log
    
    // Verify authentication and get user ID
    // We need to pass the auth token manually since we've already consumed the request body
    const authHeader = request.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.split('Bearer ')[1] : '';
    
    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized: Missing token' },
        { status: 401 }
      );
    }
    
    // Call verifyAuthToken with the token string
    userId = await verifyTokenAndGetUserId(token);
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Log for debugging
    console.log('Upload request received:', {
      userId,
      filesCount: files.length,
      hasComment: !!comment.trim(),
      recordName
    });
    
    if (files.length === 0 && !comment.trim()) {
      return NextResponse.json(
        { error: 'Please select at least one file to upload or provide a comment' },
        { status: 400 }
      );
    }
    
    // Handle comment-only uploads
    if (files.length === 0 && comment.trim()) {
      console.log('Processing comment-only upload');
      
      // Create record in Firestore for comment-only upload
      const recordData: RecordData = {
        name: recordName.trim() || 'Comment',
        comment: comment,
        urls: [],
        fileCount: 0,
        isMultiFile: false,
        createdAt: new Date(),
        analysis: comment, // Use the actual comment as the analysis
        briefSummary: comment, // Use the actual comment as the summary
        detailedAnalysis: comment, // Use the actual comment as the detailed analysis
        recordType: recordName.trim() || 'Comment', // Use recordName if provided, otherwise default to 'Comment'
        recordDate: new Date().toISOString().split('T')[0],
        fileTypes: [],
        analysisInProgress: false // No analysis needed for comments
      };
      
      const docRef = await db.collection('users').doc(userId).collection('records').add(recordData);
      
      // Update the analysis document to indicate that an update is needed
      const analysisRef = db.collection('users').doc(userId).collection('analysis').doc('holistic');
      await analysisRef.set({
        needsUpdate: true,
        lastRecordAdded: new Date()
      }, { merge: true });
      
      // Trigger vector index rebuild for the comment
      console.log(`Triggering vector index rebuild for user ${userId} after comment upload`);
      (async () => {
        try {
          await buildUserVectorIndex(userId, true);
          console.log(`Vector index rebuild completed for user ${userId}`);
        } catch (indexError) {
          console.error(`Error rebuilding vector index for user ${userId}:`, indexError);
        }
      })();
      
      return NextResponse.json({
        success: true,
        recordId: docRef.id,
        fileUrls: []
      });
    }
    
    // Check file types
    const supportedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
    const invalidFiles = files.filter(file => !supportedTypes.includes(file.type));
    
    if (invalidFiles.length > 0) {
      return NextResponse.json(
        { error: 'Only PDF, JPG, and PNG files are supported' },
        { status: 400 }
      );
    }

    // Check file count to provide better error messages
    if (files.length > 20) {
      return NextResponse.json(
        { error: 'Maximum of 20 files can be uploaded at once' },
        { status: 400 }
      );
    }
    
    // Upload files to Firebase Storage
    const fileUrls: string[] = [];
    const fileTypes: string[] = [];
    const timestamp = Date.now();
    
    try {
      // Process files in smaller batches for better stability
      const batchSize = 1; // Process one file at a time to avoid memory issues
      const fileBatches = [];
      
      // Split files into batches
      for (let i = 0; i < files.length; i += batchSize) {
        fileBatches.push(files.slice(i, i + batchSize));
      }
      
      // Process each batch sequentially
      for (const batch of fileBatches) {
        // Process files within a batch concurrently
        const batchResults = await Promise.all(
          batch.map(async (file, batchIndex) => {
            try {
              const safeRecordName = recordName.replace(/[^a-zA-Z0-9.-]/g, '_');
              const index = fileUrls.length; // Use current file count for indexing
              const filePath = `users/${userId}/records/${safeRecordName}_${timestamp}_${index}_${file.name}`;
              
              // Convert file to buffer
              const arrayBuffer = await file.arrayBuffer();
              const buffer = Buffer.from(arrayBuffer);
              
              // Upload to Firebase Storage
              const fileRef = storage.bucket().file(filePath);
              await fileRef.save(buffer, {
                metadata: {
                  contentType: file.type,
                  metadata: {
                    firebaseStorageDownloadTokens: timestamp.toString(),
                  }
                }
              });
              
              // Get the download URL
              const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${storage.bucket().name}/o/${encodeURIComponent(filePath)}?alt=media&token=${timestamp}`;
              
              return { url: downloadUrl, type: file.type, success: true };
            } catch (error) {
              console.error(`Error uploading file in batch ${batchIndex}:`, error);
              return { success: false, error };
            }
          })
        );
        
        // Add successful uploads to our result arrays
        batchResults.forEach(result => {
          if (result.success) {
            fileUrls.push(result.url as string);
            fileTypes.push(result.type as string);
          }
        });
        
        // Add a small delay between batches
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Check if we have at least some successful uploads
      if (fileUrls.length === 0) {
        throw new Error('Failed to upload any files. Please try again.');
      }
      
    } catch (uploadError: any) {
      console.error('Error during file upload process:', uploadError);
      return NextResponse.json(
        { error: 'Failed to upload files: ' + (uploadError.message || 'Unknown error') },
        { status: 500 }
      );
    }
    
    // Create record in Firestore with basic information initially
    const recordData: RecordData = {
      name: recordName.trim() || 'Medical Record',
      comment: comment,
      urls: fileUrls,
      fileCount: files.length,
      isMultiFile: files.length > 1,
      createdAt: new Date(),
      fileTypes: fileTypes,
      recordType: recordName.trim() || 'Medical Record', // Use recordName if provided, otherwise default to 'Medical Record'
      recordDate: new Date().toISOString().split('T')[0],
      analysisInProgress: true  // Flag to indicate analysis is in progress
    };
    
    // Only add url field if there's exactly one file
    if (fileUrls.length === 1) {
      recordData.url = fileUrls[0];
    }
    
    const docRef = await db.collection('users').doc(userId).collection('records').add(recordData);
    
    // Update the analysis document to indicate that an update is needed
    const analysisRef = db.collection('users').doc(userId).collection('analysis').doc('holistic');
    await analysisRef.set({
      needsUpdate: true,
      lastRecordAdded: new Date()
    }, { merge: true });
    
    // Initiate automatic analysis for each uploaded file
    try {
      console.log('Initiating automatic analysis for uploaded files');
      
      if (fileUrls.length > 0) {
        // Process analysis in the background
        (async () => {
          try {
            // Import the utilities
            const { uploadFirestoreFileToOpenAI, analyzeRecord } = await import('../../../lib/openai-utils');
            
            // Array to store OpenAI file IDs
            const openaiFileIds: string[] = [];
            
            // Use batch processing for OpenAI uploads too
            const batchSize = 3;
            const fileBatches = [];
            
            // Split files into batches
            for (let i = 0; i < fileUrls.length; i += batchSize) {
              fileBatches.push(fileUrls.slice(i, i + batchSize).map((url, idx) => ({
                url,
                type: fileTypes[i + idx] || 'application/octet-stream',
                index: i + idx
              })));
            }
            
            // Process each batch sequentially
            for (let batchIndex = 0; batchIndex < fileBatches.length; batchIndex++) {
              const batch = fileBatches[batchIndex];
              console.log(`Processing OpenAI upload batch ${batchIndex + 1}/${fileBatches.length}`);
              
              // Process files within a batch concurrently with individual error handling
              const batchResults = await Promise.allSettled(
                batch.map(async (file) => {
                  try {
                    console.log(`Processing file ${file.index + 1}/${fileUrls.length} for OpenAI upload`);
                    
                    // Upload the file to OpenAI
                    const fileId = await uploadFirestoreFileToOpenAI(
                      file.url,
                      `${recordName.trim() || 'Medical Record'}_${file.index + 1}`,
                      file.type,
                      userId,
                      docRef.id
                    );
                    
                    console.log(`File ${file.index + 1} uploaded to OpenAI with ID: ${fileId}`);
                    return fileId;
                  } catch (fileError) {
                    console.error(`Error processing file ${file.index + 1} for OpenAI:`, fileError);
                    throw fileError;
                  }
                })
              );
              
              // Add successful uploads to our file IDs array
              batchResults.forEach(result => {
                if (result.status === 'fulfilled') {
                  openaiFileIds.push(result.value);
                }
              });
              
              // Short pause between batches to avoid rate limits
              if (batchIndex < fileBatches.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
              }
            }
            
            // If we have at least one file ID, trigger analysis
            if (openaiFileIds.length > 0) {
              console.log(`Starting analysis with ${openaiFileIds.length} files`);
              const primaryFileId = openaiFileIds[0];
              const additionalIds = openaiFileIds.slice(1);
              
              // Update record with file IDs
              const recordRef = db.collection('users').doc(userId).collection('records').doc(docRef.id);
              await recordRef.update({
                openaiFileId: primaryFileId,
                additionalFileIds: additionalIds.length > 0 ? additionalIds : [],
                openaiFileIds: openaiFileIds,
                analysisInProgress: true
              });
              
              // Now trigger analysis, but limit the number of additional files to avoid timeouts
              // When there are too many files, we'll analyze just the primary file first
              const maxAdditionalFilesForAnalysis = 8; // Increased from 5 to 8
              const analysisAdditionalIds = additionalIds.length > maxAdditionalFilesForAnalysis
                ? additionalIds.slice(0, maxAdditionalFilesForAnalysis) // Take only the first few additional files
                : additionalIds;
                
              try {
                // Customize the prompt based on number of files
                let analysisInstructions = undefined;
                if (openaiFileIds.length > 2) {
                  // Create enhanced instructions for OpenAI when handling multiple files
                  analysisInstructions = 
                    `You're analyzing ${openaiFileIds.length} medical files that belong to the same patient. 
                    Please examine each file thoroughly and provide a complete analysis that covers ALL files.
                    Take your time to analyze each file individually first, then create a comprehensive summary 
                    that covers all important findings across all files.
                    This analysis is critical for medical care, so please be thorough and don't omit any important details.`;
                    
                  // Update the briefSummary in the record data
                  recordData.briefSummary = `Analysis includes ${Math.min(openaiFileIds.length, maxAdditionalFilesForAnalysis + 1)} of ${openaiFileIds.length} uploaded files. Important findings across all files are noted.`;
                }
                
                const result = await analyzeRecord(
                  userId, 
                  docRef.id,
                  primaryFileId,
                  fileTypes[0], 
                  recordName.trim() || 'Medical Record',
                  analysisInstructions, // Pass the custom instructions for multiple files
                  analysisAdditionalIds.length > 0 ? analysisAdditionalIds : undefined
                );
                
                console.log('Analysis complete with result:', result);
                
                // Extract and save FHIR resources if they're in the analysis output
                if (result && result.analysis) {
                  try {
                    // Extract FHIR resources from analysis
                    const fhirMatch = result.analysis.match(/<FHIR_RESOURCES>\s*([\s\S]*?)\s*<\/FHIR_RESOURCES>/i);
                    
                    if (fhirMatch && fhirMatch[1]) {
                      const fhirResourcesJson = fhirMatch[1].trim();
                      
                      try {
                        // Log the raw JSON for debugging
                        console.log('Raw FHIR resources JSON length:', fhirResourcesJson.length);
                        
                        // Sanitize the JSON to handle common issues
                        let sanitizedJson = fhirResourcesJson;
                        
                        // Try to fix the most common JSON issues
                        try {
                          // Look for missing commas between array elements - this is a common error
                          sanitizedJson = sanitizedJson.replace(/}\s*{/g, '},{');
                          
                          // Remove trailing commas in arrays which are invalid in JSON
                          sanitizedJson = sanitizedJson.replace(/,\s*]/g, ']');
                          
                          // Try to auto-fix specific positions if we can identify errors
                          // For example, the specific error reported at position 3804
                          // "Expected ',' or ']' after array element in JSON at position 3804"
                          try {
                            // Make sure we're working with a proper JSON array
                            if (!sanitizedJson.startsWith('[')) {
                              sanitizedJson = '[' + sanitizedJson + ']';
                            }
                            
                            // Attempt to find and fix problems with missing commas at object boundaries
                            // This often happens when AI generates JSON with formatting issues
                            sanitizedJson = sanitizedJson.replace(/}\s*\n\s*{/g, '},\n{');
                            sanitizedJson = sanitizedJson.replace(/"\s*\n\s*{/g, '",\n{');
                            sanitizedJson = sanitizedJson.replace(/}\s*\n\s*"/g, '},\n"');
                          } catch (fixError) {
                            console.error('Error during targeted JSON fixes:', fixError);
                          }
                          
                          // Wrap in array if it's not already an array or object
                          if (!sanitizedJson.startsWith('[') && !sanitizedJson.startsWith('{')) {
                            sanitizedJson = '[' + sanitizedJson + ']';
                          }
                        } catch (sanitizationError: unknown) {
                          console.error('Error during JSON sanitization:', sanitizationError instanceof Error ? sanitizationError.message : String(sanitizationError));
                        }
                        
                        // Attempt to parse with error details if it fails
                        let fhirResources;
                        try {
                          fhirResources = JSON.parse(sanitizedJson);
                          console.log(`Successfully parsed JSON. Found ${fhirResources.length} FHIR resources in analysis output`);
                        } catch (parseError: unknown) {
                          // Get detailed error position
                          const errorMessage = (parseError as Error).message || 'Unknown JSON parse error';
                          console.error('JSON parse error details:', errorMessage);
                          
                          // Extract position information
                          const positionMatch = errorMessage.match(/position (\d+)/);
                          if (positionMatch && positionMatch[1]) {
                            const position = parseInt(positionMatch[1]);
                            const contextStart = Math.max(0, position - 50);
                            const contextEnd = Math.min(sanitizedJson.length, position + 50);
                            
                            console.error('JSON error context:');
                            console.error(sanitizedJson.substring(contextStart, position) + ' 👉 ' + 
                                          sanitizedJson.charAt(position) + ' 👈 ' + 
                                          sanitizedJson.substring(position + 1, contextEnd));
                          }
                          
                          // Try again with a more aggressive approach - create an empty array if all else fails
                          console.log('Falling back to empty array due to JSON parse error');
                          fhirResources = [];
                          
                          // Attempt to parse individual objects if the array parse failed
                          // This can often recover partial data when one object breaks the entire array
                          try {
                            console.log('Attempting to extract individual valid JSON objects');
                            
                            // Try to match individual JSON objects
                            const objectRegex = /\{(?:[^{}]|(?:\{[^{}]*\}))*\}/g;
                            const potentialObjects = sanitizedJson.match(objectRegex) || [];
                            
                            if (potentialObjects.length > 0) {
                              console.log(`Found ${potentialObjects.length} potential JSON objects to recover`);
                              
                              for (const objString of potentialObjects) {
                                try {
                                  const obj = JSON.parse(objString);
                                  if (obj && typeof obj === 'object' && obj.resourceType) {
                                    console.log(`Successfully recovered JSON object of type ${obj.resourceType}`);
                                    fhirResources.push(obj);
                                  }
                                } catch (objParseError) {
                                  // Skip objects that don't parse
                                }
                              }
                              
                              if (fhirResources.length > 0) {
                                console.log(`Recovered ${fhirResources.length} valid FHIR resources`);
                              }
                            }
                          } catch (recoveryError) {
                            console.error('Failed to recover partial JSON objects:', recoveryError);
                          }
                          
                          // Record the error but continue processing
                          await recordRef.update({
                            analysisError: `Error parsing FHIR resources: ${errorMessage}`
                          });
                        }
                        
                        // Save each resource to Firestore
                        const savedResourceIds: string[] = [];
                        
                        for (const resource of fhirResources) {
                          // Skip resources without resourceType or invalid types
                          if (!resource.resourceType) continue;
                          
                          // Add a timestamp to avoid conflicts
                          const timestamp = new Date().getTime();
                          const resourceId = resource.id || `${timestamp}`;
                          
                          // Ensure the resource has an ID
                          resource.id = resourceId;
                          
                          try {
                            // Save the FHIR resource to the standardized fhir_resources collection
                            const fhirRef = db.collection('users').doc(userId)
                              .collection('fhir_resources')
                              .doc(`${resource.resourceType}_${resourceId}`);
                            
                            await fhirRef.set(resource);
                            console.log(`Saved FHIR resource ${resource.resourceType}/${resourceId}`);
                            
                            // Add to our list of saved resources using the standardized format
                            savedResourceIds.push(`${resource.resourceType}_${resourceId}`);
                          } catch (saveError) {
                            console.error(`Error saving FHIR resource ${resource.resourceType}:`, saveError);
                          }
                        }
                        
                        // Update the record with the FHIR resource IDs
                        if (savedResourceIds.length > 0) {
                          console.log(`Updating record ${docRef.id} with ${savedResourceIds.length} FHIR resource IDs`);
                          await recordRef.update({
                            fhirResourceIds: savedResourceIds,
                            analysisInProgress: false // Mark analysis as complete
                          });
                        } else {
                          // Even if no resources were saved, mark analysis as complete
                          await recordRef.update({
                            analysisInProgress: false
                          });
                        }
                      } catch (fhirExtractionError: any) {
                        console.error('Error extracting FHIR resources from analysis:', fhirExtractionError);
                        // Mark analysis as complete with error
                        let errorMessage = fhirExtractionError.message || String(fhirExtractionError);
                        
                        // Check if it's a JSON parsing error and extract context if available
                        if (errorMessage.includes('position')) {
                          // This is likely a JSON parsing error with position information
                          await recordRef.update({
                            analysisInProgress: false,
                            analysisError: `Error parsing FHIR resources: ${errorMessage}`
                          });
                        } else {
                          // Generic error without context
                          await recordRef.update({
                            analysisInProgress: false,
                            analysisError: `Error extracting FHIR resources: ${errorMessage}`
                          });
                        }
                      }
                    } else {
                      console.log('No FHIR resources found in analysis output');
                      // Mark analysis as complete
                      await recordRef.update({
                        analysisInProgress: false
                      });
                    }
                  } catch (fhirExtractionError: any) {
                    console.error('Error extracting FHIR resources from analysis:', fhirExtractionError);
                    // Mark analysis as complete with error
                    let errorMessage = fhirExtractionError.message || String(fhirExtractionError);
                    
                    // Check if it's a JSON parsing error and extract context if available
                    if (errorMessage.includes('position')) {
                      // This is likely a JSON parsing error with position information
                      await recordRef.update({
                        analysisInProgress: false,
                        analysisError: `Error parsing FHIR resources: ${errorMessage}`
                      });
                    } else {
                      // Generic error without context
                      await recordRef.update({
                        analysisInProgress: false,
                        analysisError: `Error extracting FHIR resources: ${errorMessage}`
                      });
                    }
                  }
                } else {
                  // Mark analysis as complete even if there's no result
                  await recordRef.update({
                    analysisInProgress: false
                  });
                }
                
                // After analysis is complete, update the record with the suggested name if appropriate
                try {
                  // Check if the analysis result contains a suggested record name
                  if (result && result.content) {
                    const suggestedNameMatch = result.content.match(/<SUGGESTED_RECORD_NAME>\s*([\s\S]*?)\s*<\/SUGGESTED_RECORD_NAME>/i);
                    
                    if (suggestedNameMatch && suggestedNameMatch[1]) {
                      const suggestedName = suggestedNameMatch[1].trim();
                      console.log(`Found suggested record name: ${suggestedName}`);
                      
                      // Only update if the user didn't provide a name
                      if (!recordName || recordName.trim() === '' || recordName.trim() === 'Medical Record') {
                        await recordRef.update({
                          name: suggestedName
                        });
                        console.log(`Updated record name to suggested name: ${suggestedName}`);
                      }
                    }
                  }
                } catch (nameExtractionError) {
                  console.error('Error extracting or updating suggested record name:', nameExtractionError);
                }
              } catch (analysisError: any) {
                console.error('Error during analysis:', analysisError);
                // Update record to indicate analysis error
                await recordRef.update({
                  analysis: `Error during analysis: ${analysisError.message || 'Unknown error'}. Files were uploaded successfully.`,
                  analysisInProgress: false,
                  analyzedAt: new Date()
                });
              }
            } else {
              console.error('No files were successfully uploaded to OpenAI');
              
              // Update record to indicate error
              const recordRef = db.collection('users').doc(userId).collection('records').doc(docRef.id);
              await recordRef.update({
                analysis: "Error: Failed to upload files to OpenAI for analysis.",
                analysisInProgress: false,
                analyzedAt: new Date()
              });
            }
          } catch (analysisError) {
            console.error('Error during automatic analysis:', analysisError);
          }
        })();
      }
    } catch (autoAnalysisError) {
      console.error('Error setting up automatic analysis:', autoAnalysisError);
    }
    
    // Extract text from the uploaded document using existing methods
    let documentText = '';
    if (fileTypes[0].includes('pdf')) {
      // Use existing PDF text extraction
      const pdfText = await extractTextFromPdf(fileUrls[0]);
      documentText = pdfText;
    } else if (fileTypes[0].includes('image')) {
      // Use existing OCR for images
      const ocrText = await performOCR(fileUrls[0]);
      documentText = ocrText;
    }

    // If we have text content, analyze it to determine document type and extract data
    if (documentText) {
      try {
        const analysis = await analyzeDocumentText(documentText, recordName, fileUrls[0]);
        
        // Create document metadata for FHIR resource creation
        const documentData = {
          name: recordName,
          recordType: analysis.recordType,
          recordDate: '', // Initialize as empty string
          briefSummary: analysis.summary,
          extractedData: analysis.extractedData,
          comment: comment || '',
          createdAt: new Date().toISOString(),
          provider: analysis.extractedData?.provider || ''
        };
        
        // Try to extract a date from the analysis
        if (analysis.extractedData && analysis.extractedData.date) {
          documentData.recordDate = new Date(analysis.extractedData.date).toISOString();
        } else if (analysis.summary) {
          // Try to extract date from the summary text
          const dateMatch = analysis.summary.match(/<DATE>([^<]+)<\/DATE>/);
          if (dateMatch) {
            documentData.recordDate = new Date(dateMatch[1].trim()).toISOString();
          }
        }
        
        // If still no date, use current date as fallback
        if (!documentData.recordDate) {
          documentData.recordDate = new Date().toISOString();
        }
        
        // Extract FHIR resources based on document type
        const patientId = 'default-patient-id'; // In a real app, this would be linked to the user
        
        // Use the extractAllFromDocument function to get all relevant FHIR resources
        const fhirResources = await extractAllFromDocument(documentData, fileUrls[0], patientId);
        
        // Save each extracted resource to Firestore
        const savedResources = {
          documentReferenceId: '',
          procedureId: '',
          imagingStudyId: '',
          diagnosticReportIds: [] as string[]
        };
        
        // Save DocumentReference if detected
        if (fhirResources.documentReference) {
          try {
            const docRefId = await createDocumentReference(
              userId,
              fhirResources.documentReference,
              patientId,
              fileUrls[0],
              fileTypes[0]
            );
            
            if (docRefId) {
              savedResources.documentReferenceId = docRefId;
              console.log(`Saved DocumentReference with ID: ${docRefId}`);
            }
          } catch (err) {
            console.error('Error saving DocumentReference:', err);
          }
        }
        
        // Save Procedure if detected
        if (fhirResources.procedures && fhirResources.procedures.length > 0) {
          try {
            const procedureId = await createProcedure(
              userId,
              fhirResources.procedures[0],
              patientId
            );
            
            if (procedureId) {
              savedResources.procedureId = procedureId;
              console.log(`Saved Procedure with ID: ${procedureId}`);
            }
          } catch (err) {
            console.error('Error saving Procedure:', err);
          }
        }
        
        // Save ImagingStudy if detected
        if (fhirResources.imagingStudies && fhirResources.imagingStudies.length > 0) {
          try {
            const imagingStudyId = await createImagingStudy(
              userId,
              fhirResources.imagingStudies[0],
              patientId
            );
            
            if (imagingStudyId) {
              savedResources.imagingStudyId = imagingStudyId;
              console.log(`Saved ImagingStudy with ID: ${imagingStudyId}`);
              
              // Save DiagnosticReport for imaging if we have an imaging study
              if (fhirResources.imagingReports && fhirResources.imagingReports.length > 0) {
                try {
                  const reportId = await createDiagnosticReportImaging(
                    userId,
                    fhirResources.imagingReports[0],
                    patientId,
                    imagingStudyId
                  );
                  
                  if (reportId) {
                    savedResources.diagnosticReportIds.push(reportId);
                    console.log(`Saved DiagnosticReport for imaging with ID: ${reportId}`);
                  }
                } catch (err) {
                  console.error('Error saving DiagnosticReport for imaging:', err);
                }
              }
            }
          } catch (err) {
            console.error('Error saving ImagingStudy:', err);
          }
        }
        
        // Include the saved resource IDs in the record metadata
        const allResourceIds: string[] = [];
        
        // Add document reference ID if present
        if (savedResources.documentReferenceId) {
          allResourceIds.push(savedResources.documentReferenceId);
        }
        
        // Add procedure ID if present
        if (savedResources.procedureId) {
          allResourceIds.push(savedResources.procedureId);
        }
        
        // Add imaging study ID if present
        if (savedResources.imagingStudyId) {
          allResourceIds.push(savedResources.imagingStudyId);
        }
        
        // Add all diagnostic report IDs if present
        if (savedResources.diagnosticReportIds && savedResources.diagnosticReportIds.length > 0) {
          savedResources.diagnosticReportIds.forEach(id => {
            if (id) allResourceIds.push(id);
          });
        }
        
        const recordWithFhirIds = {
          ...documentData,
          fhirResourceIds: allResourceIds
        };
        
        // Update the record in Firestore with FHIR resource IDs
        const recordRef = db.collection('users').doc(userId).collection('records').doc(docRef.id);
        await recordRef.update(recordWithFhirIds);
        
      } catch (analysisError) {
        console.error('Error analyzing document:', analysisError);
        // Continue without analysis if it fails
      }
    }

    return NextResponse.json({
      success: true,
      recordId: docRef.id,
      fileUrls
    });
  } catch (error) {
    // Enhanced error logging
    console.error('Error uploading files:', error);
    
    // Return a more detailed error response in development mode
    if (process.env.NODE_ENV === 'development') {
      return NextResponse.json(
        { 
          error: 'Internal server error', 
          details: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  } finally {
    // Trigger vector index rebuild in the background
    // This runs after the response has been sent to the client
    if (userId) {
      (async () => {
        try {
          console.log(`Triggering vector index rebuild for user ${userId} after document upload`);
          await buildUserVectorIndex(userId, true);
          console.log(`Vector index rebuild completed for user ${userId}`);
        } catch (indexError) {
          console.error(`Error rebuilding vector index for user ${userId}:`, indexError);
          // Don't throw, just log the error since this is a background process
        }
      })();
    }
  }
}

// Define interface for record data
interface RecordData {
  name: string;
  comment: string;
  urls: string[];
  fileCount: number;
  isMultiFile: boolean;
  createdAt: Date;
  fileTypes: string[];
  recordType: string;
  recordDate: string;
  analysisInProgress: boolean;
  url?: string; // Optional URL for single-file uploads
  analysis?: string;
  briefSummary?: string;
  detailedAnalysis?: string;
  fhirResourceIds?: string[];
} 