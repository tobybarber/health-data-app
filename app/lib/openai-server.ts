import OpenAI from 'openai';

// Configure OpenAI client with the API key from environment variables
export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Function to validate OpenAI API key
export async function validateOpenAIKey() {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    return { success: false, message: 'OpenAI API key not found' };
  }
  
  try {
    // Simple API call to check if the key works
    await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'test' }],
      max_tokens: 5
    });
    
    return { success: true, message: 'OpenAI API key is valid' };
  } catch (error) {
    return { 
      success: false, 
      message: `OpenAI API key validation error: ${(error as Error).message}` 
    };
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