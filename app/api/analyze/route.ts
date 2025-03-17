import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../lib/firebase-admin';
import admin from 'firebase-admin';
import openai, { isApiKeyValid } from '../../lib/openai-server';

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
  const debugInfo = {
    recordsFetched: 0,
    profileFetched: false,
    openAIUsed: false,
    firestoreSaved: false,
    errors: [] as string[],
    timings: {
      total: 0,
      profileFetch: 0,
      recordsFetch: 0,
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
    
    const { userId, recordNames, recordDetails: frontendRecordDetails, mode = 'standard' } = body;
    
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
      // Try the correct path first - this is where the profile is actually stored
      const userProfileDoc = await db.collection('profile').doc('user').get();
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
      } else if (userId) {
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
        comments: Array.isArray(record.comments) ? record.comments.join('\n\n') : record.comments || ''
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
            
            // First check if the record itself has a comment field
            if (record.comment) {
              comments.push(record.comment);
            }
            
            // Check if the record has a comments field (plural)
            if (record.comments) {
              if (Array.isArray(record.comments)) {
                comments.push(...record.comments);
              } else if (typeof record.comments === 'string') {
                comments.push(record.comments);
              } else if (typeof record.comments === 'object') {
                comments.push(JSON.stringify(record.comments));
              }
            }
            
            // Then check the comments collection
            try {
              const commentsSnapshot = await db.collection(`users/${userId}/records/${doc.id}/comments`).get();
              
              commentsSnapshot.forEach(commentDoc => {
                const comment = commentDoc.data();
                // Check for both 'text' field and direct comment content
                if (comment.text) {
                  comments.push(comment.text);
                } else if (typeof comment === 'object' && Object.keys(comment).length > 0) {
                  // If there's no text field but there is content, stringify it
                  const commentContent = JSON.stringify(comment);
                  comments.push(commentContent);
                }
              });
            } catch (commentsError) {
              console.error(`Error fetching comments for record ${recordName}:`, commentsError);
            }
            
            // Add the record details to our array
            recordDetails.push({
              name: recordName,
              detailedAnalysis: summary,
              comment: record.comment || '',
              comments: comments.join('\n\n')
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
          
          // First check if the record itself has a comment field
          if (record.comment) {
            comments.push(record.comment);
          }
          
          // Check if the record has a comments field (plural)
          if (record.comments) {
            if (Array.isArray(record.comments)) {
              comments.push(...record.comments);
            } else if (typeof record.comments === 'string') {
              comments.push(record.comments);
            } else if (typeof record.comments === 'object') {
              comments.push(JSON.stringify(record.comments));
            }
          }
          
          // Then check the comments collection
          try {
            const commentsSnapshot = await db.collection(`users/${userId}/records/${doc.id}/comments`).get();
            
            commentsSnapshot.forEach(commentDoc => {
              const comment = commentDoc.data();
              // Check for both 'text' field and direct comment content
              if (comment.text) {
                comments.push(comment.text);
              } else if (typeof comment === 'object' && Object.keys(comment).length > 0) {
                // If there's no text field but there is content, stringify it
                const commentContent = JSON.stringify(comment);
                comments.push(commentContent);
              }
            });
          } catch (commentsError) {
            console.error(`Error fetching comments for record ${recordName}:`, commentsError);
          }
          
          // Add the record details to our array
          recordDetails.push({
            name: recordName,
            detailedAnalysis: summary,
            comment: record.comment || '',
            comments: comments.join('\n\n')
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
    
    if (recordDetails.length > 0 && useOpenAI) {
      const openAIStartTime = Date.now();
      try {
        // Check if any records have comments
        hasComments = recordDetails.some(record => 
          (record.comment && record.comment.trim() !== '') || 
          (record.comments && record.comments.trim() !== '')
        );
        
        // Prepare the record summaries for analysis
        const recordSummaries = recordDetails.map(record => {
          return `Record: ${record.name}
Detailed Analysis: ${record.detailedAnalysis}
Comment: ${record.comment}
Additional Comments: ${record.comments}`;
        });
        
        // Determine the analysis prompt based on mode
        let analysisPrompt = '';
        let systemPrompt = '';
        
        // Standard mode - balanced analysis
        systemPrompt = 'You are a medical AI assistant. Analyze the provided health records and provide balanced insights using XML-like tags for structured output. Do not use any personal identifiers and avoid phrases like "the patient" or similar.';
        analysisPrompt = `Please analyze these health records and provide your insights using these XML-like tags:

<OVERVIEW>
Provide a high level overview here.
</OVERVIEW>

<KEY_FINDINGS>
Provide a summary of key findings here.
</KEY_FINDINGS>

<HEALTH_CONCERNS>
List any potential health concerns here.
</HEALTH_CONCERNS>

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
            generatedBy: 'openai',
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
    } else if (recordDetails.length > 0) {
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
      recordCount: recordDetails.length,
      mode: mode,
      generatedBy: 'openai',
      summariesUsed: true,
      commentsUsed: hasComments,
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
      // Try the correct path first - this is where the profile is actually stored
      const userProfileDoc = await db.collection('profile').doc('user').get();
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
      } else if (userId) {
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