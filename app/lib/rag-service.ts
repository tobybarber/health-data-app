// Import OpenAI directly for fallback
import OpenAI from 'openai';
import { fhirResourcesToDocuments } from './rag-processor';
import { db } from './firebase-admin';

// OpenAI client for fallback
let openai: OpenAI | null = null;

try {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY as string,
  });
} catch (error) {
  console.error("Failed to initialize OpenAI client:", error);
}

// Cache for user data to avoid rebuilding on every request
const userCache: Record<string, {
  resources: any[],
  lastUpdate: Date
}> = {};

/**
 * Get resources of a specific type for a user
 * @param userId The user ID
 * @param resourceType The FHIR resource type
 * @returns The resources of the specified type
 */
export async function getResourcesByType(userId: string, resourceType: string): Promise<any[]> {
  console.log(`Fetching resources of type ${resourceType} for user ${userId}...`);
  try {
    // Try the fhir_resources collection first
    const fhirResourcesRef = db.collection('users').doc(userId).collection('fhir_resources');
    const query = fhirResourcesRef.where('resourceType', '==', resourceType);
    const snapshot = await query.get();
    
    if (!snapshot.empty) {
      console.log(`Found ${snapshot.size} ${resourceType} resources`);
      return snapshot.docs.map(doc => doc.data());
    }
    
    // If no results in fhir_resources, try the fhir collection
    console.log(`No results in fhir_resources collection, trying 'fhir' collection...`);
    const fhirRef = db.collection('users').doc(userId).collection('fhir');
    const altQuery = fhirRef.where('resourceType', '==', resourceType);
    const altSnapshot = await altQuery.get();
    
    console.log(`Found ${altSnapshot.size} resources in 'fhir' collection`);
    return altSnapshot.docs.map(doc => doc.data());
  } catch (error) {
    console.error(`Error fetching ${resourceType} resources:`, error);
    return [];
  }
}

/**
 * Get all FHIR resources for a user
 */
export async function getUserResources(userId: string, forceRefresh = false): Promise<any[]> {
  try {
    // Check cache
    if (!forceRefresh && userCache[userId] && (new Date().getTime() - userCache[userId].lastUpdate.getTime() < 3600000)) {
      console.log(`Using cached resources for user ${userId}`);
      return userCache[userId].resources;
    }
    
    const resources: any[] = [];
    
    // Get resources by type
    const resourceTypes = [
      'Observation', 
      'Condition', 
      'DiagnosticReport', 
      'MedicationStatement',
      'AllergyIntolerance',
      'Immunization',
      'Procedure'
    ];
    
    // Collect all resources
    for (const resourceType of resourceTypes) {
      const typeResources = await getResourcesByType(userId, resourceType);
      resources.push(...typeResources);
    }
    
    console.log(`Retrieved ${resources.length} FHIR resources`);
    
    // Cache resources
    userCache[userId] = {
      resources,
      lastUpdate: new Date()
    };
    
    return resources;
  } catch (error) {
    console.error("Error getting user resources:", error);
    return [];
  }
}

/**
 * Generate a holistic health analysis based on FHIR resources
 */
export async function generateHolisticAnalysis(
  userId: string,
  profileInfo: string,
  options?: {
    forceRefresh?: boolean,
    analysisAreas?: string[]
  }
): Promise<string> {
  try {
    // Check if OpenAI client is available
    if (!openai) {
      return `<OVERVIEW>
Error: OpenAI API client is not properly initialized. Please check your API key.
</OVERVIEW>

<KEY_FINDINGS>
The system encountered a technical error while trying to analyze health data.
</KEY_FINDINGS>

<HEALTH_CONCERNS>
Unable to analyze health concerns due to technical issues.
</HEALTH_CONCERNS>`;
    }
    
    // Build default analysis areas if not provided
    const analysisAreas = options?.analysisAreas || [
      "Key health metrics and vital signs",
      "Chronic conditions and management status",
      "Medication adherence and effectiveness",
      "Recent diagnostic tests and findings",
      "Potential health concerns or risks",
      "Preventive care recommendations"
    ];
    
    // Get user resources
    const resources = await getUserResources(userId, options?.forceRefresh);
    
    if (resources.length === 0) {
      return `<OVERVIEW>
No health data available for analysis.
</OVERVIEW>

<KEY_FINDINGS>
No health data was found in the system.
</KEY_FINDINGS>

<HEALTH_CONCERNS>
No health concerns could be identified due to lack of data.
</HEALTH_CONCERNS>`;
    }
    
    // Convert FHIR resources to documents for analysis
    const documents = await fhirResourcesToDocuments(resources);
    
    console.log(`Created ${documents.length} documents for analysis`);
    
    // Create a context message from the document texts
    // Use any type for doc since we don't know the exact structure
    const contextMessage = documents.map((doc: any) => {
      // Check if the document has a text or pageContent property
      if (typeof doc.text === 'string') {
        return doc.text;
      } else if (typeof doc.pageContent === 'string') {
        return doc.pageContent;
      } else if (doc && typeof doc === 'object') {
        // Convert the entire document to a string if no text property is found
        return JSON.stringify(doc);
      }
      return '';
    }).join('\n\n');
    
    // Generate analysis for each area
    const analysisResults = [];
    
    for (const area of analysisAreas) {
      console.log(`Generating analysis for area: ${area}`);
      
      try {
        const response = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content: 'You are a healthcare AI assistant analyzing FHIR health data. Provide concise, insightful analysis focusing on patterns, trends, and actionable insights.'
            },
            {
              role: 'user',
              content: `${profileInfo}\n\nHere is the health data to analyze:\n\n${contextMessage}\n\nBased on this data, provide a concise analysis of ${area}. Focus on providing actionable insights and identifying patterns or trends if present.`
            }
          ],
          temperature: 0.3
        });
        
        const responseText = response.choices[0]?.message?.content || 
          `No analysis available for ${area}`;
        
        analysisResults.push({
          area,
          analysis: responseText
        });
      } catch (error) {
        console.error(`Error analyzing area "${area}":`, error);
        analysisResults.push({
          area,
          analysis: `Error analyzing ${area}: ${error instanceof Error ? error.message : String(error)}`
        });
      }
    }
    
    // Format the holistic analysis with XML tags for structured output
    let formattedAnalysis = "";
    
    formattedAnalysis += "<OVERVIEW>\n";
    formattedAnalysis += "Analysis based on structured FHIR health records using RAG approach.\n";
    formattedAnalysis += "</OVERVIEW>\n\n";
    
    for (const result of analysisResults) {
      formattedAnalysis += `<${result.area.toUpperCase().replace(/\s+/g, "_")}>\n`;
      formattedAnalysis += result.analysis + "\n";
      formattedAnalysis += `</${result.area.toUpperCase().replace(/\s+/g, "_")}>\n\n`;
    }
    
    return formattedAnalysis;
  } catch (error) {
    console.error("Error generating holistic analysis:", error);
    return `<OVERVIEW>
Error generating analysis: ${error instanceof Error ? error.message : String(error)}
</OVERVIEW>

<KEY_FINDINGS>
The system encountered a technical error while generating the analysis.
</KEY_FINDINGS>

<TECHNICAL_DETAILS>
The error occurred in the generateHolisticAnalysis function.
</TECHNICAL_DETAILS>`;
  }
} 