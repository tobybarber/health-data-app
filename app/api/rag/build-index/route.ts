import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../lib/firebase-admin';

// Use Node.js runtime for this API route
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  // Extract userId from query parameters
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json(
      { error: 'Missing userId parameter' },
      { status: 400 }
    );
  }

  try {
    // Get the index status from Firestore
    const indexRef = db.collection('users').doc(userId).collection('settings').doc('ragIndex');
    const indexDoc = await indexRef.get();
    
    if (!indexDoc.exists) {
      return NextResponse.json({
        status: 'not_started',
        needsRebuild: false,
        options: {
          onlySummaryReports: true
        }
      });
    }

    const indexData = indexDoc.data();
    
    return NextResponse.json({
      status: indexData?.status || 'not_started',
      lastUpdated: indexData?.lastUpdated || null,
      needsRebuild: indexData?.needsRebuild || false,
      error: indexData?.error || null,
      options: {
        onlySummaryReports: indexData?.options?.onlySummaryReports ?? true
      }
    });

  } catch (error) {
    console.error('Error fetching index status:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch index status',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, onlySummaryReports = true } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId in request body' },
        { status: 400 }
      );
    }

    // Update the index status to indicate building has started
    const indexRef = db.collection('users').doc(userId).collection('settings').doc('ragIndex');
    await indexRef.set({
      status: 'building',
      lastUpdated: new Date(),
      needsRebuild: false,
      error: null,
      options: {
        onlySummaryReports
      }
    }, { merge: true });

    // In a real implementation, you would:
    // 1. Start a background job to build the index
    // 2. Process FHIR resources
    // 3. Create vector embeddings
    // 4. Save them to your vector store
    
    // For now, we'll simulate success after a delay
    setTimeout(async () => {
      try {
        await indexRef.set({
          status: 'complete',
          lastUpdated: new Date(),
          error: null
        }, { merge: true });
      } catch (error) {
        console.error('Error updating index status:', error);
      }
    }, 5000);

    return NextResponse.json({
      status: 'building',
      message: 'Index build started'
    });

  } catch (error) {
    console.error('Error starting index build:', error);
    return NextResponse.json(
      { 
        error: 'Failed to start index build',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
} 