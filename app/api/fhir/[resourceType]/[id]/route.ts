import db from '../../../../lib/firebaseAdmin';
import { NextResponse, NextRequest } from 'next/server';

// Base path for FHIR resources in Firestore
const FHIR_COLLECTION_PATH = 'fhir_resources';

/**
 * Handle GET request to fetch a specific resource by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { resourceType: string; id: string } }
) {
  try {
    // Get the resource type and ID from the URL
    const { resourceType, id } = params;
    
    // Get user ID from query parameter (simplified for demo)
    const userId = request.nextUrl.searchParams.get('userId');
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }
    
    // Create document reference with the standardized format
    const docRef = db.collection('users').doc(userId)
      .collection(FHIR_COLLECTION_PATH)
      .doc(`${resourceType}_${id}`);
    
    const doc = await docRef.get();
    
    if (!doc.exists) {
      return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
    }
    
    return NextResponse.json(doc.data());
  } catch (error) {
    console.error('Error fetching FHIR resource:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

/**
 * Handle PUT request to update a specific resource by ID
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { resourceType: string; id: string } }
) {
  try {
    // Get the resource type and ID from the URL
    const { resourceType, id } = params;
    
    // Get user ID from query parameter (simplified for demo)
    const userId = request.nextUrl.searchParams.get('userId');
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }
    
    // Parse the request body
    const resource = await request.json();
    
    // Validate the resource has the right type and ID
    if (!resource || resource.resourceType !== resourceType || resource.id !== id) {
      return NextResponse.json({ 
        error: 'Invalid resource: Type or ID mismatch' 
      }, { status: 400 });
    }
    
    // Create document reference with the standardized format
    const docRef = db.collection('users').doc(userId)
      .collection(FHIR_COLLECTION_PATH)
      .doc(`${resourceType}_${id}`);
    
    // Check if the resource exists
    const doc = await docRef.get();
    
    if (!doc.exists) {
      return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
    }
    
    // Update the resource
    await docRef.set(resource);
    
    return NextResponse.json(resource);
  } catch (error) {
    console.error('Error updating FHIR resource:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

/**
 * Handle DELETE request to delete a specific resource by ID
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { resourceType: string; id: string } }
) {
  try {
    // Get the resource type and ID from the URL
    const { resourceType, id } = params;
    
    // Get user ID from query parameter (simplified for demo)
    const userId = request.nextUrl.searchParams.get('userId');
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }
    
    // Create document reference with the standardized format
    const docRef = db.collection('users').doc(userId)
      .collection(FHIR_COLLECTION_PATH)
      .doc(`${resourceType}_${id}`);
    
    // Check if the resource exists
    const doc = await docRef.get();
    
    if (!doc.exists) {
      return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
    }
    
    // Delete the resource
    await docRef.delete();
    
    return NextResponse.json({ message: 'Resource deleted' });
  } catch (error) {
    console.error('Error deleting FHIR resource:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
} 