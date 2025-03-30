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

/**
 * POST handler for uploading files and creating records
 * This endpoint ensures users can only upload to their own storage space
 */
export async function POST(request: NextRequest) {
  try {
    // Parse the form data first, before any other operations
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const recordName = formData.get('recordName') as string || 'Medical Record';
    const comment = formData.get('comment') as string || '';
    
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
    
    // Call verifyAuthToken with the token
    const userId = await verifyTokenAndGetUserId(token);
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid token' },
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
        name: recordName.trim() || 'Medical Record',
        comment: comment,
        urls: [],
        fileCount: 0,
        isMultiFile: false,
        createdAt: new Date(),
        analysis: "This is a comment-only record.",
        briefSummary: "Comment-only record",
        detailedAnalysis: "This record contains only a comment without any attached files.",
        recordType: recordName.trim() || 'Comment',
        recordDate: new Date().toISOString().split('T')[0],
        fileTypes: [],
        analysisInProgress: true  // Flag to indicate analysis is in progress
      };
      
      const docRef = await db.collection('users').doc(userId).collection('records').add(recordData);
      
      // Update the analysis document to indicate that an update is needed
      const analysisRef = db.collection('users').doc(userId).collection('analysis').doc('holistic');
      await analysisRef.set({
        needsUpdate: true,
        lastRecordAdded: new Date()
      }, { merge: true });
      
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
      recordType: recordName.trim() || 'Medical Record',
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
                        // Parse the JSON array of resources
                        const fhirResources = JSON.parse(fhirResourcesJson);
                        console.log(`Found ${fhirResources.length} FHIR resources in analysis output`);
                        
                        // Save each resource to Firestore
                        const savedResourceIds: string[] = [];
                        
                        for (const resource of fhirResources) {
                          // Skip resources without resourceType or invalid types
                          if (!resource.resourceType) continue;
                          
                          // Add a timestamp to avoid conflicts
                          const timestamp = new Date().getTime();
                          const resourceId = `${resource.id || `${resource.resourceType.toLowerCase()}-${timestamp}`}`;
                          
                          try {
                            // Save the FHIR resource to Firestore
                            const fhirRef = db.collection('users').doc(userId).collection('fhir').doc(resourceId);
                            await fhirRef.set(resource);
                            console.log(`Saved FHIR resource ${resource.resourceType}/${resourceId}`);
                            
                            // Add to our list of saved resources
                            savedResourceIds.push(resourceId);
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
                      } catch (jsonError) {
                        console.error('Error parsing FHIR resources JSON:', jsonError);
                        // Mark analysis as complete even if there was an error
                        await recordRef.update({
                          analysisInProgress: false,
                          analysisError: `Error parsing FHIR resources: ${jsonError}`
                        });
                      }
                    } else {
                      console.log('No FHIR resources found in analysis output');
                      // Mark analysis as complete
                      await recordRef.update({
                        analysisInProgress: false
                      });
                    }
                  } catch (fhirExtractionError) {
                    console.error('Error extracting FHIR resources from analysis:', fhirExtractionError);
                    // Mark analysis as complete with error
                    await recordRef.update({
                      analysisInProgress: false,
                      analysisError: `Error extracting FHIR resources: ${fhirExtractionError}`
                    });
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
          recordDate: new Date().toISOString(), // Use extracted date if available
          briefSummary: analysis.summary,
          extractedData: analysis.extractedData,
          comment: comment || '',
          createdAt: new Date().toISOString(),
          provider: analysis.extractedData?.provider || ''
        };
        
        // Try to extract a date from the analysis
        if (analysis.extractedData && analysis.extractedData.date) {
          documentData.recordDate = new Date(analysis.extractedData.date).toISOString();
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
        
        // Save DocumentReference
        if (fhirResources.documentReference) {
          try {
            const docRef = await createDocumentReference(
              userId,
              fhirResources.documentReference,
              patientId,
              fileUrls[0],
              fileTypes[0]
            );
            
            // Check if docRef exists and has an id property
            if (docRef && typeof docRef === 'object') {
              savedResources.documentReferenceId = docRef.id || '';
              console.log(`Saved DocumentReference with ID: ${docRef.id || 'unknown'}`);
            }
          } catch (err) {
            console.error('Error saving DocumentReference:', err);
          }
        }
        
        // Save Procedure if detected
        if (fhirResources.procedures && fhirResources.procedures.length > 0) {
          try {
            const procedureRef = await createProcedure(
              userId,
              fhirResources.procedures[0],
              patientId
            );
            
            // Check if procedureRef exists and has an id property
            if (procedureRef && typeof procedureRef === 'object') {
              savedResources.procedureId = procedureRef.id || '';
              console.log(`Saved Procedure with ID: ${procedureRef.id || 'unknown'}`);
            }
          } catch (err) {
            console.error('Error saving Procedure:', err);
          }
        }
        
        // Save ImagingStudy if detected
        if (fhirResources.imagingStudies && fhirResources.imagingStudies.length > 0) {
          try {
            const imagingStudyRef = await createImagingStudy(
              userId,
              fhirResources.imagingStudies[0],
              patientId
            );
            
            // Check if imagingStudyRef exists and has an id property
            if (imagingStudyRef && typeof imagingStudyRef === 'object') {
              savedResources.imagingStudyId = imagingStudyRef.id || '';
              console.log(`Saved ImagingStudy with ID: ${imagingStudyRef.id || 'unknown'}`);
              
              // Save DiagnosticReport for imaging if we have an imaging study
              if (fhirResources.imagingReports && fhirResources.imagingReports.length > 0) {
                try {
                  const reportRef = await createDiagnosticReportImaging(
                    userId,
                    fhirResources.imagingReports[0],
                    patientId,
                    imagingStudyRef.id
                  );
                  
                  // Check if reportRef exists and has an id property
                  if (reportRef && typeof reportRef === 'object') {
                    savedResources.diagnosticReportIds.push(reportRef.id || '');
                    console.log(`Saved DiagnosticReport for imaging with ID: ${reportRef.id || 'unknown'}`);
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
        await updateDoc(recordRef, recordWithFhirIds);
        
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