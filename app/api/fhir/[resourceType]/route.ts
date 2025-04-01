import db from '../../../lib/firebaseAdmin';
import { NextResponse, NextRequest } from 'next/server';
import { Query, DocumentData } from 'firebase-admin/firestore';

// Base path for FHIR resources in Firestore
const FHIR_COLLECTION_PATH = 'fhir_resources';

/**
 * Validate a FHIR resource
 */
function validateResource(resource: any, resourceType: string) {
  // Ensure it has the right resourceType
  if (resource.resourceType !== resourceType) {
    throw new Error(`Resource type mismatch: expected ${resourceType}, got ${resource.resourceType}`);
  }
  
  // Ensure it has an ID
  if (!resource.id) {
    throw new Error('Resource must have an ID');
  }
  
  return true;
}

export async function GET(
  request: NextRequest, 
  { params }: { params: { resourceType: string } }
) {
  try {
    // Get the resource type from the URL
    const { resourceType } = params;
    
    // Get user ID from session or query parameter (simplified for demo)
    const userId = request.nextUrl.searchParams.get('userId');
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }
    
    // Get the resource ID from the query parameters
    const id = request.nextUrl.searchParams.get('id');
    
    // If ID provided, get a single resource
    if (id) {
      // Create document reference with the standardized format
      const docRef = db.collection('users').doc(userId)
        .collection(FHIR_COLLECTION_PATH)
        .doc(`${resourceType}_${id}`);
      
      const doc = await docRef.get();
      
      if (!doc.exists) {
        return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
      }
      
      return NextResponse.json(doc.data());
    }
    
    // Otherwise, search for resources matching query parameters
    // Reference the resources collection
    let queryRef: Query<DocumentData> = db.collection('users').doc(userId)
      .collection(FHIR_COLLECTION_PATH);
    
    // Filter by resource type (using a where clause since we now use a flat collection)
    queryRef = queryRef.where('resourceType', '==', resourceType);
    
    // Process search parameters (excluding FHIR-specific parameters)
    const searchParams = request.nextUrl.searchParams;
    searchParams.forEach((value, key) => {
      // Skip special parameters
      if (['_count', '_sort', '_format', '_include', '_revinclude', '_id', 'userId'].includes(key)) {
        return;
      }
      
      // Handle the parameter
      if (key.includes('.')) {
        // Handle nested parameters (like subject.reference)
        const [parent, child] = key.split('.');
        queryRef = queryRef.where(`${parent}.${child}`, '==', value);
      } else {
        // Handle simple parameters
        queryRef = queryRef.where(key, '==', value);
      }
    });
    
    // Check for _count parameter to limit results
    const limit = searchParams.get('_count');
    if (limit) {
      queryRef = queryRef.limit(parseInt(limit, 10));
    }
    
    // Check for _sort parameter to order results
    const sort = searchParams.get('_sort');
    if (sort) {
      // Determine sort direction
      const desc = sort.startsWith('-');
      const field = desc ? sort.substring(1) : sort;
      
      queryRef = queryRef.orderBy(field, desc ? 'desc' : 'asc');
    }
    
    // Execute the query
    const querySnapshot = await queryRef.get();
    
    // Prepare the response
    const resources = querySnapshot.docs.map(doc => doc.data());
    
    // Create a FHIR Bundle response
    const bundle = {
      resourceType: 'Bundle',
      type: 'searchset',
      total: resources.length,
      entry: resources.map(resource => ({
        resource,
        fullUrl: `${request.nextUrl.origin}/api/fhir/${resourceType}/${resource.id}`
      }))
    };
    
    return NextResponse.json(bundle);
  } catch (error) {
    console.error('Error in FHIR GET:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest, 
  { params }: { params: { resourceType: string } }
) {
  try {
    // Get the resource type from the URL
    const { resourceType } = params;
    
    // Get user ID from session or query parameter (simplified for demo)
    const userId = request.nextUrl.searchParams.get('userId');
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }
    
    // Parse the request body
    const resource = await request.json();
    
    // Validate the resource
    if (!resource || !resource.resourceType) {
      return NextResponse.json({ error: 'Invalid resource' }, { status: 400 });
    }
    
    // Ensure resourceType matches
    if (resource.resourceType !== resourceType) {
      return NextResponse.json({ error: `Resource type mismatch: expected ${resourceType}, got ${resource.resourceType}` }, { status: 400 });
    }
    
    // Generate an ID if not provided
    if (!resource.id) {
      resource.id = Date.now().toString();
    }
    
    // Create a document reference with the standardized format
    const docRef = db.collection('users').doc(userId)
      .collection(FHIR_COLLECTION_PATH)
      .doc(`${resourceType}_${resource.id}`);
    
    // Save the resource
    await docRef.set(resource);
    
    // Return the created resource
    return NextResponse.json(resource, { status: 201 });
  } catch (error) {
    console.error('Error in FHIR POST:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest, 
  { params }: { params: { resourceType: string } }
) {
  try {
    // Get the resource type from the URL
    const { resourceType } = params;
    
    // Get user ID from session or query parameter (simplified for demo)
    const userId = request.nextUrl.searchParams.get('userId');
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }
    
    // Parse the request body
    const resource = await request.json();
    
    // Validate the resource
    if (!resource || !resource.resourceType || !resource.id) {
      return NextResponse.json({ error: 'Invalid resource' }, { status: 400 });
    }
    
    // Ensure resourceType matches
    if (resource.resourceType !== resourceType) {
      return NextResponse.json({ error: `Resource type mismatch: expected ${resourceType}, got ${resource.resourceType}` }, { status: 400 });
    }
    
    // Create a document reference with the standardized format
    const docRef = db.collection('users').doc(userId)
      .collection(FHIR_COLLECTION_PATH)
      .doc(`${resourceType}_${resource.id}`);
    
    // Check if the resource exists
    const doc = await docRef.get();
    
    if (!doc.exists) {
      return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
    }
    
    // Update the resource
    await docRef.set(resource);
    
    // Return the updated resource
    return NextResponse.json(resource);
  } catch (error) {
    console.error('Error in FHIR PUT:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest, 
  { params }: { params: { resourceType: string } }
) {
  try {
    // Get the resource type from the URL
    const { resourceType } = params;
    
    // Get user ID from session or query parameter (simplified for demo)
    const userId = request.nextUrl.searchParams.get('userId');
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }
    
    // Get the resource ID from the query parameters
    const id = request.nextUrl.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Resource ID is required' }, { status: 400 });
    }
    
    // Create a document reference with the standardized format
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
    
    // Return a success response
    return NextResponse.json({ message: 'Resource deleted' });
  } catch (error) {
    console.error('Error in FHIR DELETE:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
} 