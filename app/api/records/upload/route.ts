import { NextRequest, NextResponse } from 'next/server';
import { db, storage } from '../../../lib/firebase-admin';
import { verifyAuthToken } from '../../../lib/auth-middleware';

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
    
    // Upload files to Firebase Storage
    const fileUrls: string[] = [];
    const fileTypes: string[] = [];
    const timestamp = Date.now();
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const safeRecordName = recordName.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filePath = `users/${userId}/records/${safeRecordName}_${timestamp}_${i}_${file.name}`;
      
      // Convert file to buffer
      const buffer = Buffer.from(await file.arrayBuffer());
      
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
      fileUrls.push(downloadUrl);
      fileTypes.push(file.type);
    }
    
    // Create record in Firestore
    const recordData = {
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