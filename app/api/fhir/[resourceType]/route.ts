import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../lib/firebase-admin';
import { verifyAuthToken } from '../../../lib/auth-middleware';

// Base path for FHIR resources in Firestore
const FHIR_COLLECTION_PATH = 'fhir';

/**
 * Validate a FHIR resource
 * This is a simple validation for now - can be expanded with more complex validation rules
 */
function validateResource(resource: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!resource) {
    errors.push('Resource cannot be empty');
    return { valid: false, errors };
  }
  
  if (!resource.resourceType) {
    errors.push('Resource must have a resourceType');
    return { valid: false, errors };
  }
  
  // More validation rules can be added here
  
  return { valid: errors.length === 0, errors };
}

/**
 * Handle GET request to fetch a specific resource or search for resources
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { resourceType: string } }
) {
  try {
    // Verify auth token
    const token = request.headers.get('authorization')?.split('Bearer ')[1] || '';
    const userId = await verifyAuthToken(token);
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { resourceType } = params;
    const searchParams = new URL(request.url).searchParams;
    const id = searchParams.get('_id');
    
    // If an ID is provided, fetch a specific resource
    if (id) {
      const docRef = db.collection(`users/${userId}/${FHIR_COLLECTION_PATH}/${resourceType}`).doc(id);
      const docSnap = await docRef.get();
      
      if (!docSnap.exists) {
        return NextResponse.json(
          { error: `${resourceType}/${id} not found` },
          { status: 404 }
        );
      }
      
      return NextResponse.json(docSnap.data());
    }
    
    // Otherwise, perform a search
    let queryRef = db.collection(`users/${userId}/${FHIR_COLLECTION_PATH}/${resourceType}`);
    
    // Process search parameters (excluding FHIR-specific parameters)
    searchParams.forEach((value, key) => {
      if (!key.startsWith('_')) {
        // Handle prefixes for comparisons (e.g., gt, lt, ge, le, eq)
        if (
          value.startsWith('gt') ||
          value.startsWith('lt') ||
          value.startsWith('ge') ||
          value.startsWith('le') ||
          value.startsWith('eq')
        ) {
          const prefix = value.substring(0, 2);
          const actualValue = value.substring(2);
          
          switch (prefix) {
            case 'gt':
              queryRef = queryRef.where(key, '>', actualValue);
              break;
            case 'lt':
              queryRef = queryRef.where(key, '<', actualValue);
              break;
            case 'ge':
              queryRef = queryRef.where(key, '>=', actualValue);
              break;
            case 'le':
              queryRef = queryRef.where(key, '<=', actualValue);
              break;
            case 'eq':
              queryRef = queryRef.where(key, '==', actualValue);
              break;
          }
        } else {
          queryRef = queryRef.where(key, '==', value);
        }
      }
    });
    
    // Handle sorting
    const sort = searchParams.get('_sort');
    if (sort) {
      const sortFields = sort.split(',');
      for (const field of sortFields) {
        const isDescending = field.startsWith('-');
        const sortField = isDescending ? field.substring(1) : field;
        queryRef = queryRef.orderBy(sortField, isDescending ? 'desc' : 'asc');
      }
    }
    
    // Handle limit
    const count = searchParams.get('_count');
    if (count) {
      queryRef = queryRef.limit(parseInt(count));
    } else {
      queryRef = queryRef.limit(100); // Default limit
    }
    
    const querySnapshot = await queryRef.get();
    
    // Convert to Bundle
    const entries: any[] = [];
    querySnapshot.forEach((doc) => {
      entries.push({
        resource: doc.data(),
        fullUrl: `${resourceType}/${doc.id}`
      });
    });
    
    const bundle = {
      resourceType: 'Bundle',
      type: 'searchset',
      total: entries.length,
      entry: entries
    };
    
    return NextResponse.json(bundle);
  } catch (error: any) {
    console.error('Error in FHIR GET:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Handle POST request to create a new resource
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { resourceType: string } }
) {
  try {
    // Verify auth token
    const token = request.headers.get('authorization')?.split('Bearer ')[1] || '';
    const userId = await verifyAuthToken(token);
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { resourceType } = params;
    const resource = await request.json();
    
    // Validate resource
    const { valid, errors } = validateResource(resource);
    if (!valid) {
      return NextResponse.json({ error: errors.join(', ') }, { status: 400 });
    }
    
    // Ensure resourceType matches route
    if (resource.resourceType !== resourceType) {
      return NextResponse.json(
        { error: `Resource type mismatch: expected ${resourceType}, got ${resource.resourceType}` },
        { status: 400 }
      );
    }
    
    // Generate ID if not provided
    const id = resource.id || Math.random().toString(36).substring(2, 15);
    resource.id = id;
    
    // Add metadata
    resource.meta = {
      ...(resource.meta || {}),
      lastUpdated: new Date().toISOString(),
    };
    
    // Store in Firestore
    const docRef = db.collection(`users/${userId}/${FHIR_COLLECTION_PATH}/${resourceType}`).doc(id);
    await docRef.set(resource);
    
    return NextResponse.json(resource, { status: 201 });
  } catch (error: any) {
    console.error('Error in FHIR POST:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Handle PUT request to update a resource
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { resourceType: string } }
) {
  try {
    // Verify auth token
    const token = request.headers.get('authorization')?.split('Bearer ')[1] || '';
    const userId = await verifyAuthToken(token);
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { resourceType } = params;
    const resource = await request.json();
    
    // Validate resource
    const { valid, errors } = validateResource(resource);
    if (!valid) {
      return NextResponse.json({ error: errors.join(', ') }, { status: 400 });
    }
    
    // Ensure resourceType matches route
    if (resource.resourceType !== resourceType) {
      return NextResponse.json(
        { error: `Resource type mismatch: expected ${resourceType}, got ${resource.resourceType}` },
        { status: 400 }
      );
    }
    
    // Ensure ID is provided
    if (!resource.id) {
      return NextResponse.json(
        { error: 'Resource ID is required for updates' },
        { status: 400 }
      );
    }
    
    // Check if resource exists
    const docRef = db.collection(`users/${userId}/${FHIR_COLLECTION_PATH}/${resourceType}`).doc(resource.id);
    const docSnap = await docRef.get();
    
    if (!docSnap.exists) {
      return NextResponse.json(
        { error: `${resourceType}/${resource.id} not found` },
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
    console.error('Error in FHIR PUT:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Handle DELETE request to delete a resource
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { resourceType: string } }
) {
  try {
    // Verify auth token
    const token = request.headers.get('authorization')?.split('Bearer ')[1] || '';
    const userId = await verifyAuthToken(token);
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { resourceType } = params;
    const searchParams = new URL(request.url).searchParams;
    const id = searchParams.get('_id');
    
    if (!id) {
      return NextResponse.json(
        { error: 'Resource ID is required for deletion' },
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
    
    // Delete from Firestore
    await docRef.delete();
    
    return new NextResponse(null, { status: 204 });
  } catch (error: any) {
    console.error('Error in FHIR DELETE:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
} 