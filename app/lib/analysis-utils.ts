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
    return recordTypeFromXml
      .replace(/^[-–—]+\s*/, '')
      .replace(/\*\*/g, '');
  }
  
  // Try to match the new format with numbered sections
  const numberedRecordTypeMatch = analysis.match(/3\.?\s*DOCUMENT TYPE:?\s*([\s\S]*?)(?=4\.?\s*DATE|DATE|$)/i);
  if (numberedRecordTypeMatch && numberedRecordTypeMatch[1]) {
    return numberedRecordTypeMatch[1].trim()
      .replace(/^[-–—]+\s*/, '')
      .replace(/\*\*/g, '');
  }
  
  // Try to match with just DOCUMENT TYPE: heading
  const recordTypeMatch = analysis.match(/DOCUMENT TYPE:?\s*([\s\S]*?)(?=DATE|$)/i);
  if (recordTypeMatch && recordTypeMatch[1]) {
    return recordTypeMatch[1].trim()
      .replace(/^[-–—]+\s*/, '')
      .replace(/\*\*/g, '');
  }
  
  // Try to extract the record type section with double asterisks - more strict pattern
  const doubleAsteriskMatch = analysis.match(/\*\*RECORD_TYPE:\*\*([\s\S]*?)(?=\*\*DATE:|$)/);
  if (doubleAsteriskMatch && doubleAsteriskMatch[1]) {
    return doubleAsteriskMatch[1].trim()
      .replace(/^[-–—]+\s*/, '')
      .replace(/\*\*/g, '');
  }
  
  // If we can't find a specific record type section, return a default value
  return 'Medical Record';
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