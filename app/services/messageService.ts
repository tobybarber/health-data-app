import { Message } from '../types/chat';

export const processChatResponse = (response: string): string => {
  if (!response) return '';
  
  // Extract content from XML-like tags
  const extractTagContent = (text: string, tagName: string) => {
    const regex = new RegExp(`<${tagName}>\\s*([\\s\\S]*?)\\s*<\\/${tagName}>`, 'i');
    const match = text.match(regex);
    return match ? match[1].trim() : null;
  };

  // Check if the text contains XML-like tags
  const hasXmlTags = /<[A-Z_]+>[\s\S]*?<\/[A-Z_]+>/i.test(response);
  
  if (hasXmlTags) {
    // Extract content from each section
    const answer = extractTagContent(response, 'ANSWER') || '';
    const relevantRecords = extractTagContent(response, 'RELEVANT_RECORDS');
    const additionalContext = extractTagContent(response, 'ADDITIONAL_CONTEXT');
    
    // Combine sections with proper formatting
    let formattedResponse = answer;
    
    if (relevantRecords) {
      formattedResponse += '\n\nRelevant Records:\n' + relevantRecords;
    }
    
    if (additionalContext) {
      formattedResponse += '\n\nAdditional Context:\n' + additionalContext;
    }
    
    return formattedResponse;
  }
  
  // If no XML tags, return the original response
  return response;
};

export const loadMessages = (userId: string): Message[] => {
  if (typeof window === 'undefined') return [];
  
  const savedMessages = localStorage.getItem(`chat_messages_${userId}`);
  if (savedMessages) {
    try {
      return JSON.parse(savedMessages);
    } catch (e) {
      console.error('Error parsing saved messages:', e);
      return [];
    }
  }
  return [];
};

export const saveMessages = (userId: string, messages: Message[]): void => {
  if (typeof window === 'undefined') return;
  
  if (messages.length > 0) {
    try {
      // Create a copy of messages without audioData to save storage space
      const messagesForStorage = messages.map(msg => ({
        ...msg,
        audioData: undefined // Remove audio data before storing
      }));
      
      localStorage.setItem(`chat_messages_${userId}`, JSON.stringify(messagesForStorage));
    } catch (error) {
      console.error('Error saving chat messages to local storage:', error);
      // If storage fails, try clearing localStorage
      localStorage.removeItem(`chat_messages_${userId}`);
    }
  } else {
    localStorage.removeItem(`chat_messages_${userId}`);
  }
};

interface MessageResponse {
  message: string;
  responseId?: string;
  audioData?: string;
  performance?: any;
}

/**
 * Sends a message to the AI service and returns the response
 */
export async function sendMessage(
  text: string, 
  previousMessages: Message[], 
  userId: string, 
  wasVoiceInput: boolean
): Promise<MessageResponse> {
  const requestStartTime = performance.now();
  
  try {
    // Get the previous response ID if it exists in the last message
    const previousResponseId = previousMessages.length > 0 ? previousMessages[previousMessages.length - 1].responseId : undefined;
    
    console.log('Sending message to API, request start time:', requestStartTime);
    
    // Make the API call to the question endpoint
    const response = await fetch('/api/question', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        question: text,
        userId,
        previousResponseId,
        generateAudio: wasVoiceInput,
        voicePreference: 'alloy',
        isGuest: userId === 'guest-user'
      }),
    });

    const responseEndTime = performance.now();
    const roundTripTime = responseEndTime - requestStartTime;
    console.log(`Message round-trip time: ${Math.round(roundTripTime)}ms`);

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Failed to get AI response');
    }
    
    // Log performance data if available
    if (data.performance) {
      console.log('API Performance metrics:', data.performance);
    }
    
    return {
      message: processChatResponse(data.answer),
      responseId: data.id,
      audioData: data.audioUrl,
      performance: data.performance
    };
  } catch (error) {
    console.error('Error in message service:', error);
    return {
      message: 'Sorry, I encountered an error. Please try again.',
    };
  }
} 