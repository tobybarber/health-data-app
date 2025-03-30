import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../lib/firebase-admin';
import { verifyAuthToken } from '../../../lib/auth-middleware';

// Path for FHIR resources collection
const FHIR_COLLECTION_PATH = 'fhir_resources';

/**
 * POST handler to clean up FHIR resources
 * Supported operations:
 * - delete all lab reports
 * - delete orphaned resources
 * - find orphaned resources
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
    
    // Parse request body
    const body = await request.json();
    const { operation } = body;
    
    if (!operation) {
      return NextResponse.json(
        { error: 'Operation parameter is required' },
        { status: 400 }
      );
    }
    
    // Handle different cleanup operations
    switch (operation) {
      case 'delete_lab_reports':
        return await deleteLabReports(userId);
      
      case 'delete_orphaned':
        return await deleteOrphanedResources(userId);
      
      case 'find_orphaned':
        return await findOrphanedResources(userId);
        
      case 'delete_all_fhir':
        return await deleteAllFHIRResources(userId);
        
      default:
        return NextResponse.json(
          { error: `Unknown operation: ${operation}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error in FHIR cleanup:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Delete all lab reports (Observations and DiagnosticReports)
 */
async function deleteLabReports(userId: string) {
  try {
    // Find all Observation resources
    const observationsQuery = db.collection('users').doc(userId)
      .collection(FHIR_COLLECTION_PATH)
      .where('resourceType', '==', 'Observation');
    
    const observationsSnapshot = await observationsQuery.get();
    
    // Find all DiagnosticReport resources  
    const reportsQuery = db.collection('users').doc(userId)
      .collection(FHIR_COLLECTION_PATH)
      .where('resourceType', '==', 'DiagnosticReport');
    
    const reportsSnapshot = await reportsQuery.get();
    
    let deleted = 0;
    
    // Delete observations
    const observationDeletes = observationsSnapshot.docs.map(async (doc) => {
      await doc.ref.delete();
      return true;
    });
    
    // Delete reports
    const reportDeletes = reportsSnapshot.docs.map(async (doc) => {
      await doc.ref.delete();
      return true;
    });
    
    // Wait for all deletions to complete
    const results = await Promise.all([...observationDeletes, ...reportDeletes]);
    deleted = results.filter(Boolean).length;
    
    // Clear the fhirResourceIds from all records
    await updateRecordsAfterDeletion(userId);
    
    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${deleted} laboratory-related resources.`,
      deletedCount: deleted
    });
  } catch (error) {
    console.error('Error deleting lab reports:', error);
    return NextResponse.json({
      error: `Error deleting lab reports: ${error}`
    }, { status: 500 });
  }
}

/**
 * Find orphaned FHIR resources
 */
async function findOrphanedResources(userId: string) {
  try {
    // Get all FHIR resources
    const fhirResourcesSnapshot = await db.collection('users').doc(userId)
      .collection(FHIR_COLLECTION_PATH)
      .get();
    
    const fhirResources = fhirResourcesSnapshot.docs.map(doc => ({
      id: doc.id,
      type: doc.id.split('_')[0] || 'Unknown',
      resourceType: doc.data().resourceType || 'Unknown'
    }));
    
    // Get all records with their FHIR resource IDs
    const recordsSnapshot = await db.collection('users').doc(userId)
      .collection('records')
      .get();
    
    // Collect all referenced FHIR resource IDs
    const referencedIds = new Set<string>();
    recordsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.fhirResourceIds && Array.isArray(data.fhirResourceIds)) {
        data.fhirResourceIds.forEach((id: string) => referencedIds.add(id));
      }
    });
    
    // Find orphaned resources (those not referenced by any record)
    const orphaned = fhirResources.filter(resource => !referencedIds.has(resource.id));
    
    return NextResponse.json({
      success: true,
      orphanedResources: orphaned,
      count: orphaned.length
    });
  } catch (error) {
    console.error('Error finding orphaned resources:', error);
    return NextResponse.json({
      error: `Error finding orphaned resources: ${error}`
    }, { status: 500 });
  }
}

/**
 * Delete orphaned FHIR resources
 */
async function deleteOrphanedResources(userId: string) {
  try {
    // Get all FHIR resources
    const fhirResourcesSnapshot = await db.collection('users').doc(userId)
      .collection(FHIR_COLLECTION_PATH)
      .get();
    
    const fhirResources = fhirResourcesSnapshot.docs.map(doc => ({
      id: doc.id,
      type: doc.id.split('_')[0] || 'Unknown',
      resourceType: doc.data().resourceType || 'Unknown',
      ref: doc.ref
    }));
    
    // Get all records with their FHIR resource IDs
    const recordsSnapshot = await db.collection('users').doc(userId)
      .collection('records')
      .get();
    
    // Collect all referenced FHIR resource IDs
    const referencedIds = new Set<string>();
    recordsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.fhirResourceIds && Array.isArray(data.fhirResourceIds)) {
        data.fhirResourceIds.forEach((id: string) => referencedIds.add(id));
      }
    });
    
    // Find orphaned resources (those not referenced by any record)
    const orphanedResources = fhirResources.filter(resource => !referencedIds.has(resource.id));
    
    if (orphanedResources.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No orphaned resources found to delete.',
        deletedCount: 0
      });
    }
    
    // Delete each orphaned resource
    let deleted = 0;
    for (const resource of orphanedResources) {
      try {
        await resource.ref.delete();
        deleted++;
      } catch (err) {
        console.error(`Error deleting resource ${resource.id}:`, err);
      }
    }
    
    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${deleted} orphaned FHIR resources.`,
      deletedCount: deleted
    });
  } catch (error) {
    console.error('Error deleting orphaned resources:', error);
    return NextResponse.json({
      error: `Error deleting orphaned resources: ${error}`
    }, { status: 500 });
  }
}

/**
 * Delete all FHIR resources for a user
 */
async function deleteAllFHIRResources(userId: string) {
  try {
    // Get all FHIR resources
    const fhirResourcesSnapshot = await db.collection('users').doc(userId)
      .collection(FHIR_COLLECTION_PATH)
      .get();
    
    let deleted = 0;
    
    // Delete each resource
    for (const doc of fhirResourcesSnapshot.docs) {
      try {
        await doc.ref.delete();
        deleted++;
      } catch (err) {
        console.error(`Error deleting resource ${doc.id}:`, err);
      }
    }
    
    // Clear the fhirResourceIds from all records
    await updateRecordsAfterDeletion(userId);
    
    return NextResponse.json({
      success: true,
      message: `Successfully deleted all ${deleted} FHIR resources.`,
      deletedCount: deleted
    });
  } catch (error) {
    console.error('Error deleting all FHIR resources:', error);
    return NextResponse.json({
      error: `Error deleting all FHIR resources: ${error}`
    }, { status: 500 });
  }
}

/**
 * Update all records to clear fhirResourceIds after deletion
 */
async function updateRecordsAfterDeletion(userId: string) {
  try {
    // Get all records
    const recordsSnapshot = await db.collection('users').doc(userId)
      .collection('records')
      .get();
    
    // Update each record to clear fhirResourceIds
    const updatePromises = recordsSnapshot.docs.map(doc => 
      doc.ref.update({ fhirResourceIds: [] })
    );
    
    await Promise.all(updatePromises);
    
    return true;
  } catch (error) {
    console.error('Error updating records after deletion:', error);
    return false;
  }
} 