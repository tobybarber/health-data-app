import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { db } from '../../lib/firebase-admin';
import { v4 as uuidv4 } from 'uuid';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY as string,
});

// Define request interface
interface QuestionRequest {
  question: string;
  userId: string;
  previousResponseId?: string;
  voicePreference?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer' | 'sage' | 'ash' | 'coral';
  generateAudio?: boolean;
  isGuest?: boolean; // Added to indicate guest users
}

export async function POST(request: NextRequest) {
  console.log('API question route called');
  
  try {
    console.log('Parsing request body');
    const body = await request.json();
    const { 
      question, 
      userId, 
      previousResponseId = 'Not provided',
      generateAudio = false,
      voicePreference = 'alloy' as const,
      isGuest = false
    } = body as QuestionRequest;
    
    console.log('Request received:', {
      question: question?.substring(0, 15) + '...',
      userId: userId?.substring(0, 10) + '...',
      previousResponseId,
      generateAudio,
      voicePreference,
      isGuest
    });
    
    // Validate OpenAI API key
    console.log('Validating OpenAI API key');
    
    try {
      await openai.models.list();
      console.log('OpenAI API key validation successful');
    } catch (validationError) {
      console.error('OpenAI API key validation failed:', validationError);
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid OpenAI API key. Please check your API key and try again.' 
      }, { status: 401 });
    }
    
    // If guest mode is enabled, proceed with a basic chat
    if (isGuest) {
      console.log('Using guest mode');
      try {
        const response = await openai.chat.completions.create({
          model: 'gpt-4-turbo-preview',
          messages: [
            {
              role: 'system',
              content: 'You are a helpful healthcare assistant. Since no health records are provided, you can only give general advice and cannot reference specific health data.'
            },
            { role: 'user', content: question }
          ],
          temperature: 0.7,
        });
        
        const answer = response.choices[0]?.message?.content || 'I apologize, but I was unable to generate a response.';
        
        return NextResponse.json({
          success: true,
          answer,
          audioUrl: null,
          id: uuidv4()
        });
      } catch (openaiError) {
        console.error('Error communicating with OpenAI:', openaiError);
        return NextResponse.json(
          { 
            success: false, 
            error: `Error communicating with OpenAI: ${(openaiError as Error).message}` 
          },
          { status: 500 }
        );
      }
    }
    
    // Start a new conversation with user's records
    console.log(`Starting new conversation, fetching user records for user ID: ${userId}`);
    
    // Get user basic info first
    let userInfo = 'No user information available.';
    try {
      const userDoc = await db.collection('users').doc(userId).get();
      const userData = userDoc.data();
      
      if (userData) {
        userInfo = `User Profile:`;
        if (userData.dateOfBirth) {
          const dob = new Date(userData.dateOfBirth);
          const age = Math.floor((new Date().getTime() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
          userInfo += `\nAge: ${age} years old`;
        }
        
        if (userData.gender) {
          userInfo += `\nGender: ${userData.gender}`;
        }
        
        if (userData.height) {
          userInfo += `\nHeight: ${userData.height}cm`;
        }
        
        if (userData.weight) {
          userInfo += `\nWeight: ${userData.weight}kg`;
        }
        
        if (userData.dietType) {
          userInfo += `\nDiet Type: ${userData.dietType}`;
        }
        
        if (userData.activityLevel) {
          userInfo += `\nActivity Level: ${userData.activityLevel}`;
        }
        
        if (userData.medicalConditions) {
          userInfo += `\nMedical Conditions: ${userData.medicalConditions}`;
        }
        
        if (userData.medications) {
          userInfo += `\nMedications: ${userData.medications}`;
        }
        
        if (userData.allergies) {
          userInfo += `\nAllergies: ${userData.allergies}`;
        }
        
        if (userData.sleepHours) {
          userInfo += `\nTypical Sleep Hours: ${userData.sleepHours}`;
        }
        
        if (userData.stressLevel) {
          userInfo += `\nTypical Stress Level: ${userData.stressLevel}`;
        }
      }
      
      console.log('User data retrieved successfully');
    } catch (userError) {
      console.error('Error fetching user data:', userError);
      userInfo = 'Error retrieving user information.';
    }
    
    // Fetch records from Firestore
    console.log('Querying health records for user');
    let recordsData = '';
    try {
      const recordsSnapshot = await db.collection('users').doc(userId).collection('records').get();
      const records = recordsSnapshot.docs.map(doc => doc.data());
      
      console.log(`Records query returned: ${records.length} RECORDS FOUND`);
      if (records.length > 0) {
        console.log(`First record ID: ${recordsSnapshot.docs[0].id}`);
      }
      
      // Extract the four key fields from each record
      recordsData = records.map((record, index) => {
        return `Record ${index + 1}:
Record Type: ${record.recordType || 'Unknown type'}
Date: ${record.recordDate || 'Unknown date'}
Analysis: ${record.detailedAnalysis || record.analysis || record.briefSummary || 'No analysis available'}
Comment: ${record.comment || 'No comment'}\n\n`;
      }).join('');
      
      console.log(`Processed ${records.length} health records`);
    } catch (recordsError) {
      console.error('Error fetching health records:', recordsError);
      recordsData = 'Error retrieving health records.';
    }
    
    // Create the system message
    const systemMessage = `You are a healthcare AI assistant analyzing the user's health records.
Your goal is to provide helpful, accurate information based on the provided health records and user profile.
Do not make up information not found in the records.
Be empathetic, clear, and direct in your answers.
Always prioritize relevant information from the most recent health records when answering questions.

${userInfo}

== HEALTH RECORDS ==
${recordsData}
`;
    
    try {
      console.log('Making OpenAI API request');
      const response = await openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: question }
        ],
        temperature: 0.5,
      });
      
      console.log('OpenAI API response received successfully');
      const answer = response.choices[0]?.message?.content || 'I apologize, but I was unable to generate a response.';
      
      // Generate unique ID for this response
      const responseId = uuidv4();
      
      // Handle audio generation if requested
      let audioUrl = null;
      if (generateAudio) {
        try {
          console.log('Generating audio for response');
          const audioResponse = await openai.audio.speech.create({
            model: 'tts-1',
            voice: voicePreference,
            input: answer
          });
          
          // Convert to base64
          const buffer = Buffer.from(await audioResponse.arrayBuffer());
          const base64Audio = buffer.toString('base64');
          
          // Create data URL
          audioUrl = `data:audio/mp3;base64,${base64Audio}`;
          console.log('Audio generation successful');
        } catch (audioError) {
          console.error('Error generating audio:', audioError);
          // Continue without audio if there's an error
        }
      }
      
      // Save the conversation to Firestore
      try {
        await db.collection('users').doc(userId).collection('conversations').doc(responseId).set({
          question,
          answer,
          timestamp: new Date(),
          audioUrl
        });
      } catch (saveError) {
        console.error('Error saving conversation:', saveError);
        // Continue even if saving fails
      }
      
      console.log('Returning successful response');
      return NextResponse.json({
        success: true,
        answer,
        audioUrl,
        id: responseId
      });
    } catch (openaiError) {
      console.error('Error communicating with OpenAI:', openaiError);
      return NextResponse.json(
        { 
          success: false, 
          error: `Error communicating with OpenAI: ${(openaiError as Error).message}` 
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Unexpected error in question processing:', error);
    return NextResponse.json(
      { success: false, error: `Unexpected error: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}