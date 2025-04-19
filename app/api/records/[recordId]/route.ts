import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../lib/firebase-admin';
import { verifyAuthToken } from '../../../lib/auth-middleware';

/**
 * GET handler for fetching a specific record
 * This endpoint ensures users can only access their own records
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { recordId: string } }
) {
  try {
    const recordId = params.recordId;
    
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
    
    // Fetch the record for the authenticated user
    const recordDoc = await db.collection('users').doc(userId).collection('records').doc(recordId).get();
    
    if (!recordDoc.exists) {
      return NextResponse.json(
        { error: 'Record not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      id: recordDoc.id,
      ...recordDoc.data()
    });
  } catch (error) {
    // Only log errors in development mode
    if (process.env.NODE_ENV === 'development') {
      console.error('Error fetching record:', error);
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT handler for updating a specific record
 * This endpoint ensures users can only update their own records
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { recordId: string } }
) {
  try {
    const recordId = params.recordId;
    
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
    
    // Parse the request body
    const updateData = await request.json();
    
    // Check if the record exists and belongs to the user
    const recordRef = db.collection('users').doc(userId).collection('records').doc(recordId);
    const recordDoc = await recordRef.get();
    
    if (!recordDoc.exists) {
      return NextResponse.json(
        { error: 'Record not found' },
        { status: 404 }
      );
    }
    
    // Update the record
    await recordRef.update({
      ...updateData,
      updatedAt: new Date()
    });
    
    console.log(`✅ Record ${recordId} updated for user ${userId}`);
    console.log(`Updated fields: ${Object.keys(updateData).join(', ')}`);
    
    return NextResponse.json({ 
      success: true,
      recordId
    });
  } catch (error) {
    // Only log errors in development mode
    if (process.env.NODE_ENV === 'development') {
      console.error('Error updating record:', error);
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE handler for deleting a specific record
 * This endpoint ensures users can only delete their own records
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { recordId: string } }
) {
  try {
    const recordId = params.recordId;
    
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
    
    // Check if the record exists and belongs to the user
    const recordRef = db.collection('users').doc(userId).collection('records').doc(recordId);
    const recordDoc = await recordRef.get();
    
    if (!recordDoc.exists) {
      return NextResponse.json(
        { error: 'Record not found' },
        { status: 404 }
      );
    }
    
    const recordData = recordDoc.data();
    
    // Delete any associated FHIR resources
    if (recordData?.fhirResourceIds && Array.isArray(recordData.fhirResourceIds)) {
      console.log(`Server-side: Deleting ${recordData.fhirResourceIds.length} FHIR resources for record ${recordId}`);
      
      for (const resourceId of recordData.fhirResourceIds) {
        try {
          // Parse the resource ID to get type and ID
          const [resourceType, id] = resourceId.split('_');
          
          if (resourceType && id) {
            // Delete the FHIR resource
            await db.collection('users').doc(userId)
              .collection('fhir_resources')
              .doc(resourceId)
              .delete();
              
            console.log(`Server-side: Deleted FHIR resource ${resourceId}`);
          }
        } catch (fhirError) {
          console.error(`Server-side: Error deleting FHIR resource ${resourceId}:`, fhirError);
          // Continue with other resources even if one fails
        }
      }
    }
    
    // Delete the record
    await recordRef.delete();
    
    return NextResponse.json({ 
      success: true,
      message: 'Record deleted successfully'
    });
  } catch (error) {
    // Only log errors in development mode
    if (process.env.NODE_ENV === 'development') {
      console.error('Error deleting record:', error);
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 