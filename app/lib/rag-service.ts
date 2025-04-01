// Import OpenAI directly for fallback
import OpenAI from 'openai';
import { fhirResourcesToDocuments } from './rag-processor';
import { db } from './firebase-admin';
import { VectorStoreIndex, Document, SimpleNodeParser, ServiceContext } from 'llamaindex';
import { OpenAI as LlamaOpenAI } from 'llamaindex';
import { OpenAIEmbedding } from '@llamaindex/openai';
import { createEmbeddingModel } from './rag-processor';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

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

// Function to get the path for a user's vector index
function getUserIndexPath(userId: string): string {
  return path.join(INDEX_DIR, `${userId}_index.json`);
}

// Function to get the path for a user's vector index metadata
function getUserIndexMetadataPath(userId: string): string {
  return path.join(INDEX_DIR, `${userId}_metadata.json`);
}

/**
 * Save a vector index to disk for a user
 * @param userId The user ID
 * @param index The vector index to save
 * @param metadata Additional metadata about the index
 */
async function saveVectorIndex(
  userId: string, 
  index: typeof VectorStoreIndex,
  metadata: { 
    resourceCount: number, 
    lastUpdated: Date, 
    resourceIds: string[] 
  }
): Promise<void> {
  try {
    // Create the index directory if it doesn't exist
    await mkdir(INDEX_DIR, { recursive: true });
    
    // Save the index
    const indexPath = getUserIndexPath(userId);
    await index.saveToFile(indexPath);
    
    // Save metadata about the index
    const metadataPath = getUserIndexMetadataPath(userId);
    await writeFile(metadataPath, JSON.stringify(metadata, null, 2));
    
    console.log(`Saved vector index for user ${userId} with ${metadata.resourceCount} resources`);
  } catch (error) {
    console.error(`Error saving vector index for user ${userId}:`, error);
    throw error;
  }
}

/**
 * Check if a vector index exists for a user
 * @param userId The user ID
 * @returns Whether the index exists
 */
async function vectorIndexExists(userId: string): Promise<boolean> {
  try {
    const indexPath = getUserIndexPath(userId);
    const metadataPath = getUserIndexMetadataPath(userId);
    
    // Check if both files exist
    await access(indexPath, fs.constants.R_OK);
    await access(metadataPath, fs.constants.R_OK);
    
    return true;
  } catch {
    return false;
  }
}

/**
 * Load a vector index from disk for a user
 * @param userId The user ID
 * @returns The vector index and its metadata
 */
async function loadVectorIndex(userId: string): Promise<{
  index: typeof VectorStoreIndex, 
  metadata: { 
    resourceCount: number, 
    lastUpdated: Date, 
    resourceIds: string[]
  }
} | null> {
  try {
    // Check if the index is in memory cache first
    if (indexCache[userId] && (new Date().getTime() - indexCache[userId].lastUpdate.getTime() < 3600000)) {
      console.log(`Using in-memory cached vector index for user ${userId}`);
      const metadata = JSON.parse(await readFile(getUserIndexMetadataPath(userId), 'utf8'));
      metadata.lastUpdated = new Date(metadata.lastUpdated);
      
      return {
        index: indexCache[userId].index,
        metadata
      };
    }
    
    // Check if the index exists on disk
    const indexExists = await vectorIndexExists(userId);
    if (!indexExists) {
      console.log(`Vector index does not exist for user ${userId}`);
      return null;
    }
    
    // Load the index
    const indexPath = getUserIndexPath(userId);
    const embedModel = createEmbeddingModel();
    
    // Create service context for loading
    const serviceContext = new ServiceContext({
      nodeParser: new SimpleNodeParser(),
      llm: new LlamaOpenAI({
        model: 'gpt-3.5-turbo',
        temperature: 0.1,
      }),
      embedModel,
    });
    
    // Load the index from file
    const index = await VectorStoreIndex.loadFromFile(indexPath, { serviceContext });
    
    // Load metadata
    const metadataPath = getUserIndexMetadataPath(userId);
    const metadata = JSON.parse(await readFile(metadataPath, 'utf8'));
    metadata.lastUpdated = new Date(metadata.lastUpdated);
    
    // Cache the index in memory
    indexCache[userId] = {
      index,
      lastUpdate: new Date()
    };
    
    console.log(`Loaded vector index for user ${userId} with ${metadata.resourceCount} resources`);
    return { index, metadata };
  } catch (error) {
    console.error(`Error loading vector index for user ${userId}:`, error);
    return null;
  }
}

/**
 * Build or update a vector index for a user
 * @param userId The user ID
 * @param forceRebuild Whether to force rebuilding the index
 * @returns The vector index
 */
export async function buildUserVectorIndex(
  userId: string | null | undefined, 
  forceRebuild: boolean = false
): Promise<typeof VectorStoreIndex | null> {
  try {
    // Early return if userId is null or undefined
    if (!userId) {
      console.log('Cannot build vector index: userId is null or undefined');
      return null;
    }
    
    console.log(`Building vector index for user ${userId}${forceRebuild ? ' (forced rebuild)' : ''}`);
    
    // Check if we need to rebuild the index
    let needsRebuild = forceRebuild;
    
    if (!needsRebuild) {
      // Check if the index exists and is up to date
      const existingIndex = await loadVectorIndex(userId);
      if (!existingIndex) {
        needsRebuild = true;
      } else {
        // Get the most recent data update time
        const resources = await getUserResources(userId, true);
        
        // If resource count has changed, we need to rebuild
        if (resources.length !== existingIndex.metadata.resourceCount) {
          console.log(`Resource count changed (${existingIndex.metadata.resourceCount} -> ${resources.length}), rebuilding index`);
          needsRebuild = true;
        }
        
        // Check if the user has newer resources than the index
        if (userCache[userId] && userCache[userId].lastUpdate > existingIndex.metadata.lastUpdated) {
          console.log(`User data updated since last index build, rebuilding index`);
          needsRebuild = true;
        }
      }
    }
    
    if (!needsRebuild) {
      console.log(`Using existing vector index for user ${userId}`);
      const existingIndex = await loadVectorIndex(userId);
      return existingIndex?.index || null;
    }
    
    // Get all user resources
    const resources = await getUserResources(userId, true);
    
    if (resources.length === 0) {
      console.log(`No resources found for user ${userId}, not building index`);
      return null;
    }
    
    // Convert resources to LlamaIndex documents
    const documents = await fhirResourcesToDocuments(resources);
    
    // Create embedding model
    const embedModel = createEmbeddingModel();
    
    // Create service context
    const serviceContext = new ServiceContext({
      nodeParser: new SimpleNodeParser(),
      llm: new LlamaOpenAI({
        model: 'gpt-3.5-turbo',
        temperature: 0.1,
      }),
      embedModel,
    });
    
    // Create vector index
    const index = await VectorStoreIndex.fromDocuments(documents, { serviceContext });
    
    // Save metadata about the resources
    const resourceIds = resources.map(r => `${r.resourceType}_${r.id}`);
    const metadata = {
      resourceCount: resources.length,
      lastUpdated: new Date(),
      resourceIds
    };
    
    // Save the index to disk
    await saveVectorIndex(userId, index, metadata);
    
    // Cache the index in memory
    indexCache[userId] = {
      index,
      lastUpdate: new Date()
    };
    
    console.log(`Built and saved vector index for user ${userId} with ${resources.length} resources`);
    return index;
  } catch (error) {
    console.error(`Error building vector index for user ${userId}:`, error);
    return null;
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
 * Get all FHIR resources for a user
 */
export async function getUserResources(userId: string, forceRefresh = false, includeWearables = true): Promise<any[]> {
  try {
    // Check cache
    if (!forceRefresh && userCache[userId] && (new Date().getTime() - userCache[userId].lastUpdate.getTime() < 3600000)) {
      console.log(`Using cached resources for user ${userId}`);
      const resources = userCache[userId].resources;
      
      // If wearables should be excluded, filter them out from cached results
      if (!includeWearables) {
        return resources.filter(resource => 
          resource.resourceType !== 'Observation' || !isWearableObservation(resource)
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
      
      // For observations, filter out wearable data if includeWearables is false
      if (resourceType === 'Observation' && !includeWearables) {
        const filteredObservations = typeResources.filter(obs => !isWearableObservation(obs));
        resources.push(...filteredObservations);
        console.log(`Filtered out ${typeResources.length - filteredObservations.length} wearable observations`);
      } else {
        resources.push(...typeResources);
      }
    }
    
    console.log(`Retrieved ${resources.length} FHIR resources`);
    
    // Cache the unfiltered resources
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
 * Find relevant FHIR resources based on a query
 * @param userId The user ID
 * @param query The search query
 * @param resourceLimit Maximum number of resources to return (default: 10)
 * @returns Array of relevant FHIR resources
 */
export async function findRelevantResources(
  userId: string, 
  query: string,
  resourceLimit: number = 10
): Promise<any[]> {
  console.log(`Finding relevant resources for query: "${query}"`);
  try {
    // First, try to use the persistent vector index
    let index: typeof VectorStoreIndex | null = null;
    let allResources: any[] = [];
    
    try {
      // Load the existing index if available
      const existingIndex = await loadVectorIndex(userId);
      if (existingIndex) {
        index = existingIndex.index;
        console.log(`Using existing vector index for user ${userId}`);
        
        // Load resources from cache or fetch them if needed
        if (userCache[userId]) {
          allResources = userCache[userId].resources;
          console.log(`Using cached resources for user ${userId}`);
        } else {
          allResources = await getUserResources(userId);
        }
      } else {
        console.log(`No existing vector index found for user ${userId}, building one now`);
        // Get all user resources first
        allResources = await getUserResources(userId);
        
        if (allResources.length === 0) {
          console.log('No resources found for this user');
          return [];
        }
        
        // Build the index (this will also save it for future use)
        index = await buildUserVectorIndex(userId);
      }
    } catch (error) {
      console.error(`Error with vector index operations:`, error);
      // Fall back to building the index in memory only
      console.log('Falling back to building index in memory');
      
      // Get all user resources first
      allResources = await getUserResources(userId);
      
      if (allResources.length === 0) {
        console.log('No resources found for this user');
        return [];
      }
      
      // Convert resources to LlamaIndex documents
      const documents = await fhirResourcesToDocuments(allResources);
      
      // Create embedding model
      const embedModel = createEmbeddingModel();
      
      // Create service context
      const serviceContext = new ServiceContext({
        nodeParser: new SimpleNodeParser(),
        llm: new LlamaOpenAI({
          model: 'gpt-3.5-turbo',
          temperature: 0.1,
        }),
        embedModel,
      });
      
      // Create vector index in memory only
      index = await VectorStoreIndex.fromDocuments(documents, { serviceContext });
    }
    
    // If we still don't have an index, return empty results
    if (!index) {
      console.log('Could not create or load vector index, returning empty results');
      return [];
    }
    
    console.log(`Performing query on vector index with ${allResources.length} resources`);
    
    // Perform query
    const queryEngine = index.asQueryEngine();
    const response = await queryEngine.query({
      query,
    });
    
    // Extract source nodes (containing the relevant FHIR resources)
    const sourceNodes = response.sourceNodes || [];
    
    console.log(`Found ${sourceNodes.length} relevant nodes for the query`);
    
    // Map nodes back to original FHIR resources
    const relevantResources = sourceNodes
      .map((node: any) => {
        // Find the original resource based on node metadata
        const metadata = node.metadata;
        return allResources.find((r: any) => 
          r.resourceType === metadata.resourceType && 
          r.id === metadata.id
        );
      })
      .filter((resource: any) => resource !== undefined);
    
    // Deduplicate resources
    const deduplicatedResources: any[] = [];
    const seenIds = new Set();
    
    for (const resource of relevantResources) {
      const key = `${resource.resourceType}_${resource.id}`;
      if (!seenIds.has(key)) {
        seenIds.add(key);
        deduplicatedResources.push(resource);
      }
    }
    
    // Limit to specified number
    const limitedResources = deduplicatedResources.slice(0, resourceLimit);
    
    console.log(`Returning ${limitedResources.length} relevant resources for the query`);
    return limitedResources;
  } catch (error) {
    console.error('Error finding relevant resources:', error);
    // Fallback to retrieving all resources if semantic search fails
    console.log('Falling back to returning all resources');
    return getUserResources(userId);
  }
} 