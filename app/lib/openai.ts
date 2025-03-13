import OpenAI from 'openai';

// Initialize OpenAI client with proper configuration
// Use a dummy API key if none is provided to prevent initialization errors
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy-key-for-initialization-only',
  dangerouslyAllowBrowser: true // Allow client-side usage
});

// Export a function to check if the API key is valid
// This function is safe to call from client components
export async function isApiKeyValid(): Promise<boolean> {
  try {
    // In client components, we can't directly check the API key
    // So we'll make a simple API call to our backend
    const response = await fetch('/api/check-api-key');
    const data = await response.json();
    return data.valid;
  } catch (error) {
    console.error('Error checking API key:', error);
    return false;
  }
}

export default openai; 