import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../lib/firebase-admin';
import { verifyTokenAndGetUserId } from '../../../../lib/auth-middleware';

// Base path for FHIR resources in Firestore
const FHIR_COLLECTION_PATH = 'fhir';

/**
 * Handle GET request to fetch a specific resource by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { resourceType: string; id: string } }
) {
  try {
    // Verify auth token
    const token = request.headers.get('authorization')?.split('Bearer ')[1] || '';
    const userId = await verifyTokenAndGetUserId(token);
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { resourceType, id } = params;
    
    // Fetch the resource
    const docRef = db.collection(`users/${userId}/${FHIR_COLLECTION_PATH}/${resourceType}`).doc(id);
    const docSnap = await docRef.get();
    
    if (!docSnap.exists) {
      return NextResponse.json(
        { error: `${resourceType}/${id} not found` },
        { status: 404 }
      );
    }
    
    return NextResponse.json(docSnap.data());
  } catch (error: any) {
    console.error(`Error fetching ${params.resourceType}/${params.id}:`, error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
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
    // Verify auth token
    const token = request.headers.get('authorization')?.split('Bearer ')[1] || '';
    const userId = await verifyTokenAndGetUserId(token);
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { resourceType, id } = params;
    const resource = await request.json();
    
    // Ensure resource has correct ID and type
    if (resource.id !== id) {
      return NextResponse.json(
        { error: `Resource ID mismatch: expected ${id}, got ${resource.id}` },
        { status: 400 }
      );
    }
    
    if (resource.resourceType !== resourceType) {
      return NextResponse.json(
        { error: `Resource type mismatch: expected ${resourceType}, got ${resource.resourceType}` },
        { status: 400 }
      );
    }
    
    // Check if resource exists
    const docRef = db.collection(`users/${userId}/${FHIR_COLLECTION_PATH}/${resourceType}`).doc(id);
    const docSnap = await docRef.get();
    
    if (!docSnap.exists) {
      return NextResponse.json(
        { error: `${resourceType}/${id} not found` },
        { status: 404 }
      );
    }
    
    // Update metadata
    resource.meta = {
      ...(resource.meta || {}),
      lastUpdated: new Date().toISOString(),
      versionId: resource.meta?.versionId
        ? `${parseInt(resource.meta.versionId) + 1}`
        : '1'
    };
    
    // Update in Firestore
    await docRef.set(resource);
    
    return NextResponse.json(resource);
  } catch (error: any) {
    console.error(`Error updating ${params.resourceType}/${params.id}:`, error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
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
    // Verify auth token
    const token = request.headers.get('authorization')?.split('Bearer ')[1] || '';
    const userId = await verifyTokenAndGetUserId(token);
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { resourceType, id } = params;
    
    // Check if resource exists
    const docRef = db.collection(`users/${userId}/${FHIR_COLLECTION_PATH}/${resourceType}`).doc(id);
    const docSnap = await docRef.get();
    
    if (!docSnap.exists) {
      return NextResponse.json(
        { error: `${resourceType}/${id} not found` },
        { status: 404 }
      );
    }
    
    // Delete from Firestore
    await docRef.delete();
    
    return new NextResponse(null, { status: 204 });
  } catch (error: any) {
    console.error(`Error deleting ${params.resourceType}/${params.id}:`, error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
} 