import OpenAI from 'openai';

// Initialize OpenAI client with proper configuration for server-side usage
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || ''
});

// Helper function to check if OpenAI API key is valid
export async function isApiKeyValid(): Promise<{ valid: boolean, message: string }> {
  if (!process.env.OPENAI_API_KEY) {
    return { valid: false, message: 'OpenAI API key is missing' };
  }
  
  try {
    // Make a simple API call to test the key
    await openai.models.list();
    return { valid: true, message: 'OpenAI API key is valid' };
  } catch (error: any) {
    return { 
      valid: false, 
      message: `OpenAI API key validation failed: ${error.message || 'Unknown error'}` 
    };
  }
}

export default openai; 