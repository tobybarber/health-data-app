import OpenAI from 'openai';

// Configure OpenAI client with the API key from environment variables
export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Cache for API key validation
let apiKeyValidationCache: {
  success: boolean;
  message: string;
  timestamp: number;
} | null = null;

// Cache duration in milliseconds (5 minutes)
const CACHE_DURATION = 5 * 60 * 1000;

// Function to validate OpenAI API key
export async function validateOpenAIKey() {
  const now = Date.now();
  
  // If we have a cached result that's still valid, return it
  if (apiKeyValidationCache && now - apiKeyValidationCache.timestamp < CACHE_DURATION) {
    return {
      success: apiKeyValidationCache.success,
      message: apiKeyValidationCache.message
    };
  }
  
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    const result = { success: false, message: 'OpenAI API key not found' };
    apiKeyValidationCache = { ...result, timestamp: now };
    return result;
  }
  
  try {
    // Simple API call to check if the key works
    await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'test' }],
      max_tokens: 5
    });
    
    const result = { success: true, message: 'OpenAI API key is valid' };
    apiKeyValidationCache = { ...result, timestamp: now };
    return result;
  } catch (error) {
    const result = { 
      success: false, 
      message: `OpenAI API key validation error: ${(error as Error).message}` 
    };
    apiKeyValidationCache = { ...result, timestamp: now };
    return result;
  }
}

// For backwards compatibility
export async function isApiKeyValid() {
  const result = await validateOpenAIKey();
  // Convert success/message format to valid/message format
  return {
    valid: result.success,
    message: result.message
  };
}

export default openai; 