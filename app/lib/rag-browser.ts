'use client';

/**
 * Browser-safe version of the RAG service
 * This file contains stub implementations of the RAG functions that can be safely imported in browser contexts
 */

/**
 * Generate a holistic health analysis based on FHIR resources
 * In the browser, this function delegates to the server-side API
 */
export async function generateHolisticAnalysis(
  userId: string,
  profileInfo: string,
  options?: {
    forceRefresh?: boolean,
    analysisAreas?: string[]
  }
): Promise<string> {
  console.log('Browser-side generateHolisticAnalysis called - delegating to API');
  
  // In the browser, we use the analyze API endpoint
  try {
    // This is just a stub function for type compatibility
    // The actual implementation is in the API route
    return "Analysis will be generated through the API";
  } catch (error) {
    console.error('Error in browser RAG stub:', error);
    return "Error: Unable to generate analysis";
  }
} 