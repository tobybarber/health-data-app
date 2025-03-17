import { NextRequest, NextResponse } from 'next/server';
import { db, storage } from '../../../lib/firebase-admin';
import { verifyAuthToken } from '../../../lib/auth-middleware';

/**
 * POST handler for uploading files and creating records
 * This endpoint ensures users can only upload to their own storage space
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication and get user ID
    const authRequest = await verifyAuthToken(request);
    
    // If authRequest is a NextResponse, it means there was an auth error
    if (authRequest instanceof NextResponse) {
      return authRequest;
    }
    
    // Get the authenticated user ID from the request headers
    const userId = authRequest.headers.get('x-user-id');
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized: User ID not found' },
        { status: 401 }
      );
    }
    
    // Parse the form data
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const recordName = formData.get('recordName') as string || 'Medical Record';
    const comment = formData.get('comment') as string || '';
    
    if (files.length === 0 && !comment.trim()) {
      return NextResponse.json(
        { error: 'Please select at least one file to upload or provide a comment' },
        { status: 400 }
      );
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
      recordDate: "",
      fileTypes: files.map(file => file.type),
    };
    
    const docRef = await db.collection('users').doc(userId).collection('records').add(recordData);
    
    return NextResponse.json({
      success: true,
      recordId: docRef.id,
      fileUrls
    });
  } catch (error) {
    // Only log errors in development mode
    if (process.env.NODE_ENV === 'development') {
      console.error('Error uploading files:', error);
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 