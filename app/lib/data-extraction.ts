import { 
  Patient, 
  Observation, 
  DiagnosticReport, 
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
import { 
  convertLabToObservation,
  convertRecordToDiagnosticReport,
  convertToMedication,
  convertToMedicationStatement,
  convertToCondition,
  convertToAllergyIntolerance,
  convertToImmunization,
  convertToDocumentReference,
  convertToProcedure,
  convertToFamilyMemberHistory,
  convertToImagingStudy,
  convertToDiagnosticReportImaging
} from './fhir-converter';

/**
 * Extract document metadata from uploaded medical document
 * @param documentData Content or metadata from the document
 * @param fileUrl URL where the document is stored
 * @param patientId ID of the patient this document belongs to
 * @returns DocumentReference FHIR resource
 */
export async function extractDocumentReference(
  documentData: any,
  fileUrl: string,
  patientId: string
): Promise<DocumentReference> {
  // For now, we're just converting the metadata we have
  // In a production app, you might use OCR, NLP, or other extraction techniques
  // to get more information from the actual document content
  
  const documentReference = convertToDocumentReference(
    documentData,
    patientId,
    fileUrl
  );
  
  return documentReference;
}

/**
 * Extract procedure information from uploaded medical document or user input
 * @param procedureData Data about the procedure
 * @param patientId ID of the patient this procedure was performed on
 * @returns Procedure FHIR resource
 */
export async function extractProcedure(
  procedureData: any,
  patientId: string
): Promise<Procedure> {
  // For now, we're just converting the data we have
  // In a production app, you might use NLP or other techniques
  // to extract more detailed procedure information
  
  const procedure = convertToProcedure(
    procedureData,
    patientId
  );
  
  return procedure;
}

/**
 * Extract family history information from uploaded medical document or user input
 * @param familyHistoryData Data about the family member and their conditions
 * @param patientId ID of the patient this family history belongs to
 * @returns FamilyMemberHistory FHIR resource
 */
export async function extractFamilyMemberHistory(
  familyHistoryData: any,
  patientId: string
): Promise<FamilyMemberHistory> {
  // For now, we're just converting the data we have
  
  const familyMemberHistory = convertToFamilyMemberHistory(
    familyHistoryData,
    patientId
  );
  
  return familyMemberHistory;
}

/**
 * Extract imaging study information from radiology reports or DICOM metadata
 * @param imagingData Data about the imaging study
 * @param patientId ID of the patient this imaging study was performed on
 * @returns ImagingStudy FHIR resource
 */
export async function extractImagingStudy(
  imagingData: any,
  patientId: string
): Promise<ImagingStudy> {
  // For now, we're just converting the data we have
  // In a production app, you might extract DICOM metadata directly
  
  const imagingStudy = convertToImagingStudy(
    imagingData,
    patientId
  );
  
  return imagingStudy;
}

/**
 * Extract imaging diagnostic report information from radiology reports
 * @param reportData Data about the imaging report
 * @param patientId ID of the patient this report belongs to
 * @param imagingStudyId Optional ID of the related imaging study
 * @param observationIds Optional IDs of related observations
 * @returns DiagnosticReport FHIR resource for imaging
 */
export async function extractDiagnosticReportImaging(
  reportData: any,
  patientId: string,
  imagingStudyId?: string,
  observationIds?: string[]
): Promise<DiagnosticReportImaging> {
  // For now, we're just converting the data we have
  
  const diagnosticReport = convertToDiagnosticReportImaging(
    reportData,
    patientId,
    imagingStudyId
  );
  
  // Add observation references if provided
  if (observationIds && observationIds.length > 0) {
    diagnosticReport.result = observationIds.map(id => ({
      reference: `Observation/${id}`
    }));
  }
  
  return diagnosticReport;
}

/**
 * Extract lab observations from a lab report
 * @param labData Laboratory report data
 * @param patientId ID of the patient
 * @returns Array of Observation resources
 */
export async function extractObservationsFromLabReport(
  labData: any,
  patientId: string
): Promise<Observation[]> {
  const observations: Observation[] = [];
  
  // If there are structured lab results
  if (labData.results && Array.isArray(labData.results)) {
    for (const result of labData.results) {
      const observation = convertLabToObservation(result, patientId);
      observations.push(observation);
    }
  }
  
  // If no structured results, try to extract from text
  if (observations.length === 0 && labData.briefSummary) {
    // Simple pattern matching for common lab tests
    // This is a basic implementation and would need more sophisticated NLP in production
    const labPatterns = [
      { regex: /hemoglobin:?\s*([\d\.]+)\s*(g\/dL)?/i, name: 'Hemoglobin', unit: 'g/dL' },
      { regex: /hematocrit:?\s*([\d\.]+)\s*(%)?/i, name: 'Hematocrit', unit: '%' },
      { regex: /wbc:?\s*([\d\.]+)\s*(k\/uL|10\^3\/uL)?/i, name: 'White Blood Cell Count', unit: '10^3/uL' },
      { regex: /platelets:?\s*([\d\.]+)\s*(k\/uL|10\^3\/uL)?/i, name: 'Platelet Count', unit: '10^3/uL' },
      { regex: /glucose:?\s*([\d\.]+)\s*(mg\/dL)?/i, name: 'Glucose', unit: 'mg/dL' },
      { regex: /cholesterol:?\s*([\d\.]+)\s*(mg\/dL)?/i, name: 'Cholesterol', unit: 'mg/dL' },
      { regex: /ldl:?\s*([\d\.]+)\s*(mg\/dL)?/i, name: 'LDL Cholesterol', unit: 'mg/dL' },
      { regex: /hdl:?\s*([\d\.]+)\s*(mg\/dL)?/i, name: 'HDL Cholesterol', unit: 'mg/dL' }
    ];
    
    for (const pattern of labPatterns) {
      const match = labData.briefSummary.match(pattern.regex);
      if (match && match[1]) {
        const result = {
          name: pattern.name,
          value: parseFloat(match[1]),
          unit: match[2] || pattern.unit,
          date: labData.recordDate || new Date().toISOString()
        };
        
        const observation = convertLabToObservation(result, patientId);
        observations.push(observation);
      }
    }
  }
  
  return observations;
}

/**
 * Extract diagnostic report from medical record
 * @param recordData Medical record data
 * @param patientId ID of the patient
 * @param observationIds Optional IDs of related observations
 * @returns DiagnosticReport resource
 */
export async function extractDiagnosticReport(
  recordData: any,
  patientId: string,
  observationIds: string[] = []
): Promise<DiagnosticReport> {
  const diagnosticReport = convertRecordToDiagnosticReport(
    recordData,
    patientId,
    observationIds
  );
  
  return diagnosticReport;
}

/**
 * Extract multiple types of data from a medical document
 * @param documentData Document content or metadata
 * @param fileUrl URL where the document is stored
 * @param patientId ID of the patient
 * @returns Object containing extracted FHIR resources
 */
export async function extractAllFromDocument(
  documentData: any,
  fileUrl: string,
  patientId: string
): Promise<{
  documentReference?: DocumentReference,
  observations?: Observation[],
  diagnosticReports?: DiagnosticReport[],
  procedures?: Procedure[],
  imagingStudies?: ImagingStudy[],
  imagingReports?: DiagnosticReportImaging[]
}> {
  const result: {
    documentReference?: DocumentReference,
    observations?: Observation[],
    diagnosticReports?: DiagnosticReport[],
    procedures?: Procedure[],
    imagingStudies?: ImagingStudy[],
    imagingReports?: DiagnosticReportImaging[]
  } = {};
  
  // First, create a document reference for the uploaded file
  result.documentReference = await extractDocumentReference(documentData, fileUrl, patientId);
  
  // Try to determine document type and extract appropriate data
  if (documentData.recordType) {
    const normalizedType = documentData.recordType.toLowerCase().trim();
    
    // Extract observations from lab reports or pathology reports
    if (normalizedType.includes('lab') || 
        normalizedType.includes('laboratory') || 
        normalizedType.includes('pathology') || 
        normalizedType.includes('blood') || 
        normalizedType.includes('test') || 
        normalizedType.includes('panel')) {
      
      console.log('Identified lab/pathology document, extracting lab observations');
      
      // Use existing extraction methods for lab data
      const labResults = await extractObservationsFromLabReport(documentData, patientId);
      
      if (labResults.length > 0) {
        result.observations = labResults;
        
        // Create a diagnostic report linking these observations
        const diagnosticReport = await extractDiagnosticReport(
          documentData,
          patientId,
          labResults.map((obs: Observation) => obs.id || '')
        );
        
        // Ensure the diagnostic report has the correct category for lab reports
        if (!diagnosticReport.category) {
          diagnosticReport.category = [];
        }
        
        // Add lab category if not already present
        const hasLabCategory = diagnosticReport.category.some(cat => 
          cat.coding?.some(code => code.code === 'LAB')
        );
        
        if (!hasLabCategory) {
          diagnosticReport.category.push({
            coding: [{
              system: 'http://terminology.hl7.org/CodeSystem/v2-0074',
              code: 'LAB',
              display: 'Laboratory'
            }],
            text: 'Laboratory'
          });
        }
        
        result.diagnosticReports = [diagnosticReport];
        console.log(`Created diagnostic report with ID ${diagnosticReport.id} and linked ${labResults.length} observations`);
      } else {
        // Handle case where no lab results were extracted, but we know it's a lab document
        console.log('No structured lab results found in lab document, creating basic diagnostic report');
        
        // Create a basic diagnostic report with limited information
        const basicReport = await extractDiagnosticReport(
          {
            ...documentData,
            recordType: 'Laboratory Report' // Ensure correct type is set
          },
          patientId,
          []
        );
        
        // Add lab category
        basicReport.category = [{
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/v2-0074',
            code: 'LAB',
            display: 'Laboratory'
          }],
          text: 'Laboratory'
        }];
        
        result.diagnosticReports = [basicReport];
        console.log(`Created basic diagnostic report with ID ${basicReport.id} without observations`);
      }
    }
    
    // Extract imaging studies from radiology reports
    if (normalizedType.includes('radio') || normalizedType.includes('imaging') || 
        normalizedType.includes('mri') || normalizedType.includes('ct scan') ||
        normalizedType.includes('xray') || normalizedType.includes('x-ray') ||
        normalizedType.includes('ultrasound')) {
      
      // Extract imaging study data
      const imagingData = {
        name: documentData.name || 'Imaging Study',
        description: documentData.briefSummary || '',
        date: documentData.recordDate || new Date().toISOString(),
        modality: extractModalityFromText(normalizedType)
      };
      
      const imagingStudy = await extractImagingStudy(imagingData, patientId);
      result.imagingStudies = [imagingStudy];
      
      // Create an imaging diagnostic report
      const reportData = {
        name: documentData.name || 'Imaging Report',
        conclusion: documentData.briefSummary || '',
        date: documentData.recordDate || new Date().toISOString(),
        url: fileUrl
      };
      
      const imagingReport = await extractDiagnosticReportImaging(
        reportData,
        patientId,
        imagingStudy.id
      );
      result.imagingReports = [imagingReport];
    }
    
    // Extract procedures from surgical or procedure notes
    if (normalizedType.includes('procedure') || normalizedType.includes('surgery') || 
        normalizedType.includes('operative') || normalizedType.includes('operation')) {
      
      const procedureData = {
        name: documentData.name || extractProcedureNameFromText(documentData.briefSummary || ''),
        date: documentData.recordDate || new Date().toISOString(),
        status: 'completed',
        performer: documentData.provider || '',
        reason: documentData.reason || '',
        outcome: documentData.outcome || ''
      };
      
      const procedure = await extractProcedure(procedureData, patientId);
      result.procedures = [procedure];
    }
  }
  
  return result;
}

/**
 * Helper function to extract modality from text description
 */
function extractModalityFromText(text: string): string {
  const modalityKeywords = {
    'mri': 'MR',
    'magnetic resonance': 'MR',
    'ct': 'CT',
    'cat scan': 'CT',
    'computed tomography': 'CT',
    'ultrasound': 'US',
    'sonogram': 'US',
    'x-ray': 'CR',
    'xray': 'CR',
    'radiograph': 'CR',
    'mammogram': 'MG',
    'mammography': 'MG',
    'nuclear medicine': 'NM',
    'pet': 'PT',
    'positron emission': 'PT'
  };
  
  const normalizedText = text.toLowerCase();
  
  for (const [keyword, modality] of Object.entries(modalityKeywords)) {
    if (normalizedText.includes(keyword)) {
      return modality;
    }
  }
  
  return 'OT'; // Other
}

/**
 * Helper function to extract procedure name from text description
 */
function extractProcedureNameFromText(text: string): string {
  if (!text) return 'Procedure';
  
  // Common procedure keywords to look for
  const procedureKeywords = [
    'excision of', 'removal of', 'resection of', 'biopsy of',
    'endoscopy', 'colonoscopy', 'gastroscopy', 'bronchoscopy',
    'surgery', 'surgical', 'procedure', 'operation',
    'repair of', 'replacement of', 'implantation of',
    'appendectomy', 'cholecystectomy', 'hysterectomy', 'colectomy'
  ];
  
  // Try to find a procedure name in the text
  const words = text.split(' ');
  for (let i = 0; i < words.length; i++) {
    for (const keyword of procedureKeywords) {
      if (text.indexOf(keyword) >= 0) {
        // Try to get a phrase around the keyword
        const startIndex = Math.max(0, text.indexOf(keyword) - 10);
        const endIndex = Math.min(text.length, text.indexOf(keyword) + keyword.length + 30);
        return text.substring(startIndex, endIndex).trim();
      }
    }
  }
  
  // If no specific procedure found, return first 50 characters or full text
  return text.length > 50 ? text.substring(0, 50) + '...' : text;
} 