import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../lib/firebase-admin';
import admin from 'firebase-admin';
import openai, { isApiKeyValid } from '../../lib/openai-server';

// Instead declare the function type that will be dynamically imported if needed
let generateHolisticAnalysis: any = null;
let ragServiceImportFailed = false;
let ragServiceErrors: string[] = [];

// Function to dynamically import the RAG service when needed
async function importRagService() {
  try {
    // Use dynamic import with catch to prevent build failure
    const module = await import('../../lib/rag-service').catch(() => null);
    if (module) {
      generateHolisticAnalysis = module.generateHolisticAnalysis;
      console.log('Successfully imported RAG service');
      return true;
    }
    console.log('RAG service module not available');
    return false;
  } catch (error) {
    console.error('Failed to import RAG service:', error);
    ragServiceImportFailed = true;
    ragServiceErrors.push(`Import error: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

// No need to check dependencies since we're using direct OpenAI implementation
// async function checkRagDependencies() {
//   // Implementation removed
//   return true;
// }

// No need to import the service dynamically since we import it directly
// async function importRagService() {
//   // Implementation removed
// }

// No need to try importing the service
// importRagService().catch(err => {
//   console.error('Error in importRagService:', err);
//   ragServiceImportFailed = true;
//   ragServiceErrors.push(`Import function error: ${err instanceof Error ? err.message : String(err)}`);
// });

// Debug info interface
interface DebugInfo {
  recordsFetched: number;
  profileFetched: boolean;
  openAIUsed: boolean;
  ragUsed: boolean;
  firestoreSaved: boolean;
  includeWearables?: boolean;
  errors: string[];
  timings: {
    total: number;
    profileFetch: number;
    recordsFetch: number;
    rag: number;
    openAI: number;
    firestore: number;
  };
}

// Helper function to get detailed diet description
function getDietDescription(dietValue: string): string {
  switch (dietValue) {
    case 'whole-foods':
      return 'Mostly whole foods (fruits, vegetables, lean meats, whole grains) - nutrient-rich, balanced diet';
    case 'mixed':
      return 'Balanced mix of whole foods and some processed foods - moderate diet with room for improvement';
    case 'processed':
      return 'Mostly processed foods (fast food, sugary drinks, packaged snacks) - high in empty calories, sodium, and fats';
    case 'irregular':
      return 'Irregular eating (skipping meals, heavy snacking, little variety) - inconsistent nutrition with poor diversity';
    default:
      return dietValue || 'Not specified';
  }
}

// Use Node.js runtime for this API route
export const runtime = "nodejs";

// Simple GET handler to check if the API is accessible
export async function GET() {
  return NextResponse.json({ 
    status: 'ok', 
    message: 'Analysis API is running' 
  });
}

export async function POST(request: NextRequest) {
  console.log('API route /api/analyze POST handler called');
  
  // Track performance and debugging info
  const startTime = Date.now();
  const debugInfo: DebugInfo = {
    recordsFetched: 0,
    profileFetched: false,
    openAIUsed: false,
    ragUsed: false,
    firestoreSaved: false,
    errors: [],
    timings: {
      total: 0,
      profileFetch: 0,
      recordsFetch: 0,
      rag: 0,
      openAI: 0,
      firestore: 0
    }
  };
  
  try {
    // Debug Firebase Admin SDK initialization
    console.log('Firebase Admin SDK initialization status:', admin.apps.length ? 'Initialized' : 'Not initialized');
    
    // Parse request body
    const body = await request.json();
    console.log('Request body received:', JSON.stringify(body, null, 2));
    
    const { userId, recordNames, recordDetails: frontendRecordDetails, mode = 'standard', useRag = true } = body;
    
    if (!userId) {
      console.error('Missing userId in request');
      return NextResponse.json(
        { error: 'Missing userId in request' },
        { status: 400 }
      );
    }
    
    // Check if OpenAI API key is valid
    let useOpenAI = false;
    let openAIError = null;
    
    try {
      const apiKeyStatus = await isApiKeyValid();
      useOpenAI = apiKeyStatus.valid;
      if (!apiKeyStatus.valid) {
        console.log('OpenAI API key is not valid, using mock analysis instead');
        openAIError = apiKeyStatus.message;
        debugInfo.errors.push(`OpenAI API key error: ${apiKeyStatus.message}`);
      } else {
        console.log('OpenAI API key is valid, will use OpenAI for analysis');
      }
    } catch (error) {
      console.error('Error checking OpenAI API key:', error);
      openAIError = error instanceof Error ? error.message : 'Unknown OpenAI error';
      debugInfo.errors.push(`OpenAI API key check error: ${openAIError}`);
    }
    
    // Fetch user profile information
    let profileInfo = "No profile information available.";
    const profileStartTime = Date.now();
    try {
      if (userId) {
        // Try to get the profile using the user's ID
        const userProfileDoc = await db.collection('profile').doc(userId).get();
        if (userProfileDoc.exists) {
          const profile = userProfileDoc.data();
          debugInfo.profileFetched = true;
          
          // Create a detailed profile string with all available information
          profileInfo = `User Profile:
Name: ${profile?.name || 'Not specified'}
Age: ${profile?.age || 'Not specified'}
Gender: ${profile?.gender || 'Not specified'}
Height: ${profile?.height || 'Not specified'} cm
Weight: ${profile?.weight || 'Not specified'} kg
Lifestyle Factors:
- Smoking: ${profile?.smoking || 'Not specified'}
- Alcohol: ${profile?.alcohol || 'Not specified'}
- Diet: ${getDietDescription(profile?.diet)}
- Exercise: ${profile?.exercise || 'Not specified'}
Family Medical History:
${profile?.familyHistory ? profile.familyHistory : 'Not specified'}`;
        } else {
          // Try alternative paths if the main path doesn't work
          const profileDoc = await db.collection('users').doc(userId).collection('profile').doc('data').get();
          if (profileDoc.exists) {
            const profile = profileDoc.data();
            debugInfo.profileFetched = true;
            
            // Create a detailed profile string with all available information
            profileInfo = `User Profile:
Name: ${profile?.name || 'Not specified'}
Age: ${profile?.age || 'Not specified'}
Gender: ${profile?.gender || 'Not specified'}
Height: ${profile?.height || 'Not specified'} cm
Weight: ${profile?.weight || 'Not specified'} kg
Lifestyle Factors:
- Smoking: ${profile?.smoking || 'Not specified'}
- Alcohol: ${profile?.alcohol || 'Not specified'}
- Diet: ${getDietDescription(profile?.diet)}
- Exercise: ${profile?.exercise || 'Not specified'}
Family Medical History:
${profile?.familyHistory ? profile.familyHistory : 'Not specified'}`;
          }
        }
      }
    } catch (profileError) {
      console.error('Error fetching user profile:', profileError);
      debugInfo.errors.push(`Profile fetch error: ${profileError instanceof Error ? profileError.message : 'Unknown error'}`);
    }
    debugInfo.timings.profileFetch = Date.now() - profileStartTime;
    
    // Fetch detailed record information
    interface RecordDetail {
      name: string;
      detailedAnalysis: string;
      comment: string;
      comments: string;
      recordType?: string;
      recordDate?: string;
    }
    
    let recordDetails: RecordDetail[] = [];
    const recordsFetchStartTime = Date.now();
    
    // Use record details from frontend if available, otherwise fetch from Firestore
    if (frontendRecordDetails && Array.isArray(frontendRecordDetails) && frontendRecordDetails.length > 0) {
      console.log('Using record details provided by frontend');
      console.log('Number of records from frontend:', frontendRecordDetails.length);
      console.log('First record details:', JSON.stringify(frontendRecordDetails[0], null, 2));
      
      // Convert frontend record details to the format expected by the API
      recordDetails = frontendRecordDetails.map(record => ({
        name: record.name,
        detailedAnalysis: record.detailedAnalysis || '',
        comment: record.comment || '',
        comments: Array.isArray(record.comments) ? record.comments.join('\n\n') : record.comments || '',
        recordType: record.recordType,
        recordDate: record.recordDate
      }));
      
      debugInfo.recordsFetched = recordDetails.length;
    } else if (recordNames && Array.isArray(recordNames) && recordNames.length > 0) {
      console.log('Fetching specific records from Firestore:', recordNames);
      
      // Fetch specific records by name
      try {
        const recordsCollection = db.collection(`users/${userId}/records`);
        const recordsSnapshot = await recordsCollection.get();
        
        // Filter records by name
        for (const doc of recordsSnapshot.docs) {
          const record = doc.data();
          const recordName = record.name || doc.id;
          
          if (recordNames.includes(recordName)) {
            console.log(`Processing requested record: ${recordName}`);
            
            // Fetch the record's summary if it exists
            let summary = '';
            try {
              const summaryDoc = await db.collection(`users/${userId}/records/${doc.id}/summaries`).doc('main').get();
              if (summaryDoc.exists) {
                summary = summaryDoc.data()?.text || '';
              }
            } catch (summaryError) {
              console.error(`Error fetching summary for record ${recordName}:`, summaryError);
            }
            
            // Fetch the record's comments if they exist
            let comments: string[] = [];
            
            // Only check if the record itself has a comment field
            if (record.comment) {
              comments.push(record.comment);
            }
            
            // Add the record details to our array
            recordDetails.push({
              name: recordName,
              detailedAnalysis: summary,
              comment: record.comment || '',
              comments: comments.join('\n\n'),
              recordType: record.recordType,
              recordDate: record.recordDate
            });
          }
        }
        
        debugInfo.recordsFetched = recordDetails.length;
      } catch (recordsError) {
        console.error('Error fetching records from Firestore:', recordsError);
        debugInfo.errors.push(`Records fetch error: ${recordsError instanceof Error ? recordsError.message : 'Unknown error'}`);
      }
    } else {
      console.log('No record details or names provided, fetching all records from Firestore');
      
      try {
        // Get all records for the user
        const recordsCollection = db.collection(`users/${userId}/records`);
        const recordsSnapshot = await recordsCollection.get();
        
        // Process each record to extract summaries and comments
        for (const doc of recordsSnapshot.docs) {
          const record = doc.data();
          const recordName = record.name || doc.id;
          
          console.log(`Processing record: ${recordName}`);
          
          // Fetch the record's summary if it exists
          let summary = '';
          try {
            const summaryDoc = await db.collection(`users/${userId}/records/${doc.id}/summaries`).doc('main').get();
            if (summaryDoc.exists) {
              summary = summaryDoc.data()?.text || '';
            }
          } catch (summaryError) {
            console.error(`Error fetching summary for record ${recordName}:`, summaryError);
          }
          
          // Fetch the record's comments if they exist
          let comments: string[] = [];
          
          // Only check if the record itself has a comment field
          if (record.comment) {
            comments.push(record.comment);
          }
          
          // Add the record details to our array
          recordDetails.push({
            name: recordName,
            detailedAnalysis: summary,
            comment: record.comment || '',
            comments: comments.join('\n\n'),
            recordType: record.recordType,
            recordDate: record.recordDate
          });
        }
        
        debugInfo.recordsFetched = recordDetails.length;
      } catch (recordsError) {
        console.error('Error fetching records from Firestore:', recordsError);
        debugInfo.errors.push(`Records fetch error: ${recordsError instanceof Error ? recordsError.message : 'Unknown error'}`);
      }
    }
    debugInfo.timings.recordsFetch = Date.now() - recordsFetchStartTime;
    
    // If we have records and OpenAI is available, generate analysis
    let analysis = '';
    // Track if any records have comments
    let hasComments = false;
    
    // Use RAG-based analysis if enabled
    if (useRag && useOpenAI) {
      const ragStartTime = Date.now();
      try {
        console.log('Using RAG-based approach for holistic analysis...');
        
        // Check if FHIR collections exist for this user
        let hasValidFhirData = false;
        try {
          const fhirCollectionRef = db.collection('users').doc(userId).collection('fhir_resources');
          const snapshot = await fhirCollectionRef.limit(1).get();
          console.log(`FHIR resources collection exists: ${!snapshot.empty}`);
          console.log(`Collection path: users/${userId}/fhir_resources`);
          
          if (!snapshot.empty) {
            hasValidFhirData = true;
          } else {
            // Try alternative paths if main path is empty
            console.log("Checking alternative FHIR resource paths...");
            
            // Try 'fhir' collection
            const fhirAltRef = db.collection('users').doc(userId).collection('fhir');
            const altSnapshot = await fhirAltRef.limit(1).get();
            console.log(`Alternative 'fhir' collection exists: ${!altSnapshot.empty}`);
            
            if (!altSnapshot.empty) {
              console.log("Found FHIR resources in 'fhir' collection.");
              hasValidFhirData = true;
            } else {
              console.log("No FHIR resources found in any collection, will use traditional approach");
              // If no FHIR resources in either location, disable RAG for this analysis
              throw new Error('No FHIR resources found for this user');
            }
          }
        } catch (pathError) {
          console.error("Error checking FHIR collections:", pathError);
          throw new Error(`Error checking FHIR paths: ${pathError instanceof Error ? pathError.message : 'Unknown error'}`);
        }
        
        // Only proceed with RAG if we have valid FHIR data
        if (hasValidFhirData) {
          try {
            // Get analysis settings for whether to include wearables data
            // The useRag setting in the UI actually controls wearables inclusion now
            const settingsRef = db.collection('users').doc(userId).collection('settings').doc('analysis');
            const settingsDoc = await settingsRef.get();
            const includeWearables = settingsDoc.exists && settingsDoc.data()?.useRag !== false;
            
            // Dynamically import the RAG service only when needed
            if (!generateHolisticAnalysis) {
              const importSuccessful = await importRagService();
              if (!importSuccessful) {
                throw new Error('Failed to import RAG service');
              }
            }
            
            // Generate holistic analysis using our updated RAG service
            analysis = await generateHolisticAnalysis(userId, profileInfo, {
              forceRefresh: mode === 'refresh',
              includeWearables: includeWearables
            });
            
            console.log(`Generated analysis with includeWearables=${includeWearables}`);
            
            // Check if the analysis indicates an error
            if (analysis.includes("Error generating analysis:") || 
                analysis.includes("Error: Unable to process FHIR health data")) {
              console.log("RAG service returned an error, falling back to traditional approach");
              throw new Error("RAG service returned an error response");
            }
            
            console.log('RAG-based holistic analysis generated successfully');
            debugInfo.ragUsed = true;
            debugInfo.includeWearables = includeWearables;
            
            // After generating the RAG analysis, save it to Firestore
            if (analysis && userId) {
              const firestoreStartTime = Date.now();
              try {
                console.log(`Saving RAG analysis to Firestore for user ${userId}`);
                
                // Save the analysis to the user's holistic analysis document
                await db.collection('users').doc(userId).collection('analysis').doc('holistic').set({
                  text: analysis,
                  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                  needsUpdate: false,
                  recordCount: recordDetails?.length || 0,
                  generatedBy: includeWearables ? 'structured+wearables' : 'structured',
                  summariesUsed: false,
                  commentsUsed: false,
                  usedStructuredFhir: true,
                  includeWearables: includeWearables
                }, { merge: true });
                
                console.log('RAG analysis saved to Firestore successfully');
                debugInfo.firestoreSaved = true;
              } catch (firestoreError) {
                console.error('Error saving RAG analysis to Firestore:', firestoreError);
                debugInfo.errors.push(`Firestore RAG save error: ${firestoreError instanceof Error ? firestoreError.message : 'Unknown error'}`);
                debugInfo.firestoreSaved = false;
              }
              debugInfo.timings.firestore = Date.now() - firestoreStartTime;
            }
          } catch (ragInnerError) {
            console.error('Error in RAG processing:', ragInnerError);
            debugInfo.errors.push(`RAG processing error: ${ragInnerError instanceof Error ? ragInnerError.message : 'Unknown RAG error'}`);
            
            // If we get here, the analysis failed with RAG, so we need to fall back
            throw new Error(`RAG analysis failed: ${ragInnerError instanceof Error ? ragInnerError.message : 'Unknown error'}`);
          }
        }
      } catch (ragError) {
        console.error('Error generating RAG-based analysis:', ragError);
        debugInfo.errors.push(`RAG error: ${ragError instanceof Error ? ragError.message : 'Unknown error'}`);
        
        // Fall back to traditional approach if RAG fails
        console.log('Falling back to traditional approach...');
        
        // If we have recordDetails and OpenAI is available, generate analysis using traditional approach
        if (recordDetails && recordDetails.length > 0 && useOpenAI) {
          const openAIStartTime = Date.now();
          try {
            // Check if any records have comments
            hasComments = recordDetails.some(record => 
              record.comment && record.comment.trim() !== ''
            );
            
            // Prepare the record summaries for analysis
            const recordSummaries = recordDetails.map(record => {
              return `Record: ${record.name}
Record Type: ${record.recordType || 'Not specified'}
Record Date: ${record.recordDate || 'Not specified'}
Detailed Analysis: ${record.detailedAnalysis}
Comment: ${record.comment}`;
            });
            
            // Determine the analysis prompt based on mode
            let analysisPrompt = '';
            let systemPrompt = '';
            
            // Standard mode - balanced analysis
            systemPrompt = 'Based on the provided health records provide some balanced insights using XML-like tags for structured output. Do not use any personal identifiers and avoid phrases like "the patient" or similar. Phrase it in a friendly way as though you are given a summary of a patients health to them to read.';
            analysisPrompt = `Please analyze these health records and provide your insights using these XML-like tags:

<OVERVIEW>
Provide a high level overview here.
</OVERVIEW>

<KEY_FINDINGS>
Provide a summary of key findings here. Go quite deep here about the history and any issues. Make it interesting and readable for the patient.
</KEY_FINDINGS>

It is CRITICAL that you use these exact XML-like tags in your response to ensure proper formatting. Do not use any personal identifiers and avoid phrases like "the patient" or similar.`;
            
            // Call OpenAI for analysis
            const chatResponse = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
              },
              body: JSON.stringify({
                model: 'gpt-4o',
                messages: [
                  {
                    role: 'system',
                    content: systemPrompt
                  },
                  {
                    role: 'user',
                    content: `${profileInfo}\n\nI have the following health records:\n\n${recordSummaries.join('\n\n---\n\n')}\n\n${analysisPrompt}`
                  }
                ]
              })
            });
            
            if (chatResponse.ok) {
              const chatData = await chatResponse.json();
              analysis = chatData.choices[0]?.message?.content || 'No analysis available';
              debugInfo.openAIUsed = true;
            } else {
              const errorText = await chatResponse.text();
              console.error('OpenAI API error:', errorText);
              analysis = 'Error generating analysis. Please try again later.';
              debugInfo.errors.push(`OpenAI API error: ${errorText}`);
            }
          } catch (analysisError) {
            console.error('Error generating analysis:', analysisError);
            analysis = 'Error generating analysis. Please try again later.';
            debugInfo.errors.push(`Analysis error: ${analysisError instanceof Error ? analysisError.message : 'Unknown error'}`);
          }
          debugInfo.timings.openAI = Date.now() - openAIStartTime;
          
          // After generating the analysis, save it to Firestore
          if (analysis && userId) {
            const firestoreStartTime = Date.now();
            try {
              console.log(`Saving analysis to Firestore for user ${userId}`);
              
              // Save the analysis to the user's holistic analysis document
              await db.collection('users').doc(userId).collection('analysis').doc('holistic').set({
                text: analysis,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                needsUpdate: false,
                recordCount: recordDetails.length,
                generatedBy: 'text_summaries',
                summariesUsed: true,
                commentsUsed: hasComments
              }, { merge: true });
              
              console.log('Analysis saved to Firestore successfully');
              debugInfo.firestoreSaved = true;
            } catch (firestoreError) {
              console.error('Error saving analysis to Firestore:', firestoreError);
              debugInfo.errors.push(`Firestore save error: ${firestoreError instanceof Error ? firestoreError.message : 'Unknown error'}`);
              debugInfo.firestoreSaved = false;
            }
            debugInfo.timings.firestore = Date.now() - firestoreStartTime;
          }
        }
      }
    } else if (recordDetails && recordDetails.length > 0 && useOpenAI) {
      // Traditional OpenAI-based approach
      const openAIStartTime = Date.now();
      try {
        // Check if any records have comments
        hasComments = recordDetails.some(record => 
          record.comment && record.comment.trim() !== ''
        );
        
        // Prepare the record summaries for analysis
        const recordSummaries = recordDetails.map(record => {
          return `Record: ${record.name}
Record Type: ${record.recordType || 'Not specified'}
Record Date: ${record.recordDate || 'Not specified'}
Detailed Analysis: ${record.detailedAnalysis}
Comment: ${record.comment}`;
        });
        
        // Determine the analysis prompt based on mode
        let analysisPrompt = '';
        let systemPrompt = '';
        
        // Standard mode - balanced analysis
        systemPrompt = 'Based on the provided health records provide some balanced insights using XML-like tags for structured output. Do not use any personal identifiers and avoid phrases like "the patient" or similar. Phrase it in a friendly way as though you are given a summary of a patients health to them to read.';
        analysisPrompt = `Please analyze these health records and provide your insights using these XML-like tags:

<OVERVIEW>
Provide a high level overview here.
</OVERVIEW>

<KEY_FINDINGS>
Provide a summary of key findings here. Go quite deep here about the history and any issues. Make it interesting and readable for the patient.
</KEY_FINDINGS>

It is CRITICAL that you use these exact XML-like tags in your response to ensure proper formatting. Do not use any personal identifiers and avoid phrases like "the patient" or similar.`;
        
        // Call OpenAI for analysis
        const chatResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
          },
          body: JSON.stringify({
            model: 'gpt-4o',
            messages: [
              {
                role: 'system',
                content: systemPrompt
              },
              {
                role: 'user',
                content: `${profileInfo}\n\nI have the following health records:\n\n${recordSummaries.join('\n\n---\n\n')}\n\n${analysisPrompt}`
              }
            ]
          })
        });
        
        if (chatResponse.ok) {
          const chatData = await chatResponse.json();
          analysis = chatData.choices[0]?.message?.content || 'No analysis available';
          debugInfo.openAIUsed = true;
        } else {
          const errorText = await chatResponse.text();
          console.error('OpenAI API error:', errorText);
          analysis = 'Error generating analysis. Please try again later.';
          debugInfo.errors.push(`OpenAI API error: ${errorText}`);
        }
      } catch (analysisError) {
        console.error('Error generating analysis:', analysisError);
        analysis = 'Error generating analysis. Please try again later.';
        debugInfo.errors.push(`Analysis error: ${analysisError instanceof Error ? analysisError.message : 'Unknown error'}`);
      }
      debugInfo.timings.openAI = Date.now() - openAIStartTime;
      
      // After generating the analysis, save it to Firestore
      if (analysis && userId) {
        const firestoreStartTime = Date.now();
        try {
          console.log(`Saving analysis to Firestore for user ${userId}`);
          
          // Save the analysis to the user's holistic analysis document
          await db.collection('users').doc(userId).collection('analysis').doc('holistic').set({
            text: analysis,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            needsUpdate: false,
            recordCount: recordDetails.length,
            generatedBy: 'text_summaries',
            summariesUsed: true,
            commentsUsed: hasComments
          }, { merge: true });
          
          console.log('Analysis saved to Firestore successfully');
          debugInfo.firestoreSaved = true;
        } catch (firestoreError) {
          console.error('Error saving analysis to Firestore:', firestoreError);
          debugInfo.errors.push(`Firestore save error: ${firestoreError instanceof Error ? firestoreError.message : 'Unknown error'}`);
          debugInfo.firestoreSaved = false;
        }
        debugInfo.timings.firestore = Date.now() - firestoreStartTime;
      }
    } else if (recordDetails && recordDetails.length > 0) {
      // If OpenAI is not available, provide a mock analysis
      analysis = 'OpenAI API is not available. Please check your API key and try again.';
    } else {
      // If no records are available, provide a message
      analysis = 'No health records available for analysis.';
    }
    
    // Calculate total execution time
    debugInfo.timings.total = Date.now() - startTime;
    
    // Return the analysis and debug info
    return NextResponse.json({
      status: 'success',
      analysis: analysis,
      recordCount: recordDetails?.length || 0,
      mode: mode,
      generatedBy: debugInfo.ragUsed ? 'structured+wearables' : 'text_summaries',
      summariesUsed: true,
      commentsUsed: hasComments,
      usedStructuredFhir: debugInfo.ragUsed,
      includeWearables: debugInfo.includeWearables,
      firestoreSaved: debugInfo.firestoreSaved,
      debug: debugInfo
    });
    
  } catch (error: any) {
    console.error('Error in analyze API route:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

// Helper function to answer specific questions about health records
async function answerQuestion(question: string, fileIds: string[], summaries: string[], userId?: string) {
  try {
    console.log(`Answering question with ${summaries.length} health record summaries`);
    
    // Get user profile information
    let profileInfo = "No profile information available.";
    try {
      if (userId) {
        // Try to get the profile using the user's ID
        const userProfileDoc = await db.collection('profile').doc(userId).get();
        if (userProfileDoc.exists) {
          const profile = userProfileDoc.data();
          
          // Create a detailed profile string with all available information
          profileInfo = `User Profile:
Name: ${profile?.name || 'Not specified'}
Age: ${profile?.age || 'Not specified'}
Gender: ${profile?.gender || 'Not specified'}
Height: ${profile?.height || 'Not specified'} cm
Weight: ${profile?.weight || 'Not specified'} kg
Lifestyle Factors:
- Smoking: ${profile?.smoking || 'Not specified'}
- Alcohol: ${profile?.alcohol || 'Not specified'}
- Diet: ${getDietDescription(profile?.diet)}
- Exercise: ${profile?.exercise || 'Not specified'}
Family Medical History:
${profile?.familyHistory ? profile.familyHistory : 'Not specified'}`;
        } else {
          // Try alternative paths if the main path doesn't work
          const profileDoc = await db.collection('users').doc(userId).collection('profile').doc('data').get();
          if (profileDoc.exists) {
            const profile = profileDoc.data();
            
            // Create a detailed profile string with all available information
            profileInfo = `User Profile:
Name: ${profile?.name || 'Not specified'}
Age: ${profile?.age || 'Not specified'}
Gender: ${profile?.gender || 'Not specified'}
Height: ${profile?.height || 'Not specified'} cm
Weight: ${profile?.weight || 'Not specified'} kg
Lifestyle Factors:
- Smoking: ${profile?.smoking || 'Not specified'}
- Alcohol: ${profile?.alcohol || 'Not specified'}
- Diet: ${getDietDescription(profile?.diet)}
- Exercise: ${profile?.exercise || 'Not specified'}
Family Medical History:
${profile?.familyHistory ? profile.familyHistory : 'Not specified'}`;
          }
        }
      }
    } catch (profileError) {
      console.error('Error fetching user profile:', profileError);
    }
    
    // Use the summaries for holistic analysis instead of the original files
    const chatResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are a medical AI assistant. Analyze the provided health record summaries and answer the user\'s question based on the information in these summaries. All records belong to the same individual whose profile information is provided. Consider how the patient\'s demographic information, lifestyle factors, and medical history might interact when formulating your response. Format your answer using XML-like tags for structured output.'
          },
          {
            role: 'user',
            content: `${profileInfo}\n\nI have the following health record summaries for this user:\n\n${summaries.join('\n\n---\n\n')}\n\nBased on these summaries and the user's profile information, please answer this question: ${question}\n\nPlease format your response using these XML-like tags:\n\n<ANSWER>\nYour detailed answer here.\n</ANSWER>\n\n<RELEVANT_RECORDS>\nList the records that were most relevant to answering this question.\n</RELEVANT_RECORDS>\n\n<ADDITIONAL_CONTEXT>\nProvide any additional context or caveats about your answer.\n</ADDITIONAL_CONTEXT>\n\nIt is CRITICAL that you use these exact XML-like tags in your response to ensure proper formatting.`
          }
        ]
      })
    });
    
    if (chatResponse.ok) {
      const chatData = await chatResponse.json();
      return chatData.choices[0]?.message?.content || 'No answer available';
    } else {
      const errorText = await chatResponse.text();
      console.error('OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${chatResponse.status} - ${errorText}`);
    }
  } catch (error) {
    console.error('Error answering question:', error);
    throw error;
  }
} 