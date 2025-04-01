import { NextRequest, NextResponse } from 'next/server';
import { buildUserVectorIndexWithOptions } from '../../../lib/rag-service';
import admin from 'firebase-admin';
import { db } from '../../../lib/firebase-admin';

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    const { userId, onlySummaryReports = false } = body;
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Missing userId parameter" },
        { status: 400 }
      );
    }
    
    console.log(`Manual vector index building requested for user ${userId}, onlySummaryReports: ${onlySummaryReports}`);
    
    // Update the index status in Firestore
    const statusRef = db.collection('users').doc(userId).collection('settings').doc('ragIndex');
    await statusRef.set({
      status: 'building',
      startedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastError: null,
      options: {
        onlySummaryReports
      }
    }, { merge: true });
    
    // Start index building in the background
    const buildPromise = buildUserVectorIndexWithOptions(userId, onlySummaryReports);
    
    // Return success immediately
    return NextResponse.json({
      success: true,
      message: "Vector index building started in the background",
      options: {
        onlySummaryReports
      }
    });
    
    // The buildPromise continues in the background
    buildPromise
      .then(index => {
        console.log(`Vector index built successfully for user ${userId}`);
        // Update the status to complete
        return statusRef.set({
          status: 'complete',
          completedAt: admin.firestore.FieldValue.serverTimestamp(),
          resourceCount: index ? 'success' : 'no resources'
        }, { merge: true });
      })
      .catch(error => {
        console.error(`Error building vector index for user ${userId}:`, error);
        // Update the status to error
        return statusRef.set({
          status: 'error',
          lastError: error.message || 'Unknown error',
          errorAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      });
      
  } catch (error) {
    console.error('Error processing index build request:', error);
    return NextResponse.json(
      { success: false, error: `Unexpected error: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Missing userId parameter" },
        { status: 400 }
      );
    }
    
    // Get the current status from Firestore
    const statusRef = db.collection('users').doc(userId).collection('settings').doc('ragIndex');
    const statusDoc = await statusRef.get();
    
    if (!statusDoc.exists) {
      return NextResponse.json({
        success: true,
        status: 'not_started',
        message: "Vector index has not been built yet"
      });
    }
    
    const statusData = statusDoc.data();
    
    return NextResponse.json({
      success: true,
      status: statusData?.status || 'unknown',
      lastUpdated: statusData?.completedAt || statusData?.errorAt || statusData?.startedAt || null,
      error: statusData?.lastError || null,
      options: statusData?.options || {},
      needsRebuild: statusData?.needsRebuild || false
    });
    
  } catch (error) {
    console.error('Error fetching index status:', error);
    return NextResponse.json(
      { success: false, error: `Unexpected error: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
} 