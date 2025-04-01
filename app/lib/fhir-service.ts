'use client';

import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  addDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit as fbLimit,
  serverTimestamp,
  QueryConstraint,
  DocumentData
} from 'firebase/firestore';
import { db } from './firebase';
import { 
  Resource, 
  Patient, 
  Observation, 
  DiagnosticReport, 
  Bundle, 
  BundleEntry, 
  FHIRSearchParams,
  Medication,
  MedicationStatement,
  Condition,
  AllergyIntolerance,
  Immunization,
  DocumentReference,
  Procedure,
  FamilyMemberHistory,
  ImagingStudy,
  DiagnosticReportImaging
} from '../types/fhir';

// Safely execute code in browser context only
const isBrowser = typeof window !== 'undefined';

// Base path for FHIR resources in Firestore - updated for proper collection/document alternation
const FHIR_COLLECTION_NAME = 'fhir_resources';

/**
 * Create a valid FHIR resource ID
 */
function generateResourceId(): string {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}

/**
 * Create a FHIR resource reference
 */
export function createReference(resourceType: string, id: string): string {
  return `${resourceType}/${id}`;
}

/**
 * Extract resource type and ID from a reference
 */
export function parseReference(reference: string): { resourceType: string, id: string } | null {
  const parts = reference.split('/');
  if (parts.length !== 2) return null;
  
  return {
    resourceType: parts[0],
    id: parts[1]
  };
}

/**
 * Get a FHIR resource by its type and ID
 */
export async function getResource<T extends Resource>(
  userId: string, 
  resourceType: string, 
  id: string
): Promise<T | null> {
  if (!isBrowser) return null;
  
  try {
    const docRef = doc(db, 'users', userId, FHIR_COLLECTION_NAME, `${resourceType}_${id}`);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      return data as T;
    }
    
    return null;
  } catch (error) {
    console.error(`Error fetching ${resourceType}/${id}:`, error);
    throw error;
  }
}

/**
 * Create a new FHIR resource
 */
export async function createResource<T extends Resource>(
  userId: string, 
  resource: T
): Promise<string> {
  if (!isBrowser) return '';
  
  try {
    // Generate ID if not provided
    const resourceId = resource.id || generateResourceId();
    resource.id = resourceId;
    
    // Add metadata
    resource.meta = {
      ...(resource.meta || {}),
      lastUpdated: new Date().toISOString(),
    };
    
    // Proper path structure with even number of segments for document reference
    const docRef = doc(db, 'users', userId, FHIR_COLLECTION_NAME, `${resource.resourceType}_${resourceId}`);
    await setDoc(docRef, resource);
    
    return resourceId;
  } catch (error) {
    console.error(`Error creating ${resource.resourceType}:`, error);
    throw error;
  }
}

/**
 * Update an existing FHIR resource
 */
export async function updateResource<T extends Resource>(
  userId: string, 
  resource: T
): Promise<void> {
  if (!isBrowser) return;
  
  try {
    if (!resource.id) {
      throw new Error('Resource ID is required for updates');
    }
    
    // Update metadata
    resource.meta = {
      ...(resource.meta || {}),
      lastUpdated: new Date().toISOString(),
      versionId: resource.meta?.versionId 
        ? `${parseInt(resource.meta.versionId) + 1}` 
        : '1'
    };
    
    // Proper path structure with even number of segments for document reference
    const docRef = doc(db, 'users', userId, FHIR_COLLECTION_NAME, `${resource.resourceType}_${resource.id}`);
    await setDoc(docRef, resource);
  } catch (error) {
    console.error(`Error updating ${resource.resourceType}/${resource.id}:`, error);
    throw error;
  }
}

/**
 * Delete a FHIR resource
 */
export async function deleteResource(
  userId: string, 
  resourceType: string, 
  id: string
): Promise<void> {
  if (!isBrowser) return;
  
  try {
    const docRef = doc(db, 'users', userId, FHIR_COLLECTION_NAME, `${resourceType}_${id}`);
    await deleteDoc(docRef);
  } catch (error) {
    console.error(`Error deleting ${resourceType}/${id}:`, error);
    throw error;
  }
}

/**
 * Search for FHIR resources
 */
export async function searchResources<T extends Resource>(
  userId: string,
  resourceType: string,
  params: FHIRSearchParams,
  limit = 100
): Promise<Bundle> {
  if (!isBrowser) return { resourceType: 'Bundle', type: 'searchset', total: 0, entry: [] };
  
  try {
    const constraints: QueryConstraint[] = [];
    
    // Process search parameters
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        if (key === '_sort') continue; // Handle sorting separately
        if (key === '_count') continue; // Handle limit separately
        
        // Special handling for date ranges
        if (typeof value === 'string' && (
            value.startsWith('gt') || value.startsWith('lt') || 
            value.startsWith('ge') || value.startsWith('le') || 
            value.startsWith('eq'))) {
          const operator = value.substring(0, 2);
          const dateValue = value.substring(2);
          
          switch (operator) {
            case 'gt': constraints.push(where(key, '>', dateValue)); break;
            case 'lt': constraints.push(where(key, '<', dateValue)); break;
            case 'ge': constraints.push(where(key, '>=', dateValue)); break;
            case 'le': constraints.push(where(key, '<=', dateValue)); break;
            case 'eq': constraints.push(where(key, '==', dateValue)); break;
          }
        } else {
          // For deeply nested fields, Firestore might need exact paths
          console.log(`Adding constraint: ${key} == ${value}`);
          constraints.push(where(key, '==', value));
        }
      }
    }
    
    // Handle sorting
    if (params._sort) {
      const sortFields = params._sort.split(',');
      for (const field of sortFields) {
        const isDescending = field.startsWith('-');
        const sortField = isDescending ? field.substring(1) : field;
        constraints.push(orderBy(sortField, isDescending ? 'desc' : 'asc'));
      }
    }
    
    // Handle limit
    const resultLimit = params._count ? parseInt(params._count) : limit;
    constraints.push(fbLimit(resultLimit));
    
    // For queries, we need to filter by resourceType
    const collectionRef = collection(db, 'users', userId, FHIR_COLLECTION_NAME);
    
    // Add a constraint for the resource type
    constraints.unshift(where('resourceType', '==', resourceType));
    
    const q = query(collectionRef, ...constraints);
    const querySnapshot = await getDocs(q);
    
    // Convert to Bundle
    const entries: BundleEntry[] = [];
    querySnapshot.forEach((doc) => {
      const resource = doc.data() as T;
      entries.push({
        resource,
        fullUrl: `${resource.resourceType}/${resource.id}` 
      });
    });
    
    return {
      resourceType: 'Bundle',
      type: 'searchset',
      total: entries.length,
      entry: entries
    };
  } catch (error) {
    console.error(`Error searching ${resourceType}:`, error);
    throw error;
  }
}

/**
 * Get all patient resources for a user
 */
export async function getPatients(userId: string): Promise<Patient[]> {
  if (!isBrowser) return [];
  
  try {
    const bundle = await searchResources<Patient>(userId, 'Patient', {});
    return (bundle.entry || [])
      .map(entry => entry.resource as Patient)
      .filter(Boolean);
  } catch (error) {
    console.error('Error fetching patients:', error);
    throw error;
  }
}

/**
 * Get all observations for a patient
 */
export async function getPatientObservations(
  userId: string, 
  patientId: string, 
  code?: string
): Promise<Observation[]> {
  if (!isBrowser) return [];
  
  try {
    console.log(`Getting observations for patient ${patientId}${code ? ` with code ${code}` : ''}`);
    
    // First get all Observation documents - we're working with a flat structure now
    const collectionRef = collection(db, 'users', userId, FHIR_COLLECTION_NAME);
    
    // Query for all documents that start with Observation_ prefix
    // Then we'll filter locally for the specific reference and code
    const q = query(
      collectionRef, 
      where('resourceType', '==', 'Observation')
    );
    
    const querySnapshot = await getDocs(q);
    console.log(`Found ${querySnapshot.size} total observations`);
    
    // Convert to Observation array
    const observations: Observation[] = [];
    querySnapshot.forEach(doc => {
      const data = doc.data();
      if (data.resourceType === 'Observation') {
        observations.push(data as Observation);
      }
    });
    
    // Filter by patient reference
    let filtered = observations.filter(
      obs => obs.subject?.reference === `Patient/${patientId}`
    );
    console.log(`After filtering by patient: ${filtered.length} observations`);
    
    // Filter by code if provided
    if (code) {
      filtered = filtered.filter(obs => {
        if (!obs.code.coding) return false;
        return obs.code.coding.some(coding => coding.code === code);
      });
      console.log(`After filtering by code ${code}: ${filtered.length} observations`);
    }
    
    return filtered;
  } catch (error) {
    console.error(`Error fetching observations for patient ${patientId}:`, error);
    throw error;
  }
}

/**
 * Get an observation timeline for a specific code
 */
export async function getObservationTimeline(
  userId: string,
  patientId: string,
  code: string
): Promise<Array<{ date: string, value: number, unit: string }>> {
  if (!isBrowser) return [];
  
  try {
    const observations = await getPatientObservations(userId, patientId, code);
    
    return observations
      .filter(obs => 
        obs.valueQuantity?.value !== undefined && 
        obs.effectiveDateTime
      )
      .sort((a, b) => {
        const dateA = a.effectiveDateTime || '';
        const dateB = b.effectiveDateTime || '';
        return dateA.localeCompare(dateB);
      })
      .map(obs => ({
        date: obs.effectiveDateTime || '',
        value: obs.valueQuantity?.value || 0,
        unit: obs.valueQuantity?.unit || ''
      }));
  } catch (error) {
    console.error(`Error fetching observation timeline for patient ${patientId} and code ${code}:`, error);
    throw error;
  }
}

/**
 * Create a patient resource
 */
export async function createPatient(userId: string, patientData: Partial<Patient>): Promise<string> {
  if (!isBrowser) return '';
  
  const patient: Patient = {
    resourceType: 'Patient',
    ...patientData
  };
  
  return createResource(userId, patient);
}

/**
 * Create an observation resource
 */
export async function createObservation(
  userId: string, 
  observationData: Partial<Observation>, 
  patientId: string
): Promise<string> {
  if (!isBrowser) return '';
  
  const observation: Observation = {
    resourceType: 'Observation',
    status: 'final',
    code: observationData.code || {
      coding: [{
        system: 'http://loinc.org',
        code: 'unknown',
        display: 'Unknown Observation'
      }],
      text: 'Unknown Observation'
    },
    subject: {
      reference: `Patient/${patientId}`
    },
    ...observationData
  };
  
  return createResource(userId, observation);
}

/**
 * Create a diagnostic report resource
 */
export async function createDiagnosticReport(
  userId: string,
  reportData: Partial<DiagnosticReport>,
  patientId: string,
  observationIds: string[] = []
): Promise<string> {
  if (!isBrowser) return '';
  
  const report: DiagnosticReport = {
    resourceType: 'DiagnosticReport',
    status: 'final',
    code: reportData.code || {
      coding: [{
        system: 'http://loinc.org',
        code: 'unknown',
        display: 'Unknown Report'
      }],
      text: 'Unknown Report'
    },
    subject: {
      reference: `Patient/${patientId}`
    },
    result: observationIds.map(id => ({
      reference: `Observation/${id}`
    })),
    ...reportData
  };
  
  return createResource(userId, report);
}

/**
 * Create a medication resource
 */
export async function createMedication(
  userId: string,
  medicationData: Partial<Medication>
): Promise<string> {
  if (!isBrowser) return '';
  
  const medication: Medication = {
    resourceType: 'Medication',
    status: 'active',
    ...medicationData
  };
  
  return createResource(userId, medication);
}

/**
 * Create a medication statement resource
 */
export async function createMedicationStatement(
  userId: string,
  medicationStatementData: Partial<MedicationStatement>,
  patientId: string,
  medicationId?: string
): Promise<string> {
  if (!isBrowser) return '';
  
  const medicationStatement: MedicationStatement = {
    resourceType: 'MedicationStatement',
    status: 'active',
    subject: {
      reference: `Patient/${patientId}`
    },
    ...medicationStatementData
  };
  
  // If a medication reference is provided, add it
  if (medicationId) {
    medicationStatement.medicationReference = {
      reference: `Medication/${medicationId}`
    };
  }
  
  return createResource(userId, medicationStatement);
}

/**
 * Create a condition resource
 */
export async function createCondition(
  userId: string,
  conditionData: Partial<Condition>,
  patientId: string
): Promise<string> {
  if (!isBrowser) return '';
  
  const condition: Condition = {
    resourceType: 'Condition',
    subject: {
      reference: `Patient/${patientId}`
    },
    recordedDate: new Date().toISOString(),
    ...conditionData
  };
  
  return createResource(userId, condition);
}

/**
 * Create an allergy intolerance resource
 */
export async function createAllergyIntolerance(
  userId: string,
  allergyData: Partial<AllergyIntolerance>,
  patientId: string
): Promise<string> {
  if (!isBrowser) return '';
  
  const allergy: AllergyIntolerance = {
    resourceType: 'AllergyIntolerance',
    patient: {
      reference: `Patient/${patientId}`
    },
    recordedDate: new Date().toISOString(),
    ...allergyData
  };
  
  return createResource(userId, allergy);
}

/**
 * Create an immunization resource
 */
export async function createImmunization(
  userId: string,
  immunizationData: Partial<Immunization>,
  patientId: string
): Promise<string> {
  if (!isBrowser) return '';
  
  const immunization: Immunization = {
    resourceType: 'Immunization',
    status: 'completed',
    patient: {
      reference: `Patient/${patientId}`
    },
    vaccineCode: immunizationData.vaccineCode || {
      coding: [{
        system: 'http://hl7.org/fhir/sid/cvx',
        code: 'unknown',
        display: 'Unknown Vaccine'
      }],
      text: 'Unknown Vaccine'
    },
    ...immunizationData
  };
  
  return createResource(userId, immunization);
}

/**
 * Create a document reference resource
 */
export async function createDocumentReference(
  userId: string,
  documentData: Partial<DocumentReference>,
  patientId: string,
  contentUrl: string,
  contentType: string
): Promise<string> {
  if (!isBrowser) return '';
  
  // Create attachment from the provided URL and content type
  const attachment = {
    contentType: contentType || 'application/pdf',
    url: contentUrl,
    creation: new Date().toISOString()
  };
  
  const documentReference: DocumentReference = {
    resourceType: 'DocumentReference',
    status: 'current',
    content: [
      {
        attachment
      }
    ],
    subject: {
      reference: `Patient/${patientId}`
    },
    date: new Date().toISOString(),
    ...documentData
  };
  
  return createResource(userId, documentReference);
}

/**
 * Create a procedure resource
 */
export async function createProcedure(
  userId: string,
  procedureData: Partial<Procedure>,
  patientId: string
): Promise<string> {
  if (!isBrowser) return '';
  
  const procedure: Procedure = {
    resourceType: 'Procedure',
    status: 'completed',
    subject: {
      reference: `Patient/${patientId}`
    },
    performedDateTime: new Date().toISOString(),
    ...procedureData
  };
  
  return createResource(userId, procedure);
}

/**
 * Create a family member history resource
 */
export async function createFamilyMemberHistory(
  userId: string,
  familyHistoryData: Partial<FamilyMemberHistory>,
  patientId: string
): Promise<string> {
  if (!isBrowser) return '';
  
  // Ensure required fields are present
  if (!familyHistoryData.relationship) {
    throw new Error('Relationship is required for family member history');
  }
  
  const familyHistory: FamilyMemberHistory = {
    resourceType: 'FamilyMemberHistory',
    status: 'completed',
    patient: {
      reference: `Patient/${patientId}`
    },
    relationship: familyHistoryData.relationship,
    date: new Date().toISOString(),
    ...familyHistoryData
  };
  
  return createResource(userId, familyHistory);
}

/**
 * Create an imaging study resource
 */
export async function createImagingStudy(
  userId: string,
  imagingStudyData: Partial<ImagingStudy>,
  patientId: string
): Promise<string> {
  if (!isBrowser) return '';
  
  // Generate a unique UID for the study if not provided
  const studyUid = imagingStudyData.identifier?.find(i => i.system === 'urn:dicom:uid')?.value || 
                  `2.25.${Math.floor(Math.random() * 100000000000000)}`;
  
  const imagingStudy: ImagingStudy = {
    resourceType: 'ImagingStudy',
    status: 'available',
    subject: {
      reference: `Patient/${patientId}`
    },
    started: new Date().toISOString(),
    identifier: [
      {
        system: 'urn:dicom:uid',
        value: studyUid
      }
    ],
    ...imagingStudyData
  };
  
  return createResource(userId, imagingStudy);
}

/**
 * Create a diagnostic report for imaging
 */
export async function createDiagnosticReportImaging(
  userId: string,
  reportData: Partial<DiagnosticReportImaging>,
  patientId: string,
  imagingStudyId?: string,
  observationIds: string[] = []
): Promise<string> {
  if (!isBrowser) return '';
  
  const report: DiagnosticReportImaging = {
    resourceType: 'DiagnosticReport',
    status: 'final',
    category: [
      {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/v2-0074',
          code: 'RAD',
          display: 'Radiology'
        }],
        text: 'Radiology'
      }
    ],
    code: reportData.code || {
      coding: [{
        system: 'http://loinc.org',
        code: '18748-4',
        display: 'Diagnostic imaging report'
      }],
      text: 'Imaging Report'
    },
    subject: {
      reference: `Patient/${patientId}`
    },
    result: observationIds.map(id => ({
      reference: `Observation/${id}`
    })),
    ...reportData
  };
  
  // Add imaging study reference if provided
  if (imagingStudyId) {
    report.imagingStudy = [
      {
        reference: `ImagingStudy/${imagingStudyId}`
      }
    ];
  }
  
  return createResource(userId, report);
}

/**
 * Get family member history for a patient
 */
export async function getFamilyMemberHistoryForPatient(
  userId: string,
  patientId: string
): Promise<FamilyMemberHistory[]> {
  if (!isBrowser) return [];
  
  try {
    // Query for all family member history resources for this patient
    const queryRef = collection(db, 'users', userId, FHIR_COLLECTION_NAME);
    const q = query(
      queryRef,
      where('resourceType', '==', 'FamilyMemberHistory'),
      where('patient.reference', '==', `Patient/${patientId}`)
    );
    
    const querySnapshot = await getDocs(q);
    const familyHistories: FamilyMemberHistory[] = [];
    
    querySnapshot.forEach(doc => {
      familyHistories.push(doc.data() as FamilyMemberHistory);
    });
    
    return familyHistories;
  } catch (error) {
    console.error('Error fetching family member history:', error);
    throw error;
  }
}

/**
 * Get procedures for a patient
 */
export async function getProceduresForPatient(
  userId: string,
  patientId: string
): Promise<Procedure[]> {
  if (!isBrowser) return [];
  
  try {
    // Query for all procedure resources for this patient
    const queryRef = collection(db, 'users', userId, FHIR_COLLECTION_NAME);
    const q = query(
      queryRef,
      where('resourceType', '==', 'Procedure'),
      where('subject.reference', '==', `Patient/${patientId}`)
    );
    
    const querySnapshot = await getDocs(q);
    const procedures: Procedure[] = [];
    
    querySnapshot.forEach(doc => {
      procedures.push(doc.data() as Procedure);
    });
    
    return procedures;
  } catch (error) {
    console.error('Error fetching procedures:', error);
    throw error;
  }
}

/**
 * Get imaging studies for a patient
 */
export async function getImagingStudiesForPatient(
  userId: string,
  patientId: string
): Promise<ImagingStudy[]> {
  if (!isBrowser) return [];
  
  try {
    // Query for all imaging study resources for this patient
    const queryRef = collection(db, 'users', userId, FHIR_COLLECTION_NAME);
    const q = query(
      queryRef,
      where('resourceType', '==', 'ImagingStudy'),
      where('subject.reference', '==', `Patient/${patientId}`)
    );
    
    const querySnapshot = await getDocs(q);
    const imagingStudies: ImagingStudy[] = [];
    
    querySnapshot.forEach(doc => {
      imagingStudies.push(doc.data() as ImagingStudy);
    });
    
    return imagingStudies;
  } catch (error) {
    console.error('Error fetching imaging studies:', error);
    throw error;
  }
}

/**
 * Get document references for a patient
 */
export async function getDocumentReferencesForPatient(
  userId: string,
  patientId: string
): Promise<DocumentReference[]> {
  if (!isBrowser) return [];
  
  try {
    // Query for all document reference resources for this patient
    const queryRef = collection(db, 'users', userId, FHIR_COLLECTION_NAME);
    const q = query(
      queryRef,
      where('resourceType', '==', 'DocumentReference'),
      where('subject.reference', '==', `Patient/${patientId}`)
    );
    
    const querySnapshot = await getDocs(q);
    const documentReferences: DocumentReference[] = [];
    
    querySnapshot.forEach(doc => {
      documentReferences.push(doc.data() as DocumentReference);
    });
    
    return documentReferences;
  } catch (error) {
    console.error('Error fetching document references:', error);
    throw error;
  }
}

/**
 * Get diagnostic reports for a patient
 * Optionally filter by category
 */
export async function getDiagnosticReportsForPatient(
  userId: string,
  patientId: string,
  filters: { category?: string } = {}
): Promise<DiagnosticReport[]> {
  if (!isBrowser) return [];
  
  try {
    const constraints: QueryConstraint[] = [
      where('resourceType', '==', 'DiagnosticReport'),
      where('subject.reference', '==', `Patient/${patientId}`)
    ];
    
    // Add category filter if provided
    if (filters.category) {
      constraints.push(where('category.0.coding.0.code', '==', filters.category));
    }
    
    const q = query(
      collection(db, 'users', userId, FHIR_COLLECTION_NAME),
      ...constraints
    );
    
    const querySnapshot = await getDocs(q);
    const reports: DiagnosticReport[] = [];
    
    querySnapshot.forEach((doc) => {
      reports.push(doc.data() as DiagnosticReport);
    });
    
    return reports;
  } catch (error) {
    console.error(`Error fetching diagnostic reports for patient ${patientId}:`, error);
    throw error;
  }
}

/**
 * Get observations for a patient
 * Optionally filter by category
 */
export async function getObservationsForPatient(
  userId: string,
  patientId: string,
  filters: { category?: string } = {}
): Promise<Observation[]> {
  if (!isBrowser) return [];
  
  try {
    const constraints: QueryConstraint[] = [
      where('resourceType', '==', 'Observation'),
      where('subject.reference', '==', `Patient/${patientId}`)
    ];
    
    // Add category filter if provided
    if (filters.category) {
      constraints.push(where('category.0.coding.0.code', '==', filters.category));
    }
    
    const q = query(
      collection(db, 'users', userId, FHIR_COLLECTION_NAME),
      ...constraints,
      orderBy('effectiveDateTime', 'desc')
    );
    
    const querySnapshot = await getDocs(q);
    const observations: Observation[] = [];
    
    querySnapshot.forEach((doc) => {
      observations.push(doc.data() as Observation);
    });
    
    return observations;
  } catch (error) {
    console.error(`Error fetching observations for patient ${patientId}:`, error);
    throw error;
  }
}

/**
 * Get all resources of a specific type for a user
 */
export async function getResourcesByType<T extends Resource>(
  userId: string,
  resourceType: string,
  limit = 1000
): Promise<T[]> {
  if (!isBrowser) return [];
  
  try {
    const collectionRef = collection(db, 'users', userId, FHIR_COLLECTION_NAME);
    const q = query(
      collectionRef,
      where('resourceType', '==', resourceType),
      fbLimit(limit)
    );
    
    const querySnapshot = await getDocs(q);
    const resources: T[] = [];
    
    querySnapshot.forEach(doc => {
      resources.push(doc.data() as T);
    });
    
    return resources;
  } catch (error) {
    console.error(`Error fetching resources of type ${resourceType}:`, error);
    return [];
  }
}

/**
 * Get recent observations for specific biomarkers by LOINC codes
 */
export async function getRecentObservationsForBiomarkers(
  userId: string,
  patientId: string,
  loincCodes: string[]
): Promise<Observation[]> {
  if (!isBrowser) return [];
  
  try {
    console.log(`Getting recent observations for biomarkers - User: ${userId}, Patient: ${patientId}`);
    console.log(`Looking for LOINC codes:`, loincCodes);
    
    // Get all observations for the patient
    const observations = await getPatientObservations(userId, patientId);
    console.log(`Retrieved ${observations.length} total observations for the patient`);
    
    // Filter observations by LOINC codes and organize by code
    const biomarkerObservations: Record<string, Observation[]> = {};
    
    for (const obs of observations) {
      // Find if observation has any matching LOINC code
      const matchingCode = obs.code?.coding?.find(c => 
        c.system === 'http://loinc.org' && loincCodes.includes(c.code || '')
      );
      
      if (matchingCode?.code) {
        if (!biomarkerObservations[matchingCode.code]) {
          biomarkerObservations[matchingCode.code] = [];
        }
        biomarkerObservations[matchingCode.code].push(obs);
      }
    }
    
    console.log(`Found biomarker observations for ${Object.keys(biomarkerObservations).length} LOINC codes`);
    if (Object.keys(biomarkerObservations).length > 0) {
      console.log(`Matching LOINC codes found:`, Object.keys(biomarkerObservations));
    } else {
      console.log(`No matching LOINC codes found in observations`);
      // Log some sample observations for debugging
      if (observations.length > 0) {
        const sampleObs = observations.slice(0, Math.min(3, observations.length));
        console.log(`Sample observations:`, sampleObs.map(o => ({
          id: o.id,
          code: o.code?.coding?.map(c => ({system: c.system, code: c.code}))
        })));
      }
    }
    
    // For each biomarker, get the most recent observation
    const recentObservations: Observation[] = [];
    
    Object.values(biomarkerObservations).forEach(obsArray => {
      // Sort by date, newest first
      const sorted = obsArray.sort((a, b) => {
        const dateA = a.effectiveDateTime ? new Date(a.effectiveDateTime).getTime() : 0;
        const dateB = b.effectiveDateTime ? new Date(b.effectiveDateTime).getTime() : 0;
        return dateB - dateA;
      });
      
      // Add the most recent observation
      if (sorted.length > 0) {
        recentObservations.push(sorted[0]);
      }
    });
    
    console.log(`Returning ${recentObservations.length} recent biomarker observations`);
    return recentObservations;
  } catch (error) {
    console.error('Error fetching biomarker observations:', error);
    return [];
  }
} 