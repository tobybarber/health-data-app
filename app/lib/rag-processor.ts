import { Document } from 'llamaindex';
import { OpenAIEmbedding } from '@llamaindex/openai';

// Helper function to convert FHIR resource to text representation
export function fhirResourceToText(resource: any): string {
  if (!resource || !resource.resourceType) {
    return '';
  }

  let textContent = '';
  
  // Common header for all resources
  textContent += `Resource Type: ${resource.resourceType}\n`;
  textContent += `ID: ${resource.id}\n`;
  
  // Resource-specific formatting
  switch (resource.resourceType) {
    case 'Observation':
      textContent += `Code: ${resource.code?.coding?.[0]?.display || resource.code?.text || 'Unknown'}\n`;
      
      // Handle different value types
      if (resource.valueQuantity) {
        textContent += `Value: ${resource.valueQuantity.value} ${resource.valueQuantity.unit}\n`;
      } else if (resource.valueString) {
        textContent += `Value: ${resource.valueString}\n`;
      } else if (resource.valueCodeableConcept) {
        textContent += `Value: ${resource.valueCodeableConcept.coding?.[0]?.display || resource.valueCodeableConcept.text}\n`;
      }
      
      textContent += `Date: ${resource.effectiveDateTime || resource.issued || 'Unknown'}\n`;
      textContent += `Status: ${resource.status || 'Unknown'}\n`;
      
      // Reference information
      if (resource.subject?.reference) {
        textContent += `Subject: ${resource.subject.reference}\n`;
      }
      break;
      
    case 'Condition':
      textContent += `Condition: ${resource.code?.coding?.[0]?.display || resource.code?.text || 'Unknown'}\n`;
      textContent += `Clinical Status: ${resource.clinicalStatus?.coding?.[0]?.code || 'Unknown'}\n`;
      textContent += `Verification Status: ${resource.verificationStatus?.coding?.[0]?.code || 'Unknown'}\n`;
      
      if (resource.severity) {
        textContent += `Severity: ${resource.severity?.coding?.[0]?.display || resource.severity?.text || 'Unknown'}\n`;
      }
      
      if (resource.onsetDateTime) {
        textContent += `Onset Date: ${resource.onsetDateTime}\n`;
      }
      
      if (resource.abatementDateTime) {
        textContent += `Abatement Date: ${resource.abatementDateTime}\n`;
      }
      break;
      
    case 'DiagnosticReport':
      textContent += `Report Type: ${resource.code?.coding?.[0]?.display || resource.code?.text || 'Unknown'}\n`;
      textContent += `Status: ${resource.status || 'Unknown'}\n`;
      textContent += `Date: ${resource.effectiveDateTime || resource.issued || 'Unknown'}\n`;
      
      if (resource.conclusion) {
        textContent += `Conclusion: ${resource.conclusion}\n`;
      }
      
      if (resource.result && Array.isArray(resource.result)) {
        textContent += `Results: ${resource.result.length} observation(s)\n`;
        resource.result.forEach((result: any, index: number) => {
          textContent += `  Result ${index + 1}: ${result.reference || 'Unknown'}\n`;
        });
      }
      break;
      
    case 'MedicationStatement':
      textContent += `Medication: ${resource.medicationCodeableConcept?.coding?.[0]?.display || 
        resource.medicationCodeableConcept?.text || 'Unknown'}\n`;
      textContent += `Status: ${resource.status || 'Unknown'}\n`;
      
      if (resource.effectivePeriod) {
        textContent += `Period: ${resource.effectivePeriod.start || 'Unknown'} to ${resource.effectivePeriod.end || 'ongoing'}\n`;
      } else if (resource.effectiveDateTime) {
        textContent += `Date: ${resource.effectiveDateTime}\n`;
      }
      
      if (resource.dosage && Array.isArray(resource.dosage)) {
        resource.dosage.forEach((dosage: any, index: number) => {
          textContent += `Dosage ${index + 1}: ${dosage.text || 'Unknown'}\n`;
        });
      }
      break;
      
    case 'AllergyIntolerance':
      textContent += `Allergy: ${resource.code?.coding?.[0]?.display || resource.code?.text || 'Unknown'}\n`;
      textContent += `Type: ${resource.type || 'Unknown'}\n`;
      textContent += `Category: ${Array.isArray(resource.category) ? resource.category.join(', ') : resource.category || 'Unknown'}\n`;
      textContent += `Criticality: ${resource.criticality || 'Unknown'}\n`;
      break;
      
    case 'Immunization':
      textContent += `Vaccine: ${resource.vaccineCode?.coding?.[0]?.display || resource.vaccineCode?.text || 'Unknown'}\n`;
      textContent += `Status: ${resource.status || 'Unknown'}\n`;
      textContent += `Date: ${resource.occurrenceDateTime || 'Unknown'}\n`;
      break;
      
    case 'Procedure':
      textContent += `Procedure: ${resource.code?.coding?.[0]?.display || resource.code?.text || 'Unknown'}\n`;
      textContent += `Status: ${resource.status || 'Unknown'}\n`;
      textContent += `Date: ${resource.performedDateTime || 'Unknown'}\n`;
      break;
      
    default:
      // For other resource types, include basic properties as text
      Object.entries(resource).forEach(([key, value]) => {
        if (key !== 'resourceType' && key !== 'id' && typeof value !== 'object') {
          textContent += `${key}: ${value}\n`;
        }
      });
  }
  
  return textContent;
}

// Convert FHIR resources to LlamaIndex documents
export async function fhirResourcesToDocuments(resources: any[]): Promise<Document[]> {
  return resources.map(resource => {
    const text = fhirResourceToText(resource);
    
    // Create metadata that will be useful for retrieval
    const metadata = {
      resourceType: resource.resourceType,
      id: resource.id,
      date: resource.effectiveDateTime || resource.issued || resource.performedDateTime || 
        resource.occurrenceDateTime || (resource.effectivePeriod?.start) || '',
    };
    
    // For observations and diagnostics, add code info to metadata
    if (['Observation', 'DiagnosticReport', 'Condition', 'Procedure'].includes(resource.resourceType)) {
      metadata['code'] = resource.code?.coding?.[0]?.code || '';
      metadata['display'] = resource.code?.coding?.[0]?.display || resource.code?.text || '';
    }
    
    return new Document({
      text,
      metadata
    });
  });
}

// Create embedding model
export function createEmbeddingModel() {
  return new OpenAIEmbedding({
    // You can customize your embedding model here
    // OpenAI's text-embedding-3-small is a good default
    model: 'text-embedding-3-small'
  });
} 