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
  
  // Check for lab report
  if (
    lowerCaseAnalysis.includes('lab report') || 
    lowerCaseAnalysis.includes('laboratory results') || 
    lowerCaseAnalysis.includes('test results') ||
    lowerCaseAnalysis.includes('reference range')
  ) {
    return 'Laboratory Report';
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
    
    // Medications
    'medication': 'Medication List',
    'medications': 'Medication List',
    'medication record': 'Medication List',
    'prescription': 'Medication List',
    'prescriptions': 'Medication List',
    'drug list': 'Medication List',
    
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
    
    // Progress notes
    'progress note': 'Progress Note',
    'soap note': 'Progress Note',
    'clinical note': 'Progress Note',
    'office visit': 'Progress Note',
    
    // Discharge summaries
    'discharge': 'Discharge Summary',
    'hospital discharge': 'Discharge Summary',
    
    // Vital signs
    'vitals': 'Vital Signs',
    'vital signs': 'Vital Signs'
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
  const recordDateFromXml = extractTagContent(analysis, 'DATE');
  if (recordDateFromXml) {
    return recordDateFromXml
      .replace(/^[-–—]+\s*/, '')
      .replace(/\*\*/g, '');
  }
  
  // Try to match the new format with numbered sections
  const numberedRecordDateMatch = analysis.match(/4\.?\s*DATE:?\s*([\s\S]*?)(?=$)/i);
  if (numberedRecordDateMatch && numberedRecordDateMatch[1]) {
    return numberedRecordDateMatch[1].trim()
      .replace(/^[-–—]+\s*/, '')
      .replace(/\*\*/g, '');
  }
  
  // Try to match with just DATE: heading
  const recordDateMatch = analysis.match(/DATE:?\s*([\s\S]*?)(?=$)/i);
  if (recordDateMatch && recordDateMatch[1]) {
    return recordDateMatch[1].trim()
      .replace(/^[-–—]+\s*/, '')
      .replace(/\*\*/g, '');
  }
  
  // Try to extract the date section with double asterisks - more strict pattern
  const doubleAsteriskMatch = analysis.match(/\*\*DATE:\*\*([\s\S]*?)(?=$)/);
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
            
            // Handle potential variants of name tags - use string.match() for better readability
            const nameTag1 = testContent.match(/<Name>([\s\S]*?)<\/Name>/i);
            const nameTag2 = testContent.match(/<n>([\s\S]*?)<\/n>/i);
            
            if (nameTag1) {
              testName = nameTag1[1].trim();
            } else if (nameTag2) {
              testName = nameTag2[1].trim();
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
