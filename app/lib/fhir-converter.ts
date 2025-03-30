'use client';

import { 
  Patient, 
  Observation, 
  DiagnosticReport, 
  CodeableConcept, 
  Coding, 
  Quantity, 
  Reference,
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

/**
 * Create a Patient resource from user data
 */
export function createPatientFromUser(
  userData: any, 
  id?: string
): Patient {
  return {
    resourceType: 'Patient',
    id,
    active: true,
    name: [
      {
        use: 'official',
        family: userData.lastName || '',
        given: [userData.firstName || ''],
        text: `${userData.firstName || ''} ${userData.lastName || ''}`.trim()
      }
    ],
    telecom: userData.email 
      ? [
          {
            system: 'email',
            value: userData.email,
            use: 'home'
          }
        ] 
      : undefined,
    gender: userData.gender || undefined,
    birthDate: userData.birthDate || undefined
  };
}

/**
 * Convert a LabResult to FHIR Observation
 */
export function convertLabToObservation(
  labData: any, 
  patientId: string,
  id?: string
): Observation {
  // Create a coding from the lab test name
  const coding: Coding[] = [];
  
  // Try to find a LOINC code for common lab tests
  // This is a simplified mapping and should be expanded
  if (labData.name) {
    const normalizedName = labData.name.toLowerCase().trim();
    
    // Common lab test mappings
    const loincMap: { [key: string]: { code: string, display: string } } = {
      'ferritin': { code: '2276-4', display: 'Ferritin [Mass/volume] in Serum or Plasma' },
      'iron': { code: '2498-4', display: 'Iron [Mass/volume] in Serum or Plasma' },
      'hemoglobin': { code: '718-7', display: 'Hemoglobin [Mass/volume] in Blood' },
      'glucose': { code: '2339-0', display: 'Glucose [Mass/volume] in Blood' },
      'cholesterol': { code: '2093-3', display: 'Cholesterol [Mass/volume] in Serum or Plasma' },
      'hdl': { code: '2085-9', display: 'Cholesterol in HDL [Mass/volume] in Serum or Plasma' },
      'ldl': { code: '2089-1', display: 'Cholesterol in LDL [Mass/volume] in Serum or Plasma' },
      'triglycerides': { code: '2571-8', display: 'Triglyceride [Mass/volume] in Serum or Plasma' },
      'tsh': { code: '11580-8', display: 'Thyrotropin [Units/volume] in Serum or Plasma' },
      'vitamin d': { code: '35365-6', display: '25-hydroxyvitamin D3 [Mass/volume] in Serum or Plasma' },
      'vitamin b12': { code: '2132-9', display: 'Vitamin B12 [Mass/volume] in Serum or Plasma' },
      'creatinine': { code: '2160-0', display: 'Creatinine [Mass/volume] in Serum or Plasma' }
    };
    
    // Find a match
    let found = false;
    for (const [key, value] of Object.entries(loincMap)) {
      if (normalizedName.includes(key)) {
        coding.push({
          system: 'http://loinc.org',
          code: value.code,
          display: value.display
        });
        found = true;
        break;
      }
    }
    
    // If no LOINC code found, use a generic code
    if (!found) {
      coding.push({
        system: 'http://loinc.org',
        code: 'unknown',
        display: labData.name
      });
    }
  }
  
  // Create the observation
  const observation: Observation = {
    resourceType: 'Observation',
    id,
    status: 'final',
    code: {
      coding,
      text: labData.name || 'Unknown test'
    },
    subject: {
      reference: `Patient/${patientId}`
    },
    effectiveDateTime: labData.date || new Date().toISOString(),
    issued: labData.date || new Date().toISOString()
  };
  
  // Add value if available
  if (labData.value !== undefined) {
    observation.valueQuantity = {
      value: parseFloat(labData.value),
      unit: labData.unit || '',
      system: 'http://unitsofmeasure.org',
      code: labData.unit || ''
    };
  }
  
  // Add reference range if available
  if (labData.referenceRange?.low !== undefined || labData.referenceRange?.high !== undefined) {
    observation.referenceRange = [
      {
        low: labData.referenceRange?.low !== undefined 
          ? { value: parseFloat(labData.referenceRange.low), unit: labData.unit || '' }
          : undefined,
        high: labData.referenceRange?.high !== undefined
          ? { value: parseFloat(labData.referenceRange.high), unit: labData.unit || '' }
          : undefined,
        text: labData.referenceRange?.text
      }
    ];
  }
  
  return observation;
}

/**
 * Convert a medical record to FHIR DiagnosticReport
 */
export function convertRecordToDiagnosticReport(
  recordData: any, 
  patientId: string,
  observationIds: string[] = [],
  id?: string
): DiagnosticReport {
  const report: DiagnosticReport = {
    resourceType: 'DiagnosticReport',
    id,
    status: 'final',
    code: {
      coding: [
        {
          system: 'http://loinc.org',
          code: recordData.recordType?.toLowerCase().includes('lab') ? '11502-2' : '74465-6',
          display: recordData.recordType || 'Unknown report type'
        }
      ],
      text: recordData.recordType || 'Unknown report type'
    },
    subject: {
      reference: `Patient/${patientId}`
    },
    effectiveDateTime: recordData.recordDate || new Date().toISOString(),
    issued: recordData.createdAt || new Date().toISOString(),
    result: observationIds.map(id => ({
      reference: `Observation/${id}`
    })),
    conclusion: recordData.briefSummary || recordData.comment || '',
    presentedForm: recordData.url 
      ? [
          {
            contentType: recordData.fileType || 'application/pdf',
            url: recordData.url
          }
        ] 
      : undefined
  };
  
  return report;
}

/**
 * Parse a FHIR Observation to get a simple value object
 */
export function parseObservationValue(observation: Observation): {
  value?: number;
  unit?: string;
  date?: string;
  name?: string;
  code?: string;
  system?: string;
} {
  return {
    value: observation.valueQuantity?.value,
    unit: observation.valueQuantity?.unit,
    date: observation.effectiveDateTime,
    name: observation.code.text,
    code: observation.code.coding?.[0]?.code,
    system: observation.code.coding?.[0]?.system
  };
}

/**
 * Extract LOINC code from an Observation
 */
export function getLoincCode(observation: Observation): string | null {
  if (!observation.code.coding) return null;
  
  const loincCoding = observation.code.coding.find(
    coding => coding.system === 'http://loinc.org'
  );
  
  return loincCoding?.code || null;
}

/**
 * Convert medication data to FHIR Medication
 */
export function convertToMedication(
  medicationData: any,
  id?: string
): Medication {
  // Create a coding from the medication name
  const coding: Coding[] = [];
  
  // Try to find a standard code for common medications
  // RxNorm would be ideal but this is a simplified mapping
  if (medicationData.name) {
    const normalizedName = medicationData.name.toLowerCase().trim();
    
    // This is a very simplified mapping - in production, use a real terminology service
    const rxNormMap: { [key: string]: { code: string, display: string } } = {
      'aspirin': { code: '1191', display: 'Aspirin' },
      'ibuprofen': { code: '5640', display: 'Ibuprofen' },
      'acetaminophen': { code: '161', display: 'Acetaminophen' },
      'lisinopril': { code: '29046', display: 'Lisinopril' },
      'metformin': { code: '6809', display: 'Metformin' },
      'atorvastatin': { code: '83367', display: 'Atorvastatin' },
      'levothyroxine': { code: '10582', display: 'Levothyroxine' },
      'metoprolol': { code: '6918', display: 'Metoprolol' },
      'amlodipine': { code: '17767', display: 'Amlodipine' },
      'omeprazole': { code: '7646', display: 'Omeprazole' },
    };
    
    // Find a match
    let found = false;
    for (const [key, value] of Object.entries(rxNormMap)) {
      if (normalizedName.includes(key)) {
        coding.push({
          system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
          code: value.code,
          display: value.display
        });
        found = true;
        break;
      }
    }
    
    // If no RxNorm code found, use a generic code
    if (!found) {
      coding.push({
        system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
        code: 'unknown',
        display: medicationData.name
      });
    }
  }
  
  // Create the medication
  const medication: Medication = {
    resourceType: 'Medication',
    id,
    code: {
      coding,
      text: medicationData.name || 'Unknown medication'
    },
    status: 'active'
  };
  
  // Add form if available (tablet, capsule, etc)
  if (medicationData.form) {
    medication.form = {
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/v3-orderableDrugForm',
        code: medicationData.form.toLowerCase(),
        display: medicationData.form
      }],
      text: medicationData.form
    };
  }
  
  return medication;
}

/**
 * Convert medication data to FHIR MedicationStatement
 */
export function convertToMedicationStatement(
  medicationData: any,
  patientId: string,
  medicationId?: string,
  id?: string
): MedicationStatement {
  const medicationStatement: MedicationStatement = {
    resourceType: 'MedicationStatement',
    id,
    status: 'active',
    subject: {
      reference: `Patient/${patientId}`
    },
    dateAsserted: new Date().toISOString()
  };
  
  // Add medication reference or codeable concept
  if (medicationId) {
    medicationStatement.medicationReference = {
      reference: `Medication/${medicationId}`
    };
  } else if (medicationData.name) {
    medicationStatement.medicationCodeableConcept = {
      text: medicationData.name
    };
  }
  
  // Add dosage if available
  if (medicationData.dosage || medicationData.frequency || medicationData.route) {
    const dosage = {
      text: `${medicationData.dosage || ''} ${medicationData.frequency || ''} ${medicationData.route || ''}`.trim()
    };
    
    medicationStatement.dosage = [dosage];
  }
  
  // Add date information if available
  if (medicationData.startDate) {
    medicationStatement.effectivePeriod = {
      start: medicationData.startDate
    };
    
    if (medicationData.endDate) {
      medicationStatement.effectivePeriod.end = medicationData.endDate;
    }
  }
  
  return medicationStatement;
}

/**
 * Convert condition data to FHIR Condition
 */
export function convertToCondition(
  conditionData: any,
  patientId: string,
  id?: string
): Condition {
  // Create a coding from the condition name
  const coding: Coding[] = [];
  
  // Try to find an ICD-10 code for common conditions
  if (conditionData.name) {
    const normalizedName = conditionData.name.toLowerCase().trim();
    
    // This is a very simplified mapping - in production, use a real terminology service
    const icdMap: { [key: string]: { code: string, display: string } } = {
      'hypertension': { code: 'I10', display: 'Essential (primary) hypertension' },
      'diabetes': { code: 'E11.9', display: 'Type 2 diabetes mellitus without complications' },
      'asthma': { code: 'J45.909', display: 'Unspecified asthma, uncomplicated' },
      'depression': { code: 'F32.9', display: 'Major depressive disorder, single episode, unspecified' },
      'anxiety': { code: 'F41.9', display: 'Anxiety disorder, unspecified' },
      'migraine': { code: 'G43.909', display: 'Migraine, unspecified, not intractable, without status migrainosus' },
      'hypothyroidism': { code: 'E03.9', display: 'Hypothyroidism, unspecified' },
      'arthritis': { code: 'M19.90', display: 'Unspecified osteoarthritis, unspecified site' }
    };
    
    // Find a match
    let found = false;
    for (const [key, value] of Object.entries(icdMap)) {
      if (normalizedName.includes(key)) {
        coding.push({
          system: 'http://hl7.org/fhir/sid/icd-10',
          code: value.code,
          display: value.display
        });
        found = true;
        break;
      }
    }
    
    // If no ICD-10 code found, use a generic code
    if (!found) {
      coding.push({
        system: 'http://hl7.org/fhir/sid/icd-10',
        code: 'unknown',
        display: conditionData.name
      });
    }
  }
  
  // Create the condition
  const condition: Condition = {
    resourceType: 'Condition',
    id,
    subject: {
      reference: `Patient/${patientId}`
    },
    recordedDate: new Date().toISOString(),
    code: {
      coding,
      text: conditionData.name || 'Unknown condition'
    }
  };
  
  // Add clinical status if available
  condition.clinicalStatus = {
    coding: [{
      system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
      code: conditionData.status || 'active',
      display: conditionData.status ? 
        conditionData.status.charAt(0).toUpperCase() + conditionData.status.slice(1) : 
        'Active'
    }]
  };
  
  // Add onset date if available
  if (conditionData.onsetDate) {
    condition.onsetDateTime = conditionData.onsetDate;
  }
  
  // Add severity if available
  if (conditionData.severity) {
    condition.severity = {
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/condition-severity',
        code: conditionData.severity.toLowerCase(),
        display: conditionData.severity
      }],
      text: conditionData.severity
    };
  }
  
  return condition;
}

/**
 * Convert allergy data to FHIR AllergyIntolerance
 */
export function convertToAllergyIntolerance(
  allergyData: any,
  patientId: string,
  id?: string
): AllergyIntolerance {
  // Create the allergy
  const allergy: AllergyIntolerance = {
    resourceType: 'AllergyIntolerance',
    id,
    patient: {
      reference: `Patient/${patientId}`
    },
    recordedDate: new Date().toISOString(),
    type: allergyData.type || 'allergy',
    code: {
      text: allergyData.name || 'Unknown allergy'
    }
  };
  
  // Set category if available
  if (allergyData.category) {
    const categories = Array.isArray(allergyData.category) ? 
      allergyData.category : [allergyData.category];
      
    // Filter to only valid categories
    const validCategories = categories.filter((cat: string) => 
      ['food', 'medication', 'environment', 'biologic'].includes(cat.toLowerCase())
    );
    
    if (validCategories.length > 0) {
      allergy.category = validCategories as ('food' | 'medication' | 'environment' | 'biologic')[];
    }
  }
  
  // Add criticality if available
  if (allergyData.criticality) {
    const normalized = allergyData.criticality.toLowerCase();
    if (['low', 'high', 'unable-to-assess'].includes(normalized)) {
      allergy.criticality = normalized as 'low' | 'high' | 'unable-to-assess';
    }
  }
  
  // Add reactions if available
  if (allergyData.reaction) {
    const reactions = Array.isArray(allergyData.reaction) ? 
      allergyData.reaction : [allergyData.reaction];
      
    allergy.reaction = reactions.map((reaction: any) => ({
      manifestation: [{ 
        text: reaction.manifestation || reaction.description || 'Unknown reaction'
      }],
      description: reaction.description,
      severity: reaction.severity || undefined
    }));
  }
  
  return allergy;
}

/**
 * Convert immunization data to FHIR Immunization
 */
export function convertToImmunization(
  immunizationData: any,
  patientId: string,
  id?: string
): Immunization {
  // Create a coding from the vaccine name
  const coding: Coding[] = [];
  
  // Try to find a CVX code for common vaccines
  if (immunizationData.name) {
    const normalizedName = immunizationData.name.toLowerCase().trim();
    
    // This is a very simplified mapping - in production, use a real terminology service
    const cvxMap: { [key: string]: { code: string, display: string } } = {
      'flu': { code: '141', display: 'Influenza, seasonal, injectable, preservative free' },
      'influenza': { code: '141', display: 'Influenza, seasonal, injectable, preservative free' },
      'covid': { code: '213', display: 'SARS-COV-2 (COVID-19) vaccine, mRNA, spike protein, LNP, preservative free, 30 mcg/0.3mL dose' },
      'covid-19': { code: '213', display: 'SARS-COV-2 (COVID-19) vaccine, mRNA, spike protein, LNP, preservative free, 30 mcg/0.3mL dose' },
      'tetanus': { code: '115', display: 'Tdap vaccine' },
      'tdap': { code: '115', display: 'Tdap vaccine' },
      'pneumococcal': { code: '33', display: 'pneumococcal polysaccharide vaccine, 23 valent' },
      'shingles': { code: '187', display: 'recombinant zoster vaccine' },
      'zoster': { code: '187', display: 'recombinant zoster vaccine' },
      'hpv': { code: '165', display: 'HPV9, 9 valent vaccine, preservative free' }
    };
    
    // Find a match
    let found = false;
    for (const [key, value] of Object.entries(cvxMap)) {
      if (normalizedName.includes(key)) {
        coding.push({
          system: 'http://hl7.org/fhir/sid/cvx',
          code: value.code,
          display: value.display
        });
        found = true;
        break;
      }
    }
    
    // If no CVX code found, use a generic code
    if (!found) {
      coding.push({
        system: 'http://hl7.org/fhir/sid/cvx',
        code: 'unknown',
        display: immunizationData.name
      });
    }
  }
  
  // Create the immunization
  const immunization: Immunization = {
    resourceType: 'Immunization',
    id,
    status: 'completed',
    patient: {
      reference: `Patient/${patientId}`
    },
    vaccineCode: {
      coding,
      text: immunizationData.name || 'Unknown vaccine'
    },
    recorded: immunizationData.recordedDate || new Date().toISOString(),
    primarySource: immunizationData.primarySource || true
  };
  
  // Add occurrence date if available
  if (immunizationData.date) {
    immunization.occurrenceDateTime = immunizationData.date;
  }
  
  // Add lot number if available
  if (immunizationData.lotNumber) {
    immunization.lotNumber = immunizationData.lotNumber;
  }
  
  // Add expiration date if available
  if (immunizationData.expirationDate) {
    immunization.expirationDate = immunizationData.expirationDate;
  }
  
  // Add site if available (e.g., left arm)
  if (immunizationData.site) {
    immunization.site = {
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/v3-ActSite',
        code: immunizationData.site,
        display: immunizationData.site
      }],
      text: immunizationData.site
    };
  }
  
  return immunization;
}

/**
 * Convert uploaded document data to DocumentReference resource
 */
export function convertToDocumentReference(
  documentData: any,
  patientId: string,
  fileUrl: string,
  id?: string
): DocumentReference {
  // Create a coding for the document type
  const coding: Coding[] = [];
  let category: CodeableConcept[] = [];
  
  // Try to determine document type from metadata
  if (documentData.recordType) {
    const normalizedType = documentData.recordType.toLowerCase().trim();
    
    // Map document types to LOINC codes
    const loincMap: { [key: string]: { code: string, display: string, category: string } } = {
      'laboratory report': { code: '11502-2', display: 'Laboratory report', category: 'LAB' },
      'radiology report': { code: '18748-4', display: 'Diagnostic imaging report', category: 'RAD' },
      'pathology report': { code: '60567-5', display: 'Comprehensive pathology report', category: 'PAT' },
      'discharge summary': { code: '18842-5', display: 'Discharge summary', category: 'DS' },
      'progress note': { code: '11506-3', display: 'Progress note', category: 'PN' },
      'consultation note': { code: '11488-4', display: 'Consultation note', category: 'CN' },
      'history and physical': { code: '34117-2', display: 'History and physical note', category: 'HP' },
      'procedure note': { code: '28570-0', display: 'Procedure note', category: 'PN' },
      'operative report': { code: '11504-8', display: 'Surgical operation note', category: 'OPN' }
    };
    
    // Find matching document type
    let found = false;
    for (const [key, value] of Object.entries(loincMap)) {
      if (normalizedType.includes(key)) {
        coding.push({
          system: 'http://loinc.org',
          code: value.code,
          display: value.display
        });
        
        // Set appropriate category
        category = [{
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
            code: value.category,
            display: value.display
          }],
          text: value.display
        }];
        
        found = true;
        break;
      }
    }
    
    // If no match found, use generic coding
    if (!found) {
      coding.push({
        system: 'http://loinc.org',
        code: '83320-2',
        display: 'Medical record documentation'
      });
      
      category = [{
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
          code: 'DOC',
          display: 'Document'
        }],
        text: 'Document'
      }];
    }
  } else {
    // Default coding if no type provided
    coding.push({
      system: 'http://loinc.org',
      code: '83320-2',
      display: 'Medical record documentation'
    });
    
    category = [{
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
        code: 'DOC',
        display: 'Document'
      }],
      text: 'Document'
    }];
  }
  
  // Determine content type from file extension
  const fileExtension = fileUrl.split('.').pop()?.toLowerCase();
  let contentType = 'application/pdf'; // Default
  
  if (fileExtension === 'jpg' || fileExtension === 'jpeg') {
    contentType = 'image/jpeg';
  } else if (fileExtension === 'png') {
    contentType = 'image/png';
  } else if (fileExtension === 'txt') {
    contentType = 'text/plain';
  } else if (fileExtension === 'html') {
    contentType = 'text/html';
  }
  
  // Create the document reference
  const documentReference: DocumentReference = {
    resourceType: 'DocumentReference',
    id,
    status: 'current',
    type: {
      coding,
      text: documentData.recordType || 'Medical Record'
    },
    category,
    subject: {
      reference: `Patient/${patientId}`
    },
    date: documentData.recordDate ? new Date(documentData.recordDate).toISOString() : new Date().toISOString(),
    content: [
      {
        attachment: {
          contentType,
          url: fileUrl,
          title: documentData.name || 'Medical Record',
          creation: documentData.createdAt || new Date().toISOString()
        }
      }
    ],
    description: documentData.comment || documentData.briefSummary || 'Medical document'
  };
  
  return documentReference;
}

/**
 * Convert procedure data to FHIR Procedure
 */
export function convertToProcedure(
  procedureData: any,
  patientId: string,
  id?: string
): Procedure {
  // Create a coding from the procedure name
  const coding: Coding[] = [];
  
  // Try to find a SNOMED CT code for common procedures
  if (procedureData.name) {
    const normalizedName = procedureData.name.toLowerCase().trim();
    
    // This is a very simplified mapping - in production, use a real terminology service
    const snomedMap: { [key: string]: { code: string, display: string } } = {
      'colonoscopy': { code: '73761001', display: 'Colonoscopy' },
      'appendectomy': { code: '80146002', display: 'Appendectomy' },
      'cataract surgery': { code: '83895000', display: 'Cataract extraction' },
      'hysterectomy': { code: '236886002', display: 'Hysterectomy' },
      'cholecystectomy': { code: '38102005', display: 'Cholecystectomy' },
      'tonsillectomy': { code: '59108006', display: 'Tonsillectomy' },
      'endoscopy': { code: '71651007', display: 'Endoscopic procedure' },
      'biopsy': { code: '86273004', display: 'Biopsy' },
      'mri': { code: '113091000', display: 'Magnetic resonance imaging' },
      'ct scan': { code: '77477000', display: 'Computerized tomography' }
    };
    
    // Find a match
    let found = false;
    for (const [key, value] of Object.entries(snomedMap)) {
      if (normalizedName.includes(key)) {
        coding.push({
          system: 'http://snomed.info/sct',
          code: value.code,
          display: value.display
        });
        found = true;
        break;
      }
    }
    
    // If no SNOMED code found, use a generic code
    if (!found) {
      coding.push({
        system: 'http://snomed.info/sct',
        code: '71388002',
        display: 'Procedure'
      });
    }
  }
  
  // Determine procedure status
  let status: 'preparation' | 'in-progress' | 'completed' | 'entered-in-error' | 'stopped' | 'unknown' = 'unknown';
  
  if (procedureData.status) {
    const normalizedStatus = procedureData.status.toLowerCase().trim();
    if (normalizedStatus.includes('complet')) {
      status = 'completed';
    } else if (normalizedStatus.includes('in progress') || normalizedStatus.includes('ongoing')) {
      status = 'in-progress';
    } else if (normalizedStatus.includes('planned') || normalizedStatus.includes('scheduled')) {
      status = 'preparation';
    } else if (normalizedStatus.includes('cancelled') || normalizedStatus.includes('stopped')) {
      status = 'stopped';
    }
  } else if (procedureData.date && new Date(procedureData.date) <= new Date()) {
    // If date is in the past, assume completed
    status = 'completed';
  }
  
  // Create the procedure
  const procedure: Procedure = {
    resourceType: 'Procedure',
    id,
    status,
    subject: {
      reference: `Patient/${patientId}`
    },
    code: {
      coding,
      text: procedureData.name || 'Procedure'
    }
  };
  
  // Add performed date/time if available
  if (procedureData.date) {
    procedure.performedDateTime = new Date(procedureData.date).toISOString();
  } else if (procedureData.performedDateTime) {
    procedure.performedDateTime = new Date(procedureData.performedDateTime).toISOString();
  } else if (status === 'completed') {
    procedure.performedDateTime = new Date().toISOString();
  }
  
  // Add location if available
  if (procedureData.location) {
    procedure.location = {
      display: procedureData.location
    };
  }
  
  // Add performer if available
  if (procedureData.performer) {
    procedure.performer = [
      {
        actor: {
          display: procedureData.performer
        }
      }
    ];
  }
  
  // Add reason if available
  if (procedureData.reason) {
    procedure.reasonCode = [
      {
        text: procedureData.reason
      }
    ];
  }
  
  // Add outcome if available
  if (procedureData.outcome) {
    procedure.outcome = {
      text: procedureData.outcome
    };
  }
  
  // Add complications if available
  if (procedureData.complications) {
    const complications = Array.isArray(procedureData.complications) ? 
      procedureData.complications : [procedureData.complications];
      
    procedure.complication = complications.map((complication: string) => ({
      text: complication
    }));
  }
  
  return procedure;
}

/**
 * Convert family history data to FHIR FamilyMemberHistory
 */
export function convertToFamilyMemberHistory(
  familyHistoryData: any,
  patientId: string,
  id?: string
): FamilyMemberHistory {
  // Create relationship coding
  let relationshipCoding: Coding[] = [];
  
  if (familyHistoryData.relationship) {
    const normalizedRelationship = familyHistoryData.relationship.toLowerCase().trim();
    
    // Map common relationships to SNOMED CT codes
    const relationshipMap: { [key: string]: { code: string, display: string } } = {
      'mother': { code: '72705000', display: 'Mother' },
      'father': { code: '66839005', display: 'Father' },
      'sister': { code: '27733009', display: 'Sister' },
      'brother': { code: '70924004', display: 'Brother' },
      'daughter': { code: '66089001', display: 'Daughter' },
      'son': { code: '65616008', display: 'Son' },
      'grandmother': { code: '113157001', display: 'Maternal grandmother' },
      'grandfather': { code: '48385004', display: 'Grandfather' },
      'aunt': { code: '25211005', display: 'Aunt' },
      'uncle': { code: '38048003', display: 'Uncle' }
    };
    
    // Find a match
    let found = false;
    for (const [key, value] of Object.entries(relationshipMap)) {
      if (normalizedRelationship.includes(key)) {
        relationshipCoding = [{
          system: 'http://snomed.info/sct',
          code: value.code,
          display: value.display
        }];
        found = true;
        break;
      }
    }
    
    // If no specific match found, use general relative code
    if (!found) {
      relationshipCoding = [{
        system: 'http://snomed.info/sct',
        code: '35359004',
        display: 'Family member'
      }];
    }
  } else {
    // Default relationship if none provided
    relationshipCoding = [{
      system: 'http://snomed.info/sct',
      code: '35359004',
      display: 'Family member'
    }];
  }
  
  // Create the family member history
  const familyHistory: FamilyMemberHistory = {
    resourceType: 'FamilyMemberHistory',
    id,
    status: 'completed',
    patient: {
      reference: `Patient/${patientId}`
    },
    relationship: {
      coding: relationshipCoding,
      text: familyHistoryData.relationship || 'Family member'
    },
    date: new Date().toISOString()
  };
  
  // Add name if available
  if (familyHistoryData.name) {
    familyHistory.name = familyHistoryData.name;
  }
  
  // Add sex if available
  if (familyHistoryData.sex) {
    familyHistory.sex = {
      coding: [{
        system: 'http://hl7.org/fhir/administrative-gender',
        code: familyHistoryData.sex.toLowerCase(),
        display: familyHistoryData.sex.charAt(0).toUpperCase() + familyHistoryData.sex.slice(1).toLowerCase()
      }],
      text: familyHistoryData.sex
    };
  }
  
  // Add age information if available
  if (familyHistoryData.age) {
    familyHistory.ageString = familyHistoryData.age.toString();
  }
  
  // Add birth date if available
  if (familyHistoryData.birthDate) {
    familyHistory.bornDate = new Date(familyHistoryData.birthDate).toISOString().split('T')[0];
  }
  
  // Add deceased information if available
  if (familyHistoryData.deceased === true) {
    familyHistory.deceasedBoolean = true;
    
    if (familyHistoryData.deceasedDate) {
      familyHistory.deceasedDate = new Date(familyHistoryData.deceasedDate).toISOString().split('T')[0];
    }
  }
  
  // Add conditions if available
  if (familyHistoryData.conditions) {
    const conditions = Array.isArray(familyHistoryData.conditions) ? 
      familyHistoryData.conditions : [familyHistoryData.conditions];
      
    familyHistory.condition = conditions.map((condition: any) => {
      const conditionObj: any = {
        code: {
          text: typeof condition === 'string' ? condition : condition.name || 'Unknown condition'
        }
      };
      
      // Add onset information if available
      if (condition.onsetAge) {
        conditionObj.onsetString = condition.onsetAge.toString();
      }
      
      // Add outcome information if available
      if (condition.outcome) {
        conditionObj.outcome = {
          text: condition.outcome
        };
      }
      
      // Add contributed to death information if available
      if (condition.contributedToDeath) {
        conditionObj.contributedToDeath = true;
      }
      
      return conditionObj;
    });
  }
  
  return familyHistory;
}

/**
 * Convert imaging data to FHIR ImagingStudy
 */
export function convertToImagingStudy(
  imagingData: any,
  patientId: string,
  id?: string
): ImagingStudy {
  // Generate a unique DICOM UID if not provided
  const studyUid = imagingData.studyUid || `2.25.${Math.floor(Math.random() * 100000000000000)}`;
  
  // Create the imaging study
  const imagingStudy: ImagingStudy = {
    resourceType: 'ImagingStudy',
    id,
    status: 'available',
    subject: {
      reference: `Patient/${patientId}`
    },
    identifier: [
      {
        system: 'urn:dicom:uid',
        value: studyUid
      }
    ]
  };
  
  // Add started time if available
  if (imagingData.date) {
    imagingStudy.started = new Date(imagingData.date).toISOString();
  } else {
    imagingStudy.started = new Date().toISOString();
  }
  
  // Add description if available
  if (imagingData.description) {
    imagingStudy.description = imagingData.description;
  } else if (imagingData.name) {
    imagingStudy.description = imagingData.name;
  }
  
  // Add modality coding if available
  if (imagingData.modality) {
    // Map common modalities to DICOM codes
    const modalityMap: { [key: string]: { code: string, display: string } } = {
      'ct': { code: 'CT', display: 'Computed Tomography' },
      'mr': { code: 'MR', display: 'Magnetic Resonance' },
      'mri': { code: 'MR', display: 'Magnetic Resonance' },
      'us': { code: 'US', display: 'Ultrasound' },
      'xr': { code: 'CR', display: 'Computed Radiography' },
      'x-ray': { code: 'CR', display: 'Computed Radiography' },
      'nm': { code: 'NM', display: 'Nuclear Medicine' },
      'pet': { code: 'PT', display: 'Positron Emission Tomography' },
      'dx': { code: 'DX', display: 'Digital Radiography' }
    };
    
    const normalizedModality = imagingData.modality.toLowerCase().trim();
    let modalityCode = 'OT'; // Other
    let modalityDisplay = 'Other';
    
    // Find a match
    for (const [key, value] of Object.entries(modalityMap)) {
      if (normalizedModality.includes(key)) {
        modalityCode = value.code;
        modalityDisplay = value.display;
        break;
      }
    }
    
    imagingStudy.modality = [
      {
        system: 'http://dicom.nema.org/resources/ontology/DCM',
        code: modalityCode,
        display: modalityDisplay
      }
    ];
  }
  
  // Add series if available
  if (imagingData.series) {
    const series = Array.isArray(imagingData.series) ? 
      imagingData.series : [imagingData.series];
      
    imagingStudy.series = series.map((seriesItem: any, index: number) => {
      // Generate a unique series UID
      const seriesUid = seriesItem.uid || `${studyUid}.${index + 1}`;
      
      // Determine modality for this series
      let modality: Coding = {
        system: 'http://dicom.nema.org/resources/ontology/DCM',
        code: 'OT',
        display: 'Other'
      };
      
      if (seriesItem.modality) {
        modality.code = seriesItem.modality;
        modality.display = seriesItem.modality;
      } else if (imagingStudy.modality && imagingStudy.modality.length > 0) {
        modality = imagingStudy.modality[0];
      }
      
      return {
        uid: seriesUid,
        number: index + 1,
        modality: modality,
        description: seriesItem.description || `Series ${index + 1}`,
        numberOfInstances: seriesItem.instances?.length || 1,
        bodySite: seriesItem.bodySite ? {
          system: 'http://snomed.info/sct',
          code: '38266002',
          display: seriesItem.bodySite
        } : undefined,
        instance: seriesItem.instances ? seriesItem.instances.map((instance: any, instIndex: number) => {
          return {
            uid: instance.uid || `${seriesUid}.${instIndex + 1}`,
            sopClass: {
              system: 'urn:ietf:rfc:3986',
              code: '1.2.840.10008.5.1.4.1.1.2',
              display: 'CT Image Storage'
            },
            number: instIndex + 1,
            title: instance.title || `Instance ${instIndex + 1}`
          };
        }) : [
          {
            uid: `${seriesUid}.1`,
            sopClass: {
              system: 'urn:ietf:rfc:3986',
              code: '1.2.840.10008.5.1.4.1.1.2',
              display: 'CT Image Storage'
            },
            number: 1,
            title: 'Image 1'
          }
        ]
      };
    });
  } else {
    // Create a default series if none provided
    const seriesUid = `${studyUid}.1`;
    
    let modality: Coding = {
      system: 'http://dicom.nema.org/resources/ontology/DCM',
      code: 'OT',
      display: 'Other'
    };
    
    if (imagingStudy.modality && imagingStudy.modality.length > 0) {
      modality = imagingStudy.modality[0];
    }
    
    imagingStudy.series = [
      {
        uid: seriesUid,
        number: 1,
        modality: modality,
        description: 'Default Series',
        numberOfInstances: 1,
        instance: [
          {
            uid: `${seriesUid}.1`,
            sopClass: {
              system: 'urn:ietf:rfc:3986',
              code: '1.2.840.10008.5.1.4.1.1.2',
              display: 'CT Image Storage'
            },
            number: 1,
            title: 'Image 1'
          }
        ]
      }
    ];
  }
  
  // Add number of series and instances
  imagingStudy.numberOfSeries = imagingStudy.series?.length || 0;
  imagingStudy.numberOfInstances = imagingStudy.series?.reduce((total, series) => 
    total + (series.numberOfInstances || 0), 0) || 0;
  
  return imagingStudy;
}

/**
 * Convert to DiagnosticReport for imaging
 */
export function convertToDiagnosticReportImaging(
  reportData: any,
  patientId: string,
  imagingStudyId?: string,
  id?: string
): DiagnosticReportImaging {
  const report: DiagnosticReportImaging = {
    resourceType: 'DiagnosticReport',
    id,
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
    code: {
      coding: [{
        system: 'http://loinc.org',
        code: '18748-4',
        display: 'Diagnostic imaging report'
      }],
      text: reportData.name || 'Imaging Report'
    },
    subject: {
      reference: `Patient/${patientId}`
    },
    effectiveDateTime: reportData.date ? new Date(reportData.date).toISOString() : new Date().toISOString(),
    issued: reportData.issued ? new Date(reportData.issued).toISOString() : new Date().toISOString(),
    conclusion: reportData.conclusion || reportData.impression || reportData.briefSummary || ''
  };
  
  // Add imaging study reference if provided
  if (imagingStudyId) {
    report.imagingStudy = [
      {
        reference: `ImagingStudy/${imagingStudyId}`
      }
    ];
  }
  
  // Add media if available
  if (reportData.images) {
    const images = Array.isArray(reportData.images) ? 
      reportData.images : [reportData.images];
      
    report.media = images.map((image: any, index: number) => ({
      comment: image.comment || `Image ${index + 1}`,
      link: {
        display: image.title || `Image ${index + 1}`,
        reference: image.reference || `Media/${index + 1}`
      }
    }));
  }
  
  // Add result references if available
  if (reportData.observationIds) {
    report.result = reportData.observationIds.map((id: string) => ({
      reference: `Observation/${id}`
    }));
  }
  
  // Add presented form if available
  if (reportData.url) {
    report.presentedForm = [
      {
        contentType: reportData.contentType || 'application/pdf',
        url: reportData.url
      }
    ];
  }
  
  return report;
} 