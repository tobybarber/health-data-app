import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { db, storage } from '../../../lib/firebase-admin';
import { verifyAuthToken } from '../../../lib/auth-middleware';
import fs from 'fs';

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
    const userId = await verifyIdToken(token);
    
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
      const recordData = {
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
    
    // Create record in Firestore
    const recordData: Record<string, any> = {
      name: recordName.trim() || 'Medical Record',
      comment: comment,
      urls: fileUrls,
      fileCount: fileUrls.length,
      isMultiFile: fileUrls.length > 1,
      createdAt: new Date(),
      analysis: "This record is being analyzed...",
      briefSummary: "This record is being analyzed...",
      detailedAnalysis: "This record is being analyzed...",
      recordType: "Medical Record",
      recordDate: new Date().toISOString().split('T')[0],
      fileTypes: files.map(file => file.type),
    };
    
    // Only add url field if there's exactly one file (for single-file records)
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
                openaiFileIds: openaiFileIds
              });
              
              // Now trigger analysis, but limit the number of additional files to avoid timeouts
              // When there are too many files, we'll analyze just the primary file first
              const maxAdditionalFilesForAnalysis = 5;
              const analysisAdditionalIds = additionalIds.length > maxAdditionalFilesForAnalysis
                ? additionalIds.slice(0, maxAdditionalFilesForAnalysis) // Take only the first few additional files
                : additionalIds;
                
              try {
                const result = await analyzeRecord(
                  userId, 
                  docRef.id,
                  primaryFileId,
                  fileTypes[0], 
                  recordName.trim() || 'Medical Record',
                  undefined,
                  analysisAdditionalIds.length > 0 ? analysisAdditionalIds : undefined
                );
                
                console.log('Analysis complete with result:', result);
                
                // If we limited the analysis files, update the record to note this
                if (additionalIds.length > maxAdditionalFilesForAnalysis) {
                  await recordRef.update({
                    briefSummary: "Note: Due to the large number of files, only some have been analyzed together. For a complete analysis, view individual files.",
                    analysisNote: `Analyzed ${maxAdditionalFilesForAnalysis + 1} out of ${openaiFileIds.length} files in this record.`
                  });
                }
              } catch (analysisError: any) {
                console.error('Error during analysis:', analysisError);
                // Update record to indicate analysis error
                await recordRef.update({
                  analysis: `Error during analysis: ${analysisError.message || 'Unknown error'}. Files were uploaded successfully.`,
                  analyzedAt: new Date()
                });
              }
            } else {
              console.error('No files were successfully uploaded to OpenAI');
              
              // Update record to indicate error
              const recordRef = db.collection('users').doc(userId).collection('records').doc(docRef.id);
              await recordRef.update({
                analysis: "Error: Failed to upload files to OpenAI for analysis.",
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

// Helper function to verify Firebase ID token
async function verifyIdToken(token: string): Promise<string | null> {
  try {
    const { getAuth } = require('firebase-admin/auth');
    const decodedToken = await getAuth().verifyIdToken(token);
    return decodedToken.uid;
  } catch (error) {
    console.error('Error verifying token:', error);
    return null;
  }
} 