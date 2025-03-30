/**
 * Utility functions for extracting and parsing health record analysis data
 */

/**
 * Extract content from XML-like tags
 * @param text The text to extract from
 * @param tagName The name of the tag to extract
 * @returns The content inside the tag, or null if not found
 */
export const extractTagContent = (text: string, tagName: string): string | null => {
  if (!text) return null;
  const regex = new RegExp(`<${tagName}>\\s*([\\s\\S]*?)\\s*<\\/${tagName}>`, 'i');
  const match = text.match(regex);
  return match ? match[1].trim() : null;
};

/**
 * Extract brief summary from analysis text
 * @param analysis The analysis text
 * @returns The brief summary
 */
export const extractBriefSummary = (analysis: string): string => {
  if (!analysis) return 'No analysis available';
  
  // First try to extract using XML-like tags (new format)
  const briefSummaryFromXml = extractTagContent(analysis, 'BRIEF_SUMMARY');
  if (briefSummaryFromXml) {
    return briefSummaryFromXml
      .replace(/^[-–—]+\s*/, '')
      .replace(/===\s*[^=]+\s*===/g, '')
      .replace(/\*\*/g, '');
  }
  
  // Try to match the new format with numbered sections
  const numberedBriefSummaryMatch = analysis.match(/2\.?\s*BRIEF SUMMARY:?\s*([\s\S]*?)(?=3\.?\s*DOCUMENT TYPE|DOCUMENT TYPE|$)/i);
  if (numberedBriefSummaryMatch && numberedBriefSummaryMatch[1]) {
    // Remove file headers like "=== Shared Health Summary.pdf ==="
    return numberedBriefSummaryMatch[1].trim()
      .replace(/^[-–—]+\s*/, '')
      .replace(/===\s*[^=]+\s*===/g, '')
      .replace(/\*\*/g, '');
  }
  
  // Try to match with just BRIEF SUMMARY: heading
  const briefSummaryMatch = analysis.match(/BRIEF SUMMARY:?\s*([\s\S]*?)(?=DOCUMENT TYPE|TYPE|DATE|$)/i);
  if (briefSummaryMatch && briefSummaryMatch[1]) {
    // Remove file headers like "=== Shared Health Summary.pdf ==="
    return briefSummaryMatch[1].trim()
      .replace(/^[-–—]+\s*/, '')
      .replace(/===\s*[^=]+\s*===/g, '')
      .replace(/\*\*/g, '');
  }
  
  // Try to extract the brief summary section with double asterisks - more strict pattern
  const doubleAsteriskMatch = analysis.match(/\*\*BRIEF_SUMMARY:\*\*([\s\S]*?)(?=\*\*RECORD_TYPE:|$)/);
  if (doubleAsteriskMatch && doubleAsteriskMatch[1]) {
    // Remove file headers like "=== Shared Health Summary.pdf ==="
    return doubleAsteriskMatch[1].trim()
      .replace(/^[-–—]+\s*/, '')
      .replace(/===\s*[^=]+\s*===/g, '')
      .replace(/\*\*/g, '');
  }
  
  // If we can't find a specific brief summary section, return a default message
  return 'No brief summary available';
};

/**
 * Extract detailed analysis from analysis text
 * @param analysis The analysis text
 * @returns The detailed analysis
 */
export const extractDetailedAnalysis = (analysis: string): string => {
  if (!analysis) return 'No analysis available';
  
  // First try to extract using XML-like tags (new format)
  const detailedAnalysisFromXml = extractTagContent(analysis, 'DETAILED_ANALYSIS');
  if (detailedAnalysisFromXml) {
    return detailedAnalysisFromXml
      .replace(/^[-–—]+\s*/, '')
      .replace(/===\s*[^=]+\s*===/g, '')
      .replace(/\*\*/g, '');
  }
  
  // Try to match the new format with numbered sections
  const numberedDetailedAnalysisMatch = analysis.match(/1\.?\s*DETAILED ANALYSIS:?\s*([\s\S]*?)(?=2\.?\s*BRIEF SUMMARY|BRIEF SUMMARY|$)/i);
  if (numberedDetailedAnalysisMatch && numberedDetailedAnalysisMatch[1]) {
    // Remove file headers like "=== Shared Health Summary.pdf ==="
    return numberedDetailedAnalysisMatch[1].trim()
      .replace(/^[-–—]+\s*/, '')
      .replace(/===\s*[^=]+\s*===/g, '')
      .replace(/\*\*/g, '');
  }
  
  // Try to match with just DETAILED ANALYSIS: heading
  const detailedAnalysisMatch = analysis.match(/DETAILED ANALYSIS:?\s*([\s\S]*?)(?=BRIEF SUMMARY|SUMMARY|DOCUMENT TYPE|DATE|$)/i);
  if (detailedAnalysisMatch && detailedAnalysisMatch[1]) {
    // Remove file headers like "=== Shared Health Summary.pdf ==="
    return detailedAnalysisMatch[1].trim()
      .replace(/^[-–—]+\s*/, '')
      .replace(/===\s*[^=]+\s*===/g, '')
      .replace(/\*\*/g, '');
  }
  
  // Try to extract the detailed analysis section with double asterisks - more strict pattern
  const doubleAsteriskMatch = analysis.match(/\*\*DETAILED_ANALYSIS:\*\*([\s\S]*?)(?=\*\*BRIEF_SUMMARY:|$)/);
  if (doubleAsteriskMatch && doubleAsteriskMatch[1]) {
    // Remove file headers like "=== Shared Health Summary.pdf ==="
    return doubleAsteriskMatch[1].trim()
      .replace(/^[-–—]+\s*/, '')
      .replace(/===\s*[^=]+\s*===/g, '')
      .replace(/\*\*/g, '');
  }
  
  // If we can't find a specific detailed analysis section, return a default message
  return 'No detailed analysis available';
};

/**
 * Extract record type from analysis text
 * @param analysis The analysis text
 * @returns The record type
 */
export const extractRecordType = (analysis: string): string => {
  if (!analysis) return 'Unknown';
  
  // First try to extract using XML-like tags (new format)
  const recordTypeFromXml = extractTagContent(analysis, 'DOCUMENT_TYPE');
  if (recordTypeFromXml) {
    return normalizeRecordType(recordTypeFromXml);
  }
  
  // Try to match the new format with numbered sections
  const numberedRecordTypeMatch = analysis.match(/3\.?\s*DOCUMENT TYPE:?\s*([\s\S]*?)(?=4\.?\s*DATE|DATE|$)/i);
  if (numberedRecordTypeMatch && numberedRecordTypeMatch[1]) {
    return normalizeRecordType(numberedRecordTypeMatch[1].trim());
  }
  
  // Try to match with just DOCUMENT TYPE: heading
  const recordTypeMatch = analysis.match(/DOCUMENT TYPE:?\s*([\s\S]*?)(?=DATE|$)/i);
  if (recordTypeMatch && recordTypeMatch[1]) {
    return normalizeRecordType(recordTypeMatch[1].trim());
  }
  
  // Try to extract the record type section with double asterisks - more strict pattern
  const doubleAsteriskMatch = analysis.match(/\*\*RECORD_TYPE:\*\*([\s\S]*?)(?=\*\*DATE:|$)/);
  if (doubleAsteriskMatch && doubleAsteriskMatch[1]) {
    return normalizeRecordType(doubleAsteriskMatch[1].trim());
  }
  
  // Attempt to identify record type based on content patterns
  const lowerCaseAnalysis = analysis.toLowerCase();
  
  // Check for medication-related keywords
  if (
    lowerCaseAnalysis.includes('medication list') || 
    lowerCaseAnalysis.includes('prescribed medication') || 
    lowerCaseAnalysis.includes('current medications') ||
    lowerCaseAnalysis.includes('drug name') ||
    (lowerCaseAnalysis.includes('dosage') && lowerCaseAnalysis.includes('frequency'))
  ) {
    return 'Medication List';
  }
  
  // Check for laboratory/pathology reports first (since pathology reports are a type of lab report)
  if (
    lowerCaseAnalysis.includes('lab report') || 
    lowerCaseAnalysis.includes('laboratory results') || 
    lowerCaseAnalysis.includes('test results') ||
    lowerCaseAnalysis.includes('reference range') ||
    lowerCaseAnalysis.includes('pathology') ||
    lowerCaseAnalysis.includes('specimen') ||
    lowerCaseAnalysis.includes('biopsy') ||
    lowerCaseAnalysis.includes('histology') ||
    lowerCaseAnalysis.includes('cytology') ||
    lowerCaseAnalysis.includes('microscopic') ||
    lowerCaseAnalysis.includes('macroscopic')
  ) {
    return 'Laboratory Report';
  }
  
  // Check for immunization-related keywords
  if (
    lowerCaseAnalysis.includes('immunization') || 
    lowerCaseAnalysis.includes('vaccination') || 
    lowerCaseAnalysis.includes('vaccine') || 
    lowerCaseAnalysis.includes('booster') ||
    lowerCaseAnalysis.includes('flu shot')
  ) {
    return 'Immunization Record';
  }
  
  // Check for allergy-related keywords
  if (
    lowerCaseAnalysis.includes('allergy list') || 
    lowerCaseAnalysis.includes('known allergies') || 
    lowerCaseAnalysis.includes('drug allergies') || 
    lowerCaseAnalysis.includes('food allergies') ||
    (lowerCaseAnalysis.includes('allergen') && lowerCaseAnalysis.includes('reaction'))
  ) {
    return 'Allergy List';
  }
  
  // Check for condition or problem list
  if (
    lowerCaseAnalysis.includes('problem list') || 
    lowerCaseAnalysis.includes('diagnosis list') || 
    lowerCaseAnalysis.includes('medical conditions') || 
    lowerCaseAnalysis.includes('chronic conditions')
  ) {
    return 'Problem List';
  }
  
  // Check for radiology report
  if (
    lowerCaseAnalysis.includes('radiology') || 
    lowerCaseAnalysis.includes('x-ray') || 
    lowerCaseAnalysis.includes('mri') || 
    lowerCaseAnalysis.includes('ct scan') ||
    lowerCaseAnalysis.includes('ultrasound')
  ) {
    return 'Radiology Report';
  }
  
  // Check for discharge summary
  if (
    lowerCaseAnalysis.includes('discharge summary') || 
    lowerCaseAnalysis.includes('discharged from') || 
    lowerCaseAnalysis.includes('hospital course')
  ) {
    return 'Discharge Summary';
  }
  
  // Check for progress note
  if (
    lowerCaseAnalysis.includes('progress note') || 
    lowerCaseAnalysis.includes('soap note') || 
    lowerCaseAnalysis.includes('clinical note')
  ) {
    return 'Progress Note';
  }
  
  // Check for vital signs
  if (
    lowerCaseAnalysis.includes('vital signs') || 
    lowerCaseAnalysis.includes('blood pressure') || 
    (lowerCaseAnalysis.includes('pulse') && lowerCaseAnalysis.includes('temperature'))
  ) {
    return 'Vital Signs';
  }
  
  // If we can't find a specific record type section, return a default value
  return 'Medical Record';
};

/**
 * Normalize record type by removing special characters and standardizing common types
 * @param recordType The raw record type string
 * @returns Normalized record type
 */
const normalizeRecordType = (recordType: string): string => {
  const cleaned = recordType
    .replace(/^[-–—]+\s*/, '')
    .replace(/\*\*/g, '')
    .trim();
  
  // Normalize common record types to standard names
  const lowerType = cleaned.toLowerCase();
  
  // Map common variations to standard names
  const typeMap: { [key: string]: string } = {
    // Lab reports
    'lab result': 'Laboratory Report',
    'lab results': 'Laboratory Report',
    'laboratory result': 'Laboratory Report',
    'laboratory test': 'Laboratory Report',
    'blood test': 'Laboratory Report',
    'blood work': 'Laboratory Report',
    'pathology': 'Laboratory Report',
    'pathology report': 'Laboratory Report',
    'biopsy': 'Laboratory Report',
    'biopsy result': 'Laboratory Report',
    'histology': 'Laboratory Report',
    'cytology': 'Laboratory Report',
    'microscopic analysis': 'Laboratory Report',
    'microbiology': 'Laboratory Report',
    'observation': 'Laboratory Report',
    'diagnosticreport': 'Laboratory Report',
    
    // Medications
    'medication': 'Medication List',
    'medications': 'Medication List',
    'medication record': 'Medication List',
    'prescription': 'Medication List',
    'prescriptions': 'Medication List',
    'drug list': 'Medication List',
    'medicationstatement': 'Medication List',
    
    // Immunizations
    'immunization': 'Immunization Record',
    'immunizations': 'Immunization Record',
    'vaccination': 'Immunization Record',
    'vaccinations': 'Immunization Record',
    'vaccine record': 'Immunization Record',
    
    // Allergies
    'allergy': 'Allergy List',
    'allergies': 'Allergy List',
    'allergy record': 'Allergy List',
    'drug allergies': 'Allergy List',
    'food allergies': 'Allergy List',
    'allergyintolerance': 'Allergy List',
    
    // Conditions/Problems
    'problem list': 'Problem List',
    'problems': 'Problem List',
    'diagnosis': 'Problem List',
    'diagnoses': 'Problem List',
    'condition': 'Problem List',
    'conditions': 'Problem List',
    'medical problems': 'Problem List',
    
    // Radiology
    'xray': 'Radiology Report',
    'x-ray': 'Radiology Report',
    'ct scan': 'Radiology Report',
    'mri': 'Radiology Report',
    'ultrasound': 'Radiology Report',
    'imaging': 'Radiology Report',
    'imagingstudy': 'Radiology Report',
    
    // Progress notes
    'progress note': 'Progress Note',
    'soap note': 'Progress Note',
    'clinical note': 'Progress Note',
    'office visit': 'Progress Note',
    'encounter': 'Progress Note',
    
    // Discharge summaries
    'discharge summary': 'Discharge Summary',
    'hospital discharge': 'Discharge Summary',
    'discharge note': 'Discharge Summary',
    
    // Vital signs
    'vital signs': 'Vital Signs',
    'vitals': 'Vital Signs',
    'blood pressure': 'Vital Signs',
    
    // Procedures
    'procedure': 'Procedure',
    'surgery': 'Procedure',
    'surgical report': 'Procedure',
    'operative report': 'Procedure',
    
    // Family history
    'family history': 'Family History',
    'family medical history': 'Family History',
    'familymemberhistory': 'Family History',
    
    // Documents
    'document': 'Medical Record',
    'documentreference': 'Medical Record',
    'medical record': 'Medical Record'
  };
  
  // Check if any key in the map is contained in the lower type
  for (const [key, value] of Object.entries(typeMap)) {
    if (lowerType.includes(key)) {
      return value;
    }
  }
  
  // If no match found, keep the original cleaned string
  // Just capitalize first letter of each word
  return cleaned.replace(/\w\S*/g, (w) => (w.replace(/^\w/, (c) => c.toUpperCase())));
};

/**
 * Extract record date from analysis text
 * @param analysis The analysis text
 * @returns The record date
 */
export const extractRecordDate = (analysis: string): string => {
  if (!analysis) return '';
  
  // First try to extract using XML-like tags (new format)
  const recordDateFromXml = extractTagContent(analysis, 'DOCUMENT_DATE');
  if (recordDateFromXml) {
    return recordDateFromXml
      .replace(/^[-–—]+\s*/, '')
      .replace(/\*\*/g, '');
  }
  
  // Try to match the new format with numbered sections
  // Limit capture to reasonable date length (up to 30 chars)
  const numberedRecordDateMatch = analysis.match(/4\.?\s*DATE:?\s*([\s\S]{1,30}?)(?=5\.|\n\n|$)/i);
  if (numberedRecordDateMatch && numberedRecordDateMatch[1]) {
    return numberedRecordDateMatch[1].trim()
      .replace(/^[-–—]+\s*/, '')
      .replace(/\*\*/g, '');
  }
  
  // Try to match with just DATE: heading
  // Limit capture to reasonable date length (up to 30 chars)
  const recordDateMatch = analysis.match(/DATE:?\s*([\s\S]{1,30}?)(?=\n\n|$)/i);
  if (recordDateMatch && recordDateMatch[1]) {
    return recordDateMatch[1].trim()
      .replace(/^[-–—]+\s*/, '')
      .replace(/\*\*/g, '');
  }
  
  // Try to extract the date section with double asterisks - more strict pattern
  const doubleAsteriskMatch = analysis.match(/\*\*DATE:\*\*([\s\S]{1,30}?)(?=\*\*|\n\n|$)/);
  if (doubleAsteriskMatch && doubleAsteriskMatch[1]) {
    return doubleAsteriskMatch[1].trim()
      .replace(/^[-–—]+\s*/, '')
      .replace(/\*\*/g, '');
  }
  
  // If we can't find a specific date section, return an empty string
  return '';
};

/**
 * Extract structured data from analysis text
 * @param analysis The analysis text
 * @returns The structured data as an object
 */
export const extractStructuredData = (analysis: string): any => {
  if (!analysis) return {};
  
  const structuredDataSection = extractTagContent(analysis, 'STRUCTURED_DATA');
  if (!structuredDataSection) return {};
  
  // Get the document type to help with parsing
  const documentType = extractRecordType(analysis);
  
  // Base structured data object
  const structuredData: any = {
    type: documentType
  };
  
  switch (documentType) {
    case 'Laboratory Report':
      structuredData.labTests = parseLabTests(structuredDataSection);
      
      // Check if this is a pathology report without traditional lab values
      if (structuredData.labTests.length === 0 && 
          (structuredDataSection.toLowerCase().includes('pathology') || 
           structuredDataSection.toLowerCase().includes('specimen') ||
           structuredDataSection.toLowerCase().includes('biopsy') ||
           structuredDataSection.toLowerCase().includes('histology') ||
           structuredDataSection.toLowerCase().includes('microscopic'))) {
        
        // Create a generic lab test entry for pathology reports
        const pathologyFindings = extractPathologyFindings(structuredDataSection);
        if (pathologyFindings) {
          structuredData.labTests = [
            {
              name: "Pathology Assessment",
              value: "See details",
              unit: "",
              referenceRange: { low: null, high: null },
              flag: pathologyFindings.includes("normal") ? "Normal" : "See details",
              details: pathologyFindings
            }
          ];
        }
      }
      break;
    case 'Medication List':
      structuredData.medications = parseMedications(structuredDataSection);
      break;
    case 'Immunization Record':
      structuredData.immunizations = parseImmunizations(structuredDataSection);
      break;
    case 'Allergy List':
      structuredData.allergies = parseAllergies(structuredDataSection);
      break;
    case 'Problem List':
      structuredData.conditions = parseConditions(structuredDataSection);
      break;
    default:
      // For other document types, try to parse based on content patterns
      structuredData.items = parseGenericList(structuredDataSection);
  }
  
  return structuredData;
};

/**
 * Extract pathology findings from structured text
 * @param text The structured text
 * @returns Formatted pathology findings
 */
const extractPathologyFindings = (text: string): string => {
  // Extract the most important findings from pathology text
  const importantSections = [
    "diagnosis",
    "impression",
    "conclusion",
    "assessment", 
    "findings",
    "microscopic description",
    "gross description",
    "specimen"
  ];
  
  let findings = "";
  
  // Split text into lines
  const lines = text.split('\n');
  
  // First try to find specific important sections
  for (const section of importantSections) {
    const sectionPattern = new RegExp(`${section}[\\s:]*([\\s\\S]*?)(?=\\n\\s*\\n|$)`, 'i');
    const match = text.match(sectionPattern);
    if (match && match[1]) {
      findings += `${section.charAt(0).toUpperCase() + section.slice(1)}: ${match[1].trim()}\n\n`;
    }
  }
  
  // If we couldn't find any structured sections, extract generic content
  if (!findings) {
    // Extract any line that looks like a finding
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.toLowerCase().includes('format:')) {
        findings += trimmedLine + '\n';
      }
    }
  }
  
  return findings.trim();
};

/**
 * Parse laboratory test data from structured text
 * @param text The structured text
 * @returns Array of lab test objects
 */
const parseLabTests = (text: string): any[] => {
  // Array to hold all lab test results
  const labTests: any[] = [];
  
  // Try to parse XML format first
  try {
    // Check for XML-formatted lab report data
    if (text.includes('<LABORATORY_REPORT>') && text.includes('</LABORATORY_REPORT>')) {
      console.log('Found LABORATORY_REPORT XML format');
      
      // Extract the content within the LABORATORY_REPORT tags
      const labReportMatch = text.match(/<LABORATORY_REPORT>([\s\S]*?)<\/LABORATORY_REPORT>/i);
      if (labReportMatch && labReportMatch[1]) {
        const xmlContent = labReportMatch[1].trim();
        
        // Extract individual test blocks
        const testRegex = /<Test>([\s\S]*?)<\/Test>/gi;
        let testMatch;
        let testCount = 0;
        
        while ((testMatch = testRegex.exec(xmlContent)) !== null) {
          testCount++;
          const testContent = testMatch[1];
          
          try {
            // Extract all possible fields using more robust patterns that support both tag variants
            // Fix the regex patterns to correctly match with either Name or n tag
            let testName = '';
            
            // Simple approach: First check if there's text between <Name> tags
            if (testContent.includes('<Name>') && testContent.includes('</Name>')) {
              const startIndex = testContent.indexOf('<Name>') + 6;
              const endIndex = testContent.indexOf('</Name>');
              if (endIndex > startIndex) {
                testName = testContent.substring(startIndex, endIndex).trim();
              }
            } 
            // If not found, check if there's text between <n> tags
            else if (testContent.includes('<n>') && testContent.includes('</n>')) {
              const startIndex = testContent.indexOf('<n>') + 3;
              const endIndex = testContent.indexOf('</n>');
              if (endIndex > startIndex) {
                testName = testContent.substring(startIndex, endIndex).trim();
              }
            }
            
            if (!testName) continue; // Skip if no name found
            
            // Extract other fields
            const valueMatch = /<Value>([\s\S]*?)<\/Value>/i.exec(testContent);
            const unitMatch = /<Unit>([\s\S]*?)<\/Unit>/i.exec(testContent);
            const rangeMatch = /<Reference-Range>([\s\S]*?)<\/Reference-Range>/i.exec(testContent);
            const flagMatch = /<Flag>([\s\S]*?)<\/Flag>/i.exec(testContent);
            
            // Parse reference range if available
            let low = null;
            let high = null;
            
            if (rangeMatch) {
              const rangeText = rangeMatch[1].trim();
              const rangeParts = rangeText.match(/([\d\.]+)\s*-\s*([\d\.]+)/);
              if (rangeParts) {
                low = parseFloat(rangeParts[1]);
                high = parseFloat(rangeParts[2]);
              }
            }
            
            // Add parsed test to results
            labTests.push({
              name: testName,
              value: valueMatch ? (parseFloat(valueMatch[1]) || valueMatch[1].trim()) : '',
              unit: unitMatch ? unitMatch[1].trim() : '',
              referenceRange: { low, high },
              flag: flagMatch ? flagMatch[1].trim() : 'Normal'
            });
          } catch (error) {
            console.error('Error parsing individual test XML:', error);
          }
        }
        
        console.log(`Extracted ${testCount} tests from XML format, successfully parsed ${labTests.length}`);
        
        if (labTests.length > 0) {
          return labTests;
        }
      }
    }
  } catch (xmlError) {
    console.error('Error parsing XML lab tests:', xmlError);
  }
  
  // Fallback to line-by-line format
  console.log('Falling back to line-by-line lab test parsing');
  
  // Split by newlines and process each line
  const lines = text.split('\n');
  
  for (const line of lines) {
    // Skip empty lines or headers
    if (!line.trim() || line.includes('Format:') || line.includes('Laboratory Reports:')) continue;
    
    try {
      // Look for test name pattern
      const testMatch = line.match(/([^:]+):\s*([^,]+)/);
      if (!testMatch) continue;
      
      const testName = testMatch[1].trim();
      const valueWithUnit = testMatch[2].trim();
      
      // Extract value and unit
      const valueUnitMatch = valueWithUnit.match(/([^a-zA-Z]+)\s*([a-zA-Z%/]+)?/);
      const value = valueUnitMatch ? valueUnitMatch[1].trim() : valueWithUnit;
      const unit = valueUnitMatch && valueUnitMatch[2] ? valueUnitMatch[2].trim() : '';
      
      // Extract reference range
      const refMatch = line.match(/Reference Range:\s*([^,]+)/);
      let low = null;
      let high = null;
      
      if (refMatch) {
        const refRange = refMatch[1].trim();
        const rangeMatch = refRange.match(/([\d\.]+)\s*-\s*([\d\.]+)/);
        if (rangeMatch) {
          low = parseFloat(rangeMatch[1]);
          high = parseFloat(rangeMatch[2]);
        }
      }
      
      // Extract flag
      const flagMatch = line.match(/Flag:\s*([^,\s]+)/);
      const flag = flagMatch ? flagMatch[1].trim() : 'Normal';
      
      // Add to results
      labTests.push({
        name: testName,
        value: parseFloat(value) || value, // Try to convert to number if possible
        unit,
        referenceRange: { low, high },
        flag
      });
    } catch (error) {
      console.error('Error parsing lab test line:', error);
      // Continue to the next line
    }
  }
  
  return labTests;
};

/**
 * Parse medication data from structured text
 * @param text The structured text
 * @returns Array of medication objects
 */
const parseMedications = (text: string): any[] => {
  // Look for patterns like "[Medication Name], [Dosage], [Frequency], [Route], Started: [Date], Purpose: [Reason]"
  const medications: any[] = [];
  
  // Split by newlines and process each line
  const lines = text.split('\n');
  
  for (const line of lines) {
    // Skip empty lines or headers
    if (!line.trim() || line.includes('Format:') || line.includes('Medication Lists:')) continue;
    
    try {
      // Split by commas and colons
      const parts = line.split(/,\s*/);
      if (parts.length < 2) continue;
      
      const name = parts[0].trim();
      const dosage = parts.length > 1 ? parts[1].trim() : '';
      const frequency = parts.length > 2 ? parts[2].trim() : '';
      const route = parts.length > 3 ? parts[3].trim() : '';
      
      // Extract started date
      let startDate = '';
      const startMatch = line.match(/Started:\s*([^,]+)/);
      if (startMatch) {
        startDate = startMatch[1].trim();
      }
      
      // Extract purpose
      let purpose = '';
      const purposeMatch = line.match(/Purpose:\s*([^,]+)/);
      if (purposeMatch) {
        purpose = purposeMatch[1].trim();
      }
      
      // Add to results
      medications.push({
        name,
        dosage,
        frequency,
        route,
        startDate,
        purpose
      });
    } catch (error) {
      console.error('Error parsing medication line:', error);
      // Continue to the next line
    }
  }
  
  return medications;
};

/**
 * Parse immunization data from structured text
 * @param text The structured text
 * @returns Array of immunization objects
 */
const parseImmunizations = (text: string): any[] => {
  // Look for patterns like "[Vaccine Name], Date: [Date], Manufacturer: [Name], Lot: [Number]"
  const immunizations: any[] = [];
  
  // Split by newlines and process each line
  const lines = text.split('\n');
  
  for (const line of lines) {
    // Skip empty lines or headers
    if (!line.trim() || line.includes('Format:') || line.includes('Immunization Records:')) continue;
    
    try {
      // Extract vaccine name (everything before the first comma)
      const nameMatch = line.match(/^([^,]+)/);
      if (!nameMatch) continue;
      
      const name = nameMatch[1].trim();
      
      // Extract date
      let date = '';
      const dateMatch = line.match(/Date:\s*([^,]+)/);
      if (dateMatch) {
        date = dateMatch[1].trim();
      }
      
      // Extract manufacturer
      let manufacturer = '';
      const manufacturerMatch = line.match(/Manufacturer:\s*([^,]+)/);
      if (manufacturerMatch) {
        manufacturer = manufacturerMatch[1].trim();
      }
      
      // Extract lot number
      let lotNumber = '';
      const lotMatch = line.match(/Lot:\s*([^,]+)/);
      if (lotMatch) {
        lotNumber = lotMatch[1].trim();
      }
      
      // Add to results
      immunizations.push({
        name,
        date,
        manufacturer,
        lotNumber
      });
    } catch (error) {
      console.error('Error parsing immunization line:', error);
      // Continue to the next line
    }
  }
  
  return immunizations;
};

/**
 * Parse allergy data from structured text
 * @param text The structured text
 * @returns Array of allergy objects
 */
const parseAllergies = (text: string): any[] => {
  // Look for patterns like "[Allergen], Reaction: [Symptoms], Severity: [Mild/Moderate/Severe], Onset: [Date]"
  const allergies: any[] = [];
  
  // Split by newlines and process each line
  const lines = text.split('\n');
  
  for (const line of lines) {
    // Skip empty lines or headers
    if (!line.trim() || line.includes('Format:') || line.includes('Allergy Lists:')) continue;
    
    try {
      // Extract allergen name (everything before the first comma)
      const nameMatch = line.match(/^([^,]+)/);
      if (!nameMatch) continue;
      
      const name = nameMatch[1].trim();
      
      // Extract reaction
      let reaction = '';
      const reactionMatch = line.match(/Reaction:\s*([^,]+)/);
      if (reactionMatch) {
        reaction = reactionMatch[1].trim();
      }
      
      // Extract severity
      let severity = '';
      const severityMatch = line.match(/Severity:\s*([^,]+)/);
      if (severityMatch) {
        severity = severityMatch[1].trim();
      }
      
      // Extract onset date
      let onset = '';
      const onsetMatch = line.match(/Onset:\s*([^,]+)/);
      if (onsetMatch) {
        onset = onsetMatch[1].trim();
      }
      
      // Add to results
      allergies.push({
        name,
        reaction,
        severity,
        onset
      });
    } catch (error) {
      console.error('Error parsing allergy line:', error);
      // Continue to the next line
    }
  }
  
  return allergies;
};

/**
 * Parse condition/problem data from structured text
 * @param text The structured text
 * @returns Array of condition objects
 */
const parseConditions = (text: string): any[] => {
  // Look for patterns like "[Condition], Status: [Active/Resolved], Onset: [Date], Provider: [Name]"
  const conditions: any[] = [];
  
  // Split by newlines and process each line
  const lines = text.split('\n');
  
  for (const line of lines) {
    // Skip empty lines or headers
    if (!line.trim() || line.includes('Format:') || line.includes('Problem Lists:')) continue;
    
    try {
      // Extract condition name (everything before the first comma)
      const nameMatch = line.match(/^([^,]+)/);
      if (!nameMatch) continue;
      
      const name = nameMatch[1].trim();
      
      // Extract status
      let status = 'Active'; // Default to active
      const statusMatch = line.match(/Status:\s*([^,]+)/);
      if (statusMatch) {
        status = statusMatch[1].trim();
      }
      
      // Extract onset date
      let onsetDate = '';
      const onsetMatch = line.match(/Onset:\s*([^,]+)/);
      if (onsetMatch) {
        onsetDate = onsetMatch[1].trim();
      }
      
      // Extract provider
      let provider = '';
      const providerMatch = line.match(/Provider:\s*([^,]+)/);
      if (providerMatch) {
        provider = providerMatch[1].trim();
      }
      
      // Add to results
      conditions.push({
        name,
        status,
        onsetDate,
        provider
      });
    } catch (error) {
      console.error('Error parsing condition line:', error);
      // Continue to the next line
    }
  }
  
  return conditions;
};

/**
 * Parse generic list items from structured text
 * @param text The structured text
 * @returns Array of generic items
 */
const parseGenericList = (text: string): any[] => {
  // For documents that don't match specific types, extract a simple list
  const items: any[] = [];
  
  // Split by newlines and process each line
  const lines = text.split('\n');
  
  for (const line of lines) {
    // Skip empty lines or headers
    if (!line.trim() || line.includes('Format:')) continue;
    
    // Try to parse key-value pairs
    const keyValueMatch = line.match(/([^:]+):\s*(.+)/);
    if (keyValueMatch) {
      const key = keyValueMatch[1].trim();
      const value = keyValueMatch[2].trim();
      
      items.push({ key, value });
    } else if (line.trim()) {
      // If no key-value pattern, add the whole line as an item
      items.push({ text: line.trim() });
    }
  }
  
  return items;
};

/**
 * Extract FHIR resources from analysis text
 * @param analysis The analysis text
 * @returns Array of FHIR resources or null if not found
 */
export const extractFHIRResources = (analysis: string): any[] | null => {
  if (!analysis) return null;
  
  // Extract FHIR resources using XML-like tags
  const fhirResourcesContent = extractTagContent(analysis, 'FHIR_RESOURCES');
  if (!fhirResourcesContent) return null;
  
  try {
    // Sanitize JSON by removing comments and invalid characters before parsing
    const sanitizedJson = fhirResourcesContent
      // Remove single line comments (// comment)
      .replace(/\/\/.*$/gm, '')
      // Remove multi-line comments (/* comment */)
      .replace(/\/\*[\s\S]*?\*\//gm, '')
      // Clean up any trailing commas in arrays or objects which might have been left after removing comments
      .replace(/,(\s*[\]}])/g, '$1')
      // Replace control characters with proper escaped versions
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, match => {
        if (match === '\n') return '\\n';
        if (match === '\r') return '\\r';
        if (match === '\t') return '\\t';
        return '';
      })
      // Fix escaped quotes and other common JSON issues
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\')
      .replace(/(['"])\1\s*\1\1/g, '$1$1'); // Fix doubled quotes like ""text""
    
    try {
      // Try to parse the JSON array of resources
      const resources = JSON.parse(sanitizedJson);
      
      // Validate that we have an array of resources
      if (Array.isArray(resources)) {
        // Validate each resource has a resourceType
        const validResources = resources.filter(resource => 
          resource && typeof resource === 'object' && resource.resourceType
        );
        
        return validResources;
      }
    } catch (parseError) {
      // If there's a parsing error, try a more aggressive cleaning approach
      console.error('Initial JSON parsing failed, trying more aggressive cleaning:', parseError);
      
      // More aggressive cleaning - replace any character that's not valid in JSON
      const aggressivelySanitized = sanitizedJson
        // Keep only basic ASCII characters that are definitely valid in JSON
        .replace(/[^\x20-\x7E]/g, '')
        // Replace backticks with quotes
        .replace(/`/g, '"')
        // Fix unescaped quotes in strings
        .replace(/"([^"]*)\\?"([^"]*)"/g, '"$1\\"$2"');
      
      // Try parsing again
      const resources = JSON.parse(aggressivelySanitized);
      
      if (Array.isArray(resources)) {
        const validResources = resources.filter(resource => 
          resource && typeof resource === 'object' && resource.resourceType
        );
        
        return validResources;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error parsing FHIR resources:', error);
    return null;
  }
}; 
