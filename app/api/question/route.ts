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

// Add type definition for conversation history
type ConversationMessage = {
  role: 'user' | 'assistant';
  content: string;
};

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

    // If we have a previousResponseId, fetch the conversation history
    let conversationHistory: ConversationMessage[] = [];
    let cachedUserInfo = '';
    let cachedRecordsData = '';
    
    if (previousResponseId && previousResponseId !== 'Not provided') {
      try {
        const conversationDoc = await db.collection('users').doc(userId).collection('conversations').doc(previousResponseId).get();
        if (conversationDoc.exists) {
          const conversationData = conversationDoc.data();
          if (conversationData?.question && conversationData?.answer) {
            conversationHistory = [
              { role: 'user', content: conversationData.question },
              { role: 'assistant', content: conversationData.answer }
            ];
            // Get cached data if available
            cachedUserInfo = conversationData.userInfo || '';
            cachedRecordsData = conversationData.recordsData || '';
          }
        }
      } catch (historyError) {
        console.error('Error fetching conversation history:', historyError);
      }
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
            ...conversationHistory,
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
    
    // Start a conversation with user's records
    console.log(`Starting conversation, fetching user records for user ID: ${userId}`);
    
    // Get user basic info and records in parallel
    let userInfo = cachedUserInfo;
    let recordsData = cachedRecordsData;
    
    if (!userInfo || !recordsData) {
      console.log('Fetching fresh user data and health records');
      try {
        const [userDoc, recordsSnapshot] = await Promise.all([
          !userInfo ? db.collection('users').doc(userId).get() : Promise.resolve(null),
          !recordsData ? db.collection('users').doc(userId).collection('records').get() : Promise.resolve(null)
        ]);

        // Process user data if needed
        if (!userInfo && userDoc) {
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
        }

        // Process records if needed
        if (!recordsData && recordsSnapshot) {
          const records = recordsSnapshot.docs.map(doc => doc.data());
          console.log(`Records query returned: ${records.length} RECORDS FOUND`);
          if (records.length > 0) {
            console.log(`First record ID: ${recordsSnapshot.docs[0].id}`);
          }
          
          recordsData = records.map((record, index) => {
            return `Record ${index + 1}:
Record Type: ${record.recordType || 'Unknown type'}
Date: ${record.recordDate || 'Unknown date'}
Analysis: ${record.detailedAnalysis || record.analysis || record.briefSummary || 'No analysis available'}
Comment: ${record.comment || 'No comment'}\n\n`;
          }).join('');
          
          console.log(`Processed ${records.length} health records`);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        if (!userInfo) userInfo = 'Error retrieving user information.';
        if (!recordsData) recordsData = 'Error retrieving health records.';
      }
    }
    
    // Create a more concise system message
    const systemMessage = `You are a healthcare AI assistant. Analyze the user's health records and profile to provide accurate, helpful information.

User Profile:
${userInfo}

Health Records:
${recordsData}

Guidelines:
- Use only information from the provided records
- Prioritize recent records
- Be clear and direct
- Be empathetic`;
    
    try {
      console.log('Making OpenAI API request');
      const response = await openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          { role: 'system', content: systemMessage },
          ...conversationHistory,
          { role: 'user', content: question }
        ],
        temperature: 0.3, // Lower temperature for more focused responses
        max_tokens: 500, // Limit response length for faster processing
        presence_penalty: 0, // Reduce repetition
        frequency_penalty: 0 // Reduce repetition
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
      
      // Save the conversation to Firestore with cached data
      try {
        await db.collection('users').doc(userId).collection('conversations').doc(responseId).set({
          question,
          answer,
          timestamp: new Date(),
          audioUrl,
          previousResponseId: previousResponseId !== 'Not provided' ? previousResponseId : null,
          userInfo, // Cache the user info
          recordsData // Cache the records data
        });
      } catch (saveError) {
        console.error('Error saving conversation:', saveError);
        // Continue even if saving fails
      }
      
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
    console.error('API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: `API error: ${(error as Error).message}` 
      },
      { status: 500 }
    );
  }
}