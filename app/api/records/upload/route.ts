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
      
      // Update index status to indicate it needs rebuilding, but don't rebuild automatically
      console.log(`Setting needsRebuild flag for vector index after record upload`);
      const ragIndexRef = db.collection('users').doc(userId).collection('settings').doc('ragIndex');
      await ragIndexRef.set({
        needsRebuild: true,
        lastDataUpdate: new Date()
      }, { merge: true });
      
      return NextResponse.json({
        success: true,
        recordId: docRef.id,
        message: 'Record created successfully',
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
    
    // Update index status to indicate it needs rebuilding, but don't rebuild automatically
    console.log(`Setting needsRebuild flag for vector index after record upload`);
    const ragIndexRef = db.collection('users').doc(userId).collection('settings').doc('ragIndex');
    await ragIndexRef.set({
      needsRebuild: true,
      lastDataUpdate: new Date()
    }, { merge: true });
    
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

    // Trigger vector index rebuild
    console.log(`Setting needsRebuild flag for vector index for user ${userId} after file(s) processing`);
    const ragIndexStatusRef = db.collection('users').doc(userId).collection('settings').doc('ragIndex');
    await ragIndexStatusRef.set({
      needsRebuild: true,
      lastDataUpdate: new Date()
    }, { merge: true });
    
    // Collect all resource IDs that were created (or use empty array if none)
    const allResourceIds: string[] = [];
    
    // Return the response with created resources and records
    const response = {
      success: true,
      message: `Processed ${files.length} file(s)`,
      recordIds: [docRef.id],
      resourceIds: allResourceIds
    };

    return NextResponse.json(response);
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
    // Update index status to indicate it needs rebuilding instead of automatic rebuild
    if (userId) {
      (async () => {
        try {
          console.log(`Setting needsRebuild flag for vector index for user ${userId}`);
          const indexRef = db.collection('users').doc(userId).collection('settings').doc('ragIndex');
          await indexRef.set({
            needsRebuild: true,
            lastDataUpdate: new Date()
          }, { merge: true });
          console.log(`Vector index status updated for user ${userId}`);
        } catch (indexError) {
          console.error(`Error updating vector index status for user ${userId}:`, indexError);
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