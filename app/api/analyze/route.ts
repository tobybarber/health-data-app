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
  
  try {
    // Debug Firebase Admin SDK initialization
    console.log('Firebase Admin SDK initialization status:', admin.apps.length ? 'Initialized' : 'Not initialized');
    
    // Check if OpenAI API key is valid
    const apiKeyStatus = await isApiKeyValid();
    if (!apiKeyStatus.valid) {
      console.error('OpenAI API key validation failed:', apiKeyStatus.message);
      return NextResponse.json(
        { error: 'OpenAI API key validation failed', details: apiKeyStatus.message },
        { status: 500 }
      );
    }
    
    // Parse request body
    const body = await request.json();
    console.log('Request body received:', JSON.stringify(body, null, 2));
    
    const { userId, recordNames } = body;
    
    if (!userId) {
      console.error('Missing userId in request');
      return NextResponse.json(
        { error: 'Missing userId in request' },
        { status: 400 }
      );
    }
    
    // Rest of your existing code...
    
    // For now, return a simple response to test if the API route is working
    return NextResponse.json({
      status: 'success',
      message: 'Analysis API route is working',
      userId,
      recordNames
    });
    
  } catch (error: any) {
    console.error('Error in analyze API route:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

// Update the answerQuestion function to use the correct profile path
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
            content: 'You are a medical AI assistant. Analyze the provided health record summaries and answer the user\'s question based on the information in these summaries. All records belong to the same individual whose profile information is provided. Consider how the patient\'s demographic information, lifestyle factors, and medical history might interact when formulating your response.'
          },
          {
            role: 'user',
            content: `${profileInfo}\n\nI have the following health record summaries for this user:\n\n${summaries.join('\n\n---\n\n')}\n\nBased on these summaries and the user's profile information, please answer this question: ${question}`
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