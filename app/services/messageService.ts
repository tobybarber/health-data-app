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
    localStorage.setItem(`chat_messages_${userId}`, JSON.stringify(messages));
  } else {
    localStorage.removeItem(`chat_messages_${userId}`);
  }
};

export const sendMessage = async (
  message: string,
  history: Message[],
  userId: string,
  wasVoiceInput: boolean = false
): Promise<{ message: string; responseId?: string; audioData?: string }> => {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      history,
      wasVoiceInput,
      userId
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to get AI response');
  }

  const data = await response.json();
  return {
    message: processChatResponse(data.message),
    responseId: data.responseId,
    audioData: data.audioData
  };
}; 