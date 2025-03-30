'use client';

import {
  extractDocumentReference,
  extractProcedure,
  extractFamilyMemberHistory,
  extractImagingStudy,
  extractDiagnosticReportImaging,
  extractAllFromDocument
} from './data-extraction';
import {
  createDocumentReference,
  createProcedure,
  createFamilyMemberHistory,
  createImagingStudy,
  createDiagnosticReportImaging,
  createResource
} from './fhir-service';
import { analyzeDocumentText } from './openai-utils';
import { extractFHIRResources } from './analysis-utils';

/**
 * Process an uploaded document to generate appropriate FHIR resources
 * @param userId User ID
 * @param documentText Text content of the document
 * @param documentMetadata Metadata about the document
 * @param fileUrl URL where the document is stored
 * @param patientId ID of the patient this document belongs to
 * @returns IDs of created FHIR resources
 */
export async function processMedicalDocument(
  userId: string,
  documentText: string,
  documentMetadata: {
    name?: string;
    recordType?: string;
    comment?: string;
  },
  fileUrl: string,
  patientId: string = 'default-patient'
): Promise<{
  documentReferenceId?: string;
  procedureId?: string;
  imagingStudyId?: string;
  diagnosticReportIds?: string[];
  familyMemberHistoryId?: string;
  detectedDocumentType?: string;
  summary?: string;
  resourceIds?: Record<string, string[]>;
}> {
  if (!documentText) {
    console.log('No document text provided, skipping FHIR processing');
    return {};
  }
  
  try {
    // Analyze the document text to determine type and extract data
    const analysis = await analyzeDocumentText(
      documentText, 
      documentMetadata.name || '', 
      fileUrl
    );
    
    // Try to extract FHIR resources directly from the analysis
    const fhirResources = extractFHIRResources(analysis.summary);
    
    // If FHIR resources were extracted directly, process them
    if (fhirResources && fhirResources.length > 0) {
      console.log(`Found ${fhirResources.length} FHIR resources in the analysis`);
      
      // Track created resource IDs by type
      const resourceIds: Record<string, string[]> = {};
      
      // Process each resource
      for (const resource of fhirResources) {
        try {
          // Skip invalid resources
          if (!resource || !resource.resourceType) {
            console.warn('Skipping invalid FHIR resource (missing resourceType)');
            continue;
          }
          
          const resourceType = resource.resourceType;
          
          // Skip Patient resources as we already have one
          if (resourceType === 'Patient') {
            console.log('Skipping Patient resource as we already have one');
            continue;
          }
          
          // Add patient reference if not already present
          if (resourceType !== 'Patient' && !resource.subject && !resource.patient) {
            // Different FHIR resources use different fields for patient reference
            if (['Observation', 'DiagnosticReport', 'Procedure', 'Condition', 'Immunization'].includes(resourceType)) {
              resource.subject = { reference: `Patient/${patientId}` };
            } else if (['MedicationStatement', 'AllergyIntolerance'].includes(resourceType)) {
              resource.patient = { reference: `Patient/${patientId}` };
            }
          }
          
          // Create the resource
          const resourceId = await createResource(userId, resource);
          
          // Track created resources by type
          if (!resourceIds[resourceType]) {
            resourceIds[resourceType] = [];
          }
          resourceIds[resourceType].push(resourceId);
          
          console.log(`Created ${resourceType} resource with ID ${resourceId}`);
        } catch (resourceError) {
          console.error(`Error creating FHIR resource of type ${resource?.resourceType || 'unknown'}:`, resourceError);
        }
      }
      
      // Return the summary and resource IDs
      return {
        detectedDocumentType: analysis.recordType,
        summary: analysis.summary,
        resourceIds
      };
    }
    
    // If no direct FHIR resources were found, fall back to the old approach
    console.log("No direct FHIR resources found, falling back to structured data extraction");
    
    // Create a merged document data object with the analysis results
    const documentData = {
      name: documentMetadata.name || 'Medical Document',
      recordType: analysis.recordType || documentMetadata.recordType || 'Unknown Document',
      recordDate: new Date().toISOString(),
      briefSummary: analysis.summary || '',
      extractedData: analysis.extractedData || {},
      comment: documentMetadata.comment || '',
      createdAt: new Date().toISOString()
    };
    
    // Try to extract a date from the analysis data
    if (analysis.extractedData && analysis.extractedData.date) {
      documentData.recordDate = new Date(analysis.extractedData.date).toISOString();
    }
    
    // Extract FHIR resources based on document type
    const extractedResources = await extractAllFromDocument(documentData, fileUrl, patientId);
    
    // Track created resource IDs
    const result: {
      documentReferenceId?: string;
      procedureId?: string;
      imagingStudyId?: string;
      diagnosticReportIds: string[];
      familyMemberHistoryId?: string;
      detectedDocumentType: string;
      summary: string;
    } = {
      diagnosticReportIds: [],
      detectedDocumentType: analysis.recordType,
      summary: analysis.summary
    };
    
    // Save DocumentReference
    if (extractedResources.documentReference) {
      try {
        const docRef = await createDocumentReference(
          userId,
          extractedResources.documentReference,
          patientId,
          fileUrl,
          'application/pdf'
        );
        
        if (docRef) {
          result.documentReferenceId = typeof docRef === 'string' ? docRef : (docRef as any).id;
          console.log(`Created DocumentReference: ${result.documentReferenceId}`);
        }
      } catch (err) {
        console.error('Error creating DocumentReference:', err);
      }
    }
    
    // Save Procedure if detected
    if (extractedResources.procedures && extractedResources.procedures.length > 0) {
      try {
        const procedureRef = await createProcedure(
          userId,
          extractedResources.procedures[0],
          patientId
        );
        
        if (procedureRef) {
          result.procedureId = typeof procedureRef === 'string' ? procedureRef : (procedureRef as any).id;
          console.log(`Created Procedure: ${result.procedureId}`);
        }
      } catch (err) {
        console.error('Error creating Procedure:', err);
      }
    }
    
    // Save Family History if document type matches
    if (documentData.recordType.toLowerCase().includes('family history')) {
      try {
        // Create a simple family history object from document data
        const familyHistoryData = {
          relationship: 'family member',
          ...analysis.extractedData
        };
        
        // Extract family history FHIR resource
        const familyHistory = await extractFamilyMemberHistory(
          familyHistoryData,
          patientId
        );
        
        // Create family history in database
        const familyHistoryRef = await createFamilyMemberHistory(
          userId,
          familyHistory,
          patientId
        );
        
        if (familyHistoryRef) {
          result.familyMemberHistoryId = typeof familyHistoryRef === 'string' ? 
            familyHistoryRef : 
            (familyHistoryRef as any).id;
          console.log(`Created FamilyMemberHistory: ${result.familyMemberHistoryId}`);
        }
      } catch (err) {
        console.error('Error creating FamilyMemberHistory:', err);
      }
    }
    
    // Save ImagingStudy if detected
    if (extractedResources.imagingStudies && extractedResources.imagingStudies.length > 0) {
      try {
        const imagingStudyRef = await createImagingStudy(
          userId,
          extractedResources.imagingStudies[0],
          patientId
        );
        
        if (imagingStudyRef) {
          result.imagingStudyId = typeof imagingStudyRef === 'string' ? imagingStudyRef : (imagingStudyRef as any).id;
          console.log(`Created ImagingStudy: ${result.imagingStudyId}`);
          
          // Save DiagnosticReport for imaging if we have an imaging study
          if (extractedResources.imagingReports && extractedResources.imagingReports.length > 0) {
            try {
              const reportRef = await createDiagnosticReportImaging(
                userId,
                extractedResources.imagingReports[0],
                patientId,
                result.imagingStudyId
              );
              
              if (reportRef) {
                const reportId = typeof reportRef === 'string' ? reportRef : (reportRef as any).id;
                result.diagnosticReportIds.push(reportId);
                console.log(`Created DiagnosticReport for imaging: ${reportId}`);
              }
            } catch (err) {
              console.error('Error creating DiagnosticReport for imaging:', err);
            }
          }
        }
      } catch (err) {
        console.error('Error creating ImagingStudy:', err);
      }
    }
    
    return result;
  } catch (error) {
    console.error('Error processing medical document:', error);
    return {};
  }
} 