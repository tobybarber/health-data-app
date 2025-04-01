/**
 * FHIR Data Migration Script
 * 
 * This script migrates data from the patients/{patientId}/{resourceType} structure
 * to the simplified users/{userId}/fhir_resources structure.
 * 
 * Usage: node scripts/migrate-fhir-data.js
 */

const admin = require('firebase-admin');
const serviceAccount = require('../service-account.json'); // Adjust path as needed

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Resource types to migrate
const RESOURCE_TYPES = [
  'Observation',
  'DiagnosticReport',
  'Condition',
  'MedicationStatement',
  'AllergyIntolerance',
  'Immunization',
  'Procedure'
];

async function migrateData() {
  console.log('Starting FHIR data migration...');
  
  try {
    // Get all patients
    const patientsSnapshot = await db.collection('patients').get();
    
    if (patientsSnapshot.empty) {
      console.log('No patients found. Nothing to migrate.');
      return;
    }
    
    console.log(`Found ${patientsSnapshot.size} patients to process.`);
    
    // Process each patient
    for (const patientDoc of patientsSnapshot.docs) {
      const patientId = patientDoc.id;
      console.log(`Processing patient: ${patientId}`);
      
      // For each resource type, migrate data
      for (const resourceType of RESOURCE_TYPES) {
        console.log(`  Migrating ${resourceType} resources...`);
        
        const resourceSnapshot = await db.collection('patients')
          .doc(patientId)
          .collection(resourceType)
          .get();
        
        if (resourceSnapshot.empty) {
          console.log(`  No ${resourceType} resources found for this patient.`);
          continue;
        }
        
        console.log(`  Found ${resourceSnapshot.size} ${resourceType} resources.`);
        
        // Migrate each resource
        const batch = db.batch();
        let batchCount = 0;
        
        for (const resourceDoc of resourceSnapshot.docs) {
          const resourceData = resourceDoc.data();
          const resourceId = resourceData.id || resourceDoc.id;
          
          // Create a reference to the new location
          const newDocRef = db.collection('users')
            .doc(patientId) // Using patientId as userId for migration
            .collection('fhir_resources')
            .doc(`${resourceType}_${resourceId}`);
          
          // Add to batch
          batch.set(newDocRef, resourceData);
          batchCount++;
          
          // Commit when batch reaches 500 operations (Firestore limit)
          if (batchCount >= 500) {
            await batch.commit();
            console.log(`  Committed batch of ${batchCount} resources.`);
            batchCount = 0;
          }
        }
        
        // Commit any remaining operations
        if (batchCount > 0) {
          await batch.commit();
          console.log(`  Committed batch of ${batchCount} resources.`);
        }
        
        console.log(`  Completed migration of ${resourceType} resources.`);
      }
      
      console.log(`Completed processing for patient: ${patientId}`);
    }
    
    console.log('Migration completed successfully.');
    console.log('NOTE: The original data in the patients collection has not been deleted.');
    console.log('After verifying the migration, you can delete it manually if desired.');
    
  } catch (error) {
    console.error('Error during migration:', error);
    process.exit(1);
  }
}

// Run the migration
migrateData().then(() => {
  console.log('Migration script completed.');
  process.exit(0);
}).catch(err => {
  console.error('Unhandled error in migration script:', err);
  process.exit(1);
}); 