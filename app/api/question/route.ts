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

export async function POST(request: NextRequest) {
  try {
    // Check for API key
    const keyStatus = await isApiKeyValid();
    if (!keyStatus.valid) {
      console.error('Invalid or missing OpenAI API key:', keyStatus.message);
      return NextResponse.json(
        { 
          success: false, 
          message: `OpenAI API key is invalid or has insufficient permissions: ${keyStatus.message}. Please check your API key configuration.`,
          error: 'OPENAI_API_KEY_INVALID'
        },
        { status: 500 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { question, userId } = body;

    console.log('Request body:', { question, userId });

    if (!question) {
      return NextResponse.json(
        { success: false, message: 'Question is required' }, 
        { status: 400 }
      );
    }

    if (!userId) {
      console.error('No userId provided in request');
      return NextResponse.json(
        { 
          success: false, 
          message: 'User ID is required',
          error: 'USER_ID_MISSING'
        },
        { status: 400 }
      );
    }

    // Fetch all records for the user
    console.log(`Fetching all records for user ${userId}`);
    const recordsCollection = db.collection(`users/${userId}/records`);
    const recordsSnapshot = await recordsCollection.get();
    
    // Get summaries from all records
    const summaries = recordsSnapshot.docs.map(doc => {
      const data = doc.data();
      const recordType = data.isManual ? 'Manual Record' : 'Uploaded Record';
      const photoInfo = data.hasPhoto && data.url ? ' (Includes photo)' : '';
      return `Record: ${data.name || 'Unnamed Record'} (${recordType}${photoInfo})
Analysis: ${data.analysis || 'No analysis available'}`;
    });
    
    if (summaries.length === 0) {
      return NextResponse.json(
        { success: false, message: 'No records found for this user' }, 
        { status: 404 }
      );
    }
    
    // Limit the number of summaries to avoid token limits
    const limitedSummaries = summaries.slice(0, 10);
    
    // Get user profile information
    let profileInfo = 'User Profile: Not available';
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
        } else {
          // Try one more path
          const altProfileDoc = await db.collection('profile').doc(userId).get();
          if (altProfileDoc.exists) {
            const profile = altProfileDoc.data();
            
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
    
    // Use the summaries to answer the question
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
            content: `${profileInfo}\n\nI have the following health record summaries for this user:\n\n${limitedSummaries.join('\n\n---\n\n')}\n\nBased on these summaries and the user's profile information, please answer this question: ${question}\n\nPlease format your response using these XML-like tags:\n\n<ANSWER>\nYour detailed answer here.\n</ANSWER>\n\n<RELEVANT_RECORDS>\nList the records that were most relevant to answering this question.\n</RELEVANT_RECORDS>\n\n<ADDITIONAL_CONTEXT>\nProvide any additional context or caveats about your answer.\n</ADDITIONAL_CONTEXT>\n\nIt is CRITICAL that you use these exact XML-like tags in your response to ensure proper formatting.`
          }
        ]
      })
    });
    
    if (chatResponse.ok) {
      const chatData = await chatResponse.json();
      const answer = chatData.choices[0]?.message?.content || 'No answer available';
      
      return NextResponse.json({ 
        success: true, 
        answer
      });
    } else {
      const errorText = await chatResponse.text();
      console.error('OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${chatResponse.status} - ${errorText}`);
    }
  } catch (error: any) {
    console.error('API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to process request', 
        error: error instanceof Error ? error.message : String(error) 
      }, 
      { status: 500 }
    );
  }
} 