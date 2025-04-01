// Import OpenAI directly for fallback
import OpenAI from 'openai';
import { fhirResourcesToDocuments } from './rag-processor';
import { db } from './firebase-admin';
import { VectorStoreIndex, Document, SimpleNodeParser } from 'llamaindex';
import { OpenAI as LlamaOpenAI } from 'llamaindex';
import { OpenAIEmbedding } from '@llamaindex/openai';
import { createEmbeddingModel } from './rag-processor';
import * as llamaCore from '@llamaindex/core';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import * as admin from 'firebase-admin';

// Promisify file system operations
const mkdir = promisify(fs.mkdir);
const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);
const access = promisify(fs.access);

// Define the directory where vector indexes will be stored
const INDEX_DIR = path.join(process.cwd(), '.vector_indexes');

// Ensure index directory exists
try {
  if (!fs.existsSync(INDEX_DIR)) {
    fs.mkdirSync(INDEX_DIR, { recursive: true });
    console.log(`Created vector index directory at ${INDEX_DIR}`);
  }
} catch (error) {
  console.error("Failed to create vector index directory:", error);
}

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

// Cache for vector indexes to avoid rebuilding on every request
const indexCache: Record<string, {
  index: typeof VectorStoreIndex,
  lastUpdate: Date
}> = {};

/**
 * Get record details from the records collection
 * This includes detailedAnalysis, comment, recordType, and recordDate
 * @param userId The user ID
 * @returns A map of record names to their details
 */
async function getRecordDetails(userId: string): Promise<Map<string, any>> {
  console.log(`Fetching record details from records collection for user ${userId}`);
  const recordDetailsMap = new Map<string, any>();
  
  try {
    const recordsCollection = db.collection('users').doc(userId).collection('records');
    const recordsSnapshot = await recordsCollection.get();
    
    console.log(`Found ${recordsSnapshot.size} records in the records collection`);
    
    recordsSnapshot.forEach(doc => {
      const data = doc.data();
      
      // Use record name as the key
      const recordName = data.name || doc.id;
      
      // Extract essential fields
      recordDetailsMap.set(recordName, {
        detailedAnalysis: data.detailedAnalysis || '',
        comment: data.comment || '',
        recordType: data.recordType || '',
        recordDate: data.recordDate || '',
        briefSummary: data.briefSummary || '',
        analysis: data.analysis || ''
      });
    });
    
    return recordDetailsMap;
  } catch (error) {
    console.error(`Error fetching record details: ${error}`);
    return recordDetailsMap;
  }
}

/**
 * Build a vector index using only records collection data
 * This is a simplified approach that avoids FHIR resources entirely
 */
export async function buildUserVectorIndexWithOptions(userId: string, onlySummaryReports: boolean): Promise<any> {
  try {
    console.log(`Building simplified vector index for user ${userId}`);
    
    // Update status to building
    const statusRef = db.collection('users').doc(userId).collection('settings').doc('ragIndex');
    await statusRef.set({
      status: 'building',
      startedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastError: null,
      options: {
        onlySummaryReports
      }
    }, { merge: true });
    
    // Get records directly from the records collection
    const recordsCollection = db.collection('users').doc(userId).collection('records');
    const recordsSnapshot = await recordsCollection.get();
    
    console.log(`Found ${recordsSnapshot.size} records in the records collection`);
    
    if (recordsSnapshot.empty) {
      console.log(`No records found for user ${userId}, not building index`);
      
      // Update status to complete with 0 resources
      await statusRef.set({
        status: 'complete',
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
        resourceCount: 0,
        message: 'No records found to index'
      }, { merge: true });
      
      return null;
    }
    
    // Create documents from records
    const documents: Document[] = [];
    
    recordsSnapshot.forEach(doc => {
      const data = doc.data();
      
      // Create document text from essential fields
      let documentText = '';
      
      if (data.recordType) {
        documentText += `Record Type: ${data.recordType}\n`;
      }
      
      if (data.recordDate) {
        documentText += `Date: ${data.recordDate}\n`;
      }
      
      if (data.detailedAnalysis) {
        documentText += `Analysis: ${data.detailedAnalysis}\n`;
      } else if (data.analysis) {
        documentText += `Analysis: ${data.analysis}\n`;
      } else if (data.briefSummary) {
        documentText += `Summary: ${data.briefSummary}\n`;
      }
      
      if (data.comment) {
        documentText += `Comment: ${data.comment}\n`;
      }
      
      // Only add documents with actual content
      if (documentText.trim()) {
        documents.push(new Document({
          text: documentText,
          metadata: {
            id: doc.id,
            name: data.name || doc.id,
            recordType: data.recordType || 'Unknown',
            recordDate: data.recordDate || '',
          }
        }));
      }
    });
    
    console.log(`Created ${documents.length} documents from records`);
    
    if (documents.length === 0) {
      console.log(`No valid documents created, not building index`);
      
      // Update status to complete with 0 resources
      await statusRef.set({
        status: 'complete',
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
        resourceCount: 0,
        message: 'No valid documents created'
      }, { merge: true });
      
      return null;
    }
    
    // Create embedding model
    const embedModel = createEmbeddingModel();
    
    // Create service context for the index
    const serviceContext = {
      nodeParser: new SimpleNodeParser(),
      llm: new LlamaOpenAI({
        model: 'gpt-3.5-turbo',
        temperature: 0.1,
      }),
      embedModel,
    };
    
    // Create vector index
    const index = await VectorStoreIndex.fromDocuments(documents, { serviceContext });
    
    // Cache the index in memory
    indexCache[userId] = {
      index,
      lastUpdate: new Date()
    };
    
    console.log(`Built in-memory vector index for user ${userId} with ${documents.length} documents`);
    
    // Update status to complete
    console.log(`Updating index status to complete for user ${userId}`);
    await statusRef.set({
      status: 'complete',
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
      resourceCount: documents.length
    }, { merge: true });
    
    return index;
  } catch (error) {
    console.error(`Error building vector index for user ${userId}:`, error);
    
    // Update status to error
    try {
      console.log(`Updating index status to error for user ${userId}`);
      const statusRef = db.collection('users').doc(userId).collection('settings').doc('ragIndex');
      await statusRef.set({
        status: 'error',
        errorAt: admin.firestore.FieldValue.serverTimestamp(),
        lastError: error instanceof Error ? error.message : String(error)
      }, { merge: true });
    } catch (updateError) {
      console.error(`Error updating index status: ${updateError}`);
    }
    
    throw error;
  }
}

/**
 * Get resources of a specific type for a user
 * @param userId The user ID
 * @param resourceType The FHIR resource type
 * @returns The resources of the specified type
 */
export async function getResourcesByType(userId: string, resourceType: string): Promise<any[]> {
  console.log(`Fetching resources of type ${resourceType} for user ${userId}...`);
  try {
    const resources: any[] = [];
    
    // Try the users/{userId}/fhir_resources collection
    const fhirResourcesRef = db.collection('users').doc(userId).collection('fhir_resources');
    const query = fhirResourcesRef.where('resourceType', '==', resourceType);
    const snapshot = await query.get();
    
    if (!snapshot.empty) {
      console.log(`Found ${snapshot.size} ${resourceType} resources in users/fhir_resources`);
      resources.push(...snapshot.docs.map(doc => doc.data()));
    }
    
    // If no results, try the legacy fhir collection (for backward compatibility)
    if (resources.length === 0) {
      console.log(`No results in fhir_resources collection, trying 'fhir' collection...`);
      const fhirRef = db.collection('users').doc(userId).collection('fhir');
      const altQuery = fhirRef.where('resourceType', '==', resourceType);
      const altSnapshot = await altQuery.get();
      
      console.log(`Found ${altSnapshot.size} resources in 'fhir' collection`);
      resources.push(...altSnapshot.docs.map(doc => doc.data()));
    }
    
    console.log(`Total ${resourceType} resources found: ${resources.length}`);
    return resources;
  } catch (error) {
    console.error(`Error fetching ${resourceType} resources:`, error);
    return [];
  }
}

/**
 * Check if a resource is a wearable-generated observation
 */
function isWearableObservation(resource: any): boolean {
  // Check if it's an observation
  if (resource.resourceType !== 'Observation') {
    return false;
  }
  
  // Check for device information indicating wearable source
  if (resource.device?.display) {
    const deviceName = resource.device.display.toLowerCase();
    return (
      deviceName.includes('fitbit') || 
      deviceName.includes('garmin') || 
      deviceName.includes('apple watch') || 
      deviceName.includes('samsung') ||
      deviceName.includes('whoop') ||
      deviceName.includes('withings') ||
      deviceName.includes('oura') ||
      deviceName.includes('dexcom')
    );
  }
  
  // Check for common wearable measurement codes
  if (resource.code?.coding) {
    const codes = resource.code.coding.map((c: any) => c.code);
    const wearableCodes = [
      '8867-4',   // Heart rate
      '41950-7',  // Steps
      '93832-4',  // Sleep duration
      '41981-2',  // Calories burned
      '41982-0',  // Activity
      '85530-4'   // Distance
    ];
    
    return codes.some((c: string) => wearableCodes.includes(c));
  }
  
  return false;
}

/**
 * Check if a resource is a wearable summary report rather than individual data point
 */
function isWearableSummaryReport(resource: any): boolean {
  // Check if it's a DiagnosticReport
  if (resource.resourceType === 'DiagnosticReport') {
    // Check for references to wearable devices in the report
    if (resource.category) {
      const categories = Array.isArray(resource.category) ? resource.category : [resource.category];
      for (const category of categories) {
        if (category.coding) {
          for (const coding of category.coding) {
            if (coding.display && typeof coding.display === 'string') {
              const display = coding.display.toLowerCase();
              if (display.includes('wearable') || display.includes('fitness') || 
                  display.includes('activity') || display.includes('summary')) {
                return true;
              }
            }
          }
        }
      }
    }
    
    // Check if title/name indicates it's a summary
    if (resource.title && typeof resource.title === 'string') {
      const title = resource.title.toLowerCase();
      return title.includes('summary') || title.includes('report') || title.includes('wearable') || 
             title.includes('activity') || title.includes('fitness');
    }
  }
  
  // Check for Observation resources that are summaries
  if (resource.resourceType === 'Observation') {
    // Check if it has "summary" or "report" in the code display
    if (resource.code?.coding) {
      for (const coding of resource.code.coding) {
        if (coding.display && typeof coding.display === 'string') {
          const display = coding.display.toLowerCase();
          return display.includes('summary') || display.includes('report') || 
                 display.includes('daily') || display.includes('weekly') ||
                 display.includes('average');
        }
      }
    }
    
    // Look for specific category indicating summary
    if (resource.category) {
      const categories = Array.isArray(resource.category) ? resource.category : [resource.category];
      for (const category of categories) {
        if (category.coding) {
          for (const coding of category.coding) {
            if (coding.display && typeof coding.display === 'string') {
              const display = coding.display.toLowerCase();
              return display.includes('summary') || display.includes('report');
            }
          }
        }
      }
    }
  }
  
  return false;
}

/**
 * Get all FHIR resources for a user
 * @param userId The user ID
 * @param forceRefresh Whether to force refresh the cache
 * @param includeWearables Whether to include wearable data at all
 * @param onlySummaryReports Whether to include only summary reports for wearable data
 * @returns Array of FHIR resources
 */
export async function getUserResources(
  userId: string, 
  forceRefresh = false, 
  includeWearables = true,
  onlySummaryReports = false
): Promise<any[]> {
  try {
    // Check cache
    if (!forceRefresh && userCache[userId] && (new Date().getTime() - userCache[userId].lastUpdate.getTime() < 3600000)) {
      console.log(`Using cached resources for user ${userId}`);
      const resources = userCache[userId].resources;
      
      // If wearables should be excluded entirely, filter them out from cached results
      if (!includeWearables) {
        return resources.filter(resource => 
          resource.resourceType !== 'Observation' || !isWearableObservation(resource)
        );
      }
      
      // If only summary reports should be included, filter out individual data points
      if (onlySummaryReports) {
        return resources.filter(resource => 
          !isWearableObservation(resource) || isWearableSummaryReport(resource)
        );
      }
      
      return resources;
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
      
      // For observations, filter based on wearable options
      if (resourceType === 'Observation') {
        if (!includeWearables) {
          // Exclude all wearable observations
          const filteredObservations = typeResources.filter(obs => !isWearableObservation(obs));
          resources.push(...filteredObservations);
          console.log(`Filtered out ${typeResources.length - filteredObservations.length} wearable observations`);
        } else if (onlySummaryReports) {
          // Include only summary wearable observations
          const filteredObservations = typeResources.filter(obs => 
            !isWearableObservation(obs) || isWearableSummaryReport(obs)
          );
          resources.push(...filteredObservations);
          console.log(`Filtered out ${typeResources.length - filteredObservations.length} individual wearable data points`);
        } else {
          // Include all observations
          resources.push(...typeResources);
        }
      } else if (resourceType === 'DiagnosticReport' && onlySummaryReports) {
        // For diagnostic reports, include only summary reports
        const filteredReports = typeResources.filter(report => 
          !report.code?.coding?.some((c: any) => c.display?.toLowerCase().includes('wearable'))
          || isWearableSummaryReport(report)
        );
        resources.push(...filteredReports);
      } else {
        // Include all other resource types
        resources.push(...typeResources);
      }
    }
    
    console.log(`Retrieved ${resources.length} FHIR resources`);
    
    // Cache the unfiltered resources
    userCache[userId] = {
      resources,
      lastUpdate: new Date()
    };
    
    // Return filtered resources as appropriate
    if (!includeWearables) {
      return resources.filter(resource => 
        resource.resourceType !== 'Observation' || !isWearableObservation(resource)
      );
    } else if (onlySummaryReports) {
      return resources.filter(resource => 
        !isWearableObservation(resource) || isWearableSummaryReport(resource)
      );
    }
    
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
    analysisAreas?: string[],
    includeWearables?: boolean
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
    
    // Get user resources - use includeWearables option to control wearable data inclusion
    const includeWearables = options?.includeWearables ?? true;
    const resources = await getUserResources(userId, options?.forceRefresh, includeWearables);
    
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

/**
 * Find resources relevant to a query
 * @param userId The user ID
 * @param query The search query
 * @param limit The maximum number of resources to return
 * @returns The relevant records
 */
export async function findRelevantResources(
  userId: string, 
  query: string, 
  limit: number = 5
): Promise<any[]> {
  try {
    console.log(`Finding resources relevant to "${query}" for user ${userId}`);
    
    // Check for existing vector index in cache or on disk
    if (!indexCache[userId]) {
      console.log(`No vector index found for user ${userId} in cache`);
      // Check the status of any index building
      try {
        const statusRef = db.collection('users').doc(userId).collection('settings').doc('ragIndex');
        const statusDoc = await statusRef.get();
        
        if (statusDoc.exists) {
          const status = statusDoc.data()?.status;
          if (status === 'building') {
            console.log(`Index is currently being built for user ${userId}`);
            return [];
          }
        }
      } catch (err) {
        console.error('Error checking index status:', err);
      }
      
      console.log(`No vector index available, returning empty result`);
      console.log(`User should use the "Build Index" button in the Analysis page`);
      return [];
    }
    
    // Create a query engine from the index
    const queryEngine = indexCache[userId].index.asQueryEngine();
    const queryResult = await queryEngine.query({ query });
    
    console.log(`Query returned ${queryResult.sourceNodes?.length || 0} source nodes`);
    
    if (!queryResult.sourceNodes || queryResult.sourceNodes.length === 0) {
      console.log(`No relevant records found for query "${query}"`);
      return [];
    }
    
    // Collect the relevant record IDs
    const recordIds = new Set<string>();
    queryResult.sourceNodes.forEach((node: any) => {
      if (node.metadata && node.metadata.id) {
        recordIds.add(node.metadata.id);
      }
    });
    
    console.log(`Found ${recordIds.size} relevant record IDs`);
    
    // Fetch the actual records
    const records: any[] = [];
    
    const recordsCollection = db.collection('users').doc(userId).collection('records');
    
    // Convert Set to Array for iteration
    const recordIdArray = Array.from(recordIds);
    
    for (const recordId of recordIdArray) {
      try {
        const recordDoc = await recordsCollection.doc(recordId).get();
        if (recordDoc.exists) {
          const record = recordDoc.data();
          records.push({
            id: recordDoc.id,
            ...record
          });
        }
      } catch (err) {
        console.error(`Error fetching record ${recordId}:`, err);
      }
      
      // Stop once we reach the limit
      if (records.length >= limit) {
        break;
      }
    }
    
    console.log(`Returning ${records.length} relevant records`);
    
    // Sort by date, most recent first
    return records
      .sort((a, b) => {
        const dateA = new Date(a.recordDate || 0);
        const dateB = new Date(b.recordDate || 0);
        return dateB.getTime() - dateA.getTime();
      });
  } catch (error) {
    console.error(`Error finding relevant resources:`, error);
    return [];
  }
} 