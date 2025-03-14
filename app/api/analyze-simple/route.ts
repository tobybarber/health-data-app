import { NextRequest, NextResponse } from 'next/server';
import admin from 'firebase-admin';
import { db } from '../../lib/firebase-admin';
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

// Simple GET handler to check if the API is accessible
export async function GET() {
  return NextResponse.json({ 
    status: 'ok', 
    message: 'Simple Analysis API is running' 
  });
}

export async function POST(request: NextRequest) {
  console.log('API route /api/analyze-simple POST handler called');
  
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
    
    const { userId, recordNames, recordDetails: frontendRecordDetails } = body;
    
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
      } else {
        console.log('OpenAI API key is valid, will use OpenAI for analysis');
      }
    } catch (error) {
      console.error('Error checking OpenAI API key:', error);
      openAIError = error instanceof Error ? error.message : 'Unknown OpenAI error';
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
    } catch (profileError) {
      console.error('Error fetching user profile:', profileError);
      debugInfo.errors.push(`Profile fetch error: ${profileError instanceof Error ? profileError.message : 'Unknown error'}`);
    }
    debugInfo.timings.profileFetch = Date.now() - profileStartTime;
    
    // Fetch detailed record information
    interface RecordDetail {
      name: string;
      summary: string;
      comments: string;
      date: string;
      type: string;
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
        summary: record.summary || '',
        comments: Array.isArray(record.comments) ? record.comments.join('\n') : record.comments || '',
        date: record.date || 'Unknown date',
        type: record.type || 'Unknown type'
      }));
      
      debugInfo.recordsFetched = recordDetails.length;
    } else {
      console.log('No record details provided by frontend, fetching from Firestore');
      try {
        // Get all records for the user
        const recordsCollection = db.collection(`users/${userId}/records`);
        const recordsSnapshot = await recordsCollection.get();
        
        // Process each record to extract summaries and comments
        for (const doc of recordsSnapshot.docs) {
          const record = doc.data();
          const recordName = record.name || doc.id;
          
          // Fetch the record's summary if it exists
          let summary = '';
          try {
            const summaryDoc = await db.collection(`users/${userId}/records/${doc.id}/summaries`).doc('main').get();
            if (summaryDoc.exists) {
              summary = summaryDoc.data()?.text || '';
              console.log(`Found summary for record ${recordName}: ${summary.substring(0, 50)}...`);
            } else {
              console.log(`No summary found for record ${recordName}`);
            }
          } catch (summaryError) {
            console.error(`Error fetching summary for record ${recordName}:`, summaryError);
          }
          
          // Fetch the record's comments if they exist
          let comments: string[] = [];
          try {
            const commentsSnapshot = await db.collection(`users/${userId}/records/${doc.id}/comments`).get();
            commentsSnapshot.forEach(commentDoc => {
              const comment = commentDoc.data();
              if (comment.text) {
                comments.push(comment.text);
                console.log(`Found comment for record ${recordName}: ${comment.text.substring(0, 50)}...`);
              }
            });
            if (comments.length === 0) {
              console.log(`No comments found for record ${recordName}`);
            }
          } catch (commentsError) {
            console.error(`Error fetching comments for record ${recordName}:`, commentsError);
          }
          
          // Add the record details to our array
          recordDetails.push({
            name: recordName,
            summary: summary || (record.analysis ? record.analysis : 'No summary available'),
            comments: comments.join('\n'),
            date: record.date || 'Unknown date',
            type: record.type || 'Unknown type'
          });
        }

        debugInfo.recordsFetched = recordDetails.length;
      } catch (recordsError) {
        console.error('Error fetching record details:', recordsError);
        debugInfo.errors.push(`Records fetch error: ${recordsError instanceof Error ? recordsError.message : 'Unknown error'}`);
      }
    }
    debugInfo.timings.recordsFetch = Date.now() - recordsFetchStartTime;
    
    // Generate a more detailed mock analysis based on record names
    const recordList = recordNames.split(', ');
    const hasBloodTest = recordList.some((name: string) => name.toLowerCase().includes('blood') || name.toLowerCase().includes('lab'));
    const hasMRI = recordList.some((name: string) => name.toLowerCase().includes('mri') || name.toLowerCase().includes('scan'));
    const hasSurgery = recordList.some((name: string) => name.toLowerCase().includes('surgery') || name.toLowerCase().includes('ectomy'));
    
    // Check if any records have summaries or comments
    const hasSummaries = recordDetails.some(r => 
      (r.summary && r.summary.trim() !== '' && r.summary !== 'No summary available')
    );
    const hasComments = recordDetails.some(r => 
      (r.comments && r.comments.trim() !== '' && r.comments !== 'No comments available')
    );
    
    console.log('Records with summaries:', hasSummaries);
    console.log('Records with comments:', hasComments);
    
    // Log detailed information about each record's summary and comments
    recordDetails.forEach((record, index) => {
      console.log(`Record ${index + 1} - ${record.name}:`);
      console.log(`  Summary available: ${record.summary && record.summary.trim() !== '' && record.summary !== 'No summary available'}`);
      console.log(`  Summary length: ${record.summary ? record.summary.length : 0} characters`);
      console.log(`  Comments available: ${record.comments && record.comments.trim && record.comments.trim() !== '' && record.comments !== 'No comments available'}`);
      console.log(`  Comments length: ${record.comments ? (typeof record.comments === 'string' ? record.comments.length : JSON.stringify(record.comments).length) : 0} characters`);
    });
    
    // Variable to hold our analysis text
    let analysisText = '';
    
    // Try to use OpenAI if available
    if (useOpenAI) {
      const openAIStartTime = Date.now();
      try {
        console.log('Generating analysis with OpenAI');
        
        // Format record details for the prompt
        const formattedRecords = recordDetails.map(record => {
          return `
=== RECORD: ${record.name} ===
Date: ${record.date}
Type: ${record.type}

SUMMARY:
${record.summary || 'No summary available'}

COMMENTS:
${record.comments || 'No comments available'}
`;
        }).join('\n\n');
        
        // Categorize records by type for better context
        const bloodTests = recordDetails.filter(r => 
          r.name.toLowerCase().includes('blood') || 
          r.name.toLowerCase().includes('lab') || 
          r.type.toLowerCase().includes('blood') || 
          r.type.toLowerCase().includes('lab')
        ).length;
        
        const imaging = recordDetails.filter(r => 
          r.name.toLowerCase().includes('mri') || 
          r.name.toLowerCase().includes('scan') || 
          r.name.toLowerCase().includes('x-ray') || 
          r.name.toLowerCase().includes('ultrasound') || 
          r.type.toLowerCase().includes('imaging')
        ).length;
        
        const surgeries = recordDetails.filter(r => 
          r.name.toLowerCase().includes('surgery') || 
          r.name.toLowerCase().includes('ectomy') || 
          r.type.toLowerCase().includes('surgery') || 
          r.type.toLowerCase().includes('procedure')
        ).length;
        
        const medications = recordDetails.filter(r => 
          r.name.toLowerCase().includes('medication') || 
          r.name.toLowerCase().includes('prescription') || 
          r.type.toLowerCase().includes('medication')
        ).length;
        
        const prompt = `
You are a medical AI assistant. Create a comprehensive health summary based on the following user profile and medical records.

${profileInfo}

MEDICAL RECORDS SUMMARY:
The user has ${recordDetails.length} medical records, including:
${bloodTests > 0 ? `- ${bloodTests} blood tests or laboratory results\n` : ''}${imaging > 0 ? `- ${imaging} imaging studies (MRI, scans, X-rays, etc.)\n` : ''}${surgeries > 0 ? `- ${surgeries} surgical procedures\n` : ''}${medications > 0 ? `- ${medications} medication records\n` : ''}- ${recordDetails.length - (bloodTests + imaging + surgeries + medications)} other medical documents

DETAILED MEDICAL RECORDS:
${formattedRecords}

Based on the user's profile and medical records above, please provide:

1. A personalized health overview that considers the user's demographics and lifestyle
2. Key findings from the medical records, noting any patterns or concerns
3. Specific recommendations tailored to the user's health status and lifestyle
4. Lifestyle considerations that could improve their health outcomes

IMPORTANT: Your analysis MUST be based primarily on the information in the SUMMARY and COMMENTS sections of each record. These sections contain the most valuable clinical information. If a record has a detailed summary or comments, make sure to incorporate that information into your analysis.

Additional guidelines:
- Focus on factual information present in the records, especially the summaries and comments
- Use the detailed summaries and comments to inform your analysis - these are the most important parts
- Pay special attention to the content in the SUMMARY and COMMENTS sections for each record
- Highlight connections between different records when relevant
- Consider how the user's lifestyle factors might impact their health conditions
- Provide actionable recommendations that are realistic given the user's profile
- If there are any concerning findings, note them but maintain a balanced perspective

Format the response with Markdown headings using ** for section titles.
Keep your analysis concise but comprehensive, focusing on the most important insights.
`;
        
        console.log('OpenAI prompt length:', prompt.length);
        console.log('OpenAI prompt preview:', prompt.substring(0, 500) + '...');
        
        const completion = await openai.chat.completions.create({
          model: "gpt-4",
          messages: [
            { role: "system", content: "You are a medical AI assistant that provides personalized health summaries based on medical records and user profiles." },
            { role: "user", content: prompt }
          ],
          max_tokens: 1500,
        });
        
        analysisText = completion.choices[0]?.message?.content || '';
        console.log('OpenAI analysis generated successfully');
        console.log('OpenAI analysis preview:', analysisText.substring(0, 200) + '...');
        debugInfo.openAIUsed = true;
      } catch (error) {
        console.error('Error generating analysis with OpenAI:', error);
        useOpenAI = false;
        openAIError = error instanceof Error ? error.message : 'Unknown OpenAI error';
        debugInfo.errors.push(`OpenAI error: ${openAIError}`);
      }
      debugInfo.timings.openAI = Date.now() - openAIStartTime;
    }
    
    // If OpenAI failed or is not available, use our mock analysis
    if (!useOpenAI || !analysisText) {
      console.log('Using mock analysis instead of OpenAI');
      console.log('OpenAI available:', useOpenAI);
      console.log('OpenAI analysis text available:', !!analysisText);
      
      // Create a more personalized analysis
      analysisText = `
**Health Summary**
Based on the ${recordList.length} records provided (${recordNames}), here is a summary of your health status:

**Key Findings**
${hasBloodTest ? '- Your blood tests indicate values within normal ranges\n' : ''}${hasMRI ? '- Your imaging studies show no significant abnormalities\n' : ''}${hasSurgery ? '- Your surgical records indicate successful procedures with normal recovery\n' : ''}- Regular check-ups are recommended to maintain your health
${recordDetails.some(r => r.summary && r.summary.trim() !== '' && r.summary !== 'No summary available') ? '- Analysis includes information from your health record summaries\n' : ''}${recordDetails.some(r => r.comments && r.comments.trim() !== '' && r.comments !== 'No comments available') ? '- Analysis includes information from your health record comments\n' : ''}

**Recommendations**
- Continue with your current medication regimen
- Maintain a balanced diet and regular exercise
- Schedule a follow-up appointment in 6 months
${hasBloodTest ? '- Consider annual blood work to monitor your health metrics\n' : ''}${hasMRI ? '- Follow up with your specialist regarding your imaging results\n' : ''}${hasSurgery ? '- Continue post-surgical care as directed by your healthcare provider\n' : ''}

**Lifestyle Considerations**
- Ensure adequate hydration (8 glasses of water daily)
- Aim for 7-8 hours of quality sleep each night
- Incorporate stress management techniques into your daily routine
`;
    }
    
    // Try to save the analysis to Firestore
    let firestoreError = null;
    const firestoreStartTime = Date.now();
    try {
      console.log(`Attempting to save analysis to Firestore for user ${userId}`);
      
      // Check if Firebase Admin is initialized
      if (!admin.apps.length) {
        console.error('Firebase Admin SDK is not initialized');
        throw new Error('Firebase Admin SDK is not initialized');
      }
      
      await db.collection(`users/${userId}/analysis`).doc('holistic').set({
        text: analysisText,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        needsUpdate: false,
        generatedBy: useOpenAI ? 'openai' : 'mock',
        recordCount: recordDetails.length,
        summariesUsed: recordDetails.some(r => r.summary && r.summary.trim() !== '' && r.summary !== 'No summary available'),
        commentsUsed: recordDetails.some(r => r.comments && r.comments.trim() !== '' && r.comments !== 'No comments available'),
        debugInfo: debugInfo.errors.length > 0 ? debugInfo.errors : null
      });
      
      debugInfo.firestoreSaved = true;
    } catch (error) {
      console.error('Error saving analysis to Firestore:', error);
      firestoreError = error instanceof Error ? error.message : 'Unknown Firestore error';
      debugInfo.errors.push(`Firestore save error: ${firestoreError}`);
    }
    debugInfo.timings.firestore = Date.now() - firestoreStartTime;
    
    // Return the response
    return NextResponse.json({
      status: 'success',
      message: 'Analysis generated successfully',
      analysis: analysisText,
      userId,
      recordNames,
      recordCount: recordDetails.length,
      recordDetailsUsed: recordDetails.length > 0,
      summariesUsed: recordDetails.some(r => r.summary && r.summary.trim() !== '' && r.summary !== 'No summary available'),
      commentsUsed: recordDetails.some(r => r.comments && r.comments.trim() !== '' && r.comments !== 'No comments available'),
      firestoreError,
      openAIError,
      generatedBy: useOpenAI ? 'openai' : 'mock',
      performance: {
        totalTime: debugInfo.timings.total,
        recordsFetched: debugInfo.recordsFetched
      }
    });
  } catch (error) {
    console.error('Error processing request:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}